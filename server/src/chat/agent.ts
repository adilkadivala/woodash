import type { Response } from 'express';
import { prisma } from '../db/client.js';
import { config } from '../config.js';
import type { Principal } from '../auth/principal.js';
import type { UpstreamManager } from '../upstream/manager.js';
import { listAllTools } from '../aggregator/listTools.js';
import { executeTool } from '../executor/executeTool.js';
import { chatCompletion } from './llm.js';
import type { LlmMessage } from './llm.js';
import { mcpToolsToLlmTools, parseFunctionArgs } from './toolBridge.js';
import { sendEvent } from './stream.js';

export async function runChatAgent(
  manager: UpstreamManager,
  principal: Principal,
  conversationId: string,
  userMessage: string,
  res: Response,
): Promise<void> {
  try {
    if (!config.LLM_API_KEY) {
      sendEvent(res, 'error', { message: 'LLM API key is not configured' });
      sendEvent(res, 'done', {});
      return;
    }

    const availableTools = await listAllTools(manager, principal);
    const llmTools = mcpToolsToLlmTools(availableTools);

    let dbMessages: any[] = [];
    try {
      dbMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' }
      });
    } catch (err) {
      console.warn('Could not load history:', err);
    }

    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: `You are a helpful assistant with access to tools. Use the available tools to answer the user's questions.
When you need to call a tool, use the function calling capability.
Tool names are in the format 'server__tool' (e.g., 'woo__list_orders').
Always explain what you're doing and present results clearly.`
      }
    ];

    for (const msg of dbMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content || undefined });
      }
    }

    messages.push({ role: 'user', content: userMessage });

    try {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: userMessage,
        }
      });
    } catch (err) {
      console.warn('Could not save user message:', err);
    }

    let iterations = 0;
    let totalToolCalls = 0;
    const MAX_ITERATIONS = 10;
    const MAX_TOOL_CALLS = 20;
    let lastToolCalls: string[] = [];
    let assistantFinalMessage: LlmMessage | null = null;
    let finishReason = '';

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await chatCompletion(messages, llmTools.length > 0 ? llmTools : undefined);
      finishReason = response.finish_reason;

      const assistantMsg: LlmMessage = {
        role: 'assistant',
        content: response.content || undefined,
        tool_calls: response.tool_calls || undefined
      };
      
      messages.push(assistantMsg);

      if (response.content) {
        sendEvent(res, 'token', { text: response.content });
      }

      if (response.tool_calls && response.tool_calls.length > 0) {
        const currentCalls = response.tool_calls.map(tc => `${tc.function.name}:${tc.function.arguments}`);
        
        const isIdentical = currentCalls.length === lastToolCalls.length && 
          currentCalls.every((call, i) => call === lastToolCalls[i]);
          
        if (isIdentical) {
          messages.push({
            role: 'user',
            content: 'You are repeating the exact same tool calls. Please answer with the information you have or try a different approach.'
          });
          continue;
        }
        
        lastToolCalls = currentCalls;
        
        for (const tc of response.tool_calls) {
          totalToolCalls++;
          if (totalToolCalls > MAX_TOOL_CALLS) {
            break;
          }

          sendEvent(res, 'tool_call', {
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          });

          const args = parseFunctionArgs(tc.function.arguments);
          let toolResultContent: string;
          const toolStart = Date.now();
          let ok = true;

          try {
            const toolResult = await executeTool(manager, principal, tc.function.name, args, { via: 'chat' });

            if (toolResult.isError) {
              ok = false;
              toolResultContent = JSON.stringify({ error: true, content: toolResult.content });
            } else {
              toolResultContent = JSON.stringify(toolResult.content);
            }
          } catch (err: any) {
            ok = false;
            toolResultContent = JSON.stringify({ error: true, message: err.message });
          }

          const durationMs = Date.now() - toolStart;
          let summary = toolResultContent.slice(0, 240);
          try {
            const parsed = JSON.parse(toolResultContent);
            const textPart = Array.isArray(parsed)
              ? parsed.find((p: { type?: string; text?: string }) => p.type === 'text')?.text
              : parsed?.content?.[0]?.text ?? parsed?.message;
            if (typeof textPart === 'string') summary = textPart.slice(0, 240);
          } catch {
            /* keep raw summary */
          }

          sendEvent(res, 'tool_result', {
            id: tc.id,
            name: tc.function.name,
            ok,
            durationMs,
            result: toolResultContent,
            summary,
          });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: toolResultContent
          });
        }
        
        if (totalToolCalls > MAX_TOOL_CALLS) {
          messages.push({
            role: 'user',
            content: 'You have reached the maximum number of allowed tool calls. Please answer with the information you have gathered so far.'
          });
        }
      } else if (finishReason === 'stop' || !response.tool_calls) {
        assistantFinalMessage = assistantMsg;
        break;
      }
    }

    if (iterations >= MAX_ITERATIONS && !assistantFinalMessage) {
      messages.push({
        role: 'user',
        content: 'You have reached the maximum number of iterations. Please provide your final answer now.'
      });
      const finalResp = await chatCompletion(messages);
      assistantFinalMessage = {
        role: 'assistant',
        content: finalResp.content || undefined
      };
      if (finalResp.content) {
         sendEvent(res, 'token', { text: finalResp.content });
      }
    }

    if (assistantFinalMessage && assistantFinalMessage.content) {
      try {
        await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: assistantFinalMessage.content,
          }
        });
      } catch (err) {
        console.warn('Could not save assistant message:', err);
      }
    }

    sendEvent(res, 'done', {});

  } catch (error: any) {
    console.error('Chat agent error:', error);
    sendEvent(res, 'error', { message: error.message || 'An error occurred during chat' });
    sendEvent(res, 'done', {});
  }
}

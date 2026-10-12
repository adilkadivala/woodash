import { config } from '../config.js';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export interface LlmTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

export interface LlmResponse {
  content: string | null;
  tool_calls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> | null;
  finish_reason: string;
}

export async function chatCompletion(
  messages: LlmMessage[],
  tools?: LlmTool[],
): Promise<LlmResponse> {
  if (!config.LLM_API_KEY) {
    throw new Error('LLM_API_KEY is not configured');
  }

  const payload: any = {
    model: config.LLM_MODEL || 'gpt-4o',
    messages,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const response = await fetch(`${config.LLM_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.LLM_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error: ${response.status} ${response.statusText} - ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: {
        content?: string | null;
        tool_calls?: LlmResponse['tool_calls'];
      };
      finish_reason: string;
    }>;
  };
  const choice = data.choices[0];

  return {
    content: choice.message.content || null,
    tool_calls: choice.message.tool_calls || null,
    finish_reason: choice.finish_reason,
  };
}

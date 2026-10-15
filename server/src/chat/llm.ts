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

function isOpenRouter(): boolean {
  const key = config.LLM_API_KEY;
  const base = config.LLM_BASE_URL;
  return key.startsWith('sk-or-') || base.includes('openrouter.ai');
}

function resolveBaseUrl(): string {
  if (isOpenRouter()) return 'https://openrouter.ai/api/v1';
  return (config.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
}

function resolveModel(): string {
  const model = config.LLM_MODEL || 'openai/gpt-4o-mini';
  if (isOpenRouter() && !model.includes('/')) {
    return `openai/${model}`;
  }
  return model;
}

export async function chatCompletion(
  messages: LlmMessage[],
  tools?: LlmTool[],
): Promise<LlmResponse> {
  if (!config.LLM_API_KEY) {
    throw new Error('LLM_API_KEY is not configured');
  }

  const payload: Record<string, unknown> = {
    model: resolveModel(),
    messages,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.LLM_API_KEY}`,
  };

  if (isOpenRouter()) {
    headers['HTTP-Referer'] = config.CORS_ORIGIN || 'http://localhost:3000';
    headers['X-Title'] = 'MCP Gateway';
  }

  const response = await fetch(`${resolveBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers,
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

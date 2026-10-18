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

function resolveBaseUrl(): string {
  return (config.LLM_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/$/, '');
}

function resolveModel(): string {
  return config.LLM_MODEL || 'gpt-oss:120b-cloud';
}

function isOpenRouter(): boolean {
  return resolveBaseUrl().includes('openrouter.ai');
}

function isLocalOllama(): boolean {
  const base = resolveBaseUrl().toLowerCase();
  return (
    base.includes(':11434') ||
    base.includes(':11435') ||
    base.includes('ollama')
  );
}

export function isLlmConfigured(): boolean {
  return Boolean(config.LLM_API_KEY) || isLocalOllama();
}

export async function chatCompletion(
  messages: LlmMessage[],
  tools?: LlmTool[],
): Promise<LlmResponse> {
  if (!isLlmConfigured()) {
    throw new Error('LLM is not configured (set LLM_BASE_URL for Ollama or LLM_API_KEY)');
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
  };
  if (config.LLM_API_KEY) {
    headers.Authorization = `Bearer ${config.LLM_API_KEY}`;
  }

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

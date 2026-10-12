import type { LlmTool } from './llm.js';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  serverSlug?: string;
}

export function mcpToolsToLlmTools(mcpTools: McpTool[]): LlmTool[] {
  return mcpTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

export function parseFunctionArgs(argsStr: string): Record<string, unknown> {
  if (!argsStr || argsStr.trim() === '') {
    return {};
  }
  try {
    const parsed = JSON.parse(argsStr);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    console.error('Failed to parse function arguments:', error);
    return {};
  }
}

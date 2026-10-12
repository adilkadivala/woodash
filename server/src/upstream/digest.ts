import crypto from 'crypto';

export interface ToolDeclaration {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export function computeToolsDigest(tools: ToolDeclaration[]): string {
  const sortedTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(sortedTools));
  return hash.digest('hex');
}

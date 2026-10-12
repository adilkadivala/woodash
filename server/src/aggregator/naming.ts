export const SEPARATOR = '__';

export function encodeToolName(slug: string, tool: string): string {
  return `${slug}${SEPARATOR}${tool}`;
}

export function decodeToolName(namespaced: string): { slug: string, tool: string } | null {
  const parts = namespaced.split(SEPARATOR);
  if (parts.length < 2) {
    return null;
  }
  const slug = parts[0];
  const tool = parts.slice(1).join(SEPARATOR);
  return { slug, tool };
}

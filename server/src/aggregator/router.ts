import { UpstreamManager } from '../upstream/manager.js';
import { decodeToolName } from './naming.js';
import { UpstreamClient } from '../upstream/client.js';

export function routeToolCall(
  manager: UpstreamManager, 
  namespacedName: string
): { client: UpstreamClient, originalTool: string, slug: string } | null {
  const decoded = decodeToolName(namespacedName);
  
  if (!decoded) {
    return null;
  }
  
  const client = manager.getClient(decoded.slug);
  
  if (!client) {
    return null;
  }
  
  return {
    client,
    originalTool: decoded.tool,
    slug: decoded.slug
  };
}

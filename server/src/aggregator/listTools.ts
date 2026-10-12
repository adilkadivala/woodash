import { UpstreamManager } from '../upstream/manager.js';
import { encodeToolName } from './naming.js';
import type { Principal } from '../auth/principal.js';
import { prisma } from '../db/client.js';
import { checkPolicy } from '../policy/engine.js';

export interface AggregatedTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  serverSlug: string;
  serverName: string;
}

export async function listAllTools(
  manager: UpstreamManager, 
  principal: Principal
): Promise<AggregatedTool[]> {
  const slugs = manager.getAllSlugs();
  const tools: AggregatedTool[] = [];
  const serverMeta = await prisma.upstreamServer.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, name: true },
  });
  const nameBySlug = new Map(serverMeta.map((s) => [s.slug, s.name]));

  const promises = slugs.map(async (slug) => {
    const client = manager.getClient(slug);
    const breaker = manager.getBreaker(slug);
    
    if (!client || !client.isConnected() || (breaker && breaker.isOpen())) {
      return [];
    }
    
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );
    
    try {
      const serverTools = await Promise.race([
        client.listTools(),
        timeoutPromise
      ]) as any[];
      
      if (breaker) breaker.recordSuccess();
      
      const filtered = [];
      for (const t of serverTools) {
        const decision = await checkPolicy(principal, slug, t.name);
        if (decision === 'deny') continue;
        filtered.push({
          name: encodeToolName(slug, t.name),
          description: t.description,
          inputSchema: t.inputSchema,
          serverSlug: slug,
          serverName: nameBySlug.get(slug) ?? slug,
        });
      }
      return filtered;
    } catch (error) {
      console.error(`Error listing tools for ${slug}:`, error);
      if (breaker) breaker.recordFailure();
      return [];
    }
  });
  
  const results = await Promise.allSettled(promises);
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      tools.push(...result.value);
    }
  }
  
  return tools;
}

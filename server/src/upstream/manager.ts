import { UpstreamClient } from './client.js';
import { CircuitBreaker } from './breaker.js';
import { prisma } from '../db/client.js';
import { decryptCredential } from '../security/crypto.js';
import { checkServerHealth } from './health.js';

/**
 * Manages all upstream MCP server clients and their circuit breakers.
 * Owns the lifecycle: add, remove, enable, disable, refresh.
 */
export class UpstreamManager {
  private clients: Map<string, UpstreamClient> = new Map();
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Load all enabled servers from DB and connect clients.
   */
  async initialize(): Promise<void> {
    const servers = await prisma.upstreamServer.findMany({
      where: { enabled: true },
    });

    // Connect in parallel so one slow upstream doesn't delay boot for the rest.
    await Promise.allSettled(servers.map(async (server) => {
      let credential: string | undefined;
      if (server.credentialEnc) {
        try {
          credential = decryptCredential(server.credentialEnc);
        } catch (err) {
          console.error(`[upstream] Failed to decrypt credential for ${server.slug}:`, err);
        }
      }

      await this.addServer(
        server.slug,
        server.url,
        server.authType,
        server.authHeaderName ?? undefined,
        credential,
      );
    }));
  }

  /**
   * Register and connect an upstream server.
   */
  async addServer(
    slug: string,
    url: string,
    authType: string,
    authHeaderName?: string,
    credential?: string,
  ): Promise<void> {
    // Remove existing client if re-adding
    if (this.clients.has(slug)) {
      await this.removeServer(slug);
    }

    const client = new UpstreamClient(slug, url, authType, authHeaderName, credential);
    this.clients.set(slug, client);
    this.breakers.set(slug, new CircuitBreaker());

    try {
      await client.connect();
      console.log(`[upstream] Connected to ${slug} at ${url}`);
    } catch (error) {
      console.error(`[upstream] Failed to connect to ${slug}:`, error);
    }
    // Persist real status now instead of waiting for the next health tick.
    await checkServerHealth(this, slug);
  }

  /**
   * Disconnect and remove an upstream server.
   */
  async removeServer(slug: string): Promise<void> {
    const client = this.clients.get(slug);
    if (client) {
      try {
        await client.disconnect();
      } catch (error) {
        console.error(`[upstream] Error disconnecting ${slug}:`, error);
      }
      this.clients.delete(slug);
    }
    this.breakers.delete(slug);
  }

  /**
   * Enable a server — reconnect if disconnected.
   */
  async enableServer(slug: string): Promise<void> {
    const client = this.clients.get(slug);
    if (client && !client.isConnected()) {
      try {
        await client.connect();
      } catch (error) {
        console.error(`[upstream] Error enabling ${slug}:`, error);
      }
    } else if (!client) {
      // Client doesn't exist, load from DB
      const server = await prisma.upstreamServer.findUnique({ where: { slug } });
      if (server) {
        let credential: string | undefined;
        if (server.credentialEnc) {
          try {
            credential = decryptCredential(server.credentialEnc);
          } catch (err) {
            console.error(`[upstream] Failed to decrypt credential for ${slug}:`, err);
          }
        }
        await this.addServer(
          server.slug,
          server.url,
          server.authType,
          server.authHeaderName ?? undefined,
          credential,
        );
      }
    }
  }

  /**
   * Disable a server — disconnect but don't remove from memory.
   */
  async disableServer(slug: string): Promise<void> {
    const client = this.clients.get(slug);
    if (client) {
      try {
        await client.disconnect();
      } catch (error) {
        console.error(`[upstream] Error disconnecting ${slug}:`, error);
      }
      this.clients.delete(slug);
    }
    this.breakers.delete(slug);
  }

  /**
   * Get the client for a server slug.
   */
  getClient(slug: string): UpstreamClient | undefined {
    return this.clients.get(slug);
  }

  /**
   * Get the circuit breaker for a server slug.
   * Returns a default closed breaker if none exists.
   */
  getBreaker(slug: string): CircuitBreaker {
    let breaker = this.breakers.get(slug);
    if (!breaker) {
      breaker = new CircuitBreaker();
      this.breakers.set(slug, breaker);
    }
    return breaker;
  }

  /**
   * Get all enabled/connected server slugs.
   */
  getAllSlugs(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Reconnect a server — disconnect then reconnect.
   */
  async refreshServer(slug: string): Promise<void> {
    const server = await prisma.upstreamServer.findUnique({ where: { slug } });
    if (!server || !server.enabled) {
      await this.removeServer(slug);
      return;
    }

    let credential: string | undefined;
    if (server.credentialEnc) {
      try {
        credential = decryptCredential(server.credentialEnc);
      } catch (err) {
        console.error(`[upstream] Failed to decrypt credential for ${slug}:`, err);
      }
    }

    await this.addServer(
      server.slug,
      server.url,
      server.authType,
      server.authHeaderName ?? undefined,
      credential,
    );
    console.log(`[upstream] Refreshed ${slug}`);
  }

  /**
   * Get all active clients.
   */
  getAllClients(): Map<string, UpstreamClient> {
    return this.clients;
  }
}

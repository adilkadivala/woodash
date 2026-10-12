import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Wraps an MCP client connection to a single upstream server.
 * Handles auth headers, connection lifecycle, tool listing, and tool calling.
 */
export class UpstreamClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private connected = false;

  constructor(
    public readonly serverSlug: string,
    private readonly url: string,
    private readonly authType: string,
    private readonly authHeaderName?: string,
    private readonly credential?: string,
  ) {}

  /**
   * Connect to the upstream MCP server.
   */
  async connect(): Promise<void> {
    const headers: Record<string, string> = {};
    if (this.authType === 'bearer' && this.credential) {
      headers['Authorization'] = `Bearer ${this.credential}`;
    } else if (this.authType === 'header' && this.authHeaderName && this.credential) {
      headers[this.authHeaderName] = this.credential;
    }

    this.transport = new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit: { headers },
    });

    this.client = new Client(
      { name: 'mcp-gateway', version: '1.0.0' },
      { capabilities: {} },
    );

    await this.client.connect(this.transport);
    this.connected = true;
  }

  /**
   * List all tools advertised by this upstream.
   */
  async listTools(): Promise<Array<{ name: string; description?: string; inputSchema?: unknown }>> {
    if (!this.client || !this.connected) {
      throw new Error(`Not connected to upstream '${this.serverSlug}'`);
    }
    const response = await this.client.listTools();
    return (response.tools ?? []) as Array<{ name: string; description?: string; inputSchema?: unknown }>;
  }

  /**
   * Call a tool on this upstream server.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text?: string; [key: string]: unknown }>; isError?: boolean }> {
    if (!this.client || !this.connected) {
      throw new Error(`Not connected to upstream '${this.serverSlug}'`);
    }
    const result = await this.client.callTool({ name, arguments: args });
    return {
      content: (result.content ?? []) as Array<{ type: string; text?: string; [key: string]: unknown }>,
      isError: result.isError as boolean | undefined,
    };
  }

  /**
   * Disconnect from the upstream.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore close errors
      }
    }
    this.connected = false;
    this.client = null;
    this.transport = null;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import dotenv from 'dotenv';
import * as z from 'zod/v4';
import { createMcpHttpApp } from '../../mcp-servers/shared/createServer.js';
import * as store from './store.js';


dotenv.config();

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'notes-mcp', version: '1.0.0' }, { capabilities: {} });

  server.registerTool(
    'save_note',
    {
      description: 'Save a short note (in-memory demo store).',
      inputSchema: {
        title: z.string().min(1),
        body: z.string().min(1),
      },
    },
    async ({ title, body }) => {
      const note = store.saveNote(title, body);
      return { content: [{ type: 'text', text: JSON.stringify({ note }) }] };
    },
  );

  server.registerTool(
    'list_notes',
    {
      description: 'List saved notes.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ limit }) => {
      const notes = store.listNotes(limit ?? 20);
      return { content: [{ type: 'text', text: JSON.stringify({ notes }) }] };
    },
  );

  server.registerTool(
    'get_note',
    {
      description: 'Fetch a note by id.',
      inputSchema: {
        id: z.string().min(1),
      },
    },
    async ({ id }) => {
      const note = store.getNote(id);
      if (!note) {
        return { content: [{ type: 'text', text: `Note ${id} not found` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ note }) }] };
    },
  );

  return server;
}

const port = Number(process.env.PORT || 4003);
const app = createMcpHttpApp({
  bearerToken: process.env.MCP_BEARER_TOKEN || 'notes-mcp-bearer-token',
  createServer: buildMcpServer,
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[notes-mcp] listening on http://0.0.0.0:${port}/mcp`);
});

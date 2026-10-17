import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import dotenv from 'dotenv';
import * as z from 'zod/v4';
import { createMcpHttpApp, listenWithGracefulShutdown } from '../../mcp-servers/shared/createServer.js';
import { evaluateExpression } from './calc.js';

dotenv.config();

const FX: Record<string, Record<string, number>> = {
  USD: { EUR: 0.92, GBP: 0.79, JPY: 150.2 },
  EUR: { USD: 1.09, GBP: 0.86, JPY: 163.5 },
  GBP: { USD: 1.27, EUR: 1.16, JPY: 190.1 },
};

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'utils-mcp', version: '1.0.0' }, { capabilities: {} });

  server.registerTool(
    'current_time',
    {
      description: 'Current date/time for a timezone (IANA name).',
      inputSchema: {
        timezone: z.string().default('UTC').describe('IANA timezone, e.g. Asia/Tokyo'),
      },
    },
    async ({ timezone }) => {
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(new Date());
      return { content: [{ type: 'text', text: JSON.stringify({ timezone, formatted }) }] };
    },
  );

  server.registerTool(
    'calculate',
    {
      description: 'Evaluate a math expression (+ - * / parentheses).',
      inputSchema: {
        expression: z.string().min(1).describe('Expression such as (12 + 4) * 2'),
      },
    },
    async ({ expression }) => {
      const value = evaluateExpression(expression);
      return { content: [{ type: 'text', text: JSON.stringify({ expression, value }) }] };
    },
  );

  server.registerTool(
    'convert_currency',
    {
      description: 'Convert amount between fiat currencies (demo static rates).',
      inputSchema: {
        from: z.string().min(3).max(3),
        to: z.string().min(3).max(3),
        amount: z.number(),
      },
    },
    async ({ from, to, amount }) => {
      const src = from.toUpperCase();
      const dst = to.toUpperCase();
      let rate = 1;
      if (src === dst) rate = 1;
      else if (FX[src]?.[dst]) rate = FX[src][dst];
      else throw new Error(`Unsupported pair ${src}->${dst}`);
      const converted = Math.round(amount * rate * 100) / 100;
      return {
        content: [{ type: 'text', text: JSON.stringify({ from: src, to: dst, amount, rate, converted }) }],
      };
    },
  );

  return server;
}

const port = Number(process.env.PORT || 4002);
const app = createMcpHttpApp({ createServer: buildMcpServer });
listenWithGracefulShutdown(app, port, 'utils-mcp');

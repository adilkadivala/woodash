import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import dotenv from 'dotenv';
import * as z from 'zod/v4';
import { createMcpHttpApp } from '../../mcp-servers/shared/createServer.js';
import * as woo from './wooClient.js';

dotenv.config();

const ORDER_STATUSES = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded'] as const;

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'woo-mcp', version: '1.0.0' }, { capabilities: {} });

  server.registerTool(
    'list_products',
    {
      description: 'List products from the WooCommerce store (projected fields, capped list).',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe('Max products to return'),
      },
    },
    async ({ limit }) => {
      const products = await woo.listProducts(limit ?? 20);
      return { content: [{ type: 'text', text: JSON.stringify({ products, truncated: false }, null, 2) }] };
    },
  );

  server.registerTool(
    'create_product',
    {
      description: 'Create a new WooCommerce product.',
      inputSchema: {
        name: z.string().min(1).describe('Product name'),
        price: z.string().describe('Regular price'),
        description: z.string().optional().describe('Product description'),
      },
    },
    async (input) => {
      const product = await woo.createProduct(input);
      return { content: [{ type: 'text', text: JSON.stringify({ product }, null, 2) }] };
    },
  );

  server.registerTool(
    'list_orders',
    {
      description: 'List recent orders (optionally filter by status).',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        status: z.enum(ORDER_STATUSES).optional(),
      },
    },
    async ({ limit, status }) => {
      const orders = await woo.listOrders(limit ?? 20, status);
      return { content: [{ type: 'text', text: JSON.stringify({ orders }, null, 2) }] };
    },
  );

  server.registerTool(
    'get_order',
    {
      description: 'Get a single order by ID.',
      inputSchema: {
        order_id: z.number().int().positive().describe('WooCommerce order ID'),
      },
    },
    async ({ order_id }) => {
      const order = await woo.getOrder(order_id);
      return { content: [{ type: 'text', text: JSON.stringify({ order }, null, 2) }] };
    },
  );

  server.registerTool(
    'update_order_status',
    {
      description: 'Update WooCommerce order status.',
      inputSchema: {
        order_id: z.number().int().positive(),
        status: z.enum(ORDER_STATUSES),
      },
    },
    async ({ order_id, status }) => {
      const order = await woo.updateOrderStatus(order_id, status);
      return { content: [{ type: 'text', text: JSON.stringify({ order }, null, 2) }] };
    },
  );

  return server;
}

const port = Number(process.env.PORT || 4001);
const app = createMcpHttpApp({
  bearerToken: process.env.MCP_BEARER_TOKEN || 'woo-mcp-bearer-token',
  createServer: buildMcpServer,
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[woo-mcp] listening on http://0.0.0.0:${port}/mcp (mock=${process.env.WOO_USE_MOCK !== 'false'})`);
});

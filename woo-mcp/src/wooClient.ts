import {
  mockCreateProduct,
  mockGetOrder,
  mockListOrders,
  mockListProducts,
  mockUpdateOrderStatus,
  seedDemoOrder,
} from './mockStore.js';

const useMock = process.env.WOO_USE_MOCK !== 'false';

function wooBase(): string {
  const base = process.env.WOO_STORE_URL?.replace(/\/$/, '');
  if (!base) throw new Error('WOO_STORE_URL is not configured');
  return `${base}/wp-json/wc/v3`;
}

function authQuery(): string {
  const key = process.env.WOO_CONSUMER_KEY;
  const secret = process.env.WOO_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET required');
  return `consumer_key=${encodeURIComponent(key)}&consumer_secret=${encodeURIComponent(secret)}`;
}

async function wooFetch(path: string, init?: RequestInit): Promise<unknown> {
  const url = `${wooBase()}${path}${path.includes('?') ? '&' : '?'}${authQuery()}`;
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WooCommerce API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export async function listProducts(limit = 20): Promise<unknown> {
  if (useMock) return mockListProducts(limit);
  const data = await wooFetch(`/products?per_page=${Math.min(limit, 100)}`);
  return (data as unknown[]).map(projectProduct);
}

export async function createProduct(input: {
  name: string;
  price: string;
  description?: string;
}): Promise<unknown> {
  if (useMock) return mockCreateProduct(input);
  const data = await wooFetch('/products', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      regular_price: input.price,
      description: input.description ?? '',
      status: 'publish',
    }),
  });
  return projectProduct(data);
}

export async function listOrders(limit = 20, status?: string): Promise<unknown> {
  if (useMock) {
    seedDemoOrder();
    let rows = mockListOrders(limit);
    if (status) rows = rows.filter((o) => o.status === status);
    return rows;
  }
  const q = status ? `&status=${encodeURIComponent(status)}` : '';
  const data = await wooFetch(`/orders?per_page=${Math.min(limit, 100)}${q}`);
  return (data as unknown[]).map(projectOrder);
}

export async function getOrder(orderId: number): Promise<unknown> {
  if (useMock) {
    const order = mockGetOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    return order;
  }
  const data = await wooFetch(`/orders/${orderId}`);
  return projectOrder(data);
}

export async function updateOrderStatus(orderId: number, status: string): Promise<unknown> {
  if (useMock) {
    const order = mockUpdateOrderStatus(orderId, status);
    if (!order) throw new Error(`Order ${orderId} not found`);
    return order;
  }
  const data = await wooFetch(`/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return projectOrder(data);
}

function projectProduct(raw: unknown) {
  const p = raw as Record<string, unknown>;
  return {
    id: p.id,
    name: p.name,
    price: p.regular_price ?? p.price,
    status: p.status,
    description: typeof p.description === 'string' ? p.description.slice(0, 500) : undefined,
  };
}

function projectOrder(raw: unknown) {
  const o = raw as Record<string, unknown>;
  const items = Array.isArray(o.line_items)
    ? (o.line_items as Record<string, unknown>[]).map((li) => ({
        name: li.name,
        quantity: li.quantity,
        total: li.total,
      }))
    : [];
  return {
    id: o.id,
    status: o.status,
    total: o.total,
    date_created: o.date_created,
    line_items: items,
  };
}

seedDemoOrder();

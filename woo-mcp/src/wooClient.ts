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

function consumerKey(): string {
  const key = process.env.WOO_CONSUMER_KEY;
  if (!key) throw new Error('WOO_CONSUMER_KEY required');
  return key;
}

function consumerSecret(): string {
  const secret = process.env.WOO_CONSUMER_SECRET;
  if (!secret) throw new Error('WOO_CONSUMER_SECRET required');
  return secret;
}

function storeHeaders(): Record<string, string> {
  const token = Buffer.from(`${consumerKey()}:${consumerSecret()}`).toString('base64');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${token}`,
  };
  // Public site URL may differ from the in-cluster service URL. Send the
  // public Host so WordPress REST matches WP_HOME / WP_SITEURL.
  if (process.env.WOO_STORE_HOST) {
    headers.Host = process.env.WOO_STORE_HOST;
    headers['X-Forwarded-Host'] = process.env.WOO_STORE_HOST;
    headers['X-Forwarded-Proto'] = process.env.WOO_STORE_PROTO || 'http';
  }
  return headers;
}

async function wooFetch(path: string, init?: RequestInit): Promise<unknown> {
  const qs = `consumer_key=${encodeURIComponent(consumerKey())}&consumer_secret=${encodeURIComponent(consumerSecret())}`;
  const url = `${wooBase()}${path}${path.includes('?') ? '&' : '?'}${qs}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { ...storeHeaders(), ...init?.headers },
      redirect: 'follow',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WooCommerce API ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
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

export type DateRange = { after?: string; before?: string };

/** Accepts YYYY-MM-DD or a full ISO datetime; WooCommerce wants a datetime. */
function toIsoDateTime(value: string, label: string): string {
  const v = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  if (Number.isNaN(Date.parse(v))) throw new Error(`Invalid ${label} date: ${value}`);
  return v;
}

export async function listOrders(limit = 20, status?: string, range: DateRange = {}): Promise<unknown> {
  const after = range.after ? toIsoDateTime(range.after, 'after') : undefined;
  const before = range.before ? toIsoDateTime(range.before, 'before') : undefined;
  if (useMock) {
    seedDemoOrder();
    let rows = mockListOrders(100);
    if (status) rows = rows.filter((o) => o.status === status);
    if (after) rows = rows.filter((o) => Date.parse(o.date_created) >= Date.parse(after));
    if (before) rows = rows.filter((o) => Date.parse(o.date_created) < Date.parse(before));
    return rows.slice(0, limit);
  }
  const params = new URLSearchParams({ per_page: String(Math.min(limit, 100)) });
  if (status) params.set('status', status);
  if (after) params.set('after', after);
  if (before) params.set('before', before);
  const data = await wooFetch(`/orders?${params}`);
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

if (useMock) seedDemoOrder();

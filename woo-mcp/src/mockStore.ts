/** In-memory catalog for local dev when WOO_USE_MOCK=true */

export type MockProduct = {
  id: number;
  name: string;
  price: string;
  status: string;
  description?: string;
};

export type MockOrder = {
  id: number;
  status: string;
  total: string;
  date_created: string;
  line_items: Array<{ name: string; quantity: number; total: string }>;
};

const products: MockProduct[] = [
  { id: 101, name: 'Gateway Demo Hoodie', price: '49.99', status: 'publish', description: 'Soft demo product' },
  { id: 102, name: 'MCP Sticker Pack', price: '9.99', status: 'publish' },
];

const orders: MockOrder[] = [];

let nextProductId = 200;
let nextOrderId = 500;

export function mockListProducts(limit = 20): MockProduct[] {
  return products.slice(0, limit);
}

export function mockCreateProduct(input: { name: string; price: string; description?: string }): MockProduct {
  const product: MockProduct = {
    id: nextProductId++,
    name: input.name,
    price: input.price,
    status: 'publish',
    description: input.description,
  };
  products.unshift(product);
  return product;
}

export function mockListOrders(limit = 20): MockOrder[] {
  return orders.slice(0, limit);
}

export function mockGetOrder(id: number): MockOrder | undefined {
  return orders.find((o) => o.id === id);
}

export function mockUpdateOrderStatus(id: number, status: string): MockOrder | undefined {
  const order = orders.find((o) => o.id === id);
  if (!order) return undefined;
  order.status = status;
  return order;
}

/** Seed a demo order for today's date (used on boot). */
export function seedDemoOrder(): void {
  if (orders.length > 0) return;
  orders.push({
    id: nextOrderId++,
    status: 'processing',
    total: '59.98',
    date_created: new Date().toISOString(),
    line_items: [
      { name: 'Gateway Demo Hoodie', quantity: 1, total: '49.99' },
      { name: 'MCP Sticker Pack', quantity: 1, total: '9.99' },
    ],
  });
}

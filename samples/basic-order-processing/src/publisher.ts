import { createClient } from '@amqp-contract/client';
import { connect } from 'amqplib';
import { orderContract } from './contract.js';

async function main() {
  // Connect to RabbitMQ
  const connection = await connect(process.env.AMQP_URL || 'amqp://localhost:5672');

  console.log('Connected to RabbitMQ');

  // Create type-safe client
  const client = createClient(orderContract);
  await client.connect(connection);

  console.log('Client ready');

  // Publish orders with type safety
  const orders = [
    {
      orderId: 'ORD-001',
      customerId: 'CUST-123',
      items: [
        { productId: 'PROD-A', quantity: 2, price: 29.99 },
        { productId: 'PROD-B', quantity: 1, price: 49.99 },
      ],
      totalAmount: 109.97,
      createdAt: new Date().toISOString(),
    },
    {
      orderId: 'ORD-002',
      customerId: 'CUST-456',
      items: [{ productId: 'PROD-C', quantity: 3, price: 15.99 }],
      totalAmount: 47.97,
      createdAt: new Date().toISOString(),
    },
  ];

  for (const order of orders) {
    await client.publish('orderCreated', order);
    console.log(`Published order: ${order.orderId}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('All orders published');

  // Keep the connection open for a bit
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Clean up
  await client.close();
  console.log('Publisher stopped');
  process.exit(0);
}

main().catch((error) => {
  console.error('Publisher error:', error);
  process.exit(1);
});

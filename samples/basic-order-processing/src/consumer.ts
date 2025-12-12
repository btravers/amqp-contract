import { createWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { orderContract } from './contract.js';

async function main() {
  // Connect to RabbitMQ
  const connection = await connect(process.env.AMQP_URL || 'amqp://localhost:5672');

  console.log('Connected to RabbitMQ');

  // Create type-safe worker with handlers
  const worker = createWorker(orderContract, {
    // Handler for processing orders
    processOrder: async (message) => {
      console.log('\n🔄 Processing order:', message.orderId);
      console.log(`  Customer: ${message.customerId}`);
      console.log(`  Items: ${message.items.length}`);
      console.log(`  Total: $${message.totalAmount.toFixed(2)}`);

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log(`✅ Order ${message.orderId} processed successfully`);
    },

    // Handler for sending notifications
    notifyOrder: async (message) => {
      console.log('\n📧 Sending notification for order:', message.orderId);
      console.log(`  Notifying customer: ${message.customerId}`);

      // Simulate sending notification
      await new Promise((resolve) => setTimeout(resolve, 300));

      console.log(`✅ Notification sent for order ${message.orderId}`);
    },
  });

  await worker.connect(connection);
  console.log('Worker ready, waiting for messages...\n');

  // Start consuming all consumers
  await worker.consumeAll();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down worker...');
    await worker.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Worker error:', error);
  process.exit(1);
});

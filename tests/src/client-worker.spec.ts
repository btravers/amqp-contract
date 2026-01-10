import {
  ContractDefinition,
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { Future, Result } from "@swan-io/boxed";
import {
  TypedAmqpWorker,
  type WorkerInferSafeConsumerHandlers,
  defineHandlers,
} from "@amqp-contract/worker";
import { describe, expect, vi } from "vitest";
import { TypedAmqpClient } from "@amqp-contract/client";
import { it as baseIt } from "@amqp-contract/testing/extension";
import { z } from "zod";

const it = baseIt.extend<{
  clientFactory: <TContract extends ContractDefinition>(
    contract: TContract,
  ) => Promise<TypedAmqpClient<TContract>>;
  workerFactory: <TContract extends ContractDefinition>(
    contract: TContract,
    handlers: WorkerInferSafeConsumerHandlers<TContract>,
  ) => Promise<TypedAmqpWorker<TContract>>;
}>({
  clientFactory: async ({ amqpConnectionUrl }, use) => {
    const clients: Array<TypedAmqpClient<ContractDefinition>> = [];

    try {
      await use(async <TContract extends ContractDefinition>(contract: TContract) => {
        const client = await TypedAmqpClient.create({
          contract,
          urls: [amqpConnectionUrl],
        }).resultToPromise();

        clients.push(client);
        return client;
      });
    } finally {
      // Clean up all clients before fixture cleanup (which deletes the vhost)
      await Promise.all(
        clients.map(async (client) => {
          try {
            await client.close().resultToPromise();
          } catch (error) {
            // Swallow errors during cleanup to avoid unhandled rejections
            // eslint-disable-next-line no-console
            console.error("Failed to close AMQP client during fixture cleanup:", error);
          }
        }),
      );
    }
  },
  workerFactory: async ({ amqpConnectionUrl }, use) => {
    const workers: Array<TypedAmqpWorker<ContractDefinition>> = [];
    try {
      await use(
        async <TContract extends ContractDefinition>(
          contract: TContract,
          handlers: WorkerInferSafeConsumerHandlers<TContract>,
        ) => {
          const worker = await TypedAmqpWorker.create({
            contract,
            handlers: defineHandlers(contract, handlers),
            urls: [amqpConnectionUrl],
          }).resultToPromise();

          workers.push(worker);
          return worker;
        },
      );
    } finally {
      // Clean up all workers before fixture cleanup (which deletes the vhost)
      await Promise.all(
        workers.map(async (worker) => {
          try {
            await worker.close().resultToPromise();
          } catch (error) {
            // Swallow errors during cleanup to avoid unhandled rejections
            // eslint-disable-next-line no-console
            console.error("Failed to close worker during fixture cleanup:", error);
          }
        }),
      );
    }
  },
});

/**
 * Helper function to wait for worker to be ready to consume messages.
 * Workers need a brief moment to establish their connection and start consuming.
 * This is a pragmatic solution for integration tests since workers don't expose a ready event.
 */
async function waitForWorkerReady(delayMs = 500): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

describe("Client and Worker Integration", () => {
  describe("end-to-end message flow", () => {
    it("should successfully publish and consume messages between client and worker", async ({
      clientFactory,
      workerFactory,
    }) => {
      // GIVEN
      const exchange = defineExchange("orders", "topic", { durable: false });
      const queue = defineQueue("order-processing", { durable: false });
      const orderMessage = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number().positive(),
          customerId: z.string(),
        }),
        {
          summary: "Order created event",
          description: "Emitted when a new order is created",
        },
      );

      const contract = defineContract({
        exchanges: { orders: exchange },
        queues: { orderProcessing: queue },
        bindings: {
          orderBinding: defineQueueBinding(queue, exchange, {
            routingKey: "order.created",
          }),
        },
        publishers: {
          orderCreated: definePublisher(exchange, orderMessage, {
            routingKey: "order.created",
          }),
        },
        consumers: {
          processOrder: defineConsumer(queue, orderMessage),
        },
      });

      // GIVEN
      const mockHandler = vi.fn().mockReturnValue(Future.value(Result.Ok(undefined)));
      await workerFactory(contract, {
        processOrder: mockHandler,
      });
      const client = await clientFactory(contract);

      // Wait for worker to be ready to consume messages
      await waitForWorkerReady();

      // WHEN
      const publishResult = await client.publish("orderCreated", {
        orderId: "ORD-123",
        amount: 99.99,
        customerId: "CUST-456",
      });

      // THEN
      expect(publishResult).toEqual(Result.Ok(undefined));

      await vi.waitFor(
        () => {
          expect(mockHandler).toHaveBeenCalledTimes(1);
          expect(mockHandler).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
              orderId: "ORD-123",
              amount: 99.99,
              customerId: "CUST-456",
            }),
          );
        },
        { timeout: 5000 },
      );
    });

    it("should handle multiple messages in sequence", async ({ clientFactory, workerFactory }) => {
      // GIVEN
      const exchange = defineExchange("events", "topic", { durable: false });
      const queue = defineQueue("event-processing", { durable: false });
      const eventMessage = defineMessage(
        z.object({
          eventId: z.string(),
          type: z.enum(["created", "updated", "deleted"]),
          data: z.record(z.string(), z.unknown()),
        }),
      );

      const contract = defineContract({
        exchanges: { events: exchange },
        queues: { eventProcessing: queue },
        bindings: {
          eventBinding: defineQueueBinding(queue, exchange, {
            routingKey: "event.#",
          }),
        },
        publishers: {
          eventPublisher: definePublisher(exchange, eventMessage, {
            routingKey: "event.general",
          }),
        },
        consumers: {
          processEvent: defineConsumer(queue, eventMessage),
        },
      });

      // GIVEN
      const receivedMessages: unknown[] = [];
      const mockHandler = vi.fn().mockImplementation((message: unknown) => {
        receivedMessages.push(message);
        return Future.value(Result.Ok(undefined));
      });
      await workerFactory(contract, {
        processEvent: mockHandler,
      });
      const client = await clientFactory(contract);

      // Wait for worker to be ready to consume messages
      await waitForWorkerReady();

      // WHEN
      const messages = [
        { eventId: "EVT-1", type: "created" as const, data: { name: "Test 1" } },
        { eventId: "EVT-2", type: "updated" as const, data: { name: "Test 2" } },
        { eventId: "EVT-3", type: "deleted" as const, data: { id: "123" } },
      ];

      for (const message of messages) {
        const result = await client.publish("eventPublisher", message);
        expect(result).toEqual(Result.Ok(undefined));
      }

      // THEN
      await vi.waitFor(
        () => {
          expect(mockHandler).toHaveBeenCalledTimes(3);
          expect(receivedMessages).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ eventId: "EVT-1", type: "created" }),
              expect.objectContaining({ eventId: "EVT-2", type: "updated" }),
              expect.objectContaining({ eventId: "EVT-3", type: "deleted" }),
            ]),
          );
        },
        { timeout: 5000 },
      );
    });

    it("should handle validation errors gracefully", async ({ clientFactory, workerFactory }) => {
      // GIVEN
      const exchange = defineExchange("strict", "topic", { durable: false });
      const queue = defineQueue("strict-processing", { durable: false });
      const strictMessage = defineMessage(
        z.object({
          id: z.string().uuid(),
          value: z.number().int().positive(),
        }),
      );

      const contract = defineContract({
        exchanges: { strict: exchange },
        queues: { strictProcessing: queue },
        bindings: {
          strictBinding: defineQueueBinding(queue, exchange, {
            routingKey: "strict.message",
          }),
        },
        publishers: {
          strictPublisher: definePublisher(exchange, strictMessage, {
            routingKey: "strict.message",
          }),
        },
        consumers: {
          processStrict: defineConsumer(queue, strictMessage),
        },
      });

      const mockHandler = vi.fn().mockReturnValue(Future.value(Result.Ok(undefined)));
      await workerFactory(contract, {
        processStrict: mockHandler,
      });
      const client = await clientFactory(contract);

      // Wait for worker to be ready to consume messages
      await waitForWorkerReady();

      // WHEN
      const invalidResult = await client.publish("strictPublisher", {
        id: "not-a-uuid",
        value: 42,
      } as never);

      // THEN
      expect(invalidResult.isError()).toBe(true);

      // WHEN
      const validResult = await client.publish("strictPublisher", {
        id: "123e4567-e89b-12d3-a456-426614174000",
        value: 42,
      });

      // THEN
      expect(validResult).toEqual(Result.Ok(undefined));

      await vi.waitFor(
        () => {
          expect(mockHandler).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );
    });
  });

  describe("routing patterns", () => {
    it("should route messages based on routing keys with topic exchange", async ({
      clientFactory,
      workerFactory,
    }) => {
      // GIVEN
      const exchange = defineExchange("notifications", "topic", { durable: false });
      const emailQueue = defineQueue("email-queue", { durable: false });
      const smsQueue = defineQueue("sms-queue", { durable: false });

      const notificationMessage = defineMessage(
        z.object({
          recipient: z.string(),
          message: z.string(),
        }),
      );

      const contract = defineContract({
        exchanges: { notifications: exchange },
        queues: {
          emailQueue,
          smsQueue,
        },
        bindings: {
          emailBinding: defineQueueBinding(emailQueue, exchange, {
            routingKey: "notification.email.*",
          }),
          smsBinding: defineQueueBinding(smsQueue, exchange, {
            routingKey: "notification.sms.*",
          }),
        },
        publishers: {
          emailNotification: definePublisher(exchange, notificationMessage, {
            routingKey: "notification.email.send",
          }),
          smsNotification: definePublisher(exchange, notificationMessage, {
            routingKey: "notification.sms.send",
          }),
        },
        consumers: {
          processEmail: defineConsumer(emailQueue, notificationMessage),
          processSms: defineConsumer(smsQueue, notificationMessage),
        },
      });

      // GIVEN
      const emailHandler = vi.fn().mockReturnValue(Future.value(Result.Ok(undefined)));
      const smsHandler = vi.fn().mockReturnValue(Future.value(Result.Ok(undefined)));

      await workerFactory(contract, {
        processEmail: emailHandler,
        processSms: smsHandler,
      });
      const client = await clientFactory(contract);

      // Wait for worker to be ready to consume messages
      await waitForWorkerReady();

      // WHEN
      const emailResult = await client.publish("emailNotification", {
        recipient: "user@example.com",
        message: "Test email",
      });
      expect(emailResult).toEqual(Result.Ok(undefined));

      // WHEN
      const smsResult = await client.publish("smsNotification", {
        recipient: "+1234567890",
        message: "Test SMS",
      });
      expect(smsResult).toEqual(Result.Ok(undefined));

      // THEN
      await vi.waitFor(
        () => {
          expect(emailHandler).toHaveBeenCalledTimes(1);
          expect(emailHandler).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
              recipient: "user@example.com",
              message: "Test email",
            }),
          );
          expect(smsHandler).toHaveBeenCalledTimes(1);
          expect(smsHandler).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
              recipient: "+1234567890",
              message: "Test SMS",
            }),
          );
        },
        { timeout: 5000 },
      );
    });
  });
});

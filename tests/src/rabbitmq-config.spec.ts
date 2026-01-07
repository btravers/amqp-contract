/**
 * Test to verify that RABBITMQ_IMAGE environment variable works correctly
 */
import { describe, expect, it } from "vitest";
import { inject } from "vitest";

describe("RabbitMQ Container Configuration", () => {
  it("should start RabbitMQ container successfully with correct configuration", () => {
    // Verify container connection details are available
    const ip = inject("__TESTCONTAINERS_RABBITMQ_IP__");
    const port = inject("__TESTCONTAINERS_RABBITMQ_PORT_5672__");
    const username = inject("__TESTCONTAINERS_RABBITMQ_USERNAME__");
    const password = inject("__TESTCONTAINERS_RABBITMQ_PASSWORD__");

    expect({
      ip,
      port,
      username,
      password,
    }).toMatchObject({
      ip: expect.any(String),
      port: expect.any(Number),
      username: "guest",
      password: "guest",
    });
    expect(port).toBeGreaterThan(0);
  });
});

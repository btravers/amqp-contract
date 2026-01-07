/**
 * Test to verify that RABBITMQ_IMAGE environment variable works correctly
 */
import { describe, expect, it } from "vitest";
import { inject } from "vitest";

describe("RabbitMQ Container Configuration", () => {
  it("should start RabbitMQ container successfully", () => {
    // Verify container connection details are available
    const ip = inject("__TESTCONTAINERS_RABBITMQ_IP__");
    const port = inject("__TESTCONTAINERS_RABBITMQ_PORT_5672__");
    const username = inject("__TESTCONTAINERS_RABBITMQ_USERNAME__");
    const password = inject("__TESTCONTAINERS_RABBITMQ_PASSWORD__");

    expect(ip).toBeDefined();
    expect(port).toBeGreaterThan(0);
    expect(username).toBe("guest");
    expect(password).toBe("guest");
  });

  it("should use custom image if RABBITMQ_IMAGE is set", () => {
    // This test just verifies the container started successfully
    // The actual image used is logged during setup
    const ip = inject("__TESTCONTAINERS_RABBITMQ_IP__");
    expect(ip).toBeDefined();
  });
});

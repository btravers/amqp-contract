import { describe, it, expect } from "vitest";
import { AmqpWorkerModule } from "./worker.module.js";

describe("AmqpWorkerModule", () => {
  describe("ConfigurableModuleBuilder", () => {
    it("should have forRoot and forRootAsync methods", () => {
      expect(AmqpWorkerModule.forRoot).toBeDefined();
      expect(AmqpWorkerModule.forRootAsync).toBeDefined();
      expect(typeof AmqpWorkerModule.forRoot).toBe("function");
      expect(typeof AmqpWorkerModule.forRootAsync).toBe("function");
    });
  });
});

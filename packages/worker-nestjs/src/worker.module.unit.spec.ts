import { describe, it, expect } from "vitest";
import { AmqpWorkerModule } from "./worker.module.js";

describe("AmqpWorkerModule", () => {
  describe("ConfigurableModuleBuilder", () => {
    it("should have forRoot method", () => {
      expect(AmqpWorkerModule.forRoot).toBeDefined();
      expect(typeof AmqpWorkerModule.forRoot).toBe("function");
    });

    it("should have forRootAsync method", () => {
      expect(AmqpWorkerModule.forRootAsync).toBeDefined();
      expect(typeof AmqpWorkerModule.forRootAsync).toBe("function");
    });
  });
});

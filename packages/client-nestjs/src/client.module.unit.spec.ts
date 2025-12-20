import { describe, it, expect } from "vitest";
import { AmqpClientModule } from "./client.module.js";

describe("AmqpClientModule", () => {
  describe("ConfigurableModuleBuilder", () => {
    it("should have forRoot method", () => {
      expect(AmqpClientModule.forRoot).toBeDefined();
      expect(typeof AmqpClientModule.forRoot).toBe("function");
    });

    it("should have forRootAsync method", () => {
      expect(AmqpClientModule.forRootAsync).toBeDefined();
      expect(typeof AmqpClientModule.forRootAsync).toBe("function");
    });
  });
});

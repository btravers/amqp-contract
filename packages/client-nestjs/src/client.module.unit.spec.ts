import { describe, it, expect } from "vitest";
import { AmqpClientModule } from "./client.module.js";

describe("AmqpClientModule", () => {
  describe("ConfigurableModuleBuilder", () => {
    it("should have forRoot and forRootAsync methods", () => {
      expect(AmqpClientModule.forRoot).toBeDefined();
      expect(AmqpClientModule.forRootAsync).toBeDefined();
      expect(typeof AmqpClientModule.forRoot).toBe("function");
      expect(typeof AmqpClientModule.forRootAsync).toBe("function");
    });
  });
});

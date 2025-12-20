import { describe, it, expect } from "vitest";
import { AmqpClientModule } from "./client.module.js";

describe("AmqpClientModule", () => {
  describe("ConfigurableModuleBuilder", () => {
    it("should have forRoot and forRootAsync methods", () => {
      expect({
        hasForRoot: AmqpClientModule.forRoot !== undefined,
        hasForRootAsync: AmqpClientModule.forRootAsync !== undefined,
        forRootType: typeof AmqpClientModule.forRoot,
        forRootAsyncType: typeof AmqpClientModule.forRootAsync,
      }).toEqual({
        hasForRoot: true,
        hasForRootAsync: true,
        forRootType: "function",
        forRootAsyncType: "function",
      });
    });
  });
});

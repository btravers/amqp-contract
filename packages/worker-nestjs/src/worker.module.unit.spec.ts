import { describe, expect, it } from "vitest";
import { AmqpWorkerModule } from "./worker.module.js";

describe("AmqpWorkerModule", () => {
  describe("ConfigurableModuleBuilder", () => {
    it("should have forRoot and forRootAsync methods", () => {
      expect({
        hasForRoot: AmqpWorkerModule.forRoot !== undefined,
        hasForRootAsync: AmqpWorkerModule.forRootAsync !== undefined,
        forRootType: typeof AmqpWorkerModule.forRoot,
        forRootAsyncType: typeof AmqpWorkerModule.forRootAsync,
      }).toEqual({
        hasForRoot: true,
        hasForRootAsync: true,
        forRootType: "function",
        forRootAsyncType: "function",
      });
    });
  });
});

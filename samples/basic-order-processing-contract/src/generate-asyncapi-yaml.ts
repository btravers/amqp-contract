import { AsyncAPIGenerator } from "@amqp-contract/asyncapi";
import YAML from "yaml";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { orderContract } from "./index.js";
import { writeFileSync } from "node:fs";

const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(orderContract, {
  info: {
    title: "Order Processing API",
    version: "1.0.0",
    description: "Type-safe AMQP messaging for order processing",
  },
  servers: {
    production: {
      host: "rabbitmq.example.com:5672",
      protocol: "amqp",
      description: "Production server",
    },
    development: {
      host: "localhost:5672",
      protocol: "amqp",
      description: "Local development",
    },
  },
});

const outputPath = "asyncapi.yaml";
writeFileSync(outputPath, YAML.stringify(spec));

console.log(`✅ Generated AsyncAPI spec: ${outputPath}`);
console.log(`   Channels: ${Object.keys(spec.channels ?? {}).length}`);
console.log(`   Operations: ${Object.keys(spec.operations ?? {}).length}`);

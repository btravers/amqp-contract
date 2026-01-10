import { spec } from "./generate-spec.js";
import { writeFileSync } from "node:fs";

const outputPath = "asyncapi.json";
writeFileSync(outputPath, JSON.stringify(spec, null, 2));

console.log(`✅ Generated AsyncAPI spec: ${outputPath}`);
console.log(`   Channels: ${Object.keys(spec.channels ?? {}).length}`);
console.log(`   Operations: ${Object.keys(spec.operations ?? {}).length}`);

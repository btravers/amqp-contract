import "@amqp-contract/asyncapi";
import "@amqp-contract/client";
import "@amqp-contract/client-nestjs";
import "@amqp-contract/contract";
import "@amqp-contract/core";
import "@amqp-contract/testing/global-setup";
import "@amqp-contract/worker";
import "@amqp-contract/worker-nestjs";

import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, "..", "api");
const nodeModulesDir = join(__dirname, "..", "node_modules");

const packages = [
  "@amqp-contract/asyncapi",
  "@amqp-contract/client",
  "@amqp-contract/client-nestjs",
  "@amqp-contract/contract",
  "@amqp-contract/core",
  "@amqp-contract/testing",
  "@amqp-contract/worker",
  "@amqp-contract/worker-nestjs",
];

async function copyDocs(): Promise<void> {
  try {
    // Create api directory if it doesn't exist
    await mkdir(docsDir, { recursive: true });

    // Copy docs from each package
    for (const pkg of packages) {
      const sourcePath = join(nodeModulesDir, pkg, "docs");
      const folder = pkg.replace("@amqp-contract/", "");
      const targetPath = join(docsDir, folder);

      try {
        await cp(sourcePath, targetPath, { recursive: true });
        console.log(`✓ Copied docs for ${pkg}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠ Could not copy docs for ${pkg}:`, message);
      }
    }

    console.log("\n✅ All documentation copied successfully!");
  } catch (error) {
    console.error("❌ Error copying documentation:", error);
    process.exit(1);
  }
}

copyDocs();

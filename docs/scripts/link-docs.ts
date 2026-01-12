import "@amqp-contract/asyncapi";
import "@amqp-contract/client";
import "@amqp-contract/client-nestjs";
import "@amqp-contract/contract";
import "@amqp-contract/core";
import "@amqp-contract/testing/global-setup";
import "@amqp-contract/worker";
import "@amqp-contract/worker-nestjs";

import { dirname, join, relative } from "node:path";
import { lstat, mkdir, rm, symlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsApiDir = join(__dirname, "..", "api");
const nodeModulesDir = join(__dirname, "..", "node_modules");

const packages = [
  "asyncapi",
  "client",
  "client-nestjs",
  "contract",
  "core",
  "testing",
  "worker",
  "worker-nestjs",
];

async function createSymlinks(): Promise<void> {
  try {
    // Create api directory if it doesn't exist
    await mkdir(docsApiDir, { recursive: true });

    // Create symlinks for each package's docs
    for (const pkg of packages) {
      const targetPath = join(docsApiDir, pkg);
      const sourcePath = join(nodeModulesDir, `@amqp-contract/${pkg}`, "docs");

      // Remove existing symlink or directory if it exists
      try {
        const stats = await lstat(targetPath);
        if (stats.isSymbolicLink() || stats.isDirectory()) {
          await rm(targetPath, { recursive: true });
        }
      } catch {
        // Target doesn't exist, which is fine
      }

      // Create relative symlink from docs/api/{pkg} to node_modules/@amqp-contract/{pkg}/docs
      const relativePath = relative(docsApiDir, sourcePath);
      await symlink(relativePath, targetPath);
      console.log(`✓ Created symlink for @amqp-contract/${pkg}`);
    }

    console.log("\n✅ All symlinks created successfully!");
  } catch (error) {
    console.error("❌ Error creating symlinks:", error);
    process.exit(1);
  }
}

createSymlinks();

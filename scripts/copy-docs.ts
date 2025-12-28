import { access, cp, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const docsDir = join(rootDir, "docs", "api");
const packagesDir = join(rootDir, "packages");

type PackageInfo = {
  name: string;
  folder: string;
};

const packages: PackageInfo[] = [
  { name: "@amqp-contract/contract", folder: "contract" },
  { name: "@amqp-contract/core", folder: "core" },
  { name: "@amqp-contract/client", folder: "client" },
  { name: "@amqp-contract/worker", folder: "worker" },
  { name: "@amqp-contract/asyncapi", folder: "asyncapi" },
  { name: "@amqp-contract/client-nestjs", folder: "client-nestjs" },
  { name: "@amqp-contract/worker-nestjs", folder: "worker-nestjs" },
  { name: "@amqp-contract/testing", folder: "testing" },
];

async function copyDocs(): Promise<void> {
  try {
    // Create api directory if it doesn't exist
    await mkdir(docsDir, { recursive: true });

    // Copy docs from each package
    for (const pkg of packages) {
      // Try workspace package location first (for packages in development)
      const workspaceSourcePath = join(packagesDir, pkg.folder, "docs");
      // Fallback to node_modules (for published packages)
      const nodeModulesSourcePath = join(rootDir, "node_modules", pkg.name, "docs");
      const targetPath = join(docsDir, pkg.folder);

      let sourcePath = workspaceSourcePath;
      try {
        await access(workspaceSourcePath);
      } catch {
        sourcePath = nodeModulesSourcePath;
      }

      try {
        await cp(sourcePath, targetPath, { recursive: true });
        console.log(`✓ Copied docs for ${pkg.name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠ Could not copy docs for ${pkg.name}:`, message);
      }
    }

    // Create index.md for the API section
    const indexContent = `# API Documentation

Welcome to the amqp-contract API documentation. This documentation is auto-generated from the source code using TypeDoc.

## Core Packages

- [@amqp-contract/contract](./contract/) - Core contract definitions
- [@amqp-contract/core](./core/) - Core utilities for AMQP setup and management
- [@amqp-contract/client](./client/) - Type-safe AMQP client
- [@amqp-contract/worker](./worker/) - Type-safe AMQP worker
- [@amqp-contract/asyncapi](./asyncapi/) - AsyncAPI specification generator

## NestJS Integration

- [@amqp-contract/client-nestjs](./client-nestjs/) - NestJS client module
- [@amqp-contract/worker-nestjs](./worker-nestjs/) - NestJS worker module

## Testing

- [@amqp-contract/testing](./testing/) - Testing utilities with testcontainers
`;

    await writeFile(join(docsDir, "index.md"), indexContent);
    console.log("✓ Created API index");

    console.log("\n✅ All documentation copied successfully!");
  } catch (error) {
    console.error("❌ Error copying documentation:", error);
    process.exit(1);
  }
}

copyDocs();

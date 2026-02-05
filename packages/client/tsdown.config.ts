import { defineConfig } from "tsdown";

export default defineConfig({
  // Prevent @swan-io/boxed types from being inlined into the declaration files
  // This ensures type compatibility across packages that use boxed types
  external: ["@swan-io/boxed"],
  // Suppress warnings about bundled dependencies in declaration files
  inlineOnly: false,
});

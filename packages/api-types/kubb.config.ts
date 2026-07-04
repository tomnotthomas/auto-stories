import { defineConfig } from "@kubb/core";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginTs } from "@kubb/plugin-ts";

// Generates real, named TypeScript types (one file per schema) from the OpenAPI
// contract into the shared api-types package. See approach 3.15.
export default defineConfig({
  root: ".",
  input: { path: "./openapi/openapi.yaml" },
  output: {
    path: "./packages/api-types/src/gen",
    clean: true,
    extension: { ".ts": "" },
    // Disable auto-formatting so generation is deterministic regardless of
    // whether a formatter (prettier/biome) happens to be installed in the
    // workspace. Keeps the checked-in types stable across CI environments.
    format: false,
  },
  plugins: [
    pluginOas({ validate: false, output: false }),
    pluginTs({
      output: { path: "models" },
      enumType: "literal",
    }),
  ],
});

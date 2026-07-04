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
  },
  plugins: [
    pluginOas({ validate: false, output: false }),
    pluginTs({
      output: { path: "models" },
      enumType: "literal",
    }),
  ],
});

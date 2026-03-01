/// <reference types="vitest" />

import path from "path";
import { fileURLToPath } from "url";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^rpc4next\/(.*)$/,
        replacement: path.resolve(
          workspaceRoot,
          "packages/rpc4next/src/rpc/$1",
        ),
      },
      {
        find: /^rpc4next$/,
        replacement: path.resolve(
          workspaceRoot,
          "packages/rpc4next/src/index.ts",
        ),
      },
      {
        find: /^rpc4next-shared\/(.*)$/,
        replacement: path.resolve(
          workspaceRoot,
          "packages/rpc4next-shared/src/$1",
        ),
      },
      {
        find: /^rpc4next-shared$/,
        replacement: path.resolve(
          workspaceRoot,
          "packages/rpc4next-shared/src/index.ts",
        ),
      },
    ],
  },
  test: {
    root: workspaceRoot,
    globals: true,
    environment: "node",
    include: ["packages/**/src/**/*.test.ts", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "json-summary"],
      reportOnFailure: true,
      reportsDirectory: "./coverage",
      include: ["packages/**/src/**/*.ts", "scripts/**/*.ts"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "packages/**/src/**/index.ts",
        "packages/**/src/**/types.ts",
        "packages/**/src/**/*-types.ts",
      ],
    },
  },
});

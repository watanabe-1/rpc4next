import { build } from "esbuild";
import {
  globEntryPoints,
  libraryBuildOptions,
  mergeBuildOptions,
} from "../build-utils";

const entries = await globEntryPoints([
  "src/index.ts",
  "src/rpc/**/*.ts",
  "!src/**/types.ts",
  "!src/**/*-types.ts",
  "!src/**/*.test.ts",
]);

await build(
  mergeBuildOptions(
    {
      entryPoints: entries,
      platform: "neutral",
      bundle: false,
    },
    libraryBuildOptions
  )
);

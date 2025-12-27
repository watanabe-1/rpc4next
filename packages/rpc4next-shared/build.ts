import { build } from "esbuild";
import {
  globEntryPoints,
  libraryBuildOptions,
  mergeBuildOptions,
} from "../build-utils";

const entryPoints = await globEntryPoints(["src/**/*.ts", "!src/**/*.test.ts"]);

await build(
  mergeBuildOptions(
    {
      entryPoints,
      platform: "neutral",
      bundle: false,
    },
    libraryBuildOptions,
  ),
);

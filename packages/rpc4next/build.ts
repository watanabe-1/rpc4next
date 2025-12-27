import { build } from "esbuild";
import type { BuildOptions } from "esbuild";
import glob from "fast-glob";

const baseOptions: BuildOptions = {
  outbase: "src",
  outdir: "dist",
  target: "ES2022",
  format: "esm",
  minify: true,
  tsconfig: "tsconfig.build.json",
};

const entries = await glob([
  "src/index.ts",
  "src/rpc/**/*.ts",
  "!src/**/types.ts",
  "!src/**/*-types.ts",
  "!src/**/*.test.ts",
]);

await build({
  ...baseOptions,
  entryPoints: entries,
  platform: "neutral",
  bundle: false,
});

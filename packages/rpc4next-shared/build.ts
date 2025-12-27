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

const entryPoints = await glob(["src/**/*.ts", "!src/**/*.test.ts"]);

await build({
  ...baseOptions,
  entryPoints,
  platform: "neutral",
  bundle: false,
});

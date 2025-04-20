import { build } from "esbuild";
import type { BuildOptions } from "esbuild";
import glob from "fast-glob";
import { readFileSync } from "fs";

const baseOptions: BuildOptions = {
  outbase: "src",
  outdir: "dist",
  target: "ES2022",
  format: "esm",
  minify: true,
  tsconfig: "tsconfig.build.json",
};

const entriesForCli = await glob([
  "src/rpc/cli/**/index.ts",
  "!src/**/*.test.ts",
]);
const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
const externals = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];
await build({
  ...baseOptions,
  entryPoints: entriesForCli,
  platform: "node",
  bundle: true,
  external: [...externals],
});

const entriesForNext = await glob([
  "src/rpc/**/*.ts",
  "!src/rpc/cli/**",
  "!src/**/*.test.ts",
]);
await build({
  ...baseOptions,
  entryPoints: entriesForNext,
  platform: "neutral",
  bundle: false,
});

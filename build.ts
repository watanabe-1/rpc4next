import { build, BuildOptions } from "esbuild";
import glob from "fast-glob";

const baseOptions: BuildOptions = {
  outbase: "src",
  outdir: "dist",
  bundle: false,
  target: "ES2022",
  format: "esm",
  minify: true,
  tsconfig: "tsconfig.build.json",
};

const entriesForCli = await glob(["src/rpc/cli/**/*.ts", "!src/**/*.test.ts"]);
await build({
  ...baseOptions,
  entryPoints: entriesForCli,
  platform: "node",
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
});

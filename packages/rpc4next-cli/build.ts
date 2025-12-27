import { build } from "esbuild";
import type { BuildOptions } from "esbuild";
import pkg from "./package.json";

const options: BuildOptions = {
  entryPoints: ["src/cli/index.ts"],
  outbase: "src/cli",
  outdir: "dist",
  target: "ES2022",
  format: "esm",
  minify: true,
  platform: "node",
  bundle: true,
  tsconfig: "tsconfig.json",
  external: [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ],
  banner: {
    js: "#!/usr/bin/env node",
  },
};

await build(options);

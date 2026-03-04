import { build } from "esbuild";
import { baseBuildOptions, mergeBuildOptions } from "../build-utils";
import pkg from "./package.json";

await build(
  mergeBuildOptions(
    {
      entryPoints: ["src/cli/index.ts"],
      outbase: "src/cli",
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
    },
    baseBuildOptions,
  ),
);

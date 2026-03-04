import type { BuildOptions } from "esbuild";
import glob from "fast-glob";

export const baseBuildOptions: BuildOptions = {
  outdir: "dist",
  target: "ES2022",
  format: "esm",
  minify: true,
};

export const libraryBuildOptions: BuildOptions = {
  ...baseBuildOptions,
  outbase: "src",
  tsconfig: "tsconfig.build.json",
};

export function mergeBuildOptions(
  overrides: BuildOptions,
  base: BuildOptions = baseBuildOptions,
): BuildOptions {
  return {
    ...base,
    ...overrides,
  };
}

export async function globEntryPoints(patterns: string[]): Promise<string[]> {
  return glob(patterns);
}

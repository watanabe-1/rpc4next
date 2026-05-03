import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { cleanupTempDir, makeTempDir } from "../test-helpers/tmp-dir.js";
import { getConfigPath, loadCliConfig } from "./config.js";

describe("loadCliConfig", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanupTempDir(dir);
    }
  });

  it("returns an empty object when the config file does not exist", () => {
    const cwd = makeTempDir("rpc4next-config-");
    tempDirs.push(cwd);

    expect(loadCliConfig(cwd)).toEqual({});
  });

  it("loads config values from rpc4next.config.json", () => {
    const cwd = makeTempDir("rpc4next-config-");
    tempDirs.push(cwd);

    fs.writeFileSync(
      getConfigPath(cwd),
      JSON.stringify({
        baseDir: "app",
        outputPath: "src/generated/rpc.ts",
        paramsFile: "params.ts",
      }),
    );

    expect(loadCliConfig(cwd)).toEqual({
      baseDir: "app",
      outputPath: "src/generated/rpc.ts",
      paramsFile: "params.ts",
    });
  });

  it("loads partial config values when paramsFile is omitted", () => {
    const cwd = makeTempDir("rpc4next-config-");
    tempDirs.push(cwd);

    fs.writeFileSync(
      getConfigPath(cwd),
      JSON.stringify({
        baseDir: "app",
        outputPath: "src/generated/rpc.ts",
      }),
    );

    expect(loadCliConfig(cwd)).toEqual({
      baseDir: "app",
      outputPath: "src/generated/rpc.ts",
    });
  });

  it("throws for invalid config shapes", () => {
    const cwd = makeTempDir("rpc4next-config-");
    tempDirs.push(cwd);

    fs.writeFileSync(getConfigPath(cwd), JSON.stringify({ baseDir: 1 }));

    expect(() => loadCliConfig(cwd)).toThrow(
      'rpc4next.config.json field "baseDir" must be a string.',
    );
  });

  it("throws when config is not a JSON object", () => {
    const cwd = makeTempDir("rpc4next-config-");
    tempDirs.push(cwd);

    fs.writeFileSync(getConfigPath(cwd), JSON.stringify([]));

    expect(() => loadCliConfig(cwd)).toThrow("rpc4next.config.json must contain a JSON object.");
  });

  it("throws for invalid outputPath values", () => {
    const cwd = makeTempDir("rpc4next-config-");
    tempDirs.push(cwd);

    fs.writeFileSync(getConfigPath(cwd), JSON.stringify({ outputPath: 1 }));

    expect(() => loadCliConfig(cwd)).toThrow(
      'rpc4next.config.json field "outputPath" must be a string.',
    );
  });

  it("throws for invalid paramsFile values", () => {
    const cwd = makeTempDir("rpc4next-config-");
    tempDirs.push(cwd);

    fs.writeFileSync(getConfigPath(cwd), JSON.stringify({ paramsFile: 1 }));

    expect(() => loadCliConfig(cwd)).toThrow(
      'rpc4next.config.json field "paramsFile" must be a string.',
    );
  });

  it("throws for empty paramsFile values", () => {
    const cwd = makeTempDir("rpc4next-config-");
    tempDirs.push(cwd);

    fs.writeFileSync(getConfigPath(cwd), JSON.stringify({ paramsFile: "" }));

    expect(() => loadCliConfig(cwd)).toThrow(
      'rpc4next.config.json field "paramsFile" must be a string.',
    );
  });

  it("builds the config path from cwd", () => {
    expect(getConfigPath("/work/demo")).toBe(path.join("/work/demo", "rpc4next.config.json"));
  });
});

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupTempDir, makeTempDir, writeTree } from "../../test-helpers/tmp-dir.js";
import { handleInitCommand } from "./init-command.js";
import { INIT_TEMPLATE_FILES } from "./templates.js";

describe("handleInitCommand", () => {
  const originalCwd = process.cwd();
  let tmpDir: string | null = null;
  const logger = {
    error: vi.fn<(...args: unknown[]) => void>(),
    info: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = makeTempDir();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir(tmpDir);
    tmpDir = null;
  });

  it("creates the default init files", () => {
    const result = handleInitCommand({}, logger);

    expect(result).toBe(0);

    for (const file of [
      "rpc4next.config.json",
      "src/generated/rpc.ts",
      "src/lib/rpc-client.ts",
      "app/_rpc/errors.ts",
      "app/_rpc/route-procedure.ts",
      "app/_rpc/page-procedure.ts",
    ]) {
      expect(fs.existsSync(path.join(process.cwd(), file))).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(`created ${file}`);
    }

    expect(fs.readFileSync("rpc4next.config.json", "utf8")).toBe(
      `${JSON.stringify(
        {
          baseDir: "app",
          outputPath: "src/generated/rpc.ts",
          paramsFile: "route-contract.ts",
        },
        null,
        2,
      )}\n`,
    );
    expect(fs.readFileSync("src/generated/rpc.ts", "utf8")).toContain("export type PathStructure");
  });

  it("does not overwrite existing files by default", () => {
    const oldContent = "existing file\n";

    writeTree(process.cwd(), {
      "rpc4next.config.json": oldContent,
      src: {
        generated: {
          "rpc.ts": oldContent,
        },
        lib: {
          "rpc-client.ts": oldContent,
        },
      },
      app: {
        _rpc: Object.fromEntries(
          INIT_TEMPLATE_FILES.filter((file) => file.path.startsWith("app/_rpc/")).map((file) => [
            path.basename(file.path),
            oldContent,
          ]),
        ),
      },
    });

    const result = handleInitCommand({}, logger);

    expect(result).toBe(0);

    for (const file of [
      "rpc4next.config.json",
      "src/generated/rpc.ts",
      "src/lib/rpc-client.ts",
      "app/_rpc/errors.ts",
      "app/_rpc/route-procedure.ts",
      "app/_rpc/page-procedure.ts",
    ]) {
      expect(fs.readFileSync(file, "utf8")).toBe(oldContent);
      expect(logger.info).toHaveBeenCalledWith(`skipped ${file}`);
    }
  });

  it("overwrites existing files with force", () => {
    writeTree(process.cwd(), {
      "rpc4next.config.json": "old config\n",
      src: {
        generated: {
          "rpc.ts": "old generated\n",
        },
        lib: {
          "rpc-client.ts": "old client\n",
        },
      },
      app: {
        _rpc: {
          "errors.ts": "old errors\n",
          "route-procedure.ts": "old route procedure\n",
          "page-procedure.ts": "old page procedure\n",
        },
      },
    });

    const result = handleInitCommand({ force: true }, logger);

    expect(result).toBe(0);
    expect(fs.readFileSync("rpc4next.config.json", "utf8")).not.toBe("old config\n");
    expect(fs.readFileSync("src/generated/rpc.ts", "utf8")).not.toBe("old generated\n");
    expect(fs.readFileSync("src/lib/rpc-client.ts", "utf8")).not.toBe("old client\n");
    expect(logger.info).toHaveBeenCalledWith("created src/generated/rpc.ts");
  });

  it("does not write files during dry-run", () => {
    const result = handleInitCommand({ dryRun: true }, logger);

    expect(result).toBe(0);
    expect(fs.existsSync("rpc4next.config.json")).toBe(false);
    expect(fs.existsSync("src/generated/rpc.ts")).toBe(false);
    expect(fs.existsSync("app/_rpc/errors.ts")).toBe(false);
    expect(logger.info).toHaveBeenCalledWith("dry-run rpc4next.config.json");
    expect(logger.info).toHaveBeenCalledWith("dry-run src/generated/rpc.ts");
  });
});

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupTempDir, makeTempDir, writeTree } from "../test-helpers/tmp-dir.js";
import { handleCli } from "./cli-handler.js";
import { ROUTE_CONTRACT_GENERATED_MARKER } from "./core/generate-path-structure.js";
import { toPosixPath } from "./core/path-utils.js";
import { checkGenerated, generate } from "./generator.js";

describe("generation target safety", () => {
  let tmpDir: string;
  const logger = {
    info: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
  };
  const generated = `${ROUTE_CONTRACT_GENERATED_MARKER}\nstale`;
  const route = "export const GET = () => Response.json({ ok: true });";
  const snapshot = () =>
    fs
      .readdirSync(tmpDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const filePath = path.join(entry.parentPath, entry.name);

        return [path.relative(tmpDir, filePath), fs.readFileSync(filePath, "utf8")];
      })
      .sort(([left], [right]) => left!.localeCompare(right!));

  beforeEach(() => {
    tmpDir = makeTempDir();
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.clearAllMocks();
    writeTree(tmpDir, {
      app: {
        a: { "route.ts": route, "contract.ts": generated },
        b: { "route.ts": route },
        c: { "route.ts": route },
        stale: { "contract.ts": generated },
      },
      "rpc.ts": generated,
      "rpc-test-manifest.ts": generated,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanupTempDir(tmpDir);
  });

  it.each([false, true])("rejects reserved params filenames (check=%s)", (check) => {
    for (const paramsFile of ["route.ts", "page.tsx", "layout.js", "robots.ts"]) {
      writeTree(tmpDir, { app: { a: { [paramsFile]: "handwritten implementation" } } });
      const before = snapshot();

      expect(handleCli("app", "rpc.ts", { paramsFile, check }, logger)).toBe(1);
      expect(logger.error).toHaveBeenLastCalledWith(
        expect.stringContaining(
          `${path.join(tmpDir, "app", paramsFile)}: Next.js reserved filename`,
        ),
      );
      expect(snapshot()).toEqual(before);
    }
  });

  it.each([false, true])("preserves every file on a later route collision (check=%s)", (check) => {
    writeTree(tmpDir, { app: { c: { "contract.ts": "handwritten contract" } } });
    const before = snapshot();
    const writeSpy = vi.spyOn(fs, "writeFileSync");

    expect(handleCli("app", "rpc.ts", { paramsFile: "contract.ts", check }, logger)).toBe(1);
    expect(logger.error).toHaveBeenLastCalledWith(
      expect.stringContaining(
        `${path.join(tmpDir, "app", "c", "contract.ts")}: existing file has no rpc4next generated marker`,
      ),
    );
    expect(snapshot()).toEqual(before);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it.each(["rpc.ts", "rpc-test-manifest.ts"])("protects handwritten output %s", (fileName) => {
    writeTree(tmpDir, { [fileName]: "handwritten output" });
    const before = snapshot();

    expect(handleCli("app", "rpc.ts", { paramsFile: "contract.ts" }, logger)).toBe(1);
    expect(logger.error).toHaveBeenLastCalledWith(
      expect.stringContaining(
        `${toPosixPath(path.join(tmpDir, fileName))}: existing file has no rpc4next generated marker`,
      ),
    );
    expect(snapshot()).toEqual(before);
  });

  it.each([false, true])(
    "rejects duplicate generation targets before writing (check=%s)",
    (check) => {
      const before = snapshot();
      expect(
        handleCli(
          "app",
          "rpc.ts",
          {
            paramsFile: "contract.ts",
            testManifestOutputPath: path.join(tmpDir, "app", "a", "contract.ts"),
            check,
          },
          logger,
        ),
      ).toBe(1);
      expect(logger.error).toHaveBeenLastCalledWith(
        expect.stringContaining("duplicate output path"),
      );
      expect(snapshot()).toEqual(before);
    },
  );

  it("creates new files, updates marked files, and passes check without writes", () => {
    expect(handleCli("app", "rpc.ts", { paramsFile: "contract.ts" }, logger)).toBe(0);
    for (const name of ["a", "b", "c"]) {
      const content = fs.readFileSync(path.join(tmpDir, "app", name, "contract.ts"), "utf8");
      expect(content).toContain(ROUTE_CONTRACT_GENERATED_MARKER);
      expect(content).not.toBe(generated);
      expect(fs.readFileSync(path.join(tmpDir, "app", name, "route.ts"), "utf8")).toBe(route);
    }
    const before = snapshot();
    const writeSpy = vi.spyOn(fs, "writeFileSync");
    expect(handleCli("app", "rpc.ts", { paramsFile: "contract.ts", check: true }, logger)).toBe(0);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });

  it.each([generate, checkGenerated])(
    "protects direct generator calls from reserved filenames",
    (run) => {
      const before = snapshot();
      expect(() =>
        run({
          baseDir: path.join(tmpDir, "app"),
          outputPath: path.join(tmpDir, "rpc.ts"),
          paramsFileName: "route.ts",
          logger,
        }),
      ).toThrow("Next.js reserved filename");
      expect(snapshot()).toEqual(before);
    },
  );
});

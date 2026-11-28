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

  it.each(["icon1.ts", "icon12.ts"])("rejects reserved output filename %s", (output) => {
    const before = snapshot();

    expect(handleCli("app", output, {}, logger)).toBe(1);
    expect(logger.error).toHaveBeenLastCalledWith(
      expect.stringContaining("Next.js reserved filename"),
    );
    expect(snapshot()).toEqual(before);
  });

  it.each(["myroute.ts", "route.ts.backup", "robots.ts.backup", "icon-custom.ts"])(
    "allows non-reserved output filename %s",
    (output) => {
      expect(handleCli("app", output, {}, logger)).toBe(0);
      expect(fs.existsSync(path.join(tmpDir, output))).toBe(true);
    },
  );

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

  it.skipIf(process.platform !== "win32")(
    "rejects generation targets that differ only in case on Windows",
    () => {
      const before = snapshot();

      expect(handleCli("app", "app/a/CONTRACT.ts", { paramsFile: "contract.ts" }, logger)).toBe(1);
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
    expect(handleCli("app", "rpc.ts", { paramsFile: "contract.ts" }, logger)).toBe(0);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(handleCli("app", "rpc.ts", { paramsFile: "contract.ts", check: true }, logger)).toBe(0);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });

  it("preserves generated files with a different name during stale contract cleanup", () => {
    writeTree(tmpDir, { app: { stale: { "other.ts": generated } } });
    const otherFile = path.join(tmpDir, "app", "stale", "other.ts");
    const staleContract = path.join(tmpDir, "app", "stale", "contract.ts");

    expect(handleCli("app", "rpc.ts", { paramsFile: "contract.ts" }, logger)).toBe(0);

    expect(fs.existsSync(staleContract)).toBe(false);
    expect(fs.readFileSync(otherFile, "utf8")).toBe(generated);
  });

  it.each([
    ["app/_generated/route-contract.ts", "route-contract.ts", undefined],
    ["rpc.ts", "route-contract.ts", "app/_generated/route-contract.ts"],
    ["app/_generated/rpc.ts", "rpc-test-manifest.ts", undefined],
    ...(process.platform === "win32"
      ? [["app/_GENERATED/route-contract.ts", "route-contract.ts", undefined] as const]
      : []),
  ] as const)(
    "protects all current targets (output=%s, params=%s, manifest=%s)",
    (output, paramsFile, testManifestOutputPath) => {
      writeTree(tmpDir, {
        app: {
          _generated: {},
          obsolete: { [paramsFile]: generated },
          handwritten: { [paramsFile]: "handwritten contract" },
        },
      });
      const options = {
        paramsFile,
        ...(testManifestOutputPath ? { testManifestOutputPath } : {}),
      };
      const staleFile = path.join(tmpDir, "app", "obsolete", paramsFile);
      const handwrittenFile = path.join(tmpDir, "app", "handwritten", paramsFile);

      expect(handleCli("app", output, options, logger)).toBe(0);
      expect(fs.readFileSync(path.join(tmpDir, output), "utf8")).toContain(
        "export type PathStructure",
      );
      expect(fs.existsSync(staleFile)).toBe(false);
      expect(fs.readFileSync(handwrittenFile, "utf8")).toBe("handwritten contract");
      const before = snapshot();
      const writeSpy = vi.spyOn(fs, "writeFileSync");
      const removeSpy = vi.spyOn(fs, "rmSync");

      expect(handleCli("app", output, options, logger)).toBe(0);
      expect(handleCli("app", output, { ...options, check: true }, logger)).toBe(0);
      expect(writeSpy).not.toHaveBeenCalled();
      expect(removeSpy).not.toHaveBeenCalled();
      expect(snapshot()).toEqual(before);

      writeTree(tmpDir, { app: { obsolete: { [paramsFile]: generated } } });
      const beforeCheck = snapshot();
      expect(handleCli("app", output, { ...options, check: true }, logger)).toBe(1);
      expect(logger.error).toHaveBeenLastCalledWith(
        `Generated params file should be removed: ${path.relative(tmpDir, staleFile)}`,
      );
      expect(snapshot()).toEqual(beforeCheck);
    },
  );

  it("detects a route added between consecutive checks", () => {
    const options = {
      baseDir: path.join(tmpDir, "app"),
      outputPath: path.join(tmpDir, "rpc.ts"),
      paramsFileName: "contract.ts",
      logger,
    };
    generate(options);
    expect(checkGenerated(options)).toBe(true);

    writeTree(tmpDir, { app: { added: { "route.ts": route } } });

    expect(checkGenerated(options)).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("is stale"));
  });

  it("preserves route directory names containing a TypeScript extension in imports", () => {
    writeTree(tmpDir, { app: { "version.ts": { "route.ts": route } } });

    expect(handleCli("app", "rpc.ts", {}, logger)).toBe(0);
    expect(fs.readFileSync(path.join(tmpDir, "rpc-test-manifest.ts"), "utf8")).toContain(
      "./app/version.ts/route",
    );
  });

  it("preserves the output extension in the derived test manifest", () => {
    expect(handleCli("app", "rpc.mts", {}, logger)).toBe(0);

    const manifest = path.join(tmpDir, "rpc-test-manifest.mts");
    expect(fs.readFileSync(manifest, "utf8")).toContain(ROUTE_CONTRACT_GENERATED_MARKER);
    expect(handleCli("app", "rpc.mts", { check: true }, logger)).toBe(0);
  });

  it("uses a TypeScript manifest extension when the output has none", () => {
    expect(handleCli("app", "rpc", {}, logger)).toBe(0);

    const manifest = path.join(tmpDir, "rpc-test-manifest.ts");
    const content = fs.readFileSync(manifest, "utf8");
    expect(content).toContain(ROUTE_CONTRACT_GENERATED_MARKER);
    expect(content).not.toBe(generated);
    expect(handleCli("app", "rpc", { check: true }, logger)).toBe(0);
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

  it.each([generate, checkGenerated])(
    "rejects reserved params filenames even when no routes exist",
    (run) => {
      const emptyApp = path.join(tmpDir, "empty-app");
      fs.mkdirSync(emptyApp);
      const before = snapshot();

      expect(() =>
        run({
          baseDir: emptyApp,
          outputPath: path.join(tmpDir, "rpc.ts"),
          paramsFileName: "route.ts",
          logger,
        }),
      ).toThrow("Next.js reserved filename");
      expect(snapshot()).toEqual(before);
    },
  );
});

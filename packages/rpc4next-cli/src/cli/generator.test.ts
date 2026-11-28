import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupTempDir, makeTempDir, writeTree } from "../test-helpers/tmp-dir.js";
import { SUCCESS_INDENT_LEVEL, SUCCESS_PAD_LENGTH, SUCCESS_SEPARATOR } from "./constants.js";
import {
  clearScanCaches,
  clearScanAppDirCacheAbove,
  clearVisitedDirsCacheAbove,
  scanAppDirCache,
  visitedDirsCache,
} from "./core/cache.js";
import * as generatePathStructure from "./core/generate-path-structure.js";
import { ROUTE_CONTRACT_GENERATED_MARKER } from "./core/generate-path-structure.js";
import { checkGenerated, generate } from "./generator.js";
import { padMessage } from "./logger.js";

describe("generate", () => {
  const logger = {
    warn: vi.fn<(...args: unknown[]) => void>(),
    info: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
  };

  const baseDir = "test/base";
  const outputPath = "test/output/types.ts";
  const testManifestOutputPath = "test/output/types-test-manifest.ts";
  const paramsFileName = "params.ts";

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    scanAppDirCache.clear();
    visitedDirsCache.clear();
  });

  it("warns in generation and check, including cached watch scans", () => {
    const tmpDir = makeTempDir();
    const appDir = path.join(tmpDir, "app");
    const output = path.join(tmpDir, "src", "rpc.ts");
    const route = path.join(appDir, "api", "route.ts");
    try {
      writeTree(tmpDir, { app: { api: { "route.ts": "export * from './handlers';" } }, src: {} });
      const options = { baseDir: appDir, outputPath: output, paramsFileName: null, logger };
      generate({ ...options, preserveCache: true });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("./handlers"));
      logger.warn.mockClear();
      generate({ ...options, preserveCache: true });
      expect(logger.warn).toHaveBeenCalledTimes(1);
      logger.warn.mockClear();
      expect(checkGenerated(options)).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("route.ts"));
      fs.writeFileSync(route, "export { GET } from './handlers';");
      logger.warn.mockClear();
      generate(options);
      expect(logger.warn).not.toHaveBeenCalled();
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  it("generates imports only for exported route names", () => {
    const tmpDir = makeTempDir();
    const appDir = path.join(tmpDir, "app");
    const output = path.join(tmpDir, "src", "generated", "rpc.ts");

    try {
      writeTree(tmpDir, {
        app: {
          "route.ts": `const GET = () => new Response();
            // export const DELETE = () => new Response();
            export { GET as POST };`,
        },
        src: { generated: {} },
      });

      generate({ baseDir: appDir, outputPath: output, paramsFileName: null, logger });

      const generated = fs.readFileSync(output, "utf8");
      expect(generated).toMatch(/import type \{ POST as POST_/);
      expect(generated).not.toMatch(/import type \{ (GET|DELETE) as /);
      expect(generated).toContain('"$post"');
      expect(generated).not.toContain('"$get"');
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  it("clears scan caches after non-watch generation", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
      paramsTypes: [],
    });
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    visitedDirsCache.set("/cached/app", true);
    scanAppDirCache.set("cached-scan", {
      pathStructure: "cached",
      pathNode: { typeFragments: [], children: new Map() },
      imports: [],
      paramsTypes: [],
    });

    generate({
      baseDir,
      outputPath,
      paramsFileName: null,
      logger,
    });

    expect(visitedDirsCache.size).toBe(0);
    expect(scanAppDirCache.size).toBe(0);
  });

  it("preserves scan caches during watch generation", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
      paramsTypes: [],
    });
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    visitedDirsCache.set("/cached/app", true);
    scanAppDirCache.set("cached-scan", {
      pathStructure: "cached",
      pathNode: { typeFragments: [], children: new Map() },
      imports: [],
      paramsTypes: [],
    });

    generate({
      baseDir,
      outputPath,
      paramsFileName: null,
      logger,
      preserveCache: true,
    });

    expect(visitedDirsCache.size).toBe(1);
    expect(scanAppDirCache.size).toBe(1);
  });

  it("clears scan caches when non-watch generation throws", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockImplementation(() => {
      throw new Error("scan failed");
    });

    visitedDirsCache.set("/cached/app", true);
    scanAppDirCache.set("cached-scan", {
      pathStructure: "cached",
      pathNode: { typeFragments: [], children: new Map() },
      imports: [],
      paramsTypes: [],
    });

    expect(() =>
      generate({
        baseDir,
        outputPath,
        paramsFileName: null,
        logger,
      }),
    ).toThrow("scan failed");

    expect(visitedDirsCache.size).toBe(0);
    expect(scanAppDirCache.size).toBe(0);
  });

  it("writes the output file when it does not exist", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
      paramsTypes: [],
    });

    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    vi.spyOn(fs, "readFileSync").mockImplementation(() => "");
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    generate({
      baseDir,
      outputPath,
      paramsFileName: null,
      logger,
    });

    expect(logger.info).toHaveBeenCalledWith("Generating types...", {
      event: "generate",
    });

    expect(generatePathStructure.generatePathStructure).toHaveBeenCalledWith(outputPath, baseDir);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
    );
    expect(fs.readFileSync).not.toHaveBeenCalled();

    const expectedSuccessMessage = padMessage(
      "Path structure type",
      path.relative(process.cwd(), outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );

    expect(logger.success).toHaveBeenCalledWith(expectedSuccessMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
  });

  it("skips writing the output file when the content is unchanged", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
      paramsTypes: [],
    });

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath) => {
      if (filePath === testManifestOutputPath) {
        return generatePathStructure.generateTestManifest(testManifestOutputPath, []);
      }

      return `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`;
    });
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    generate({
      baseDir,
      outputPath,
      paramsFileName: null,
      logger,
    });

    expect(fs.readFileSync).toHaveBeenCalledWith(outputPath, "utf8");
    expect(fs.writeFileSync).not.toHaveBeenCalled();

    const expectedInfoMessage = padMessage(
      "Unchanged path type",
      path.relative(process.cwd(), outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );

    expect(logger.info).toHaveBeenNthCalledWith(2, expectedInfoMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
    expect(logger.success).not.toHaveBeenCalled();
  });

  it("writes the output file when the existing content differs", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
      paramsTypes: [],
    });

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      `${ROUTE_CONTRACT_GENERATED_MARKER}\nstale-content`,
    );
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    generate({
      baseDir,
      outputPath,
      paramsFileName: null,
      logger,
    });

    expect(fs.readFileSync).toHaveBeenCalledWith(outputPath, "utf8");
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
    );

    const expectedSuccessMessage = padMessage(
      "Path structure type",
      path.relative(process.cwd(), outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );

    expect(logger.success).toHaveBeenCalledWith(expectedSuccessMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
  });

  it("writes the test manifest to a configured output path", () => {
    const tmpDir = makeTempDir();
    const output = path.join(tmpDir, "src", "generated", "rpc.ts");
    const defaultTestManifestOutputPath = path.join(
      tmpDir,
      "src",
      "generated",
      "rpc-test-manifest.ts",
    );
    const customTestManifestOutputPath = path.join(tmpDir, "test", "generated", "routes.ts");

    try {
      writeTree(tmpDir, {
        src: {
          generated: {},
        },
      });

      vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
        pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
        paramsTypes: [],
        routeManifests: [],
      });

      generate({
        baseDir,
        outputPath: output,
        paramsFileName: null,
        testManifestOutputPath: customTestManifestOutputPath,
        logger,
      });

      expect(fs.readFileSync(customTestManifestOutputPath, "utf8")).toBe(
        generatePathStructure.generateTestManifest(customTestManifestOutputPath, []),
      );
      expect(fs.existsSync(defaultTestManifestOutputPath)).toBe(false);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  it("writes only new or changed params files when paramsFileName is provided", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
      paramsTypes: [
        { paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type-1`, dirPath: "dir1" },
        { paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type-2`, dirPath: "dir2" },
        { paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type-3`, dirPath: "dir3" },
      ],
    });

    vi.spyOn(fs, "existsSync").mockImplementation((filePath) => {
      return filePath !== outputPath && filePath !== path.join("dir1", paramsFileName);
    });
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath) => {
      if (filePath === path.join("dir2", paramsFileName)) {
        return `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type-2`;
      }

      if (filePath === path.join("dir3", paramsFileName)) {
        return `${ROUTE_CONTRACT_GENERATED_MARKER}\nold-params-type-3`;
      }

      return ROUTE_CONTRACT_GENERATED_MARKER;
    });
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    vi.spyOn(fs, "readdirSync").mockReturnValue([]);

    generate({
      baseDir,
      outputPath,
      paramsFileName,
      logger,
    });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("dir1", paramsFileName),
      `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type-1`,
    );
    expect(fs.writeFileSync).not.toHaveBeenCalledWith(
      path.join("dir2", paramsFileName),
      `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type-2`,
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("dir3", paramsFileName),
      `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type-3`,
    );
    expect(fs.writeFileSync).toHaveBeenCalledTimes(4);

    const expectedTypeMessage = padMessage(
      "Path structure type",
      path.relative(process.cwd(), outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );
    expect(logger.success).toHaveBeenCalledWith(expectedTypeMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });

    const expectedParamsMessage = padMessage(
      "Params types",
      paramsFileName,
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );
    expect(logger.success).toHaveBeenCalledWith(expectedParamsMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
  });

  it("logs unchanged params when all params files are unchanged", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
      paramsTypes: [
        { paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type-1`, dirPath: "dir1" },
      ],
    });

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath) => {
      if (filePath === outputPath) {
        return `${ROUTE_CONTRACT_GENERATED_MARKER}\nstale-content`;
      }

      return `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type-1`;
    });
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    vi.spyOn(fs, "readdirSync").mockReturnValue([]);

    generate({
      baseDir,
      outputPath,
      paramsFileName,
      logger,
    });

    const expectedParamsInfoMessage = padMessage(
      "Unchanged params",
      paramsFileName,
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );

    expect(logger.info).toHaveBeenNthCalledWith(2, expectedParamsInfoMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
    );
  });

  it("removes stale generated params files outside the current scan result", () => {
    const tmpDir = makeTempDir();
    const appDir = path.join(tmpDir, "app");
    const currentDir = path.join(appDir, "current");
    const staleDir = path.join(appDir, "stale");
    const staleFilePath = path.join(staleDir, paramsFileName);
    const currentFilePath = path.join(currentDir, paramsFileName);

    try {
      writeTree(tmpDir, {
        app: {
          current: {
            [paramsFileName]: `${ROUTE_CONTRACT_GENERATED_MARKER}\nold-current`,
          },
          stale: {
            [paramsFileName]: `${ROUTE_CONTRACT_GENERATED_MARKER}\nold-stale`,
          },
        },
        src: {
          generated: {},
        },
      });

      vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
        pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
        paramsTypes: [
          {
            paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\nnew-current`,
            dirPath: currentDir,
          },
        ],
      });

      generate({
        baseDir: appDir,
        outputPath: path.join(tmpDir, "src", "generated", "rpc.ts"),
        paramsFileName,
        logger,
      });

      expect(fs.existsSync(currentFilePath)).toBe(true);
      expect(fs.readFileSync(currentFilePath, "utf8")).toBe(
        `${ROUTE_CONTRACT_GENERATED_MARKER}\nnew-current`,
      );
      expect(fs.existsSync(staleFilePath)).toBe(false);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  it.each([false, true])("cleans stale watch files, including missing ones: %s", (removed) => {
    const tmpDir = makeTempDir();
    const appDir = path.join(tmpDir, "app");
    const currentDir = path.join(appDir, "current");
    const staleDir = path.join(appDir, "stale");
    const staleFilePath = path.join(staleDir, paramsFileName);

    try {
      writeTree(tmpDir, {
        app: {
          current: {},
          stale: {},
        },
        src: {
          generated: {},
        },
      });

      vi.spyOn(generatePathStructure, "generatePathStructure")
        .mockReturnValueOnce({
          pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
          paramsTypes: [
            {
              paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\ncurrent`,
              dirPath: currentDir,
            },
            {
              paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\nstale`,
              dirPath: staleDir,
            },
          ],
        })
        .mockReturnValueOnce({
          pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
          paramsTypes: [
            {
              paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\ncurrent`,
              dirPath: currentDir,
            },
          ],
        });

      const output = path.join(tmpDir, "src", "generated", "rpc.ts");

      generate({
        baseDir: appDir,
        outputPath: output,
        paramsFileName,
        logger,
        preserveCache: true,
      });

      if (removed) {
        fs.rmSync(staleFilePath);
      }

      generate({
        baseDir: appDir,
        outputPath: output,
        paramsFileName,
        logger,
        preserveCache: true,
      });

      expect(fs.existsSync(staleFilePath)).toBe(false);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  it.each([
    ["_users", false],
    ["_private/users", false],
    ["archive/users", true],
  ])("cleans moved watch contracts at %s (removed endpoint: %s)", (destination, removeRoute) => {
    const tmpDir = makeTempDir();
    const appDir = path.join(tmpDir, "app");
    const oldDir = path.join(appDir, "users");
    const movedDir = path.join(appDir, destination);
    const contractName = "route-contract.ts";
    const manualContent = "// handwritten contract";
    const otherContent = `${ROUTE_CONTRACT_GENERATED_MARKER}\nother contract`;

    try {
      writeTree(tmpDir, {
        app: {
          users: { "route.ts": "export function GET() {}" },
          keep: { "route.ts": "export function GET() {}" },
          _manual: { [contractName]: manualContent },
          _other: { "other-contract.ts": otherContent },
        },
        outside: { [contractName]: otherContent },
        generated: {},
      });
      const options = {
        baseDir: appDir,
        outputPath: path.join(tmpDir, "generated", "rpc.ts"),
        paramsFileName: contractName,
        logger,
      };
      generate({ ...options, preserveCache: true });
      expect(fs.existsSync(path.join(oldDir, contractName))).toBe(true);
      fs.mkdirSync(path.dirname(movedDir), { recursive: true });
      fs.renameSync(oldDir, movedDir);
      if (removeRoute) fs.rmSync(path.join(movedDir, "route.ts"));

      for (const dirPath of [oldDir, movedDir]) {
        const endpointPath = path.join(dirPath, "route.ts");
        clearVisitedDirsCacheAbove(endpointPath);
        clearScanAppDirCacheAbove(endpointPath);
      }
      generate({ ...options, preserveCache: true });

      expect(fs.existsSync(path.join(movedDir, contractName))).toBe(false);
      expect(fs.existsSync(path.join(appDir, "keep", contractName))).toBe(true);
      expect(fs.readFileSync(options.outputPath, "utf8")).not.toContain('"users"');
      expect(fs.readFileSync(path.join(appDir, "_manual", contractName), "utf8")).toBe(
        manualContent,
      );
      expect(fs.readFileSync(path.join(appDir, "_other", "other-contract.ts"), "utf8")).toBe(
        otherContent,
      );
      expect(fs.readFileSync(path.join(tmpDir, "outside", contractName), "utf8")).toBe(
        otherContent,
      );
      // checkGenerated clears scan caches, so run it only after testing the warm generation.
      expect(checkGenerated(options)).toBe(true);
    } finally {
      clearScanCaches();
      cleanupTempDir(tmpDir);
    }
  });

  it("keeps watch cleanup separate for different contract filenames", () => {
    const tmpDir = makeTempDir();
    const appDir = path.join(tmpDir, "app");
    const routeDir = path.join(appDir, "current");
    const firstName = "first-contract.ts";
    const secondName = "second-contract.ts";

    try {
      writeTree(tmpDir, { app: { current: {} }, src: { generated: {} } });
      vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
        pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
        paramsTypes: [
          { paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\ncurrent`, dirPath: routeDir },
        ],
      });
      const options = {
        baseDir: appDir,
        outputPath: path.join(tmpDir, "src", "generated", "rpc.ts"),
        logger,
        preserveCache: true,
      };

      generate({ ...options, paramsFileName: firstName });
      generate({ ...options, paramsFileName: secondName });

      expect(fs.existsSync(path.join(routeDir, firstName))).toBe(true);
      expect(fs.existsSync(path.join(routeDir, secondName))).toBe(true);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  it("keeps markerless params files even when they are stale", () => {
    const tmpDir = makeTempDir();
    const appDir = path.join(tmpDir, "app");
    const currentDir = path.join(appDir, "current");
    const manualDir = path.join(appDir, "manual");
    const manualFilePath = path.join(manualDir, paramsFileName);

    try {
      writeTree(tmpDir, {
        app: {
          current: {},
          manual: {
            [paramsFileName]: "handwritten-content",
          },
        },
        src: {
          generated: {},
        },
      });

      vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
        pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
        paramsTypes: [
          {
            paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\nnew-current`,
            dirPath: currentDir,
          },
        ],
      });

      generate({
        baseDir: appDir,
        outputPath: path.join(tmpDir, "src", "generated", "rpc.ts"),
        paramsFileName,
        logger,
      });

      expect(fs.existsSync(manualFilePath)).toBe(true);
      expect(fs.readFileSync(manualFilePath, "utf8")).toBe("handwritten-content");
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  it("does not cleanup stale params files when paramsFileName is null", () => {
    const tmpDir = makeTempDir();
    const appDir = path.join(tmpDir, "app");
    const staleFilePath = path.join(appDir, "stale", paramsFileName);

    try {
      writeTree(tmpDir, {
        app: {
          stale: {
            [paramsFileName]: `${ROUTE_CONTRACT_GENERATED_MARKER}\nstale`,
          },
        },
        src: {
          generated: {},
        },
      });

      vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
        pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
        paramsTypes: [],
      });

      generate({
        baseDir: appDir,
        outputPath: path.join(tmpDir, "src", "generated", "rpc.ts"),
        paramsFileName: null,
        logger,
      });

      expect(fs.existsSync(staleFilePath)).toBe(true);
    } finally {
      cleanupTempDir(tmpDir);
    }
  });
});

describe("checkGenerated", () => {
  const logger = {
    info: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
  };

  const baseDir = "test/base";
  const outputPath = "test/output/types.ts";
  const testManifestOutputPath = "test/output/types-test-manifest.ts";
  const paramsFileName = "params.ts";

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    scanAppDirCache.clear();
    visitedDirsCache.clear();
  });

  it("returns true when generated files are current without writing", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
      paramsTypes: [
        { paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type`, dirPath: "dir1" },
      ],
    });
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath) => {
      if (filePath === outputPath) {
        return `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`;
      }

      if (filePath === path.join("dir1", paramsFileName)) {
        return `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type`;
      }

      if (filePath === testManifestOutputPath) {
        return generatePathStructure.generateTestManifest(testManifestOutputPath, []);
      }

      return ROUTE_CONTRACT_GENERATED_MARKER;
    });
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    vi.spyOn(fs, "readdirSync").mockReturnValue([]);

    const result = checkGenerated({
      baseDir,
      outputPath,
      paramsFileName,
      logger,
    });

    expect(result).toBe(true);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("Checking generated types...", {
      event: "check",
    });
    expect(logger.success).toHaveBeenCalledWith("Generated files are up to date.");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns false when the path structure file is stale", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
      paramsTypes: [],
    });
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath) => {
      if (filePath === outputPath) {
        return `${ROUTE_CONTRACT_GENERATED_MARKER}\nstale-content`;
      }

      return generatePathStructure.generateTestManifest(testManifestOutputPath, []);
    });

    const result = checkGenerated({
      baseDir,
      outputPath,
      paramsFileName: null,
      logger,
    });

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      `Generated path structure is stale: ${path.relative(process.cwd(), outputPath)}`,
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.success).not.toHaveBeenCalled();
  });

  it("checks the test manifest at a configured output path", () => {
    const customTestManifestOutputPath = "test/generated/routes-for-tests.ts";
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
      paramsTypes: [],
      routeManifests: [],
    });
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath) => {
      if (filePath === outputPath) {
        return `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`;
      }

      if (filePath === customTestManifestOutputPath) {
        return generatePathStructure.generateTestManifest(customTestManifestOutputPath, []);
      }

      return ROUTE_CONTRACT_GENERATED_MARKER;
    });

    const result = checkGenerated({
      baseDir,
      outputPath,
      paramsFileName: null,
      testManifestOutputPath: customTestManifestOutputPath,
      logger,
    });

    expect(result).toBe(true);
    expect(fs.readFileSync).toHaveBeenCalledWith(customTestManifestOutputPath, "utf8");
    expect(fs.readFileSync).not.toHaveBeenCalledWith(testManifestOutputPath, "utf8");
  });

  it.each(["missing params", "extra params", "stale manifest"] as const)(
    "returns false when only the %s is out of date",
    (staleTarget) => {
      const tmpDir = makeTempDir();
      const appDir = path.join(tmpDir, "app");
      const currentDir = path.join(appDir, "current");
      const output = path.join(tmpDir, "generated", "rpc.ts");
      const manifest = path.join(tmpDir, "generated", "rpc-test-manifest.ts");
      const currentParams = path.join(currentDir, paramsFileName);
      const extraParams = path.join(appDir, "extra", paramsFileName);
      const pathStructure = `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`;
      const paramsType = `${ROUTE_CONTRACT_GENERATED_MARKER}\nparams-type`;

      try {
        writeTree(tmpDir, {
          app: {
            current: staleTarget === "missing params" ? {} : { [paramsFileName]: paramsType },
            ...(staleTarget === "extra params" ? { extra: { [paramsFileName]: paramsType } } : {}),
          },
          generated: {
            "rpc.ts": pathStructure,
            "rpc-test-manifest.ts":
              staleTarget === "stale manifest"
                ? `${ROUTE_CONTRACT_GENERATED_MARKER}\nstale manifest`
                : generatePathStructure.generateTestManifest(manifest, []),
          },
        });
        vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
          pathStructure,
          paramsTypes: [{ paramsType, dirPath: currentDir }],
        });

        const result = checkGenerated({
          baseDir: appDir,
          outputPath: output,
          paramsFileName,
          logger,
        });

        const expectedError =
          staleTarget === "missing params"
            ? `Generated params file is stale: ${path.relative(process.cwd(), currentParams)}`
            : staleTarget === "extra params"
              ? `Generated params file should be removed: ${path.relative(process.cwd(), extraParams)}`
              : `Generated test manifest is stale: ${path.relative(process.cwd(), manifest)}`;
        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalledExactlyOnceWith(expectedError);
        expect(logger.success).not.toHaveBeenCalled();
      } finally {
        cleanupTempDir(tmpDir);
      }
    },
  );

  it("returns false when params files are missing or should be removed", () => {
    const tmpDir = makeTempDir();
    const appDir = path.join(tmpDir, "app");
    const currentDir = path.join(appDir, "current");
    const staleDir = path.join(appDir, "stale");
    const output = path.join(tmpDir, "src", "generated", "rpc.ts");
    const staleFilePath = path.join(staleDir, paramsFileName);

    try {
      writeTree(tmpDir, {
        app: {
          current: {},
          stale: {
            [paramsFileName]: `${ROUTE_CONTRACT_GENERATED_MARKER}\nstale`,
          },
        },
        src: {
          generated: {
            "rpc.ts": `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
          },
        },
      });

      vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
        pathStructure: `${ROUTE_CONTRACT_GENERATED_MARKER}\ngenerated-type-content`,
        paramsTypes: [
          {
            paramsType: `${ROUTE_CONTRACT_GENERATED_MARKER}\ncurrent`,
            dirPath: currentDir,
          },
        ],
      });

      const result = checkGenerated({
        baseDir: appDir,
        outputPath: output,
        paramsFileName,
        logger,
      });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        `Generated params file is stale: ${path.relative(
          process.cwd(),
          path.join(currentDir, paramsFileName),
        )}`,
      );
      expect(logger.error).toHaveBeenCalledWith(
        `Generated params file should be removed: ${path.relative(process.cwd(), staleFilePath)}`,
      );
    } finally {
      cleanupTempDir(tmpDir);
    }
  });
});

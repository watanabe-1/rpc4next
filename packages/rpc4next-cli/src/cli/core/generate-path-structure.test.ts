import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupTempDir, makeTempDir } from "../../test-helpers/tmp-dir.js";
import {
  NEWLINE,
  RPC4NEXT_CLIENT_IMPORT_PATH,
  STATEMENT_TERMINATOR,
  TYPE_KEY_PARAMS,
  TYPE_KEY_QUERY,
  TYPE_RPC_ENDPOINT,
} from "./constants.js";
import { generatePathStructure } from "./generate-path-structure.js";

const scanAppDir = vi.hoisted(() => vi.fn());
vi.mock("./route-scanner.js", () => ({
  scanAppDir,
}));

vi.mock("./type-utils.js", () => ({
  createImport: vi.fn(
    (type, importPath) => `import type { ${type} } from "${importPath}";`,
  ),
}));

describe("generatePathStructure", () => {
  let tmpDir: string | null = null;

  afterEach(() => {
    cleanupTempDir(tmpDir);
    tmpDir = null;
    scanAppDir.mockReset();
  });

  it("should generate correct type definitions and imports", () => {
    tmpDir = makeTempDir();

    scanAppDir.mockReturnValue({
      pathStructure: `{ home: ${TYPE_RPC_ENDPOINT}, user: { id: ${TYPE_KEY_PARAMS} }, ${TYPE_KEY_QUERY}}`,
      imports: [
        {
          path: "./routes/home",
          statement: "import Home from './routes/home';",
        },
        {
          path: "./routes/user",
          statement: "import User from './routes/user';",
        },
      ],
      paramsTypes: [
        {
          paramsType: '{ "hoge": string }',
          dirPath: path.join(tmpDir, "[hoge]", "bar"),
        },
      ],
    });

    const outputPath = path.join(tmpDir, "output");
    const baseDir = path.join(tmpDir, "base");
    const { pathStructure, paramsTypes } = generatePathStructure(
      outputPath,
      baseDir,
    );

    const expectedImports =
      `import type { ${TYPE_RPC_ENDPOINT} ,${TYPE_KEY_PARAMS} ,${TYPE_KEY_QUERY} } from "${RPC4NEXT_CLIENT_IMPORT_PATH}"${STATEMENT_TERMINATOR}${NEWLINE}` +
      `import Home from './routes/home';${NEWLINE}import User from './routes/user';`;

    const expectedTypeDefinition = `export type PathStructure = { home: ${TYPE_RPC_ENDPOINT}, user: { id: ${TYPE_KEY_PARAMS} }, ${TYPE_KEY_QUERY}}${STATEMENT_TERMINATOR}`;

    expect(pathStructure).toBe(
      `${expectedImports}${NEWLINE}${NEWLINE}${expectedTypeDefinition}`,
    );
    expect(paramsTypes).toStrictEqual([
      {
        paramsType: 'export type Params = { "hoge": string };',
        dirPath: path.join(tmpDir, "[hoge]", "bar"),
      },
    ]);
  });

  it("should handle cases with no imports", () => {
    tmpDir = makeTempDir();

    scanAppDir.mockReturnValue({
      pathStructure: `{ dashboard: ${TYPE_RPC_ENDPOINT} }`,
      imports: [],
      paramsTypes: [],
    });

    const outputPath = path.join(tmpDir, "output");
    const baseDir = path.join(tmpDir, "base");
    const { pathStructure, paramsTypes } = generatePathStructure(
      outputPath,
      baseDir,
    );

    const expectedImports = `import type { ${TYPE_RPC_ENDPOINT} } from "${RPC4NEXT_CLIENT_IMPORT_PATH}"${STATEMENT_TERMINATOR}${NEWLINE}${NEWLINE}`;
    const expectedTypeDefinition = `export type PathStructure = { dashboard: ${TYPE_RPC_ENDPOINT} }${STATEMENT_TERMINATOR}`;

    expect(pathStructure).toBe(
      `${expectedImports}${NEWLINE}${expectedTypeDefinition}`,
    );
    expect(paramsTypes).toStrictEqual([]);
  });
});

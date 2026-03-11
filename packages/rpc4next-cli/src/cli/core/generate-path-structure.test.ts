import mock from "mock-fs";
import { describe, expect, it, vi } from "vitest";
import {
  NEWLINE,
  RPC4NEXT_CLIENT_IMPORT_PATH,
  STATEMENT_TERMINATOR,
  TYPE_END_POINT,
  TYPE_KEY_PARAMS,
  TYPE_KEY_QUERY,
} from "./constants.js";
import { generatePathStructure } from "./generate-path-structure.js";

const scanAppDir = vi.hoisted(() => vi.fn());
vi.mock("./route-scanner.js", () => ({
  scanAppDir,
}));

vi.mock("./type-utils.js", () => ({
  createImport: vi.fn(
    (type, path) => `import type { ${type} } from "${path}";`,
  ),
}));

mock({
  "/[hoge]": { bar: { "route.ts": "dummy content" } },
});

describe("generatePathStructure", () => {
  it("should generate correct type definitions and imports", () => {
    scanAppDir.mockReturnValue({
      pathStructure: `{ home: ${TYPE_END_POINT}, user: { id: ${TYPE_KEY_PARAMS} }, ${TYPE_KEY_QUERY}}`,
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
        { paramsType: '{ "hoge": string }', dirPath: "/[hoge]/bar" },
      ],
    });

    const outputPath = "./output";
    const baseDir = "./base";
    const { pathStructure, paramsTypes } = generatePathStructure(
      outputPath,
      baseDir,
    );

    const expectedImports =
      `import type { ${TYPE_END_POINT} ,${TYPE_KEY_PARAMS} ,${TYPE_KEY_QUERY} } from "${RPC4NEXT_CLIENT_IMPORT_PATH}"${STATEMENT_TERMINATOR}${NEWLINE}` +
      `import Home from './routes/home';${NEWLINE}import User from './routes/user';`;

    const expectedTypeDefinition = `export type PathStructure = { home: ${TYPE_END_POINT}, user: { id: ${TYPE_KEY_PARAMS} }, ${TYPE_KEY_QUERY}}${STATEMENT_TERMINATOR}`;

    expect(pathStructure).toBe(
      `${expectedImports}${NEWLINE}${NEWLINE}${expectedTypeDefinition}`,
    );
    expect(paramsTypes).toStrictEqual([
      {
        paramsType: 'export type Params = { "hoge": string };',
        dirPath: "/[hoge]/bar",
      },
    ]);
  });

  it("should handle cases with no imports", () => {
    scanAppDir.mockReturnValue({
      pathStructure: `{ dashboard: ${TYPE_END_POINT} }`,
      imports: [],
      paramsTypes: [],
    });

    const outputPath = "./output";
    const baseDir = "./base";
    const { pathStructure, paramsTypes } = generatePathStructure(
      outputPath,
      baseDir,
    );

    const expectedImports = `import type { ${TYPE_END_POINT} } from "${RPC4NEXT_CLIENT_IMPORT_PATH}"${STATEMENT_TERMINATOR}${NEWLINE}${NEWLINE}`;
    const expectedTypeDefinition = `export type PathStructure = { dashboard: ${TYPE_END_POINT} }${STATEMENT_TERMINATOR}`;

    expect(pathStructure).toBe(
      `${expectedImports}${NEWLINE}${expectedTypeDefinition}`,
    );
    expect(paramsTypes).toStrictEqual([]);
  });
});

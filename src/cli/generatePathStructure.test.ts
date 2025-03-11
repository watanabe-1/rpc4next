import { describe, it, expect, vi } from "vitest";
import {
  STATEMENT_TERMINATOR,
  NEWLINE,
  TYPE_KEY_OPTIONAL_QUERY,
  TYPE_KEY_QUERY,
} from "./constants";
import { TYPE_KEY_PARAMS, TYPE_END_POINT } from "./constants";
import { generatePages } from "./generatePathStructure";

const scanAppDir = vi.hoisted(() => vi.fn());
vi.mock("./routeScanner", () => ({
  scanAppDir,
}));

vi.mock("./typeUtils", () => ({
  createImport: vi.fn(
    (type, path) => `import type { ${type} } from "${path}";`
  ),
}));

describe("generatePages", () => {
  it("should generate correct type definitions and imports", () => {
    scanAppDir.mockReturnValue({
      pathStructure: `{ home: ${TYPE_END_POINT}, user: { id: ${TYPE_KEY_PARAMS} }, ${TYPE_KEY_QUERY}, ${TYPE_KEY_OPTIONAL_QUERY}}`,
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
    });

    const outputPath = "./output";
    const baseDir = "./base";
    const result = generatePages(outputPath, baseDir);

    const expectedImports =
      `import type { ${TYPE_END_POINT} ,${TYPE_KEY_OPTIONAL_QUERY} ,${TYPE_KEY_PARAMS} ,${TYPE_KEY_QUERY} } from "rpc4next/client"${STATEMENT_TERMINATOR}${NEWLINE}` +
      `import Home from './routes/home';${NEWLINE}import User from './routes/user';`;

    const expectedTypeDefinition = `export type PathStructure = { home: ${TYPE_END_POINT}, user: { id: ${TYPE_KEY_PARAMS} }, ${TYPE_KEY_QUERY}, ${TYPE_KEY_OPTIONAL_QUERY}}${STATEMENT_TERMINATOR}`;

    expect(result).toBe(
      `${expectedImports}${NEWLINE}${NEWLINE}${expectedTypeDefinition}`
    );
  });

  it("should handle cases with no imports", () => {
    scanAppDir.mockReturnValue({
      pathStructure: `{ dashboard: ${TYPE_END_POINT} }`,
      imports: [],
    });

    const outputPath = "./output";
    const baseDir = "./base";
    const result = generatePages(outputPath, baseDir);

    const expectedImports = `import type { ${TYPE_END_POINT} } from "rpc4next/client"${STATEMENT_TERMINATOR}${NEWLINE}${NEWLINE}`;
    const expectedTypeDefinition = `export type PathStructure = { dashboard: ${TYPE_END_POINT} }${STATEMENT_TERMINATOR}`;

    expect(result).toBe(
      `${expectedImports}${NEWLINE}${expectedTypeDefinition}`
    );
  });
});

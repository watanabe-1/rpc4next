import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanupTempDir,
  makeTempDir,
  writeTree,
} from "../../test-helpers/tmp-dir.js";
import { scanEndpointFile } from "./scan-utils.js";

vi.mock("./type-utils.js", () => ({
  createImport: vi.fn(
    (type, importPath, alias) =>
      `import type { ${type} as ${alias} } from '${importPath}';`,
  ),
  createRecodeType: vi.fn((key, alias) => `Record<${key}, ${alias}>`),
  createObjectType: vi.fn(
    (entries) =>
      `{ ${entries.map((e: { name: string; type: string }) => `"${e.name}": ${e.type}`).join(",")} }`,
  ),
}));

describe("scanEndpointFile", () => {
  let tmpDir: string | null = null;

  afterEach(() => {
    cleanupTempDir(tmpDir);
    tmpDir = null;
    vi.restoreAllMocks();
  });

  const createPaths = () => {
    tmpDir = makeTempDir();
    const rootDir = tmpDir;

    return {
      inputFile: path.join(rootDir, "input.ts"),
      outputFile: path.join(rootDir, "output.ts"),
      rootDir,
    };
  };

  it("should return a query definition for an exported interface", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export interface Query { id: number; }",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.query).toBeDefined();
    expect(result.query?.importName).toBe("Query_da299b9577978fcd");
    expect(result.query?.importPath).toBe("./input");
    expect(result.query?.importStatement).toBe(
      "import type { Query as Query_da299b9577978fcd } from './input';",
    );
    expect(result.query?.type).toBe("Record<QueryKey, Query_da299b9577978fcd>");
    expect(result.routes).toEqual([]);
  });

  it("should return a query definition for an exported type alias", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export type Query = { id: number; }",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.query?.importName).toBe("Query_da299b9577978fcd");
    expect(result.query?.type).toBe("Record<QueryKey, Query_da299b9577978fcd>");
    expect(result.routes).toEqual([]);
  });

  it("should omit query when no relevant query definition exists", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export interface OtherType { value: string; }",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.query).toBeUndefined();
  });

  it("should return a route definition for an exported async function", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export async function GET() { return { data: 'test' }; }",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.importName).toBe("GET_84a33c1aab9019d2");
    expect(result.routes[0]?.importPath).toBe("./input");
    expect(result.routes[0]?.importStatement).toBe(
      "import type { GET as GET_84a33c1aab9019d2 } from './input';",
    );
    expect(result.routes[0]?.type).toBe(
      '{ "$get": typeof GET_84a33c1aab9019d2 }',
    );
  });

  it("should return a route definition for an exported constant function", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export const PATCH = ()=> { return { data: 'test' }; }",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.importName).toBe("PATCH_2fb9d0ae6e8b8cfc");
    expect(result.routes[0]?.type).toBe(
      '{ "$patch": typeof PATCH_2fb9d0ae6e8b8cfc }',
    );
  });

  it("should return a route definition for a destructured export", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts":
        'export const { POST } = app.post((rc) => rc.json({test: "hello"}))',
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.importName).toBe("POST_8393a35405bb7d7f");
    expect(result.routes[0]?.type).toBe(
      '{ "$post": typeof POST_8393a35405bb7d7f }',
    );
  });

  it("should return a route definition for a re-exported function", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": 'export { DELETE } from "@/features/delete";',
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.importName).toBe("DELETE_bacf7eb8c865f8b9");
    expect(result.routes[0]?.type).toBe(
      '{ "$delete": typeof DELETE_bacf7eb8c865f8b9 }',
    );
  });

  it("should return stable aliases for multiple scans of the same route", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": 'export { PUT } from "@/features/put";',
    });

    const result1 = scanEndpointFile(outputFile, inputFile);
    const result2 = scanEndpointFile(outputFile, inputFile);

    expect(result1.routes[0]?.importName).toBe("PUT_203d1825e2307ab2");
    expect(result2.routes[0]?.importName).toBe("PUT_203d1825e2307ab2");
    expect(result2.routes[0]?.type).toBe(
      '{ "$put": typeof PUT_203d1825e2307ab2 }',
    );
  });

  it("should skip non-matching route definitions", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export function OTHER() { return { data: 'test' }; }",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toEqual([]);
  });

  it("should read the file once and return query plus all matching routes", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": `
        export interface Query { id: number; }
        export async function GET() { return { data: "get" }; }
        export const POST = () => ({ data: "post" });
      `,
    });
    const readFileSyncSpy = vi.spyOn(fs, "readFileSync");

    const result = scanEndpointFile(outputFile, inputFile);

    expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(result.query?.importName).toBe("Query_da299b9577978fcd");
    expect(result.query?.type).toBe("Record<QueryKey, Query_da299b9577978fcd>");
    expect(result.routes).toHaveLength(2);
    expect(result.routes.map((route) => route.importName)).toEqual([
      "GET_84a33c1aab9019d2",
      "POST_8393a35405bb7d7f",
    ]);
    expect(result.routes.map((route) => route.type)).toEqual([
      '{ "$get": typeof GET_84a33c1aab9019d2 }',
      '{ "$post": typeof POST_8393a35405bb7d7f }',
    ]);
  });
});

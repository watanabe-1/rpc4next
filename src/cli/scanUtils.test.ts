import mock from "mock-fs";
import { describe, it, expect, afterEach, vi } from "vitest";
import { scanQuery, scanRoute } from "./scanUtils";

vi.mock("./typeUtils", () => ({
  createImport: vi.fn(
    (type, path, alias) => `import type { ${type} as ${alias} } from '${path}';`
  ),
  createRecodeType: vi.fn((key, alias) => `Record<${key}, ${alias}>`),
  createObjectType: vi.fn(
    (entries) =>
      `{ ${entries.map((e: { name: string; type: string }) => `"${e.name}": ${e.type}`).join(",")} }`
  ),
}));

describe("scanQuery", () => {
  afterEach(() => {
    mock.restore();
  });

  it("should return a query definition for an exported interface", () => {
    mock({
      "input.ts": "export interface Query { id: number; }",
    });

    const result = scanQuery("output.ts", "input.ts");
    expect(result).toBeDefined();
    expect(result?.importName).toBe("Query_0");
    expect(result?.importPath).toBe("./input");
    expect(result?.importStatement).toBe(
      "import type { Query as Query_0 } from './input';"
    );
    expect(result?.type).toBe("Record<QueryKey, Query_0>");
  });

  it("should return a query definition for an exported type alias", () => {
    mock({
      "input.ts": "export type OptionalQuery = { id: number; }",
    });

    const result = scanQuery("output.ts", "input.ts");
    expect(result).toBeDefined();
    expect(result?.importName).toBe("OptionalQuery_0");
    expect(result?.importPath).toBe("./input");
    expect(result?.importStatement).toBe(
      "import type { OptionalQuery as OptionalQuery_0 } from './input';"
    );
    expect(result?.type).toBe("Record<OptionalQueryKey, OptionalQuery_0>");
  });

  it("should return undefined when no relevant query definition exists", () => {
    mock({ "input.ts": "export interface OtherType { value: string; }" });
    const result = scanQuery("output.ts", "input.ts");
    expect(result).toBeUndefined();
  });
});

describe("scanRoute", () => {
  afterEach(() => {
    mock.restore();
  });

  it("should return a route definition for an exported async function", () => {
    mock({
      "input.ts": "export async function GET() { return { data: 'test' }; }",
    });

    const result = scanRoute("output.ts", "input.ts", "GET");
    expect(result).toBeDefined();
    expect(result?.importName).toBe("GET_0");
    expect(result?.importPath).toBe("./input");
    expect(result?.importStatement).toBe(
      "import type { GET as GET_0 } from './input';"
    );
    expect(result?.type).toBe('{ "$get": typeof GET_0 }');
  });

  it("should return a route definition for an exported constant function", () => {
    mock({
      "input.ts": "export const PATCH = ()=> { return { data: 'test' }; }",
    });

    const result = scanRoute("output.ts", "input.ts", "PATCH");
    expect(result).toBeDefined();
    expect(result?.importName).toBe("PATCH_0");
    expect(result?.importPath).toBe("./input");
    expect(result?.importStatement).toBe(
      "import type { PATCH as PATCH_0 } from './input';"
    );
    expect(result?.type).toBe('{ "$patch": typeof PATCH_0 }');
  });

  it("should return a route definition for a destructured export", () => {
    mock({
      "input.ts":
        'export const { POST } = app.post((c) => c.json({test: "hello"}))',
    });

    const result = scanRoute("output.ts", "input.ts", "POST");
    expect(result).toBeDefined();
    expect(result?.importName).toBe("POST_0");
    expect(result?.importPath).toBe("./input");
    expect(result?.importStatement).toBe(
      "import type { POST as POST_0 } from './input';"
    );
    expect(result?.type).toBe('{ "$post": typeof POST_0 }');
  });

  it("should return a route definition for a re-exported function", () => {
    mock({
      "input.ts": 'export { DELETE } from "@/features/delete";',
    });

    const result = scanRoute("output.ts", "input.ts", "DELETE");
    expect(result).toBeDefined();
    expect(result?.importName).toBe("DELETE_0");
    expect(result?.importPath).toBe("./input");
    expect(result?.importStatement).toBe(
      "import type { DELETE as DELETE_0 } from './input';"
    );
    expect(result?.type).toBe('{ "$delete": typeof DELETE_0 }');
  });

  it("should increment alias count for multiple imports of the same route", () => {
    mock({
      "input.ts": 'export { PUT } from "@/features/put";',
    });

    const result = scanRoute("output.ts", "input.ts", "PUT");
    expect(result).toBeDefined();
    expect(result?.importName).toBe("PUT_0");
    expect(result?.importPath).toBe("./input");
    expect(result?.importStatement).toBe(
      "import type { PUT as PUT_0 } from './input';"
    );
    expect(result?.type).toBe('{ "$put": typeof PUT_0 }');

    const result2 = scanRoute("output.ts", "input.ts", "PUT");
    expect(result2).toBeDefined();
    expect(result2?.importName).toBe("PUT_1");
    expect(result2?.importPath).toBe("./input");
    expect(result2?.importStatement).toBe(
      "import type { PUT as PUT_1 } from './input';"
    );
    expect(result2?.type).toBe('{ "$put": typeof PUT_1 }');
  });

  it("should return undefined when no matching route definition exists", () => {
    mock({ "input.ts": "export function POST() { return { data: 'test' }; }" });
    const result = scanRoute("output.ts", "input.ts", "GET");
    expect(result).toBeUndefined();
  });
});

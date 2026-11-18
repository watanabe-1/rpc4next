import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanupTempDir, makeTempDir, writeTree } from "../../test-helpers/tmp-dir.js";
import { scanEndpointFile } from "./scan-utils.js";

vi.mock("./type-utils.js", () => ({
  createImport: vi.fn<(type: string, importPath: string, alias: string) => string>(
    (type, importPath, alias) => `import type { ${type} as ${alias} } from '${importPath}';`,
  ),
  createDefaultImport: vi.fn<(importPath: string, alias: string) => string>(
    (importPath, alias) => `import type ${alias} from '${importPath}';`,
  ),
  createRecodeType: vi.fn<(key: string, alias: string) => string>(
    (key, alias) => `Record<${key}, ${alias}>`,
  ),
  createObjectType: vi.fn<(entries: { name: string; type: string }[]) => string>(
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

  it.each([
    "export\ninterface\nQuery\n{ id: number }",
    "export\ntype\nQuery\n= { id: number }",
    "export { Search as Query }; interface Search { id: number }",
    "type Search = { id: number }; export type { Search as Query }",
    "export { type Search as Query } from './types'",
    "export type { Query } from './types'",
    "export { Query } from './types'",
    "import type { Search } from './types'; export type { Search as Query }",
  ])("detects Query exported through TypeScript syntax: %s", (source) => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, { "input.ts": source });

    expect(scanEndpointFile(outputFile, inputFile).query?.exportName).toBe("Query");
  });

  it.each([
    "// export type Query = { id: number }\nexport const GET = () => null",
    "const text = 'export interface Query { }'; export { text }",
    "interface Query { id: number }; export type { Query as Other }",
    "const Query = 1; export { Query }",
  ])("does not detect a Query type from unrelated syntax: %s", (source) => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, { "input.ts": source });

    expect(scanEndpointFile(outputFile, inputFile).query).toBeUndefined();
  });

  it("keeps page inference when Query only appears in a comment", () => {
    const { outputFile, rootDir } = createPaths();
    const inputFile = path.join(rootDir, "app", "search", "page.tsx");
    writeTree(rootDir, {
      "app/search/page.tsx": "// export type Query = {}\nexport default function Page() {}",
    });

    expect(scanEndpointFile(outputFile, inputFile).query?.type).toBe(
      "PageRouteMarker<typeof Page_51d775b458cca87b>",
    );
  });

  it("should omit query when no relevant query definition exists", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export interface OtherType { value: string; }",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.query).toBeUndefined();
  });

  it("should add a page query marker for page files without an exported Query type", () => {
    const { outputFile, rootDir } = createPaths();
    const inputFile = path.join(rootDir, "app", "search", "page.tsx");
    writeTree(rootDir, {
      "app/search/page.tsx": `
        const page = procedure
          .handle(() => ({ body: {} }));

        export default page;
      `,
    });

    const result = scanEndpointFile(outputFile, inputFile);

    expect(result.query?.importName).toBe("Page_51d775b458cca87b");
    expect(result.query?.importPath).toBe("./app/search/page");
    expect(result.query?.importStatement).toBe(
      "import type Page_51d775b458cca87b from './app/search/page';",
    );
    expect(result.query?.type).toBe("PageRouteMarker<typeof Page_51d775b458cca87b>");
  });

  it("should not inspect helper spelling when adding a page query marker", () => {
    const { outputFile, rootDir } = createPaths();
    const inputFile = path.join(rootDir, "app", "search", "page.tsx");
    writeTree(rootDir, {
      "app/search/page.tsx": `
        const withQuery = appPageProcedure
          .query(querySchema);

        const Page = withQuery
          .page(() => null);

        export default Page;
      `,
    });

    const result = scanEndpointFile(outputFile, inputFile);

    expect(result.query?.type).toBe("PageRouteMarker<typeof Page_51d775b458cca87b>");
  });

  it("should prefer an exported query type over default page query inference", () => {
    const { outputFile, rootDir } = createPaths();
    const inputFile = path.join(rootDir, "app", "search", "page.tsx");
    writeTree(rootDir, {
      "app/search/page.tsx": `
        export type Query = { q?: string };
        export default procedure
          .query(querySchema)
          .handle(() => ({ body: {} }))
          .page(() => null);
      `,
    });

    const result = scanEndpointFile(outputFile, inputFile);

    expect(result.query?.importName).toBe("Query_426664e2544b3fd1");
    expect(result.query?.type).toBe("Record<QueryKey, Query_426664e2544b3fd1>");
  });

  it("should not add a page query marker to route files", () => {
    const { outputFile, rootDir } = createPaths();
    const inputFile = path.join(rootDir, "app", "search", "route.ts");
    writeTree(rootDir, {
      "app/search/route.ts": "export default function handler() {}",
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
    expect(result.routes[0]?.type).toBe('{ "$get": typeof GET_84a33c1aab9019d2 }');
  });

  it("should return a route definition for an exported constant function", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export const PATCH = ()=> { return { data: 'test' }; }",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.importName).toBe("PATCH_2fb9d0ae6e8b8cfc");
    expect(result.routes[0]?.type).toBe('{ "$patch": typeof PATCH_2fb9d0ae6e8b8cfc }');
  });

  it("should return a route definition for a type annotated constant function", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export const GET: RouteHandler = () => ({ data: 'test' });",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.importName).toBe("GET_84a33c1aab9019d2");
    expect(result.routes[0]?.type).toBe('{ "$get": typeof GET_84a33c1aab9019d2 }');
  });

  it("should return a route definition for a function type annotated constant", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export const POST: (request: Request) => Response = () => new Response();",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.importName).toBe("POST_8393a35405bb7d7f");
    expect(result.routes[0]?.type).toBe('{ "$post": typeof POST_8393a35405bb7d7f }');
  });

  it("should return a route definition for a destructured export", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": 'export const { POST } = app.post((rc) => rc.json({test: "hello"}))',
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.importName).toBe("POST_8393a35405bb7d7f");
    expect(result.routes[0]?.type).toBe('{ "$post": typeof POST_8393a35405bb7d7f }');
  });

  it("should return a route definition for a re-exported function", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": 'export { DELETE } from "@/features/delete";',
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.importName).toBe("DELETE_bacf7eb8c865f8b9");
    expect(result.routes[0]?.type).toBe('{ "$delete": typeof DELETE_bacf7eb8c865f8b9 }');
  });

  it("should return a route definition for an exported binding list", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "const GET = () => ({ data: 'test' }); export { GET };",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.importName).toBe("GET_84a33c1aab9019d2");
    expect(result.routes[0]?.type).toBe('{ "$get": typeof GET_84a33c1aab9019d2 }');
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
    expect(result2.routes[0]?.type).toBe('{ "$put": typeof PUT_203d1825e2307ab2 }');
  });

  it.each([
    {
      name: "an HTTP method exported under another HTTP method name",
      source: "const GET = () => new Response(); export { GET as POST };",
      methods: ["POST"],
    },
    {
      name: "a handler exported under an HTTP method name",
      source: "const handler = () => new Response(); export { handler as GET };",
      methods: ["GET"],
    },
    {
      name: "an HTTP method exported under a non-method name",
      source: "const GET = () => new Response(); export { GET as handler };",
      methods: [],
    },
    {
      name: "aliased re-exports",
      source: 'export { GET as POST, handler as PUT, DELETE as other } from "./handlers";',
      methods: ["POST", "PUT"],
    },
    {
      name: "string export names",
      source: 'const handler = () => new Response(); export { handler as "GET" };',
      methods: ["GET"],
    },
    {
      name: "renamed destructured properties",
      source: "export const { GET: handler, handler: POST } = handlers;",
      methods: ["POST"],
    },
    {
      name: "nested bindings, defaults, computed properties, and rest bindings",
      source: `export const {
        GET: { handler: POST = () => new Response() },
        ["PUT"]: helper,
        ...DELETE
      } = handlers;`,
      methods: ["POST", "DELETE"],
    },
    {
      name: "array destructuring and multiple declarations",
      source: "export const [GET, , POST = () => new Response()] = handlers, PUT = handler;",
      methods: ["GET", "POST", "PUT"],
    },
    {
      name: "line and block comments",
      source: `// export const POST = () => new Response();
        /* export function GET() {} */
        export const DELETE = () => new Response();`,
      methods: ["DELETE"],
    },
    {
      name: "strings, templates, and regular expressions",
      source: `const text = "export const POST = () => new Response();";
        const template = \`export { GET }\`;
        const pattern = /export const PUT =/;
        export const DELETE = () => new Response();`,
      methods: ["DELETE"],
    },
    {
      name: "type-only export declarations and specifiers",
      source: `type GET = () => Response;
        type Handler = () => Response;
        const handler = () => new Response();
        export type { GET };
        export { type Handler as POST, handler as PUT };
        export type { DELETE } from "./types";
        export { type PATCH } from "./types";`,
      methods: ["PUT"],
    },
    {
      name: "local types exported without an explicit type modifier",
      source: "interface GET {} type Handler = () => Response; export { GET, Handler as POST };",
      methods: [],
    },
    {
      name: "type-only imports exported without an explicit type modifier",
      source: `import type { Handler } from "./types";
        import { type Other, handler } from "./handlers";
        export { Handler as GET, Other as POST, handler as PUT };`,
      methods: ["PUT"],
    },
    {
      name: "a type and value sharing the same name",
      source: "type GET = () => Response; const GET: GET = () => new Response(); export { GET };",
      methods: ["GET"],
    },
    {
      name: "a named default function",
      source: "export default function GET() { return new Response(); }",
      methods: [],
    },
    {
      name: "a named default function also exported by name",
      source: "export default function GET() { return new Response(); } export { GET as POST };",
      methods: ["POST"],
    },
    {
      name: "export lists preceding value declarations",
      source: "export { handler as GET }; function handler() { return new Response(); }",
      methods: ["GET"],
    },
    {
      name: "generic function declarations and comments between tokens",
      source: `export function GET<T>(request: T) { return new Response(); }
        export /* comment */ const POST: () => Response = () => new Response();`,
      methods: ["GET", "POST"],
    },
  ])("should detect only exported value names in $name", ({ source, methods }) => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, { "input.ts": source });

    const result = scanEndpointFile(outputFile, inputFile);

    expect(result.routes.map((route) => route.exportName)).toEqual(methods);
  });

  it("should reject syntax errors with the input filename", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, { "input.ts": "export const GET = ;" });

    expect(() => scanEndpointFile(outputFile, inputFile)).toThrow(SyntaxError);
    expect(() => scanEndpointFile(outputFile, inputFile)).toThrow(`Failed to parse ${inputFile}:`);
  });

  it("should parse TSX without detecting export text in JSX", () => {
    const { outputFile, rootDir } = createPaths();
    const inputFile = path.join(rootDir, "page.tsx");
    writeTree(rootDir, {
      "page.tsx": `export default function Page() {
        return <div>export const POST = handler;</div>;
      }`,
    });

    expect(scanEndpointFile(outputFile, inputFile).routes).toEqual([]);
  });

  it("should skip non-matching route definitions", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export function OTHER() { return { data: 'test' }; }",
    });

    const result = scanEndpointFile(outputFile, inputFile);
    expect(result.routes).toEqual([]);
  });

  it("should skip constants whose names only contain an HTTP method", () => {
    const { inputFile, outputFile, rootDir } = createPaths();
    writeTree(rootDir, {
      "input.ts": "export const METHOD_GET = () => ({ data: 'test' });",
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

import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupTempDir,
  type FsTreeDirectory,
  makeTempDir,
  resetTempDir,
  writeTree,
} from "../../test-helpers/tmp-dir.js";
import type { ImportAliasName } from "./alias.js";
import {
  clearScanAppDirCacheAbove,
  scanAppDirCache,
  visitedDirsCache,
} from "./cache.js";
import { toPosixPath } from "./path-utils.js";
import { hasTargetFiles, scanAppDir } from "./route-scanner.js";

vi.mock("./alias.js", () => ({
  createImportAlias: vi.fn(
    (_inputPath: string, name: ImportAliasName) => `${name}_asmocked`,
  ),
}));

describe("route-scanner", () => {
  let tmpDir: string | null = null;

  const setupTree = (tree: FsTreeDirectory) => {
    tmpDir = makeTempDir();
    writeTree(tmpDir, tree);

    return tmpDir;
  };

  const resetTree = (tree: FsTreeDirectory) => {
    if (!tmpDir) {
      throw new Error("tmpDir is not initialized");
    }

    resetTempDir(tmpDir, tree);
  };

  const tmpPath = (...parts: string[]) => {
    if (!tmpDir) {
      throw new Error("tmpDir is not initialized");
    }

    return path.join(tmpDir, ...parts);
  };

  const tmpPosixPath = (...parts: string[]) => toPosixPath(tmpPath(...parts));

  const requireTmpDir = () => {
    if (!tmpDir) {
      throw new Error("tmpDir is not initialized");
    }

    return tmpDir;
  };

  afterEach(() => {
    cleanupTempDir(tmpDir);
    tmpDir = null;
    scanAppDirCache.clear();
    visitedDirsCache.clear();
  });

  describe("hasTargetFiles", () => {
    it("should return true if directory contains endpoint files", () => {
      setupTree({
        testDir: {
          "file1.ts": "console.log('test');",
          nonapi: {
            "test.ts": "console.log('test');",
          },
          api: {
            "route.ts": "export default function handler() {};",
          },
        },
        testDir2: {
          "test.ts": "console.log('test');",
        },
        except: {
          intercepts: {
            "(.)intercept": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
            "(..)intercept": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
            "(..)(..)intercept": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
            "(...)intercept": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
          },
          private: {
            _components: {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
          },
          node: {
            node_modules: {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
          },
        },
      });

      expect(hasTargetFiles(tmpPath("testDir", "api"))).toBe(true);
    });

    it("should return false if directory does not contain endpoint files", () => {
      setupTree({
        testDir: {
          "file1.ts": "console.log('test');",
          nonapi: {
            "test.ts": "console.log('test');",
          },
        },
        testDir2: {
          "test.ts": "console.log('test');",
        },
      });

      expect(hasTargetFiles(tmpPath("testDir2"))).toBe(false);
      expect(hasTargetFiles(tmpPath("testDir", "nonapi"))).toBe(false);
    });

    it("should traverse intercepting directories to find endpoint files", () => {
      setupTree({
        except: {
          intercepts: {
            "(.)intercept": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
            "(..)intercept": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
            "(..)(..)intercept": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
            "(...)intercept": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
          },
          private: {
            _components: {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
          },
          node: {
            node_modules: {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
          },
        },
      });

      expect(hasTargetFiles(tmpPath("except", "intercepts"))).toBe(true);
      expect(
        hasTargetFiles(tmpPath("except", "intercepts", "(.)intercept")),
      ).toBe(true);
      expect(hasTargetFiles(tmpPath("except", "private"))).toBe(false);
      expect(hasTargetFiles(tmpPath("except", "node"))).toBe(false);
    });

    it("should ignore private children without hiding public routes in the same directory", () => {
      setupTree({
        mixed: {
          _private: {
            hidden: {
              "page.tsx": "export function Hidden() {};",
            },
          },
          public: {
            "page.tsx": "export function Public() {};",
          },
        },
      });

      expect(hasTargetFiles(tmpPath("mixed"))).toBe(true);
      expect(hasTargetFiles(tmpPath("mixed", "_private"))).toBe(false);
      expect(hasTargetFiles(tmpPath("mixed", "public"))).toBe(true);
    });
  });

  describe("scanAppDir", () => {
    it("should scan API directory and generate path structure with multiple HTTP methods, excluding OPTIONS", () => {
      setupTree({
        testApp: {
          api: {
            users: {
              "index.ts": "console.log('test');",
              "[id]": {
                "route.ts": `
                export function GET() {};
                export function POST() {};
                export function PUT() {};
                export function DELETE() {};
                export function PATCH() {};
                export function HEAD() {};
                export function OPTIONS() {}; // Should be ignored
              `,
              },
            },
          },
        },
      });

      const { pathStructure, imports, paramsTypes } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );

      expect(pathStructure).equals(`{
  "api": {
    "users": {
      "_id": { "$get": typeof GET_asmocked } & { "$head": typeof HEAD_asmocked } & { "$post": typeof POST_asmocked } & { "$put": typeof PUT_asmocked } & { "$delete": typeof DELETE_asmocked } & { "$patch": typeof PATCH_asmocked } & Endpoint & Record<ParamsKey, { "id": string }>
    }
  }
}`);
      expect(imports).toHaveLength(6);

      const expectedImports = [
        'import type { GET as GET_asmocked } from "./testApp/api/users/[id]/route";',
        'import type { HEAD as HEAD_asmocked } from "./testApp/api/users/[id]/route";',
        'import type { POST as POST_asmocked } from "./testApp/api/users/[id]/route";',
        'import type { PUT as PUT_asmocked } from "./testApp/api/users/[id]/route";',
        'import type { DELETE as DELETE_asmocked } from "./testApp/api/users/[id]/route";',
        'import type { PATCH as PATCH_asmocked } from "./testApp/api/users/[id]/route";',
      ];
      expectedImports.forEach((statement, i) => {
        expect(imports[i].statement).equals(statement);
      });
      expect(imports.every((imp) => !imp.statement.includes("OPTIONS"))).toBe(
        true,
      );
      expect(paramsTypes).toStrictEqual([
        {
          paramsType: '{ "id": string }',
          dirPath: tmpPosixPath("testApp", "api", "users", "[id]"),
        },
      ]);
    });

    it("should scan page directory and generate path structure with dynamic segment", () => {
      setupTree({
        testApp: {
          page: {
            "[user]": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
          },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "page": {
    "_user": {
      "home": Endpoint & Record<ParamsKey, { "user": string }>
    }
  }
}`);
    });

    it("should generate path structure with query type", () => {
      setupTree({
        testApp: {
          query: {
            home: {
              "page.tsx":
                "export type Query = {query : string;} export function Home() {};",
            },
          },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "query": {
    "home": Record<QueryKey, Query_asmocked> & Endpoint
  }
}`);
    });

    it("should scan directory with multiple dynamic segments and generate path structure", () => {
      setupTree({
        testApp: {
          dynamic: {
            "[user]": {
              "[id]": {
                home: {
                  "page.tsx": "export function Home() {};",
                },
              },
            },
          },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "dynamic": {
    "_user": {
      "_id": {
        "home": Endpoint & Record<ParamsKey, { "user": string; "id": string; }>
      }
    }
  }
}`);
    });

    it("should scan directory with catch-all routes and generate path structure", () => {
      setupTree({
        testApp: {
          catchAll: {
            "[user]": {
              "[...names]": {
                "page.tsx": "export function UserName() {};",
              },
            },
          },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "catchAll": {
    "_user": {
      "___names": Endpoint & Record<ParamsKey, { "user": string; "names": string[]; }>
    }
  }
}`);
    });

    it("should scan directory with optional catch-all routes and generate path structure", () => {
      setupTree({
        testApp: {
          OptionalCatchAll: {
            user: {
              "[[...names]]": {
                "page.tsx": "export function UserName() {};",
              },
            },
          },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "OptionalCatchAll": {
    "user": {
      "_____names": Endpoint & Record<ParamsKey, { "names": string[] | undefined }>
    }
  }
}`);
    });

    it("should scan directory with grouped routes and generate path structure", () => {
      setupTree({
        testApp: {
          group: {
            "(user)": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
          },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "group": {
    "home": Endpoint
  }
}`);
    });

    it("should ignore non-object child path structure for grouped routes", () => {
      setupTree({
        testApp: {
          group: {
            "(user)": {
              "page.tsx": "export function Home() {};",
            },
          },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "group": Endpoint
}`);
    });

    it("should throw when grouped route child path structure is empty", () => {
      setupTree({
        testApp: {
          group: {
            "(user)": {
              "page.tsx": "export function Home() {};",
            },
          },
        },
      });

      visitedDirsCache.set(tmpPath("testApp", "group", "(user)"), true);
      scanAppDirCache.set(tmpPosixPath("testApp", "group", "(user)"), {
        pathStructure: "   ",
        imports: [],
        paramsTypes: [],
      });

      expect(() => scanAppDir(tmpPath("output"), tmpPath("testApp"))).toThrow(
        `Invalid empty child path structure in grouped/parallel route: ${tmpPosixPath("testApp", "group", "(user)")}`,
      );
    });

    it("should scan directory with parallel routes and generate path structure", () => {
      setupTree({
        testApp: {
          parallel: {
            "@user": {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
          },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "parallel": {
    "home": Endpoint
  }
}`);
    });

    it("should scan intercepting routes for params types without changing path structure", () => {
      setupTree({
        testApp: {
          intercepts: {
            "(.)intercept": {
              "[id]": {
                "page.tsx": "export function Home() {};",
              },
            },
            "(..)intercept": {
              nested: {
                "[slug]": {
                  "page.tsx": "export function Nested() {};",
                },
              },
            },
            "(..)(..)intercept": {
              "[...parts]": {
                "page.tsx": "export function CatchAll() {};",
              },
            },
            "(...)intercept": {
              "[[...optionalParts]]": {
                "page.tsx": "export function OptionalCatchAll() {};",
              },
            },
          },
          base: { "page.tsx": "export function Base() {};" },
        },
      });

      const { pathStructure, paramsTypes } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "base": Endpoint
}`);
      expect(paramsTypes).toStrictEqual([
        {
          dirPath: tmpPosixPath(
            "testApp",
            "intercepts",
            "(...)intercept",
            "[[...optionalParts]]",
          ),
          paramsType: '{ "optionalParts": string[] | undefined }',
        },
        {
          dirPath: tmpPosixPath(
            "testApp",
            "intercepts",
            "(..)(..)intercept",
            "[...parts]",
          ),
          paramsType: '{ "parts": string[] }',
        },
        {
          dirPath: tmpPosixPath(
            "testApp",
            "intercepts",
            "(..)intercept",
            "nested",
            "[slug]",
          ),
          paramsType: '{ "slug": string }',
        },
        {
          dirPath: tmpPosixPath(
            "testApp",
            "intercepts",
            "(.)intercept",
            "[id]",
          ),
          paramsType: '{ "id": string }',
        },
      ]);
    });

    it("should scan private directory and generate path structure", () => {
      setupTree({
        testApp: {
          private: {
            _components: {
              home: {
                "page.tsx": "export function Home() {};",
              },
            },
          },
          base: { "page.tsx": "export function Base() {};" },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "base": Endpoint
}`);
    });

    it("should preserve escaped underscore segments to avoid DSL key collisions", () => {
      setupTree({
        testApp: {
          patterns: {
            "%5Fescaped": {
              "page.tsx": "export function Escaped() {};",
            },
          },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "patterns": {
    "%5Fescaped": Endpoint
  }
}`);
    });

    it("should keep the original segment name when decodeURIComponent fails", () => {
      setupTree({
        testApp: {
          patterns: {
            "%E0%A4%A": {
              "page.tsx": "export function BrokenEncoding() {};",
            },
          },
        },
      });

      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "patterns": {
    "%E0%A4%A": Endpoint
  }
}`);
    });

    it("should skip private directories even if cached as targetable and keep intercepting routes out of path structure", () => {
      setupTree({
        testApp: {
          parent: {
            _private: {
              hidden: {
                "page.tsx": "export function Hidden() {};",
              },
            },
            "(.)modal": {
              "[id]": {
                "page.tsx": "export function Modal() {};",
              },
            },
            public: {
              "page.tsx": "export function Public() {};",
            },
          },
        },
      });

      visitedDirsCache.set(tmpPath("testApp", "parent", "_private"), true);
      visitedDirsCache.set(tmpPath("testApp", "parent", "(.)modal"), true);
      visitedDirsCache.set(
        path.win32.join(requireTmpDir(), "testApp", "parent", "_private"),
        true,
      );
      visitedDirsCache.set(
        path.win32.join(requireTmpDir(), "testApp", "parent", "(.)modal"),
        true,
      );

      const { pathStructure, paramsTypes } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "parent": {
    "public": Endpoint
  }
}`);
      expect(paramsTypes).toStrictEqual([
        {
          dirPath: tmpPosixPath("testApp", "parent", "(.)modal", "[id]"),
          paramsType: '{ "id": string }',
        },
      ]);
    });

    it("should ignore empty parallel-route path structure produced by intercepting children while keeping params types", () => {
      setupTree({
        testApp: {
          feed: {
            "@modal": {
              "(..)photo": {
                "[id]": {
                  "page.tsx": "export function Modal() {};",
                },
              },
            },
            "page.tsx": "export function Feed() {};",
          },
        },
      });

      const { pathStructure, paramsTypes } = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp"),
      );
      expect(pathStructure).equals(`{
  "feed": Endpoint
}`);
      expect(paramsTypes).toStrictEqual([
        {
          dirPath: tmpPosixPath(
            "testApp",
            "feed",
            "@modal",
            "(..)photo",
            "[id]",
          ),
          paramsType: '{ "id": string }',
        },
      ]);
    });

    it("should handle empty directories gracefully", () => {
      setupTree({ emptyDir: {} });
      const { pathStructure } = scanAppDir(
        tmpPath("output"),
        tmpPath("emptyDir"),
      );
      expect(pathStructure).toBe("");
    });

    it("should handle multiple params", () => {
      setupTree({
        testApp: {
          OptionalCatchAll: {
            user: {
              "[[...names]]": {
                "page.tsx": "export function UserName() {};",
              },
            },
          },
          catchAll: {
            "[user]": {
              "[...names]": {
                "page.tsx": "export function UserName() {};",
              },
            },
          },
        },
      });

      const { paramsTypes } = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(paramsTypes).toStrictEqual([
        {
          paramsType: '{ "user": string; "names": string[]; }',
          dirPath: tmpPosixPath("testApp", "catchAll", "[user]", "[...names]"),
        },
        {
          paramsType: '{ "names": string[] | undefined }',
          dirPath: tmpPosixPath(
            "testApp",
            "OptionalCatchAll",
            "user",
            "[[...names]]",
          ),
        },
      ]);
    });
  });

  describe("scanAppDirCache", () => {
    it("should return the same cached result for the same directory", () => {
      setupTree({
        testApp: {
          "page.tsx": "export function Page() {};",
        },
      });

      const result1 = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      const result2 = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(result1).toBe(result2);
    });

    it("should clear cache when clearScanAppDirCache is called with the exact path", () => {
      setupTree({
        testApp: {
          "page.tsx": "export function Page() {};",
        },
      });

      const result1 = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      clearScanAppDirCacheAbove(tmpPath("testApp"));
      const result2 = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(result1).not.toBe(result2);
    });

    it("should clear parent cache when clearScanAppDirCache is called with a subdirectory", () => {
      setupTree({
        testApp: {
          "page.tsx": "export function Page() {};",
          sub: {
            "index.ts": "export default function Index() {};",
          },
        },
      });

      const parentResult1 = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      const childResult1 = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp", "sub"),
      );

      clearScanAppDirCacheAbove(tmpPath("testApp", "sub"));

      const parentResult2 = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      const childResult2 = scanAppDir(
        tmpPath("output"),
        tmpPath("testApp", "sub"),
      );

      expect(parentResult1).not.toBe(parentResult2);
      expect(childResult1).not.toBe(childResult2);
    });

    it("should not clear any cache if clearScanAppDirCache is called with a non-matching path", () => {
      setupTree({
        testApp: {
          "page.tsx": "export function Page() {};",
        },
        another: {
          "index.ts": "export function Index() {};",
        },
      });

      const resultTestApp1 = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      const resultAnother1 = scanAppDir(tmpPath("output"), tmpPath("another"));

      clearScanAppDirCacheAbove(tmpPath("nonexistent"));

      const resultTestApp2 = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      const resultAnother2 = scanAppDir(tmpPath("output"), tmpPath("another"));

      expect(resultTestApp1).toBe(resultTestApp2);
      expect(resultAnother1).toBe(resultAnother2);
    });
  });

  describe("scanAppDirCache modification scenarios - detailed verification", () => {
    beforeEach(() => {
      scanAppDirCache.clear();
      visitedDirsCache.clear();
    });

    it("should generate correct output when the lowest-level file is modified", () => {
      setupTree({
        testApp: {
          sub: {
            "page.tsx": "export function Page() {};",
          },
        },
      });
      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe(`{
  "sub": Endpoint
}`);

      resetTree({
        testApp: {
          sub: {
            "page.tsx": "export function GET() {};",
          },
        },
      });
      clearScanAppDirCacheAbove(tmpPath("testApp", "sub", "page.tsx"));
      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(`{
  "sub": { "$get": typeof GET_asmocked } & Endpoint
}`);
    });

    it("should generate correct output when a mid-level file is modified", () => {
      setupTree({
        testApp: {
          mid: {
            "page.tsx": "export function Page() {};",
          },
        },
      });
      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe(`{
  "mid": Endpoint
}`);

      resetTree({
        testApp: {
          mid: {
            "page.tsx": "export function GET() {};",
          },
        },
      });
      clearScanAppDirCacheAbove(tmpPath("testApp", "mid", "page.tsx"));
      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(`{
  "mid": { "$get": typeof GET_asmocked } & Endpoint
}`);
    });

    it("should generate correct output when a top-level file is modified", () => {
      setupTree({
        testApp: {
          "route.ts": "export default function Index() {};",
        },
      });
      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe("Endpoint");

      resetTree({
        testApp: {
          "route.ts": "export function GET() {};",
        },
      });
      clearScanAppDirCacheAbove(tmpPath("testApp", "index.ts"));
      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(
        '{ "$get": typeof GET_asmocked } & Endpoint',
      );
    });

    it("should generate correct output when a folder is added in the lowest-level directory", () => {
      setupTree({
        testApp: {
          sub: {
            "page.tsx": "export function Page() {};",
          },
        },
      });
      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe(`{
  "sub": Endpoint
}`);

      resetTree({
        testApp: {
          sub: {
            "page.tsx": "export function Page() {};",
            newFolder: {
              "page.tsx": "export function NewPage() {};",
            },
          },
        },
      });
      clearScanAppDirCacheAbove(tmpPath("testApp", "sub", "newFolder"));
      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(`{
  "sub": Endpoint & {
    "newFolder": Endpoint
  }
}`);
    });

    it("should generate correct output when a folder is added in a mid-level directory", () => {
      setupTree({
        testApp: {
          mid: {
            sub: {
              "page.tsx": "export function Page() {};",
            },
          },
        },
      });
      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe(`{
  "mid": {
    "sub": Endpoint
  }
}`);

      resetTree({
        testApp: {
          mid: {
            sub: {
              "page.tsx": "export function Page() {};",
            },
            newFolder: {
              "page.tsx": "export default function NewPage() {};",
            },
          },
        },
      });
      clearScanAppDirCacheAbove(tmpPath("testApp", "mid", "newFolder"));
      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(`{
  "mid": {
    "newFolder": Endpoint,
    "sub": Endpoint
  }
}`);
    });

    it("should generate correct output when a folder is added in the top-level directory", () => {
      setupTree({
        testApp: {
          "route.ts": "export default function Index() {};",
        },
      });
      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe("Endpoint");

      resetTree({
        testApp: {
          "route.ts": "export default function Index() {};",
          newFolder: {
            "page.tsx": "export function NewPage() {};",
          },
        },
      });
      clearScanAppDirCacheAbove(tmpPath("testApp", "newFolder"));
      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(`Endpoint & {
  "newFolder": Endpoint
}`);
    });
  });

  describe("scanAppDirCache dynamic folder scenarios - detailed verification", () => {
    beforeEach(() => {
      scanAppDirCache.clear();
      visitedDirsCache.clear();
    });

    it("should generate correct output when a single dynamic folder is inserted in between", () => {
      setupTree({
        testApp: {
          "[user]": {
            home: {
              "page.tsx": "export function Page() {};",
            },
          },
        },
      });
      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe(`{
  "_user": {
    "home": Endpoint & Record<ParamsKey, { "user": string }>
  }
}`);

      resetTree({
        testApp: {
          "[user]": {
            "[id]": {
              home: {
                "page.tsx": "export function Page() {};",
              },
            },
          },
        },
      });
      clearScanAppDirCacheAbove(tmpPath("testApp", "[user]", "[id]"));
      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(`{
  "_user": {
    "_id": {
      "home": Endpoint & Record<ParamsKey, { "user": string; "id": string; }>
    }
  }
}`);
    });

    it("should generate correct output when multiple dynamic folders are added in between", () => {
      setupTree({
        testApp: {
          "[user]": {
            home: {
              "page.tsx": "export function Page() {};",
            },
          },
        },
      });
      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe(`{
  "_user": {
    "home": Endpoint & Record<ParamsKey, { "user": string }>
  }
}`);

      resetTree({
        testApp: {
          "[user]": {
            "[id]": {
              "[detail]": {
                home: {
                  "page.tsx": "export function Page() {};",
                },
              },
            },
          },
        },
      });
      clearScanAppDirCacheAbove(tmpPath("testApp", "[user]", "[id]"));
      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(`{
  "_user": {
    "_id": {
      "_detail": {
        "home": Endpoint & Record<ParamsKey, { "user": string; "id": string; "detail": string; }>
      }
    }
  }
}`);
    });

    it("should generate correct output when a dynamic folder is inserted in the middle of an existing dynamic structure", () => {
      setupTree({
        testApp: {
          "[user]": {
            "[id]": {
              home: {
                "page.tsx": "export function Page() {};",
              },
            },
          },
        },
      });
      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe(`{
  "_user": {
    "_id": {
      "home": Endpoint & Record<ParamsKey, { "user": string; "id": string; }>
    }
  }
}`);

      resetTree({
        testApp: {
          "[user]": {
            "[lang]": {
              "[id]": {
                home: {
                  "page.tsx": "export function Page() {};",
                },
              },
            },
          },
        },
      });
      clearScanAppDirCacheAbove(tmpPath("testApp", "[user]", "[lang]"));
      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(`{
  "_user": {
    "_lang": {
      "_id": {
        "home": Endpoint & Record<ParamsKey, { "user": string; "lang": string; "id": string; }>
      }
    }
  }
}`);
    });
  });

  describe("scanAppDirCache multiple child directories scenarios", () => {
    beforeEach(() => {
      scanAppDirCache.clear();
      visitedDirsCache.clear();
    });

    it("should generate correct output when multiple child directories exist and one branch is modified with an additional dynamic folder", () => {
      setupTree({
        testApp: {
          "[user]": {
            home: {
              "page.tsx": "export function Page() {};",
            },
          },
          "[admin]": {
            home: {
              "page.tsx": "export function Page() {};",
            },
          },
          static: {
            home: {
              "page.tsx": "export function Page() {};",
            },
          },
        },
      });

      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe(`{
  "_admin": {
    "home": Endpoint & Record<ParamsKey, { "admin": string }>
  },
  "_user": {
    "home": Endpoint & Record<ParamsKey, { "user": string }>
  },
  "static": {
    "home": Endpoint
  }
}`);

      resetTree({
        testApp: {
          "[admin]": {
            "[id]": {
              home: {
                "page.tsx": "export function Page() {};",
              },
            },
          },
          "[user]": {
            "[id]": {
              home: {
                "page.tsx": "export function Page() {};",
              },
            },
          },
          static: {
            home: {
              "page.tsx": "export function Page() {};",
            },
          },
        },
      });

      clearScanAppDirCacheAbove(tmpPath("testApp", "[admin]", "[id]"));
      clearScanAppDirCacheAbove(tmpPath("testApp", "[user]", "[id]"));

      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(`{
  "_admin": {
    "_id": {
      "home": Endpoint & Record<ParamsKey, { "admin": string; "id": string; }>
    }
  },
  "_user": {
    "_id": {
      "home": Endpoint & Record<ParamsKey, { "user": string; "id": string; }>
    }
  },
  "static": {
    "home": Endpoint
  }
}`);
    });

    it("should generate correct output when multiple child directories exist and both branches are modified with additional dynamic folders", () => {
      setupTree({
        testApp: {
          "[user]": {
            home: {
              "page.tsx": "export function Page() {};",
            },
          },
          "[group]": {
            dashboard: {
              "page.tsx": "export function Page() {};",
            },
          },
        },
      });

      const initial = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(initial.pathStructure).toBe(`{
  "_group": {
    "dashboard": Endpoint & Record<ParamsKey, { "group": string }>
  },
  "_user": {
    "home": Endpoint & Record<ParamsKey, { "user": string }>
  }
}`);

      resetTree({
        testApp: {
          "[user]": {
            "[id]": {
              home: {
                "page.tsx": "export function Page() {};",
              },
            },
          },
          "[group]": {
            "[id]": {
              dashboard: {
                "page.tsx": "export function Page() {};",
              },
            },
          },
        },
      });

      clearScanAppDirCacheAbove(tmpPath("testApp", "[user]", "[id]"));
      clearScanAppDirCacheAbove(tmpPath("testApp", "[group]", "[id]"));

      const modified = scanAppDir(tmpPath("output"), tmpPath("testApp"));
      expect(modified.pathStructure).toBe(`{
  "_group": {
    "_id": {
      "dashboard": Endpoint & Record<ParamsKey, { "group": string; "id": string; }>
    }
  },
  "_user": {
    "_id": {
      "home": Endpoint & Record<ParamsKey, { "user": string; "id": string; }>
    }
  }
}`);
    });
  });
});

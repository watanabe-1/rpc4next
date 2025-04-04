import mock from "mock-fs";
import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  clearScanAppDirCacheAbove,
  scanAppDirCache,
  visitedDirsCache,
} from "./cache";
import { hasTargetFiles, scanAppDir } from "./route-scanner";

vi.mock("./alias", () => ({
  createImportAlias: vi.fn((path: string, name: string) => `${name}_asmocked`),
}));

// ----------------------
// Test for hasTargetFiles
// ----------------------
describe("hasTargetFiles", () => {
  beforeEach(() => {
    // Prepare mock file system
    mock({
      "/testDir": {
        "file1.ts": "console.log('test');",
        nonapi: {
          "test.ts": "console.log('test');",
        },
        api: {
          "route.ts": "export default function handler() {};",
        },
      },
      "/testDir2": {
        "test.ts": "console.log('test');",
      },
      "/except": {
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
  });

  afterEach(() => {
    // Restore original file system after each test
    mock.restore();
  });

  it("should return true if directory contains endpoint files", () => {
    const result = hasTargetFiles("/testDir/api");
    expect(result).toBe(true);
  });

  it("should return false if directory does not contain endpoint files", () => {
    const result = hasTargetFiles("/testDir2");
    expect(result).toBe(false);

    const result2 = hasTargetFiles("/testDir/nonapi");
    expect(result2).toBe(false);
  });

  it("should return false if the directory is one of the except directories", () => {
    const result = hasTargetFiles("/except/intercepts");
    expect(result).toBe(false);

    const result2 = hasTargetFiles("/except/private");
    expect(result2).toBe(false);

    const result3 = hasTargetFiles("/except/node");
    expect(result3).toBe(false);
  });
});

// ----------------------
// Test for scanAppDir
// ----------------------
describe("scanAppDir", () => {
  afterEach(() => {
    // Cleanup
    mock.restore();
    scanAppDirCache.clear();
  });

  it("should scan API directory and generate path structure with multiple HTTP methods, excluding OPTIONS", () => {
    // Setup API directory with multiple HTTP methods including OPTIONS
    mock({
      "/testApp": {
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

    // Expected path structure
    const expectPathStructure = `{
  "api": {
    "users": {
      "_id": { "$get": typeof GET_asmocked } & { "$head": typeof HEAD_asmocked } & { "$post": typeof POST_asmocked } & { "$put": typeof PUT_asmocked } & { "$delete": typeof DELETE_asmocked } & { "$patch": typeof PATCH_asmocked } & Endpoint & Record<ParamsKey, { "id": string }>
    }
  }
}`;
    const { pathStructure, imports, paramsTypes } = scanAppDir(
      "/output",
      "/testApp"
    );

    expect(pathStructure).equals(expectPathStructure);

    // Should import 6 methods excluding OPTIONS
    expect(imports).toHaveLength(6);

    const expectedImports = [
      {
        statement:
          'import type { GET as GET_asmocked } from "./testApp/api/users/[id]/route";',
        method: "GET",
      },
      {
        statement:
          'import type { HEAD as HEAD_asmocked } from "./testApp/api/users/[id]/route";',
        method: "HEAD",
      },
      {
        statement:
          'import type { POST as POST_asmocked } from "./testApp/api/users/[id]/route";',
        method: "POST",
      },
      {
        statement:
          'import type { PUT as PUT_asmocked } from "./testApp/api/users/[id]/route";',
        method: "PUT",
      },
      {
        statement:
          'import type { DELETE as DELETE_asmocked } from "./testApp/api/users/[id]/route";',
        method: "DELETE",
      },
      {
        statement:
          'import type { PATCH as PATCH_asmocked } from "./testApp/api/users/[id]/route";',
        method: "PATCH",
      },
    ];

    expectedImports.forEach(({ statement }, i) => {
      expect(imports[i].statement).equals(statement);
    });

    expect(imports.every((imp) => !imp.statement.includes("OPTIONS"))).toBe(
      true
    );

    // Parameter types
    expect(paramsTypes).toHaveLength(1);

    const expectedParamsTypes = [
      {
        paramsType: '{ "id": string }',
        path: "/testApp/api/users/[id]/route.ts",
      },
    ];

    expectedParamsTypes.forEach((paramsType, i) => {
      expect(paramsTypes[i]).toStrictEqual(paramsType);
    });
  });

  it("should scan page directory and generate path structure with dynamic segment", () => {
    // Setup dynamic segment
    mock({
      "/testApp": {
        page: {
          "[user]": {
            home: {
              "page.tsx": "export function Home() {};",
            },
          },
        },
      },
    });

    const expectPathStructure = `{
  "page": {
    "_user": {
      "home": Endpoint & Record<ParamsKey, { "user": string }>
    }
  }
}`;
    const { pathStructure } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);
  });

  it("should generate path structure with query type", () => {
    // Setup page containing a Query type
    mock({
      "/testApp": {
        query: {
          home: {
            "page.tsx":
              "export type Query = {query : string;} export function Home() {};",
          },
        },
      },
    });

    const expectPathStructure = `{
  "query": {
    "home": Record<QueryKey, Query_asmocked> & Endpoint
  }
}`;
    const { pathStructure } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);
  });

  it("should scan directory with multiple dynamic segments and generate path structure", () => {
    // Setup multiple dynamic segments
    mock({
      "/testApp": {
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

    const expectPathStructure = `{
  "dynamic": {
    "_user": {
      "_id": {
        "home": Endpoint & Record<ParamsKey, { "user": string; "id": string; }>
      }
    }
  }
}`;
    const { pathStructure } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);
  });

  it("should scan directory with catch-all routes and generate path structure", () => {
    // Setup catch-all routes
    mock({
      "/testApp": {
        catchAll: {
          "[user]": {
            "[...names]": {
              "page.tsx": "export function UserName() {};",
            },
          },
        },
      },
    });

    const expectPathStructure = `{
  "catchAll": {
    "_user": {
      "___names": Endpoint & Record<ParamsKey, { "user": string; "names": string[]; }>
    }
  }
}`;
    const { pathStructure } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);
  });

  it("should scan directory with optional catch-all routes and generate path structure", () => {
    // Setup optional catch-all routes
    mock({
      "/testApp": {
        OptionalCatchAll: {
          user: {
            "[[...names]]": {
              "page.tsx": "export function UserName() {};",
            },
          },
        },
      },
    });

    const expectPathStructure = `{
  "OptionalCatchAll": {
    "user": {
      "_____names": Endpoint & Record<ParamsKey, { "names": string[] | undefined }>
    }
  }
}`;
    const { pathStructure } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);
  });

  it("should scan directory with grouped routes and generate path structure", () => {
    // Setup grouped routes
    mock({
      "/testApp": {
        group: {
          "(user)": {
            home: {
              "page.tsx": "export function Home() {};",
            },
          },
        },
      },
    });

    const expectPathStructure = `{
  "group": {
    "home": Endpoint
  }
}`;
    const { pathStructure } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);
  });

  it("should scan directory with parallel routes and generate path structure", () => {
    // Setup parallel routes
    mock({
      "/testApp": {
        parallel: {
          "@user": {
            home: {
              "page.tsx": "export function Home() {};",
            },
          },
        },
      },
    });

    const expectPathStructure = `{
  "parallel": {
    "home": Endpoint
  }
}`;
    const { pathStructure } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);
  });

  it("should scan directory with intercepting routes and generate path structure", () => {
    // Setup intercepting routes
    mock({
      "/testApp": {
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
        base: { "page.tsx": "export function Base() {};" },
      },
    });

    const expectPathStructure = `{
  "base": Endpoint
}`;
    const { pathStructure } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);
  });

  it("should scan private directory and generate path structure", () => {
    // Setup private directory
    mock({
      "/testApp": {
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

    const expectPathStructure = `{
  "base": Endpoint
}`;
    const { pathStructure } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);
  });

  it("should handle empty directories gracefully", () => {
    // Handle empty directories
    mock({ "/emptyDir": {} });
    const { pathStructure } = scanAppDir("/output", "/emptyDir");
    expect(pathStructure).toBe("");
  });

  it("should handle multiple params", () => {
    // Setup for multiple params
    mock({
      "/testApp": {
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

    const { paramsTypes } = scanAppDir("/output", "/testApp");
    expect(paramsTypes).toHaveLength(2);

    const expectedParamsTypes = [
      {
        paramsType: '{ "names": string[] | undefined }',
        path: "/testApp/OptionalCatchAll/user/[[...names]]/page.tsx",
      },
      {
        paramsType: '{ "user": string; "names": string[]; }',
        path: "/testApp/catchAll/[user]/[...names]/page.tsx",
      },
    ];
    expectedParamsTypes.forEach((paramsType, i) => {
      expect(paramsTypes[i]).toStrictEqual(paramsType);
    });
  });
});

// ----------------------
// Tests for scanAppDirCache
// ----------------------
describe("scanAppDirCache", () => {
  afterEach(() => {
    // Cleanup
    mock.restore();
  });

  it("should return the same cached result for the same directory", () => {
    // Result should be cached
    mock({
      "/testApp": {
        "page.tsx": "export function Page() {};",
      },
    });

    const result1 = scanAppDir("/output", "/testApp");
    const result2 = scanAppDir("/output", "/testApp");
    expect(result1).toBe(result2);
  });

  it("should clear cache when clearScanAppDirCache is called with the exact path", () => {
    // Clear by exact path
    mock({
      "/testApp": {
        "page.tsx": "export function Page() {};",
      },
    });

    const result1 = scanAppDir("/output", "/testApp");
    clearScanAppDirCacheAbove("/testApp");
    const result2 = scanAppDir("/output", "/testApp");
    expect(result1).not.toBe(result2);
  });

  it("should clear parent cache when clearScanAppDirCache is called with a subdirectory", () => {
    // Clear cache by subdirectory
    mock({
      "/testApp": {
        "page.tsx": "export function Page() {};",
        sub: {
          "index.ts": "export default function Index() {};",
        },
      },
    });

    const parentResult1 = scanAppDir("/output", "/testApp");
    const childResult1 = scanAppDir("/output", "/testApp/sub");

    clearScanAppDirCacheAbove("/testApp/sub");

    const parentResult2 = scanAppDir("/output", "/testApp");
    const childResult2 = scanAppDir("/output", "/testApp/sub");

    expect(parentResult1).not.toBe(parentResult2);
    expect(childResult1).not.toBe(childResult2);
  });

  it("should not clear any cache if clearScanAppDirCache is called with a non-matching path", () => {
    // Clear with irrelevant path
    mock({
      "/testApp": {
        "page.tsx": "export function Page() {};",
      },
      "/another": {
        "index.ts": "export function Index() {};",
      },
    });

    const resultTestApp1 = scanAppDir("/output", "/testApp");
    const resultAnother1 = scanAppDir("/output", "/another");

    clearScanAppDirCacheAbove("/nonexistent");

    const resultTestApp2 = scanAppDir("/output", "/testApp");
    const resultAnother2 = scanAppDir("/output", "/another");

    expect(resultTestApp1).toBe(resultTestApp2);
    expect(resultAnother1).toBe(resultAnother2);
  });
});

// ----------------------
// Detailed scenarios for cache modification
// ----------------------
describe("scanAppDirCache modification scenarios - detailed verification", () => {
  beforeEach(() => {
    // Clear all caches before each test
    scanAppDirCache.clear();
    visitedDirsCache.clear();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should generate correct output when the lowest-level file is modified", () => {
    // First scan: recognized as an Endpoint from lowest-level file (page.tsx)
    mock({
      "/testApp": {
        sub: {
          "page.tsx": "export function Page() {};",
        },
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `{
  "sub": Endpoint
}`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: change to route definition with GET method
    mock.restore();
    mock({
      "/testApp": {
        sub: {
          "page.tsx": "export function GET() {};",
        },
      },
    });
    clearScanAppDirCacheAbove("/testApp/sub/page.tsx");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
  "sub": { "$get": typeof GET_asmocked } & Endpoint
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when a mid-level file is modified", () => {
    // First scan: recognized as an Endpoint from mid-level file
    mock({
      "/testApp": {
        mid: {
          "page.tsx": "export function Page() {};",
        },
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `{
  "mid": Endpoint
}`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: add GET method
    mock.restore();
    mock({
      "/testApp": {
        mid: {
          "page.tsx": "export function GET() {};",
        },
      },
    });
    clearScanAppDirCacheAbove("/testApp/mid/page.tsx");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
  "mid": { "$get": typeof GET_asmocked } & Endpoint
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when a top-level file is modified", () => {
    // First scan: top-level file as Endpoint
    mock({
      "/testApp": {
        "route.ts": "export default function Index() {};",
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `Endpoint`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: add GET method
    mock.restore();
    mock({
      "/testApp": {
        "route.ts": "export function GET() {};",
      },
    });
    clearScanAppDirCacheAbove("/testApp/index.ts");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{ "$get": typeof GET_asmocked } & Endpoint`;
    expect(modified.pathStructure).toBe(expectedModified);
  });
  it("should generate correct output when a folder is added in the lowest-level directory", () => {
    // First scan: /testApp/sub has only one file
    mock({
      "/testApp": {
        sub: {
          "page.tsx": "export function Page() {};",
        },
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `{
  "sub": Endpoint
}`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: a new folder (newFolder) is added under /testApp/sub with a file
    mock.restore();
    mock({
      "/testApp": {
        sub: {
          "page.tsx": "export function Page() {};",
          newFolder: {
            "page.tsx": "export function NewPage() {};",
          },
        },
      },
    });
    clearScanAppDirCacheAbove("/testApp/sub/newFolder");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
  "sub": Endpoint & {
    "newFolder": Endpoint
  }
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when a folder is added in a mid-level directory", () => {
    // First scan: /testApp/mid/sub has only one file
    mock({
      "/testApp": {
        mid: {
          sub: {
            "page.tsx": "export function Page() {};",
          },
        },
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `{
  "mid": {
    "sub": Endpoint
  }
}`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: add newFolder under mid
    mock.restore();
    mock({
      "/testApp": {
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
    clearScanAppDirCacheAbove("/testApp/mid/newFolder");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
  "mid": {
    "newFolder": Endpoint,
    "sub": Endpoint
  }
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when a folder is added in the top-level directory", () => {
    // First scan: /testApp has only a top-level file
    mock({
      "/testApp": {
        "route.ts": "export default function Index() {};",
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `Endpoint`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: add newFolder at the top level
    mock.restore();
    mock({
      "/testApp": {
        "route.ts": "export default function Index() {};",
        newFolder: {
          "page.tsx": "export function NewPage() {};",
        },
      },
    });
    clearScanAppDirCacheAbove("/testApp/newFolder");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `Endpoint & {
  "newFolder": Endpoint
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });
});

// ----------------------
// Tests for dynamic folder scenarios
// ----------------------
describe("scanAppDirCache dynamic folder scenarios - detailed verification", () => {
  beforeEach(() => {
    scanAppDirCache.clear();
    visitedDirsCache.clear();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should generate correct output when a single dynamic folder is inserted in between", () => {
    // Initial: /testApp/[user]/home/page.tsx
    mock({
      "/testApp": {
        "[user]": {
          home: {
            "page.tsx": "export function Page() {};",
          },
        },
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `{
  "_user": {
    "home": Endpoint & Record<ParamsKey, { "user": string }>
  }
}`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: insert dynamic folder [id]
    mock.restore();
    mock({
      "/testApp": {
        "[user]": {
          "[id]": {
            home: {
              "page.tsx": "export function Page() {};",
            },
          },
        },
      },
    });
    clearScanAppDirCacheAbove("/testApp/[user]/[id]");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
  "_user": {
    "_id": {
      "home": Endpoint & Record<ParamsKey, { "user": string; "id": string; }>
    }
  }
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when multiple dynamic folders are added in between", () => {
    // Initial: /testApp/[user]/home/page.tsx
    mock({
      "/testApp": {
        "[user]": {
          home: {
            "page.tsx": "export function Page() {};",
          },
        },
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `{
  "_user": {
    "home": Endpoint & Record<ParamsKey, { "user": string }>
  }
}`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: insert [id] and [detail] in between
    mock.restore();
    mock({
      "/testApp": {
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
    clearScanAppDirCacheAbove("/testApp/[user]/[id]");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
  "_user": {
    "_id": {
      "_detail": {
        "home": Endpoint & Record<ParamsKey, { "user": string; "id": string; "detail": string; }>
      }
    }
  }
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when a dynamic folder is inserted in the middle of an existing dynamic structure", () => {
    // Initial: /testApp/[user]/[id]/home/page.tsx
    mock({
      "/testApp": {
        "[user]": {
          "[id]": {
            home: {
              "page.tsx": "export function Page() {};",
            },
          },
        },
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `{
  "_user": {
    "_id": {
      "home": Endpoint & Record<ParamsKey, { "user": string; "id": string; }>
    }
  }
}`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: insert [lang] between [user] and [id]
    mock.restore();
    mock({
      "/testApp": {
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
    clearScanAppDirCacheAbove("/testApp/[user]/[lang]");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
  "_user": {
    "_lang": {
      "_id": {
        "home": Endpoint & Record<ParamsKey, { "user": string; "lang": string; "id": string; }>
      }
    }
  }
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });
});

// ----------------------
// Test for scanAppDirCache multiple child directories scenarios
// ----------------------
describe("scanAppDirCache multiple child directories scenarios", () => {
  beforeEach(() => {
    // Clear caches before each test
    scanAppDirCache.clear();
    visitedDirsCache.clear();
  });

  afterEach(() => {
    // Restore the mock file system
    mock.restore();
  });

  it("should generate correct output when multiple child directories exist and one branch is modified with an additional dynamic folder", () => {
    mock({
      "/testApp": {
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

    const initial = scanAppDir("/output", "/testApp");
    // Sorted by lexicographical order
    const expectedInitial = `{
  "_admin": {
    "home": Endpoint & Record<ParamsKey, { "admin": string }>
  },
  "_user": {
    "home": Endpoint & Record<ParamsKey, { "user": string }>
  },
  "static": {
    "home": Endpoint
  }
}`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: add dynamic folder [id] under both branches
    mock.restore();
    mock({
      "/testApp": {
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

    // Clear caches for added dynamic folders
    clearScanAppDirCacheAbove("/testApp/[admin]/[id]");
    clearScanAppDirCacheAbove("/testApp/[user]/[id]");

    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
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
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when multiple child directories exist and both branches are modified with additional dynamic folders", () => {
    mock({
      "/testApp": {
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

    const initial = scanAppDir("/output", "/testApp");
    // Sorting: "[group]" comes before "[user]"
    const expectedInitial = `{
  "_group": {
    "dashboard": Endpoint & Record<ParamsKey, { "group": string }>
  },
  "_user": {
    "home": Endpoint & Record<ParamsKey, { "user": string }>
  }
}`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // After modification: insert additional dynamic folder [id] into both branches
    mock.restore();
    mock({
      "/testApp": {
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

    // Clear caches for added dynamic folders
    clearScanAppDirCacheAbove("/testApp/[user]/[id]");
    clearScanAppDirCacheAbove("/testApp/[group]/[id]");

    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
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
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });
});

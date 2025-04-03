import mock from "mock-fs";
import { describe, beforeEach, afterEach, it, expect } from "vitest";
import {
  clearCntCache,
  clearScanAppDirCache,
  scanAppDirCache,
  visitedDirsCache,
} from "./cache";
import { hasTargetFiles, scanAppDir } from "./route-scanner";

describe("hasTargetFiles", () => {
  beforeEach(() => {
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

  it("should return false if except directory", () => {
    const result = hasTargetFiles("/except/intercepts");
    expect(result).toBe(false);

    const result2 = hasTargetFiles("/except/private");
    expect(result2).toBe(false);

    const result3 = hasTargetFiles("/except/node");
    expect(result3).toBe(false);
  });
});

describe("scanAppDir", () => {
  afterEach(() => {
    mock.restore();
    scanAppDirCache.clear();
  });

  it("should scan API directory and generate path structure with multiple HTTP methods, excluding OPTIONS", () => {
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
                export function OPTIONS() {}; // This should be ignored
              `,
            },
          },
        },
      },
    });

    const expectPathStructure = `{
  "api": {
    "users": {
      "_id": { "$get": typeof GET_0 } & { "$head": typeof HEAD_0 } & { "$post": typeof POST_0 } & { "$put": typeof PUT_0 } & { "$delete": typeof DELETE_0 } & { "$patch": typeof PATCH_0 } & Endpoint & Record<ParamsKey, { "id": string }>
    }
  }
}`;
    const { pathStructure, imports, paramsTypes } = scanAppDir(
      "/output",
      "/testApp"
    );
    expect(pathStructure).equals(expectPathStructure);

    expect(imports).toHaveLength(6);

    const expectedImports = [
      {
        statement:
          'import type { GET as GET_0 } from "./testApp/api/users/[id]/route";',
        method: "GET",
      },
      {
        statement:
          'import type { HEAD as HEAD_0 } from "./testApp/api/users/[id]/route";',
        method: "HEAD",
      },
      {
        statement:
          'import type { POST as POST_0 } from "./testApp/api/users/[id]/route";',
        method: "POST",
      },
      {
        statement:
          'import type { PUT as PUT_0 } from "./testApp/api/users/[id]/route";',
        method: "PUT",
      },
      {
        statement:
          'import type { DELETE as DELETE_0 } from "./testApp/api/users/[id]/route";',
        method: "DELETE",
      },
      {
        statement:
          'import type { PATCH as PATCH_0 } from "./testApp/api/users/[id]/route";',
        method: "PATCH",
      },
    ];

    expectedImports.forEach(({ statement }, i) => {
      expect(imports[i].statement).equals(statement);
    });

    expect(imports.every((imp) => !imp.statement.includes("OPTIONS"))).toBe(
      true
    );

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

  it("should scan page directory and generate path structure with dynamic segmente", () => {
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
    "home": Record<QueryKey, Query_0> & Endpoint
  }
}`;
    const { pathStructure } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);
  });

  it("sshould scan directory with multiple dynamic segments and generate path structure", () => {
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
    mock({ "/emptyDir": {} });
    const { pathStructure } = scanAppDir("/output", "/emptyDir");
    expect(pathStructure).toBe("");
  });

  it("should handle multiple paramss", () => {
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

describe("scanAppDirCache", () => {
  afterEach(() => {
    mock.restore();
  });

  it("should return the same cached result for the same directory", () => {
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
    mock({
      "/testApp": {
        "page.tsx": "export function Page() {};",
      },
    });

    const result1 = scanAppDir("/output", "/testApp");
    clearScanAppDirCache("/testApp");
    const result2 = scanAppDir("/output", "/testApp");
    expect(result1).not.toBe(result2);
  });

  it("should clear parent cache when clearScanAppDirCache is called with a subdirectory", () => {
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

    // Clear cache by indicating a change in the subdirectory.
    clearScanAppDirCache("/testApp/sub");

    const parentResult2 = scanAppDir("/output", "/testApp");
    const childResult2 = scanAppDir("/output", "/testApp/sub");

    expect(parentResult1).not.toBe(parentResult2);
    expect(childResult1).not.toBe(childResult2);
  });

  it("should not clear any cache if clearScanAppDirCache is called with a non-matching path", () => {
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

    // Call clear with a path that doesn't match any cached entry.
    clearScanAppDirCache("/nonexistent");

    const resultTestApp2 = scanAppDir("/output", "/testApp");
    const resultAnother2 = scanAppDir("/output", "/another");

    expect(resultTestApp1).toBe(resultTestApp2);
    expect(resultAnother1).toBe(resultAnother2);
  });
});

describe("scanAppDirCache modification scenarios - detailed verification", () => {
  beforeEach(() => {
    scanAppDirCache.clear();
    visitedDirsCache.clear();
    clearCntCache();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should generate correct output when the lowest-level file is modified", () => {
    // 初回スキャン：最下層のファイル (page.tsx) で Endpoint として認識される
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

    // 変更後：同じファイルの内容を route 定義に変更（GET メソッドが検出される）
    mock.restore();
    mock({
      "/testApp": {
        sub: {
          "page.tsx": "export function GET() {};",
        },
      },
    });
    // 変更されたファイルのパスを指定してキャッシュクリア
    clearScanAppDirCache("/testApp/sub/page.tsx");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
  "sub": { "$get": typeof GET_0 } & Endpoint
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when a mid-level file is modified", () => {
    // 初回スキャン：中間層のファイル (page.tsx) で Endpoint として認識される
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

    // 変更後：中間層のファイル内容を変更して GET メソッドが検出される
    mock.restore();
    mock({
      "/testApp": {
        mid: {
          "page.tsx": "export function GET() {};",
        },
      },
    });
    clearScanAppDirCache("/testApp/mid/page.tsx");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{
  "mid": { "$get": typeof GET_0 } & Endpoint
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when a top-level file is modified", () => {
    // 初回スキャン：トップレベルのファイル (index.ts) で Endpoint として認識される
    mock({
      "/testApp": {
        "route.ts": "export default function Index() {};",
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `Endpoint`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // 変更後：同じファイル内容を変更して GET メソッドが検出される
    mock.restore();
    mock({
      "/testApp": {
        "route.ts": "export function GET() {};",
      },
    });
    clearScanAppDirCache("/testApp/index.ts");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `{ "$get": typeof GET_0 } & Endpoint`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when a folder is added in the lowest-level directory", () => {
    // 初回スキャン：/testApp/sub に1ファイルのみが存在
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

    // 変更後：/testApp/sub に新たなフォルダ newFolder が追加され、その中にファイルが存在する
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
    clearScanAppDirCache("/testApp/sub/newFolder");
    const modified = scanAppDir("/output", "/testApp");
    // ※ 内部では sub 以下で page.tsx から Endpoint、newFolder からも Endpoint が生成される
    const expectedModified = `{
  "sub": Endpoint & {
    "newFolder": Endpoint
  }
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when a folder is added in a mid-level directory", () => {
    // 初回スキャン：/testApp/mid/sub に1ファイルのみが存在
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

    // 変更後：/testApp/mid に新たなフォルダ newFolder が追加され、その中にファイルが存在する
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
    clearScanAppDirCache("/testApp/mid/newFolder");
    const modified = scanAppDir("/output", "/testApp");
    // sorting により、ディレクトリ名がアルファベット順で並ぶ (newFolder < sub)
    const expectedModified = `{
  "mid": {
    "newFolder": Endpoint,
    "sub": Endpoint
  }
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });

  it("should generate correct output when a folder is added in the top-level directory", () => {
    // 初回スキャン：/testApp にトップレベルのファイルのみが存在
    mock({
      "/testApp": {
        "route.ts": "export default function Index() {};",
      },
    });
    const initial = scanAppDir("/output", "/testApp");
    const expectedInitial = `Endpoint`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // 変更後：/testApp に新たなフォルダ newFolder が追加され、その中にファイルが存在する
    mock.restore();
    mock({
      "/testApp": {
        "route.ts": "export default function Index() {};",
        newFolder: {
          "page.tsx": "export function NewPage() {};",
        },
      },
    });
    clearScanAppDirCache("/testApp/newFolder");
    const modified = scanAppDir("/output", "/testApp");
    const expectedModified = `Endpoint & {
  "newFolder": Endpoint
}`;
    expect(modified.pathStructure).toBe(expectedModified);
  });
});

describe("scanAppDirCache dynamic folder scenarios - detailed verification", () => {
  beforeEach(() => {
    scanAppDirCache.clear();
    visitedDirsCache.clear();
    clearCntCache();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should generate correct output when a single dynamic folder is inserted in between", () => {
    // 初期状態: /testApp/[user]/home/page.tsx
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

    // 変更後: ダイナミックフォルダを1段追加
    // → /testApp/[user]/[id]/home/page.tsx
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
    // 追加された部分のキャッシュをクリア（※子ディレクトリのキャッシュを削除すれば上位も再生成される）
    clearScanAppDirCache("/testApp/[user]/[id]");
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
    // 初期状態: /testApp/[user]/home/page.tsx
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

    // 変更後: 複数のダイナミックフォルダを挿入
    // → /testApp/[user]/[id]/[detail]/home/page.tsx
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
    clearScanAppDirCache("/testApp/[user]/[id]");
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

  it("should generate correct output when a dynamic folder is inserted in the middle of an already multi-folder dynamic structure", () => {
    // 初期状態: /testApp/[user]/[id]/home/page.tsx
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

    // 変更後: 既存の2段階の間にもう1段階挿入
    // → /testApp/[user]/[lang]/[id]/home/page.tsx
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
    clearScanAppDirCache("/testApp/[user]/[lang]");
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

describe("scanAppDirCache multiple child directories scenarios", () => {
  beforeEach(() => {
    scanAppDirCache.clear();
    visitedDirsCache.clear();
    clearCntCache();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should generate correct output when multiple child directories exist and one branch is modified with an additional dynamic folder", () => {
    // 初期状態:
    // /testApp
    //   [user]/home/page.tsx   → dynamic: "[user]" → "_user" として処理される
    //   static/home/page.tsx     → 静的ディレクトリ "static"
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
    // sorted順はファイルシステムのデフォルトの lexicographical ソートに従い、"[user]" は _user、"static" はそのまま "static"
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

    // 変更後: [user] ブランチに動的フォルダ [id] を追加して
    // /testApp
    //   [user]/[id]/home/page.tsx   → _user/_id の階層に変化
    //   static/home/page.tsx         → 変更なし
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
    // 追加された動的フォルダのパスを指定してキャッシュクリア
    clearScanAppDirCache("/testApp/[admin]/[id]");
    clearScanAppDirCache("/testApp/[user]/[id]");
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
    // 初期状態:
    // /testApp
    //   [user]/home/page.tsx      → _user
    //   [group]/dashboard/page.tsx → _group
    // ※ 両方とも動的フォルダのため、各ブランチは Record<ParamsKey, …> が付与される
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
    // ソート順："[group]" が先、"[user]" が後になる想定
    const expectedInitial = `{
  "_group": {
    "dashboard": Endpoint & Record<ParamsKey, { "group": string }>
  },
  "_user": {
    "home": Endpoint & Record<ParamsKey, { "user": string }>
  }
}`;
    expect(initial.pathStructure).toBe(expectedInitial);

    // 変更後: 両ブランチに追加の動的フォルダ [id] を挿入
    // /testApp
    //   [user]/[id]/home/page.tsx      → _user/_id
    //   [group]/[id]/dashboard/page.tsx  → _group/_id
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
    // キャッシュクリア：両方の追加されたパスをクリアすれば上位も再生成される
    clearScanAppDirCache("/testApp/[user]/[id]");
    clearScanAppDirCache("/testApp/[group]/[id]");
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

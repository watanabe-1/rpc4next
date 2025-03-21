import mock from "mock-fs";
import { describe, beforeEach, afterEach, it, expect } from "vitest";
import { hasTargetFiles, scanAppDir } from "./routeScanner";

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
  });

  it("should scan API directory and generate path structure with dynamic route", () => {
    mock({
      "/testApp": {
        api: {
          users: {
            "index.ts": "console.log('test');",
            "[id]": {
              "route.ts": "export function GET() {};",
            },
          },
        },
      },
    });

    const expectPathStructure = `{
  "api": {
    "users": {
      "_id": { "$get": typeof GET_0 } & Endpoint & Record<ParamsKey, { "id": string }>
    }
  }
}`;

    const { pathStructure, imports } = scanAppDir("/output", "/testApp");
    expect(pathStructure).equals(expectPathStructure);

    const { statement, path } = imports[0];
    expect(statement).equals(
      'import type { GET as GET_0 } from "./testApp/api/users/[id]/route";'
    );
    expect(path).equals("./testApp/api/users/[id]/route");
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
});

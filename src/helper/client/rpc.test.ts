import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, test, expect } from "vitest";
import { createRpcClient } from "./rpc";
import { routeHandlerFactory } from "../server";
import { ParamsKey, Endpoint } from "./types";

const createRouteHandler = routeHandlerFactory();

const { POST: _post_0 } = createRouteHandler().post(async (rc) =>
  rc.text("post")
);

const { GET: _get_0 } = createRouteHandler().get(async (rc) =>
  rc.json({ method: "get" })
);

const { DELETE: _delete_0 } = createRouteHandler().delete(async (rc) =>
  rc.text("delete")
);

const { HEAD: _head_0 } = createRouteHandler().head(async (rc) =>
  rc.text("head")
);

const { PATCH: _patch_0 } = createRouteHandler().patch(async (rc) =>
  rc.text("patch")
);

const { PUT: _put_0 } = createRouteHandler().put(async (rc) => rc.text("put"));

const { DELETE: _delete_1 } = createRouteHandler().delete(async (rc) => {
  const headers = Object.fromEntries(rc.req.headers.entries());

  return rc.json(headers);
});

export type PathStructure = Endpoint & {
  admin: Endpoint & {
    _qualification: Endpoint &
      Record<ParamsKey, { qualification: string }> & {
        _grade: Endpoint;
      };
  };
  api: {
    questions: {
      $post: typeof _post_0;
      $delete: typeof _delete_0;
      $head: typeof _head_0;
      $patch: typeof _patch_0;
      $put: typeof _put_0;
    } & Endpoint & {
        _qualification: { $get: typeof _get_0 } & Endpoint & {
            _id: { $delete: typeof _delete_1 } & Endpoint;
          };
      };
  };
};

// MSW handler configuration
const server = setupServer(
  http.get("http://localhost:3000/api/questions/test", () => {
    return HttpResponse.json({ method: "get" });
  }),
  http.post("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("post");
  }),
  http.delete("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("delete");
  }),
  http.head("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("head");
  }),
  http.patch("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("patch");
  }),
  http.put("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("put");
  }),
  http.delete("http://localhost:3000/api/questions/test/fetch", (resInfo) => {
    const headers = Object.fromEntries(resInfo.request.headers.entries());

    return HttpResponse.json(headers);
  })
);

// MSW lifecycle setup
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("createRpcClient basic behavior", () => {
  test("should generate correct URL", () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const urlResult = client.admin._qualification("test").$url();
    expect(urlResult.path).toBe("http://localhost:3000/admin/test");
    expect(urlResult.relativePath).toBe("/admin/test");
    expect(urlResult.pathname).toBe("/admin/[qualification]");
    expect(urlResult.params).toEqual({ qualification: "test" });
  });

  test("should generate URL with query and hash parameters", () => {
    const client = createRpcClient<PathStructure>("");
    const urlResult = client.admin._qualification("test").$url({
      query: { foo: "bar" },
      hash: "section",
    });
    expect(urlResult.path).toBe("/admin/test?foo=bar#section");
  });

  test("should successfully perform GET request", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions._qualification("test").$get();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ method: "get" });
  });

  test("should successfully perform POST request", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$post();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("post");
  });

  test("should successfully perform DELETE request (text response)", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$delete();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("delete");
  });

  test("should successfully perform HEAD request", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$head();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("head");
  });

  test("should successfully perform PATCH request", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$patch();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("patch");
  });

  test("should successfully perform PUT request", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$put();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("put");
  });
});

describe("customFetch behavior", () => {
  test("should use only client-level options when only client options are specified", async () => {
    let capturedInit: RequestInit | undefined;
    const customFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      capturedInit = init;

      return new Response("ok", { status: 200 });
    };

    const client = createRpcClient<PathStructure>("http://localhost:3000", {
      fetch: customFetch,
      init: {
        headers: { "x-client": "client-header" },
        mode: "cors",
      },
    });

    await client.api.questions.$delete();
    expect(capturedInit).toBeDefined();
    expect(capturedInit!.method).toBe("DELETE");
    expect(capturedInit!.mode).toBe("cors");
    expect(capturedInit!.headers).toEqual({ "x-client": "client-header" });
  });

  test("should use only method-level options when only method options are specified", async () => {
    let capturedInit: RequestInit | undefined;
    const customFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      capturedInit = init;

      return new Response("ok", { status: 200 });
    };

    const client = createRpcClient<PathStructure>("http://localhost:3000", {
      fetch: customFetch,
    });

    await client.api.questions.$delete(undefined, {
      init: {
        headers: { "x-method": "method-header" },
        cache: "no-cache",
      },
    });

    expect(capturedInit).toBeDefined();
    expect(capturedInit!.method).toBe("DELETE");
    expect(capturedInit!.cache).toBe("no-cache");
    expect(capturedInit!.headers).toEqual({ "x-method": "method-header" });
  });

  test("should correctly merge client and method options", async () => {
    let capturedInit: RequestInit | undefined;
    const customFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      capturedInit = init;

      return new Response("ok", { status: 200 });
    };

    const client = createRpcClient<PathStructure>("http://localhost:3000", {
      fetch: customFetch,
      init: {
        headers: { "x-client": "client-header", common: "client" },
        mode: "cors",
        credentials: "include",
      },
    });

    await client.api.questions.$delete(undefined, {
      init: {
        headers: { "x-method": "method-header", common: "method" },
        cache: "no-cache",
      },
    });

    expect(capturedInit).toBeDefined();
    expect(capturedInit!.method).toBe("DELETE");
    expect(capturedInit!.mode).toBe("cors");
    expect(capturedInit!.credentials).toBe("include");
    expect(capturedInit!.cache).toBe("no-cache");
    expect(capturedInit!.headers).toEqual({
      "x-client": "client-header",
      common: "method",
      "x-method": "method-header",
    });
  });

  test("should work when init options have no headers", async () => {
    let capturedInit: RequestInit | undefined;
    const customFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      capturedInit = init;

      return new Response("ok", { status: 200 });
    };

    const client = createRpcClient<PathStructure>("http://localhost:3000", {
      fetch: customFetch,
      init: {},
    });

    await client.api.questions.$delete(undefined, {
      init: {
        headers: { "x-only": "only-header" },
      },
    });

    expect(capturedInit).toBeDefined();
    expect(capturedInit!.method).toBe("DELETE");
    expect(capturedInit!.headers).toEqual({ "x-only": "only-header" });
  });

  test("should merge non-conflicting options from client and method", async () => {
    let capturedInit: RequestInit | undefined;
    const customFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      capturedInit = init;

      return new Response("ok", { status: 200 });
    };

    const client = createRpcClient<PathStructure>("http://localhost:3000", {
      fetch: customFetch,
      init: {
        mode: "cors",
      },
    });

    await client.api.questions.$delete(undefined, {
      init: {
        cache: "no-store",
      },
    });

    expect(capturedInit).toBeDefined();
    expect(capturedInit!.method).toBe("DELETE");
    expect(capturedInit!.mode).toBe("cors");
    expect(capturedInit!.cache).toBe("no-store");
  });

  test("should propagate network errors", async () => {
    const errorFetch = async (_: RequestInfo | URL, __?: RequestInit) => {
      throw new Error("Network failure");
    };

    const client = createRpcClient<PathStructure>("http://localhost:3000", {
      fetch: errorFetch,
    });

    await expect(client.api.questions.$delete()).rejects.toThrow(
      "Network failure"
    );
  });

  test("should correctly pass request body for POST requests", async () => {
    let capturedBody;
    const customFetch = async (_: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = init?.body;

      return new Response("received", { status: 200 });
    };

    const client = createRpcClient<PathStructure>("http://localhost:3000", {
      fetch: customFetch,
    });

    await client.api.questions.$post(undefined, {
      init: {
        body: JSON.stringify({ test: "data" }),
      },
    });
    expect(capturedBody).toBe(JSON.stringify({ test: "data" }));
  });

  test("should correctly merge multiple header values", async () => {
    let capturedHeaders;
    const customFetch = async (_: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = init?.headers;

      return new Response("ok", { status: 200 });
    };

    const client = createRpcClient<PathStructure>("http://localhost:3000", {
      fetch: customFetch,
      init: { headers: { "x-header": "value1", common: "client" } },
    });

    await client.api.questions.$delete(undefined, {
      init: { headers: { "another-header": "value2", common: "method" } },
    });

    expect(capturedHeaders).toEqual({
      "x-header": "value1",
      common: "method",
      "another-header": "value2",
    });
  });
});

describe("real fetch behavior", () => {
  test("should send client-level headers", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000", {
      init: {
        headers: { "x-client": "client-header" },
      },
    });
    const response = await client.api.questions
      ._qualification("test")
      ._id("fetch")
      .$delete();
    const json = await response.json();
    expect(json["x-client"]).toBe("client-header");
  });

  test("should send method-level headers", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions
      ._qualification("test")
      ._id("fetch")
      .$delete(undefined, {
        init: {
          headers: { "x-only": "only-header" },
        },
      });
    const json = await response.json();
    expect(json["x-only"]).toBe("only-header");
  });

  test("should correctly merge client and method headers", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000", {
      init: {
        headers: { "x-client": "client-header", common: "client" },
        mode: "cors",
        credentials: "include",
      },
    });

    const response = await client.api.questions
      ._qualification("test")
      ._id("fetch")
      .$delete(undefined, {
        init: {
          headers: { "x-method": "method-header", common: "method" },
          cache: "no-cache",
        },
      });
    const json = await response.json();
    expect(json["x-client"]).toBe("client-header");
    expect(json["x-method"]).toBe("method-header");
    expect(json["common"]).toBe("method");
  });
});

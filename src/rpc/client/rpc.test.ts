import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextRequest, NextResponse } from "next/server";
import {
  beforeAll,
  afterEach,
  afterAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from "vitest";
import { createRpcClient } from "./rpc";
import {
  ContentType,
  HttpStatusCode,
  routeHandlerFactory,
  TypedNextResponse,
} from "../server";
import { ParamsKey, Endpoint, QueryKey } from "./types";

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

type PathStructure = Endpoint & {
  fuga: Endpoint & {
    _foo: Endpoint &
      Record<ParamsKey, { foo: string }> & {
        _piyo: Endpoint;
      };
  };
  api: {
    hoge: {
      $post: typeof _post_0;
      $delete: typeof _delete_0;
      $head: typeof _head_0;
      $patch: typeof _patch_0;
      $put: typeof _put_0;
    } & Endpoint & {
        _foo: { $get: typeof _get_0 } & Endpoint & {
            _bar: { $delete: typeof _delete_1 } & Endpoint;
          };
      };
  };
};

// MSW handler configuration
const server = setupServer(
  http.get("http://localhost:3000/api/hoge/test", () => {
    return HttpResponse.json({ method: "get" });
  }),
  http.post("http://localhost:3000/api/hoge", () => {
    return HttpResponse.text("post");
  }),
  http.delete("http://localhost:3000/api/hoge", () => {
    return HttpResponse.text("delete");
  }),
  http.head("http://localhost:3000/api/hoge", () => {
    return HttpResponse.text("head");
  }),
  http.patch("http://localhost:3000/api/hoge", () => {
    return HttpResponse.text("patch");
  }),
  http.put("http://localhost:3000/api/hoge", () => {
    return HttpResponse.text("put");
  }),
  http.delete("http://localhost:3000/api/hoge/test/fetch", (resInfo) => {
    const headers = Object.fromEntries(resInfo.request.headers.entries());

    return HttpResponse.json(headers);
  })
);

describe("createRpcClient", () => {
  // MSW lifecycle setup
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe("createRpcClient basic behavior", () => {
    it("should generate correct URL", () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const urlResult = client.fuga._foo("test").$url();
      expect(urlResult.path).toBe("http://localhost:3000/fuga/test");
      expect(urlResult.relativePath).toBe("/fuga/test");
      expect(urlResult.pathname).toBe("/fuga/[foo]");
      expect(urlResult.params).toEqual({ foo: "test" });
    });

    it("should generate URL with query and hash parameters", () => {
      const client = createRpcClient<PathStructure>("");
      const urlResult = client.fuga._foo("test").$url({
        query: { foo: "bar" },
        hash: "section",
      });
      expect(urlResult.path).toBe("/fuga/test?foo=bar#section");
    });

    it("should successfully perform GET request", async () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const response = await client.api.hoge._foo("test").$get();
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ method: "get" });
    });

    it("should successfully perform POST request", async () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const response = await client.api.hoge.$post();
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("post");
    });

    it("should successfully perform DELETE request (text response)", async () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const response = await client.api.hoge.$delete();
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("delete");
    });

    it("should successfully perform HEAD request", async () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const response = await client.api.hoge.$head();
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("head");
    });

    it("should successfully perform PATCH request", async () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const response = await client.api.hoge.$patch();
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("patch");
    });

    it("should successfully perform PUT request", async () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const response = await client.api.hoge.$put();
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("put");
    });
  });

  describe("customFetch behavior", () => {
    it("should use only client-level options when only client options are specified", async () => {
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

      await client.api.hoge.$delete();
      expect(capturedInit).toBeDefined();
      expect(capturedInit!.method).toBe("DELETE");
      expect(capturedInit!.mode).toBe("cors");
      expect(capturedInit!.headers).toEqual({ "x-client": "client-header" });
    });

    it("should use only method-level options when only method options are specified", async () => {
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

      await client.api.hoge.$delete(undefined, {
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

    it("should correctly merge client and method options", async () => {
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

      await client.api.hoge.$delete(undefined, {
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

    it("should work when init options have no headers", async () => {
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

      await client.api.hoge.$delete(undefined, {
        init: {
          headers: { "x-only": "only-header" },
        },
      });

      expect(capturedInit).toBeDefined();
      expect(capturedInit!.method).toBe("DELETE");
      expect(capturedInit!.headers).toEqual({ "x-only": "only-header" });
    });

    it("should merge non-conflicting options from client and method", async () => {
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

      await client.api.hoge.$delete(undefined, {
        init: {
          cache: "no-store",
        },
      });

      expect(capturedInit).toBeDefined();
      expect(capturedInit!.method).toBe("DELETE");
      expect(capturedInit!.mode).toBe("cors");
      expect(capturedInit!.cache).toBe("no-store");
    });

    it("should propagate network errors", async () => {
      const errorFetch = async (_: RequestInfo | URL, __?: RequestInit) => {
        throw new Error("Network failure");
      };

      const client = createRpcClient<PathStructure>("http://localhost:3000", {
        fetch: errorFetch,
      });

      await expect(client.api.hoge.$delete()).rejects.toThrow(
        "Network failure"
      );
    });

    it("should correctly pass request body for POST requests", async () => {
      let capturedBody;
      const customFetch = async (_: RequestInfo | URL, init?: RequestInit) => {
        capturedBody = init?.body;

        return new Response("received", { status: 200 });
      };

      const client = createRpcClient<PathStructure>("http://localhost:3000", {
        fetch: customFetch,
      });

      await client.api.hoge.$post(undefined, {
        init: {
          body: JSON.stringify({ test: "data" }),
        },
      });
      expect(capturedBody).toBe(JSON.stringify({ test: "data" }));
    });

    it("should correctly merge multiple header values", async () => {
      let capturedHeaders;
      const customFetch = async (_: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = init?.headers;

        return new Response("ok", { status: 200 });
      };

      const client = createRpcClient<PathStructure>("http://localhost:3000", {
        fetch: customFetch,
        init: { headers: { "x-header": "value1", common: "client" } },
      });

      await client.api.hoge.$delete(undefined, {
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
    it("should send client-level headers", async () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000", {
        init: {
          headers: { "x-client": "client-header" },
        },
      });
      const response = await client.api.hoge
        ._foo("test")
        ._bar("fetch")
        .$delete();
      const json = await response.json();
      expect(json["x-client"]).toBe("client-header");
    });

    it("should send method-level headers", async () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const response = await client.api.hoge
        ._foo("test")
        ._bar("fetch")
        .$delete(undefined, {
          init: {
            headers: { "x-only": "only-header" },
          },
        });
      const json = await response.json();
      expect(json["x-only"]).toBe("only-header");
    });

    it("should correctly merge client and method headers", async () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000", {
        init: {
          headers: { "x-client": "client-header", common: "client" },
          mode: "cors",
          credentials: "include",
        },
      });

      const response = await client.api.hoge
        ._foo("test")
        ._bar("fetch")
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

  type FalierPathStructure = Endpoint & {
    _fuga: Endpoint;
    hoge: Endpoint;
  };

  describe("Invalid usage patterns", () => {
    it("throws when a dynamic parameter is called without an argument or when a static path is called as a function", () => {
      const client = createRpcClient<FalierPathStructure>("");

      // calling dynamic param without argument
      expect(() => client._fuga(undefined as unknown as string)).toThrow(
        "An argument is required when calling the function for paramKey: _fuga"
      );

      // calling static path segment as a function
      const hoge = client.hoge as unknown as (value: string) => "";
      expect(() => hoge("")).toThrow(
        "paramKey: hoge is not a dynamic parameter and cannot be called as a function"
      );
    });
  });

  const { POST: _post_1 } = createRouteHandler().post(
    async (rc) => rc.json("json"),
    async (rc) => rc.text("text")
  );

  const { POST: _get_1 } = createRouteHandler().post(
    async (rc) => rc.text("error", { status: 400 }),
    async (rc) => rc.json({ ok: true }, { status: 200 })
  );

  async function _get_2(_: NextRequest) {
    return NextResponse.json({ default: "true" });
  }

  type PathStructureForTypeTest = Endpoint & {
    fuga: Endpoint & {
      _foo: Endpoint &
        Record<ParamsKey, { foo: string }> & {
          _piyo: Endpoint &
            Record<QueryKey, { baz: string }> &
            Record<ParamsKey, { foo: string; piyo: string }>;
        };
    };
    api: {
      hoge: {
        $post: typeof _post_1;
      } & Endpoint & {
          _foo: { $get: typeof _get_1 } & Endpoint &
            Record<ParamsKey, { foo: string }>;
          _bar: { $get: typeof _get_2 } & Endpoint &
            Record<ParamsKey, { bar: string }>;
        };
    };
  };

  describe("createHandler type definitions", () => {
    it("should infer types correctly", async () => {
      const customFetch = async (_: RequestInfo | URL, __?: RequestInit) => {
        return new Response();
      };
      const client = createRpcClient<PathStructureForTypeTest>("", {
        fetch: customFetch,
      });
      const _createUrl = client.fuga._foo("param")._piyo("").$url;

      type ExpectedUrlResult = {
        pathname: string;
        path: string;
        relativePath: string;
        params: {
          foo: string;
          piyo: string;
        };
      };

      type ExpectedUrlFunc = (url: {
        query: {
          baz: string;
        };
        hash?: string;
      }) => ExpectedUrlResult;

      expectTypeOf<typeof _createUrl>().toEqualTypeOf<ExpectedUrlFunc>();

      const _response = await client.api.hoge.$post();

      type ExpectedResponse =
        | TypedNextResponse<string, 200, "application/json">
        | TypedNextResponse<"text", 200, "text/plain">;

      expectTypeOf<typeof _response>().toEqualTypeOf<ExpectedResponse>();

      const incloudErrResponse = await client.api.hoge._foo("").$get();

      type ExpectedIncloudErrResponse =
        | TypedNextResponse<"error", 400, "text/plain">
        | TypedNextResponse<
            {
              ok: boolean;
            },
            200,
            "application/json"
          >;
      expectTypeOf<
        typeof incloudErrResponse
      >().toEqualTypeOf<ExpectedIncloudErrResponse>();

      if (incloudErrResponse.ok) {
        type ExpectedOkResponse = TypedNextResponse<
          {
            ok: boolean;
          },
          200,
          "application/json"
        >;

        type ExpectdJson = () => Promise<{
          ok: boolean;
        }>;
        type ExpectdText = () => Promise<string>;

        const _json = incloudErrResponse.json;
        const _text = incloudErrResponse.text;

        expectTypeOf<
          typeof incloudErrResponse
        >().toEqualTypeOf<ExpectedOkResponse>();
        expectTypeOf<typeof _json>().toEqualTypeOf<ExpectdJson>();
        expectTypeOf<typeof _text>().toEqualTypeOf<ExpectdText>();
      } else {
        type ExpectedErrResponse = TypedNextResponse<
          "error",
          400,
          "text/plain"
        >;

        type ExpectdJson = () => Promise<never>;
        type ExpectdText = () => Promise<"error">;

        const _json = incloudErrResponse.json;
        const _text = incloudErrResponse.text;

        expectTypeOf<
          typeof incloudErrResponse
        >().toEqualTypeOf<ExpectedErrResponse>();
        expectTypeOf<typeof _json>().toEqualTypeOf<ExpectdJson>();
        expectTypeOf<typeof _text>().toEqualTypeOf<ExpectdText>();
      }

      const _defaultResponse = await client.api.hoge._bar("").$get();

      type ExpectedDefaultResponse = TypedNextResponse<
        {
          default: string;
        },
        HttpStatusCode,
        ContentType
      >;
      expectTypeOf<
        typeof _defaultResponse
      >().toEqualTypeOf<ExpectedDefaultResponse>();
    });
  });
});

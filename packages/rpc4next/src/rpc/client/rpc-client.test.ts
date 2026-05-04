import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { type NextRequest, NextResponse } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import {
  type ContentType,
  type HttpStatusCode,
  nextRoute,
  type ProcedureRouteContract,
  procedure,
  type RpcErrorEnvelope,
  type TypedNextResponse,
} from "../server";
import { defaultProcedureOnError } from "../server/on-error";
import { createRpcClient } from "./rpc-client";
import type { ParamsKey, QueryKey, RpcEndpoint } from "./types";

const staticRouteContract = {
  pathname: "/api/hoge",
  params: {} as Record<never, never>,
} as ProcedureRouteContract<"/api/hoge", Record<never, never>>;

const _post_0 = nextRoute(
  procedure.forRoute(staticRouteContract).handle(async ({ response }) => response.text("post")),
  { method: "POST", onError: defaultProcedureOnError },
);

const _get_0 = nextRoute(
  procedure
    .forRoute(staticRouteContract)
    .handle(async ({ response }) => response.json({ method: "get" })),
  { method: "GET", onError: defaultProcedureOnError },
);

const _delete_0 = nextRoute(
  procedure.forRoute(staticRouteContract).handle(async ({ response }) => response.text("delete")),
  { method: "DELETE", onError: defaultProcedureOnError },
);

const _head_0 = nextRoute(
  procedure.forRoute(staticRouteContract).handle(async ({ response }) => response.text("head")),
  { method: "HEAD", onError: defaultProcedureOnError },
);

const _patch_0 = nextRoute(
  procedure.forRoute(staticRouteContract).handle(async ({ response }) => response.text("patch")),
  { method: "PATCH", onError: defaultProcedureOnError },
);

const _put_0 = nextRoute(
  procedure.forRoute(staticRouteContract).handle(async ({ response }) => response.text("put")),
  { method: "PUT", onError: defaultProcedureOnError },
);

const _delete_1 = nextRoute(
  procedure
    .forRoute(staticRouteContract)
    .handle(
      async ({
        request,
        response,
      }): Promise<TypedNextResponse<Record<string, string>, 200, "application/json">> =>
        response.json(Object.fromEntries(request.headers.entries())),
    ),
  { method: "DELETE", onError: defaultProcedureOnError },
);

type PathStructure = RpcEndpoint & {
  fuga: RpcEndpoint & {
    _foo: RpcEndpoint &
      Record<ParamsKey, { foo: string }> &
      Record<QueryKey, { baz: string }> & {
        _piyo: RpcEndpoint;
      };
  };
  hoge: RpcEndpoint & {
    _foo: RpcEndpoint;
  };
  api: {
    hoge: {
      $post: typeof _post_0;
      $delete: typeof _delete_0;
      $head: typeof _head_0;
      $patch: typeof _patch_0;
      $put: typeof _put_0;
    } & RpcEndpoint & {
        _foo: { $get: typeof _get_0 } & RpcEndpoint & {
            _bar: { $delete: typeof _delete_1 } & RpcEndpoint;
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
  }),
);

describe("createRpcClient", () => {
  // MSW lifecycle setup
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe("createRpcClient basic behavior", () => {
    it("should generate correct URL", () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const urlResult = client.hoge._foo("test").$url();
      expect(urlResult.path).toBe("http://localhost:3000/hoge/test");
      expect(urlResult.relativePath).toBe("/hoge/test");
      expect(urlResult.pathname).toBe("/hoge/[foo]");
      expect(urlResult.params).toEqual({ foo: "test" });
    });

    it("should generate URL with query and hash parameters", () => {
      const client = createRpcClient<PathStructure>("");
      const urlResult = client.fuga._foo("test").$url({
        query: { baz: "bar" },
        hash: "section",
      });
      expect(urlResult.path).toBe("/fuga/test?baz=bar#section");
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
      const customFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
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
      expect(capturedInit?.method).toBe("DELETE");
      expect(capturedInit?.mode).toBe("cors");
      expect(capturedInit?.headers).toEqual({ "x-client": "client-header" });
    });

    it("should use only method-level options when only method options are specified", async () => {
      let capturedInit: RequestInit | undefined;
      const customFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
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
      expect(capturedInit?.method).toBe("DELETE");
      expect(capturedInit?.cache).toBe("no-cache");
      expect(capturedInit?.headers).toEqual({ "x-method": "method-header" });
    });

    it("should correctly merge client and method options", async () => {
      let capturedInit: RequestInit | undefined;
      const customFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
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
      expect(capturedInit?.method).toBe("DELETE");
      expect(capturedInit?.mode).toBe("cors");
      expect(capturedInit?.credentials).toBe("include");
      expect(capturedInit?.cache).toBe("no-cache");
      expect(capturedInit?.headers).toEqual({
        "x-client": "client-header",
        common: "method",
        "x-method": "method-header",
      });
    });

    it("should work when init options have no headers", async () => {
      let capturedInit: RequestInit | undefined;
      const customFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
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
      expect(capturedInit?.method).toBe("DELETE");
      expect(capturedInit?.headers).toEqual({ "x-only": "only-header" });
    });

    it("should merge non-conflicting options from client and method", async () => {
      let capturedInit: RequestInit | undefined;
      const customFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
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
      expect(capturedInit?.method).toBe("DELETE");
      expect(capturedInit?.mode).toBe("cors");
      expect(capturedInit?.cache).toBe("no-store");
    });

    it("should propagate network errors", async () => {
      const errorFetch = async (_: RequestInfo | URL, __?: RequestInit) => {
        throw new Error("Network failure");
      };

      const client = createRpcClient<PathStructure>("http://localhost:3000", {
        fetch: errorFetch,
      });

      await expect(client.api.hoge.$delete()).rejects.toThrow("Network failure");
    });

    it("should correctly pass request body for POST requests", async () => {
      let capturedBody: BodyInit | null | undefined;
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
      let capturedHeaders: HeadersInit | undefined;
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
      const response = await client.api.hoge._foo("test")._bar("fetch").$delete();
      const json = (await response.json()) as Record<string, string>;
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
      const json = (await response.json()) as Record<string, string>;
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
      const json = (await response.json()) as Record<string, string>;
      expect(json["x-client"]).toBe("client-header");
      expect(json["x-method"]).toBe("method-header");
      expect(json.common).toBe("method");
    });
  });

  describe("proxy traps / edge cases", () => {
    it("is not thenable and ignores symbols; chaining still works", async () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");

      // Triggers key === "then"
      expect(Reflect.get(client as object, "then")).toBeUndefined();

      // Triggers typeof key === "symbol"
      const tag = Reflect.get(client as object, Symbol.toStringTag);
      expect(tag).toBeUndefined();

      // Another symbol access, still safe
      void Reflect.get(client as object, Symbol.iterator);

      // Chaining remains functional after symbol accesses
      const res = await client.api.hoge.$post();
      expect(res.status).toBe(200);

      // Awaiting the proxy should not treat it as a Promise
      const awaited: unknown = await (client as unknown);
      expect(awaited).toBe(client);
    });

    it("keeps dynamic placeholders in pathname after applying values", () => {
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const url = client.api.hoge._foo("A")._bar("B").$url();
      expect(url.pathname).toBe("/api/hoge/[foo]/[bar]");
      expect(url.params).toEqual({ foo: "A", bar: "B" });
    });

    it('throws when calling the root proxy as a function ("/" is not dynamic)', () => {
      const client = createRpcClient<PathStructure>("/");
      expect(() => (client as unknown as (v: string) => void)("x")).toThrow(
        'Cannot apply a value: "/" is not a dynamic segment.',
      );
    });

    it("throws when a dynamic parameter is called without an argument", () => {
      type FailurePath = RpcEndpoint & { _fuga: RpcEndpoint };
      const client = createRpcClient<FailurePath>("");
      expect(() => (client._fuga as unknown as (v?: string) => void)()).toThrow(
        "Missing value for dynamic parameter: _fuga",
      );
    });
  });

  type FalierPathStructure = RpcEndpoint & {
    _fuga: RpcEndpoint;
    hoge: RpcEndpoint;
  };

  type OptionalCatchAllPath = RpcEndpoint & {
    patterns: {
      _____parts: RpcEndpoint & Record<ParamsKey, { parts: string[] | undefined }>;
    };
  };

  describe("Invalid usage patterns", () => {
    it("throws when a dynamic parameter is called without an argument or when a static path is called as a function", () => {
      const client = createRpcClient<FalierPathStructure>("");

      // calling dynamic param without argument
      expect(() => client._fuga(undefined as unknown as string)).toThrow(
        "Missing value for dynamic parameter: _fuga",
      );

      // calling static path segment as a function
      const hoge = client.hoge as unknown as (value: string) => "";
      expect(() => hoge("")).toThrow('Cannot apply a value: "hoge" is not a dynamic segment.');
    });
  });

  describe("optional catch-all runtime behavior", () => {
    it("allows calling an optional catch-all segment without an argument", () => {
      const client = createRpcClient<OptionalCatchAllPath>("");

      expect(client.patterns._____parts().$url()).toEqual({
        path: "/patterns",
        relativePath: "/patterns",
        pathname: "/patterns/[[...parts]]",
        params: { parts: undefined },
      });
    });
  });

  const _post_1 = nextRoute(
    procedure.forRoute(staticRouteContract).handle(async ({ response }) => {
      return Math.random() > 0.5 ? response.json("json") : response.text("text");
    }),
    { method: "POST", onError: defaultProcedureOnError },
  );

  const _get_1 = nextRoute(
    procedure.forRoute(staticRouteContract).handle(
      async ({
        response,
      }): Promise<
        | TypedNextResponse<"error", 400, "text/plain">
        | TypedNextResponse<
            {
              ok: boolean;
            },
            200,
            "application/json"
          >
      > => {
        return Math.random() > 0.5
          ? response.text("error", { status: 400 })
          : response.json({ ok: true }, { status: 200 });
      },
    ),
    { method: "GET", onError: defaultProcedureOnError },
  );

  const _get_3 = nextRoute(
    procedure
      .forRoute(staticRouteContract)
      .query(
        {
          "~standard": {
            version: 1,
            vendor: "rpc4next-test",
            validate: (value) => {
              const input =
                typeof value === "object" && value !== null
                  ? (value as { page?: string | string[] })
                  : {};
              const page = "page" in input ? input.page : "";
              const first = Array.isArray(page) ? page[0] : page;

              return first === "ok"
                ? { value: { page: first } }
                : { issues: [{ message: "page must equal ok" }] };
            },
            types: {
              input: {} as { page?: string | string[] },
              output: {} as { page: string },
            },
          },
        },
        {
          onValidationError: ({ target }) =>
            NextResponse.json(
              {
                ok: false as const,
                source: "validation" as const,
                target,
              },
              { status: 422 },
            ),
        },
      )
      .output({
        _output: {
          ok: true as const,
          page: "" as string,
        },
      })
      .handle(async ({ query, response }) =>
        response.json({
          ok: true as const,
          page: query.page,
        }),
      ),
    { method: "GET", onError: defaultProcedureOnError },
  );

  const _get_4 = nextRoute(
    procedure
      .forRoute(staticRouteContract)
      .output({
        _output: {
          ok: true as const,
          value: "" as string,
        },
      })
      .handle(async ({ response }) =>
        response.json({
          ok: true as const,
          value: "handled",
        }),
      ),
    {
      method: "GET",
      onError: (_, { response }) =>
        response.json(
          {
            ok: false as const,
            source: "onError" as const,
            reason: "custom",
          },
          { status: 418 },
        ),
    },
  );

  async function _get_2(_: NextRequest) {
    return NextResponse.json({ default: "true" });
  }

  type PathStructureForTypeTest = RpcEndpoint & {
    fuga: RpcEndpoint & {
      _foo: RpcEndpoint &
        Record<ParamsKey, { foo: string }> & {
          _piyo: RpcEndpoint &
            Record<QueryKey, { baz: string }> &
            Record<ParamsKey, { foo: string; piyo: string }>;
        };
    };
    api: {
      hoge: {
        $post: typeof _post_1;
      } & RpcEndpoint & {
          _foo: { $get: typeof _get_1 } & RpcEndpoint & Record<ParamsKey, { foo: string }>;
          _bar: { $get: typeof _get_2 } & RpcEndpoint & Record<ParamsKey, { bar: string }>;
          validation: { $get: typeof _get_3 } & RpcEndpoint;
          onError: { $get: typeof _get_4 } & RpcEndpoint;
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

      expectTypeOf(_response).toExtend<Response>();

      const incloudErrResponse = await client.api.hoge._foo("").$get();

      expectTypeOf(incloudErrResponse).toExtend<Response>();
      type JsonOrTextGetJson = Awaited<ReturnType<(typeof incloudErrResponse)["json"]>>;
      void (null as unknown as JsonOrTextGetJson);

      if (incloudErrResponse.ok) {
        const _response: Response = incloudErrResponse;
        const _json = incloudErrResponse.json;
        const _text = incloudErrResponse.text;
        void _response;
        void _json;
        void _text;
      } else {
        const _response: Response = incloudErrResponse;
        const _json = incloudErrResponse.json;
        const _text = incloudErrResponse.text;
        void _response;
        void _json;
        void _text;
      }

      const _defaultResponse = await client.api.hoge._bar("").$get();

      type ExpectedDefaultResponse = TypedNextResponse<
        { default: string },
        HttpStatusCode,
        ContentType
      >;
      const _defaultResponseFromActual: ExpectedDefaultResponse =
        _defaultResponse as ExpectedDefaultResponse;

      const validationResponse = await client.api.hoge.validation.$get({
        url: {
          query: {
            page: "bad",
          },
        },
      });

      expectTypeOf(validationResponse).toExtend<Response>();
      type ValidationJson = Awaited<ReturnType<(typeof validationResponse)["json"]>>;
      expectTypeOf<Extract<ValidationJson, { ok: true }>>().toEqualTypeOf<{
        ok: true;
        page: string;
      }>();
      expectTypeOf<Extract<ValidationJson, { source: "validation" }>>().toEqualTypeOf<{
        ok: false;
        source: "validation";
        target: "query";
      }>();
      expectTypeOf<Extract<ValidationJson, { error: { code: "BAD_REQUEST" } }>>().toEqualTypeOf<
        RpcErrorEnvelope<"BAD_REQUEST">
      >();

      const headerClient = createRpcClient<PathStructure>("", {
        fetch: customFetch,
      });
      const headerDelete = headerClient.api.hoge._foo("test")._bar("fetch").$delete;
      type HeaderEchoJson = Awaited<ReturnType<Awaited<ReturnType<typeof headerDelete>>["json"]>>;
      void (null as unknown as HeaderEchoJson);

      const onErrorResponse = await client.api.hoge.onError.$get();
      type OnErrorJson = Awaited<ReturnType<(typeof onErrorResponse)["json"]>>;
      expectTypeOf<OnErrorJson>().toEqualTypeOf<
        | {
            ok: true;
            value: string;
          }
        | {
            ok: false;
            source: "onError";
            reason: string;
          }
      >();

      void _defaultResponseFromActual;
    });
  });
});

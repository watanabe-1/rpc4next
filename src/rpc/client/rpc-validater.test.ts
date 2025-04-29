import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  describe,
  it,
  afterAll,
  afterEach,
  beforeAll,
  expect,
  expectTypeOf,
} from "vitest";
import { z } from "zod";
import { routeHandlerFactory } from "../server";
import { createRpcClient } from "./rpc-client";
import { ClientOptions, Endpoint } from "./types";
import { searchParamsToObject } from "../server/server-utils";
import { zValidator } from "../server/validators/zod/zod-validator";

const schema = z.object({
  name: z.string(),
  hoge: z.string(),
});

const optionalSchema = z.object({
  name: z.string().optional(),
  hoge: z.string().optional(),
});

const createRouteHandler = routeHandlerFactory();

const { GET: _get_1 } = createRouteHandler().get((rc) => rc.text("text"));

const { POST: _post_1 } = createRouteHandler().post(
  zValidator("json", schema),
  (rc) => rc.text("text")
);

const { POST: _post_2 } = createRouteHandler().post(
  zValidator("headers", schema),
  (rc) => rc.text("text")
);

const { POST: _post_3 } = createRouteHandler().post(
  zValidator("cookies", schema),
  (rc) => rc.text("text")
);

const { POST: _post_4 } = createRouteHandler<{
  query: z.input<typeof schema>;
}>().post(zValidator("query", schema), (rc) => rc.text("text"));

const { POST: _post_5 } = createRouteHandler<{
  query: z.input<typeof optionalSchema>;
}>().post(zValidator("query", optionalSchema), (rc) => rc.text("text"));

const { POST: _post_all } = createRouteHandler<{
  query: z.input<typeof schema>;
}>().post(
  zValidator("json", schema),
  zValidator("headers", schema),
  zValidator("cookies", schema),
  zValidator("query", schema),
  (rc) => rc.text("text")
);

const server = setupServer();

type PathStructure = Endpoint & {
  api: {
    none: {
      $get: typeof _get_1;
    } & Endpoint & {
        _json: { $post: typeof _post_1 } & Endpoint;
        headers: { $post: typeof _post_2 } & Endpoint;
        cookies: { $post: typeof _post_3 } & Endpoint;
        query: { $post: typeof _post_4 } & Endpoint;
        optionalQuery: { $post: typeof _post_5 } & Endpoint;
        all: { $post: typeof _post_all } & Endpoint;
      };
  };
};

describe("createRpcClient", () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe("createRpcClient basic behavior", () => {
    it("should send correct JSON body and receive expected response", async () => {
      server.use(
        http.post(
          "http://localhost:3000/api/none/json",
          async ({ request }) => {
            const contentType = request.headers.get("Content-Type");
            const body = await request.json();
            const result = schema.safeParse(body);

            if (!result.success) {
              return HttpResponse.json(
                { error: "Invalid JSON", issues: result.error.format() },
                { status: 400 }
              );
            }

            return HttpResponse.json({ json: result.data, contentType });
          }
        )
      );

      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const response = await client.api.none
        ._json("json")
        .$post({ body: { json: { hoge: "hogehoge", name: "foo" } } });

      const json = await response.json();
      expect(json).toStrictEqual({
        json: { hoge: "hogehoge", name: "foo" },
        contentType: "application/json",
      });
    });
  });

  it("should validate headers correctly", async () => {
    server.use(
      http.post(
        "http://localhost:3000/api/none/headers",
        async ({ request }) => {
          const headers = {
            hoge: request.headers.get("hoge"),
            name: request.headers.get("name"),
          };
          const result = schema.safeParse(headers);
          if (!result.success) {
            return HttpResponse.json(
              { error: "Invalid headers", issues: result.error.format() },
              { status: 400 }
            );
          }

          return HttpResponse.json({ headers: result.data });
        }
      )
    );

    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.none.headers.$post({
      requestHeaders: { headers: { hoge: "hogehoge", name: "foo" } },
    });
    const json = await response.json();
    expect(json).toStrictEqual({ headers: { hoge: "hogehoge", name: "foo" } });
  });

  it("should validate cookies correctly", async () => {
    server.use(
      http.post(
        "http://localhost:3000/api/none/cookies",
        async ({ request }) => {
          const cookieHeader = request.headers.get("Cookie") || "";
          const cookies: Record<string, string> = {};
          cookieHeader.split(";").forEach((cookie) => {
            const [key, value] = cookie.trim().split("=");
            if (key && value) {
              cookies[key] = value;
            }
          });
          const result = schema.safeParse(cookies);
          if (!result.success) {
            return HttpResponse.json(
              { error: "Invalid cookies", issues: result.error.format() },
              { status: 400 }
            );
          }

          return HttpResponse.json({ cookies: result.data });
        }
      )
    );

    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.none.cookies.$post({
      requestHeaders: { cookies: { hoge: "hogehoge", name: "foo" } },
    });
    const json = await response.json();
    expect(json).toStrictEqual({ cookies: { hoge: "hogehoge", name: "foo" } });
  });

  it("should validate query correctly", async () => {
    server.use(
      http.post("http://localhost:3000/api/none/query", async ({ request }) => {
        const url = new URL(request.url);
        const query = searchParamsToObject(url.searchParams);
        const result = schema.safeParse(query);
        if (!result.success) {
          return HttpResponse.json(
            { error: "Invalid query", issues: result.error.format() },
            { status: 400 }
          );
        }

        return HttpResponse.json({ query: result.data });
      })
    );

    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.none.query.$post({
      url: { query: { hoge: "hogehoge", name: "foo" } },
    });

    const json = await response.json();
    expect(json).toStrictEqual({ query: { hoge: "hogehoge", name: "foo" } });
  });

  it("should validate optionalQuery correctly", async () => {
    server.use(
      http.post(
        "http://localhost:3000/api/none/optionalQuery",
        async ({ request }) => {
          const url = new URL(request.url);
          const query = searchParamsToObject(url.searchParams);

          const result = optionalSchema.safeParse(query);
          if (!result.success) {
            return HttpResponse.json(
              { error: "Invalid query", issues: result.error.format() },
              { status: 400 }
            );
          }

          return HttpResponse.json({ query: result.data });
        }
      )
    );

    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.none.optionalQuery.$post();

    const json = await response.json();
    expect(json).toStrictEqual({ query: {} });
  });

  it("should validate query, json, headers and cookies together correctly", async () => {
    server.use(
      http.post("http://localhost:3000/api/none/all", async ({ request }) => {
        const contentType = request.headers.get("Content-Type");
        const body = await request.json().catch(() => ({}));
        const jsonData = body;
        const headersData = {
          hoge: request.headers.get("hoge"),
          name: request.headers.get("name"),
        };
        const cookieHeader = request.headers.get("Cookie") || "";
        const cookiesData: Record<string, string> = {};
        cookieHeader.split(";").forEach((cookie) => {
          const [key, value] = cookie.trim().split("=");
          if (key && value) {
            cookiesData[key] = value;
          }
        });
        const url = new URL(request.url);
        const query = searchParamsToObject(url.searchParams);

        const jsonResult = schema.safeParse(jsonData);
        const headersResult = schema.safeParse(headersData);
        const cookiesResult = schema.safeParse(cookiesData);
        const queryResult = schema.safeParse(query);
        if (
          !jsonResult.success ||
          !headersResult.success ||
          !cookiesResult.success ||
          !queryResult.success
        ) {
          return HttpResponse.json(
            {
              error: "Invalid data",
              issues: {
                json: jsonResult.success
                  ? undefined
                  : jsonResult.error.format(),
                headers: headersResult.success
                  ? undefined
                  : headersResult.error.format(),
                cookies: cookiesResult.success
                  ? undefined
                  : cookiesResult.error.format(),
                query: queryResult.success
                  ? undefined
                  : queryResult.error.format(),
              },
            },
            { status: 400 }
          );
        }

        return HttpResponse.json({
          json: jsonResult.data,
          headers: headersResult.data,
          cookies: cookiesResult.data,
          query: queryResult.data,
          contentType,
        });
      })
    );

    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.none.all.$post({
      url: { query: { hoge: "hogehoge", name: "foo" } },
      body: { json: { hoge: "hogehoge", name: "foo" } },
      requestHeaders: {
        headers: { hoge: "hogehoge", name: "foo" },
        cookies: { hoge: "hogehoge", name: "foo" },
      },
    });
    const json = await response.json();
    expect(json).toStrictEqual({
      json: { hoge: "hogehoge", name: "foo" },
      headers: { hoge: "hogehoge", name: "foo" },
      cookies: { hoge: "hogehoge", name: "foo" },
      query: { hoge: "hogehoge", name: "foo" },
      contentType: "application/json",
    });
  });
});

describe("createHandler type definitions", () => {
  it("should infer types correctly", async () => {
    const customFetch = async (_: RequestInfo | URL, __?: RequestInit) => {
      return new Response();
    };
    const client = createRpcClient<PathStructure>("", {
      fetch: customFetch,
    });

    type ExpectedNonJsonParameters = [
      methodParam?: {
        url?: {
          hash?: string;
        };
      },
      option?: ClientOptions<never, never>,
    ];

    expectTypeOf<
      Parameters<typeof client.api.none.$get>
    >().toEqualTypeOf<ExpectedNonJsonParameters>();

    type ExpectedJsonParameters = [
      methodParam: {
        url?: {
          hash?: string;
        };
      } & {
        body: {
          json: {
            name: string;
            hoge: string;
          };
        };
      },
      option?: ClientOptions<"Content-Type", "body">,
    ];

    const _post1 = client.api.none._json("").$post;

    expectTypeOf<
      Parameters<typeof _post1>
    >().toEqualTypeOf<ExpectedJsonParameters>();

    type ExpectedHeadersParameters = [
      methodParam: {
        url?: {
          hash?: string;
        };
      } & {
        requestHeaders: {
          headers: {
            hoge: string;
            name: string;
          };
        };
      },
      option?: ClientOptions<never, "headers">,
    ];

    expectTypeOf<
      Parameters<typeof client.api.none.headers.$post>
    >().toEqualTypeOf<ExpectedHeadersParameters>();

    type ExpectedCookiesParameters = [
      methodParam: {
        url?: {
          hash?: string;
        };
      } & {
        requestHeaders: {
          cookies: {
            hoge: string;
            name: string;
          };
        };
      },
      option?: ClientOptions<"Cookie", never>,
    ];

    expectTypeOf<
      Parameters<typeof client.api.none.cookies.$post>
    >().toEqualTypeOf<ExpectedCookiesParameters>();

    type ExpectedQueryParameters = [
      methodParam: {
        url: {
          query: {
            name: string;
            hoge: string;
          };
          hash?: string;
        };
      },
      option?: ClientOptions<never, never>,
    ];

    expectTypeOf<
      Parameters<typeof client.api.none.query.$post>
    >().toEqualTypeOf<ExpectedQueryParameters>();

    type ExpectedQueryUrlParameters = [
      url: {
        query: {
          name: string;
          hoge: string;
        };
        hash?: string;
      },
    ];

    expectTypeOf<
      Parameters<typeof client.api.none.query.$url>
    >().toEqualTypeOf<ExpectedQueryUrlParameters>();

    type ExpectedOptionalQueryParameters = [
      methodParam?: {
        url?: {
          query?: {
            name?: string;
            hoge?: string;
          };
          hash?: string;
        };
      },
      option?: ClientOptions<never, never>,
    ];

    expectTypeOf<
      Parameters<typeof client.api.none.optionalQuery.$post>
    >().toEqualTypeOf<ExpectedOptionalQueryParameters>();

    type ExpectedOptionalQueryUrlParameters = [
      url?: {
        query?: {
          name?: string | undefined;
          hoge?: string | undefined;
        };
        hash?: string;
      },
    ];

    expectTypeOf<
      Parameters<typeof client.api.none.optionalQuery.$url>
    >().toEqualTypeOf<ExpectedOptionalQueryUrlParameters>();

    type ExpectedAllParameters = [
      methodParam: {
        url: {
          query: {
            name: string;
            hoge: string;
          };
          hash?: string;
        };
      } & {
        body: {
          json: {
            name: string;
            hoge: string;
          };
        };
      } & {
        requestHeaders: {
          headers: {
            hoge: string;
            name: string;
          };
          cookies: {
            hoge: string;
            name: string;
          };
        };
      },
      option?: ClientOptions<"Cookie" | "Content-Type", "headers" | "body">,
    ];

    expectTypeOf<
      Parameters<typeof client.api.none.all.$post>
    >().toEqualTypeOf<ExpectedAllParameters>();
  });
});

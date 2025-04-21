import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  describe,
  it,
  expectTypeOf,
  afterAll,
  afterEach,
  beforeAll,
  expect,
} from "vitest";
import { z } from "zod";
import { routeHandlerFactory } from "../server";
import { createRpcClient } from "./rpc-client";
import { ClientOptions, Endpoint } from "./types";
import { zodValidator } from "../server/validators/zod";

const schema = z.object({
  name: z.string(),
  hoge: z.string(),
});

const createRouteHandler = routeHandlerFactory();

const { GET: _get_1 } = createRouteHandler().get((rc) => rc.text("text"));

const { POST: _post_1 } = createRouteHandler().post(
  zodValidator("json", schema),
  (rc) => rc.text("text")
);

const { POST: _post_2 } = createRouteHandler().post(
  zodValidator("headers", schema),
  (rc) => rc.text("text")
);

const { POST: _post_3 } = createRouteHandler().post(
  zodValidator("cookies", schema),
  (rc) => rc.text("text")
);

const { POST: _post_4 } = createRouteHandler().post(
  zodValidator("json", schema),
  zodValidator("headers", schema),
  zodValidator("cookies", schema),
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
        all: { $post: typeof _post_4 } & Endpoint;
      };
  };
};

describe("createRpcClient", () => {
  describe("createRpcClient basic behavior", () => {
    // MSW lifecycle setup
    beforeAll(() => server.listen());
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

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
});

describe("Headers and Cookies validation", () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

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

  it("should validate json, headers and cookies together correctly", async () => {
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

        const jsonResult = schema.safeParse(jsonData);
        const headersResult = schema.safeParse(headersData);
        const cookiesResult = schema.safeParse(cookiesData);
        if (
          !jsonResult.success ||
          !headersResult.success ||
          !cookiesResult.success
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
              },
            },
            { status: 400 }
          );
        }

        return HttpResponse.json({
          json: jsonResult.data,
          headers: headersResult.data,
          cookies: cookiesResult.data,
          contentType,
        });
      })
    );

    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.none.all.$post({
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
          query?: Record<string, string | number>;
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
          query?: Record<string, string | number>;
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
          query?: Record<string, string | number>;
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
          query?: Record<string, string | number>;
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

    type ExpectedAllParameters = [
      methodParam: {
        url?: {
          query?: Record<string, string | number>;
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

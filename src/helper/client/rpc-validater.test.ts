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
import { ContentType, routeHandlerFactory } from "../server";
import { createRpcClient } from "./rpc";
import { BodyOptions, ClientOptions, Endpoint } from "./types";
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

const server = setupServer(
  http.post("http://localhost:3000/api/hoge/test", async ({ request }) => {
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
  })
);

type PathStructure = Endpoint & {
  api: {
    hoge: {
      $get: typeof _get_1;
    } & Endpoint & {
        _foo: { $post: typeof _post_1 } & Endpoint;
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
      const client = createRpcClient<PathStructure>("http://localhost:3000");
      const response = await client.api.hoge
        ._foo("test")
        .$post({ body: { json: { hoge: "hogehoge", name: "foo" } } });

      const json = await response.json();
      expect(json).toStrictEqual({
        json: { hoge: "hogehoge", name: "foo" },
        contentType: "application/json",
      });
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
      option?: ClientOptions<ContentType, never>,
    ];

    expectTypeOf<
      Parameters<typeof client.api.hoge.$get>
    >().toEqualTypeOf<ExpectedNonJsonParameters>();

    type ExpectedJsonParameters = [
      methodParam: {
        url?: {
          query?: Record<string, string | number>;
          hash?: string;
        };
      } & {
        body: BodyOptions<{
          name: string;
          hoge: string;
        }>;
      },
      option?: ClientOptions<"application/json", "body">,
    ];

    const _post1 = client.api.hoge._foo("").$post;

    expectTypeOf<
      Parameters<typeof _post1>
    >().toEqualTypeOf<ExpectedJsonParameters>();
  });
});

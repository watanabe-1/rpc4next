import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, test, expect } from "vitest";
import { z } from "zod";
import { createRpcClient } from "./rpc";
import { routeHandlerFactory } from "../server";
import { ParamsKey, Endpoint } from "./types";
const createRouteHandler = routeHandlerFactory();

const _schema = z.object({
  name: z.string(),
  hoge: z.string(),
});

const _schema2 = z.object({
  name: z.string(),
  age: z
    .string()
    .transform((val) => Number(val))
    .refine((val) => !Number.isNaN(val)),
});

const { POST: _post_0 } = createRouteHandler<{
  params: z.infer<typeof _schema>;
  query: { name: string; age: string };
}>().post(async (rc) => rc.text("post"));

const { GET: _get_0 } = createRouteHandler<{
  params: z.infer<typeof _schema>;
  query: { name: string; age: string };
}>().get(async (rc) => rc.json({ method: "get" }));

export type PathStructure = Endpoint & {
  admin: Endpoint & {
    _qualification: Endpoint &
      Record<ParamsKey, { qualification: string }> & {
        _grade: Endpoint;
      };
  };
  api: {
    questions: { $post: typeof _post_0 } & Endpoint & {
        _qualification: { $get: typeof _get_0 } & Endpoint;
      };
  };
};

// MSW のハンドラー設定
const server = setupServer(
  // GET /api/questions/test に対して、{ method: "get" } を JSON で返す
  http.get("http://localhost:3000/api/questions/test", () => {
    return HttpResponse.json({ method: "get" });
  }),
  // POST /api/questions に対して、"post" というテキストを返す
  http.post("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("post");
  })
);

// MSW のライフサイクル設定
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("createRpcClient", () => {
  test("URL生成: client.admin._qualification('test').$url()", () => {
    const client = createRpcClient<PathStructure>("");
    const urlResult = client.admin._qualification("test").$url();
    expect(urlResult.path).toBe("/admin/test");
    expect(urlResult.pathname).toBe("/admin/[qualification]");
    expect(urlResult.params).toEqual({ _qualification: "test" });
  });

  test("GETリクエスト: client.api.questions._qualification('test').$get()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions._qualification("test").$get();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ method: "get" });
  });

  test("POSTリクエスト: client.api.questions.$post()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$post();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("post");
  });

  test("URL生成: query/hash パラメータの付与", () => {
    const client = createRpcClient<PathStructure>("");
    const urlResult = client.admin._qualification("test").$url({
      query: { foo: "bar" },
      hash: "section",
    });
    expect(urlResult.path).toBe("/admin/test?foo=bar#section");
  });
});

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, test, expect } from "vitest";
import { createRpcClient } from "./rpc";
import { routeHandlerFactory } from "../server";
import { ParamsKey, Endpoint } from "./types";

const createRouteHandler = routeHandlerFactory();

// POSTエンドポイント
const { POST: _post_0 } = createRouteHandler().post(async (rc) =>
  rc.text("post")
);

// GETエンドポイント
const { GET: _get_0 } = createRouteHandler().get(async (rc) =>
  rc.json({ method: "get" })
);

// DELETEエンドポイント
const { DELETE: _delete_0 } = createRouteHandler().delete(async (rc) =>
  rc.text("delete")
);

// HEADエンドポイント
const { HEAD: _head_0 } = createRouteHandler().head(async (rc) =>
  rc.text("head")
);

// PATCHエンドポイント
const { PATCH: _patch_0 } = createRouteHandler().patch(async (rc) =>
  rc.text("patch")
);

// PUTエンドポイント
const { PUT: _put_0 } = createRouteHandler().put(async (rc) => rc.text("put"));

// 型定義に新規メソッドを追加
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
        _qualification: { $get: typeof _get_0 } & Endpoint;
      };
  };
};

// MSW のハンドラー設定
const server = setupServer(
  // GET /api/questions/test → JSON { method: "get" } を返す
  http.get("http://localhost:3000/api/questions/test", () => {
    return HttpResponse.json({ method: "get" });
  }),
  // POST /api/questions → "post" を返す
  http.post("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("post");
  }),
  // DELETE /api/questions → "delete" を返す
  http.delete("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("delete");
  }),
  // HEAD /api/questions → "head" を返す
  http.head("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("head");
  }),
  // PATCH /api/questions → "patch" を返す
  http.patch("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("patch");
  }),
  // PUT /api/questions → "put" を返す
  http.put("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("put");
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

  test("DELETEリクエスト: client.api.questions.$delete()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$delete();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("delete");
  });

  test("HEADリクエスト: client.api.questions.$head()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$head();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("head");
  });

  test("PATCHリクエスト: client.api.questions.$patch()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$patch();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("patch");
  });

  test("PUTリクエスト: client.api.questions.$put()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$put();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("put");
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

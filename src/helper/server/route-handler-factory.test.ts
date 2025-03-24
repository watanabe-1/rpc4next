import { NextRequest } from "next/server";
import { describe, it, expect, vi } from "vitest";
import { routeHandlerFactory } from "./route-handler-factory";
import { TypedNextResponse } from "../../../dist";
import { Expect, Equal } from "../../__tests__/types";

describe("routeHandlerFactory", () => {
  it("should return the response from the first handler that returns a Response", async () => {
    const createRouteHandler = routeHandlerFactory()();
    const handler = createRouteHandler.post(
      async (_) => {
        // このハンドラは何も返さない（undefined）
      },
      async (rc) => {
        // 2つ目のハンドラで rc.text() を使ってレスポンスを返す
        return rc.text("first valid response");
      },
      async (rc) => {
        // 3つ目のハンドラ（実行されないはず）
        return rc.text("should not be reached");
      }
    );

    const req = new NextRequest("http://localhost");
    const res = await handler.POST(req, { params: Promise.resolve({}) });
    expect(await res.text()).toBe("first valid response");
  });

  it("should throw error if no handler returns a Response and no global error handler is provided", async () => {
    const createRouteHandler = routeHandlerFactory()();
    const handler = createRouteHandler.get(
      async (_) => {
        // どのハンドラも Response を返さないため、エラーとなるはず
      },
      async (_) => {
        // こちらも Response を返さない

        return undefined as unknown as TypedNextResponse;
      }
    );

    const req = new NextRequest("http://localhost");
    await expect(
      handler.GET(req, { params: Promise.resolve({}) })
    ).rejects.toThrow("No handler returned a response");
  });

  it("should use the global error handler when provided", async () => {
    const globalErrorHandler = vi.fn(async (error, rc) => {
      // グローバルエラーハンドラでは rc.text を使ってレスポンスを返す
      return rc.text("global error handled", { status: 500 });
    });
    const createRouteHandler = routeHandlerFactory(globalErrorHandler)();
    const handler = createRouteHandler.put(async (_) => {
      throw new Error("handler error");
    });

    const req = new NextRequest("http://localhost");
    const res = await handler.PUT(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("global error handled");
    expect(globalErrorHandler).toHaveBeenCalled();
  });

  it("should stop executing subsequent handlers once a Response is returned", async () => {
    const spyHandler = vi.fn(async (rc) => {
      return rc.text("response from spy");
    });
    const secondHandler = vi.fn(async (rc) => {
      return rc.text("response from second");
    });
    const createRouteHandler = routeHandlerFactory()();
    const handler = createRouteHandler.patch(
      async (_) => {
        // 何も返さないハンドラ
      },
      spyHandler,
      secondHandler // このハンドラは実行されないはず
    );

    const req = new NextRequest("http://localhost");
    const res = await handler.PATCH(req, { params: Promise.resolve({}) });
    expect(await res.text()).toBe("response from spy");
    expect(spyHandler).toHaveBeenCalled();
    expect(secondHandler).not.toHaveBeenCalled();
  });

  it("should support multiple HTTP methods", async () => {
    const createRouteHandler = routeHandlerFactory()();

    const handlers = {
      get: createRouteHandler.get(async (rc) => rc.text("GET response")),
      post: createRouteHandler.post(async (rc) => rc.text("POST response")),
      put: createRouteHandler.put(async (rc) => rc.text("PUT response")),
      delete: createRouteHandler.delete(async (rc) =>
        rc.text("DELETE response")
      ),
      patch: createRouteHandler.patch(async (rc) => rc.text("PATCH response")),
      head: createRouteHandler.head(async (rc) => {
        // HEADレスポンスにはボディがないことが一般的
        return rc.body(null, { status: 200 });
      }),
      options: createRouteHandler.options(async (rc) => {
        return rc.body(null, {
          status: 204,
          headers: { Allow: "GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS" },
        });
      }),
    };

    const req = new NextRequest("http://localhost");

    const getRes = await handlers.get.GET(req, {
      params: Promise.resolve({}),
    });
    const postRes = await handlers.post.POST(req, {
      params: Promise.resolve({}),
    });
    const putRes = await handlers.put.PUT(req, {
      params: Promise.resolve({}),
    });
    const deleteRes = await handlers.delete.DELETE(req, {
      params: Promise.resolve({}),
    });
    const patchRes = await handlers.patch.PATCH(req, {
      params: Promise.resolve({}),
    });
    const headRes = await handlers.head.HEAD(req, {
      params: Promise.resolve({}),
    });
    const optionsRes = await handlers.options.OPTIONS(req, {
      params: Promise.resolve({}),
    });

    expect(await getRes.text()).toBe("GET response");
    expect(await postRes.text()).toBe("POST response");
    expect(await putRes.text()).toBe("PUT response");
    expect(await deleteRes.text()).toBe("DELETE response");
    expect(await patchRes.text()).toBe("PATCH response");
    expect(headRes.status).toBe(200);
    expect(await headRes.text()).toBe(""); // HEADのレスポンスは空
    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get("Allow")).toBe(
      "GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS"
    );
  });
});

describe("routeHandlerFactory type definitions", () => {
  // eslint-disable-next-line vitest/expect-expect
  it("should infer types correctly for a normal handler", async () => {
    const createRouteHandler = routeHandlerFactory();
    const handler = createRouteHandler<{
      params: { name: string; age: string };
      query: { id: string };
    }>().post(async (rc) => {
      // rc.req.params と rc.req.query の型がそれぞれ正しく推論されるかテスト
      const _validParams = await rc.req.params();
      const _validQuery = rc.req.query();

      type ExpectedParams = { name: string; age: string };
      type ExpectedQuery = { id: string };

      type _Result1 = Expect<Equal<ExpectedParams, typeof _validParams>>;
      type _Result2 = Expect<Equal<ExpectedQuery, typeof _validQuery>>;

      // rc.body 経由でテキストを返す場合の型もチェック
      return rc.text("ok");
    });

    const req = new NextRequest(new URL("http://localhost/?id=123"));
    const _res = await handler.POST(req, {
      params: Promise.resolve({ name: "Alice", age: "30" }),
    });

    type ExpectedResponse = TypedNextResponse<"ok", 200, "text/plain">;
    type _Result3 = Expect<Equal<ExpectedResponse, typeof _res>>;
  });

  // eslint-disable-next-line vitest/expect-expect
  it("should infer types correctly with a global error handler", async () => {
    type CustomError = { message: string };
    const createRouteHandler = routeHandlerFactory((error: unknown, rc) => {
      if (error instanceof Error) {
        return rc.json({ message: error.message } as CustomError, {
          status: 500,
        });
      }

      return rc.text("onError", { status: 400 });
    });
    const handler = createRouteHandler<{
      params: { id: string };
      query: { flag: string };
    }>().get(async (_) => {
      // 強制的にエラーをスローしてグローバルエラーハンドラが動作するようにする
      throw new Error("failed");
    });

    const req = new NextRequest(new URL("http://localhost/?flag=true"));
    const _res = await handler.GET(req, {
      params: Promise.resolve({ id: "123" }),
    });

    type ExpectedErrorResponse =
      | TypedNextResponse<CustomError, 500, "application/json">
      | TypedNextResponse<"onError", 400, "text/plain">;

    type _Result4 = Expect<Equal<ExpectedErrorResponse, typeof _res>>;
  });
});

import { NextRequest } from "next/server";
import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { routeHandlerFactory } from "./route-handler-factory";
import { TypedNextResponse } from "./types";

describe("routeHandlerFactory", () => {
  it("should return the response from the first handler that returns a Response", async () => {
    const createRouteHandler = routeHandlerFactory()();
    const handler = createRouteHandler.post(
      async (_) => {
        // This handler does not return anything (undefined)
      },
      async (rc) => {
        // The second handler returns a response using rc.text()
        return rc.text("first valid response");
      },
      async (rc) => {
        // The third handler (should not be executed)
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
        // None of the handlers return a Response, so an error should be thrown
      },
      async (_) => {
        // Also does not return a Response
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
      // In the global error handler, return a response using rc.text
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
        // Handler that returns nothing
      },
      spyHandler,
      secondHandler // This handler should not be executed
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
        // HEAD responses typically have no body
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
    expect(await headRes.text()).toBe(""); // HEAD responses are expected to have empty bodies
    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get("Allow")).toBe(
      "GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS"
    );
  });

  it("should correctly receive query and params", async () => {
    const createRouteHandler = routeHandlerFactory()<{
      params: { user: string };
      query: { id: string };
    }>();
    const handler = createRouteHandler.get(async (rc) => {
      const params = await rc.req.params();
      const query = rc.req.query();
      expect(params).toEqual({ user: "john" });
      expect(query).toEqual({ id: "123" });

      return rc.text("Query and Params OK");
    });

    const req = new NextRequest(new URL("http://localhost/?id=123"));
    const res = await handler.GET(req, {
      params: Promise.resolve({ user: "john" }),
    });
    expect(await res.text()).toBe("Query and Params OK");
  });

  it("should support non-async (synchronous) handlers", async () => {
    const createRouteHandler = routeHandlerFactory()();
    const handler = createRouteHandler.get((rc) => {
      return rc.text("sync response");
    });
    const req = new NextRequest("http://localhost");
    const res = await handler.GET(req, { params: Promise.resolve({}) });
    expect(await res.text()).toBe("sync response");
  });

  it("should support non-async (synchronous) params", async () => {
    const createRouteHandler = routeHandlerFactory()<{
      params: { user: string };
    }>();
    const handler = createRouteHandler.get(async (rc) => {
      const params = await rc.req.params();
      expect(params).toEqual({ user: "john" });

      return rc.text("Non-async (synchronous) params OK");
    });

    const req = new NextRequest(new URL("http://localhost/?id=123"));
    const res = await handler.GET(req, {
      params: { user: "john" } as unknown as Promise<{ user: string }>,
    });
    expect(await res.text()).toBe("Non-async (synchronous) params OK");
  });
});

describe("routeHandlerFactory type definitions", () => {
  it("should infer types correctly for a normal handler", async () => {
    const createRouteHandler = routeHandlerFactory();
    const handler = createRouteHandler<{
      params: { name: string; age: string };
      query: { id: string };
    }>().post(async (rc) => {
      // Test whether rc.req.params and rc.req.query are inferred correctly
      const _validParams = await rc.req.params();
      const _validQuery = rc.req.query();

      type ExpectedParams = { name: string; age: string };
      type ExpectedQuery = { id: string };

      expectTypeOf<typeof _validParams>().toEqualTypeOf<ExpectedParams>();
      expectTypeOf<typeof _validQuery>().toEqualTypeOf<ExpectedQuery>();

      // Also check the return type when using rc.text to return a response
      return rc.text("ok");
    });

    const req = new NextRequest(new URL("http://localhost/?id=123"));
    const _res = await handler.POST(req, {
      params: Promise.resolve({ name: "Alice", age: "30" }),
    });

    type ExpectedResponse = TypedNextResponse<"ok", 200, "text/plain">;
    expectTypeOf<typeof _res>().toEqualTypeOf<ExpectedResponse>();
  });

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
    const handler = createRouteHandler().get(async (_) => {
      throw new Error("failed");
    });

    const req = new NextRequest(new URL("http://localhost/"));
    const _res = await handler.GET(req, {
      params: Promise.resolve({}),
    });

    type ExpectedErrorResponse =
      | TypedNextResponse<CustomError, 500, "application/json">
      | TypedNextResponse<"onError", 400, "text/plain">;

    expectTypeOf<typeof _res>().toEqualTypeOf<ExpectedErrorResponse>();
  });

  it("should infer types correctly for mixed async and sync normal handlers with onError", async () => {
    type CustomError = { error: string };
    const createRouteHandler = routeHandlerFactory((error: unknown, rc) => {
      if (error instanceof Error) {
        return rc.json({ error: error.message } as CustomError, {
          status: 500,
        });
      }

      return rc.text("sync error", { status: 400 });
    });
    const _handler = createRouteHandler<{
      params: { id: string };
      query: { token: string };
    }>().post(
      async (rc) => {
        // Async normal handler: returns a response via rc.text
        return rc.text("async ok");
      },
      (rc) => {
        // Synchronous normal handler: returns a response via rc.text
        return rc.text("sync ok");
      }
    );

    type ExpectedResponse =
      | TypedNextResponse<"async ok", 200, "text/plain">
      | TypedNextResponse<"sync ok", 200, "text/plain">
      | TypedNextResponse<CustomError, 500, "application/json">
      | TypedNextResponse<"sync error", 400, "text/plain">;

    expectTypeOf<
      Awaited<ReturnType<typeof _handler.POST>>
    >().toEqualTypeOf<ExpectedResponse>();
  });
});

import { NextRequest } from "next/server";
import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { z } from "zod";
import { zValidator } from "./zod-validator";
import { routeHandlerFactory } from "../../route-handler-factory";
import { RouteHandler } from "../../route-types";
import { Params, TypedNextResponse } from "../../types";
import * as validatorUtils from "../validator-utils";

const createRouteHandler = routeHandlerFactory();

const schema = z.object({
  name: z.string(),
  hoge: z.string(),
});

const schema2 = z.object({
  name: z.string(),
  age: z
    .string()
    .transform((val) => Number(val))
    .refine((val) => !Number.isNaN(val)),
});

describe("zValidator tests", () => {
  it("Should return 200 when params and query are valid (with custom hook)", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
      query: { name: string; age: string };
    }>().post(
      zValidator("params", schema, (result, rc) => {
        if (!result.success) return rc.json(result, { status: 401 });
      }),
      zValidator("query", schema2),
      async (rc) => rc.text("ok")
    );
    const req = new NextRequest(new URL("http://localhost/?name=J&age=20"));
    const res = await handler.POST(req, {
      params: Promise.resolve({ name: "J", hoge: "30" }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("Should return 401 when params are invalid (handled by custom hook)", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
      query: { name: string; age: string };
    }>().post(
      zValidator("params", schema, (result, rc) => {
        if (!result.success) return rc.json(result, { status: 401 });
      }),
      zValidator("query", schema2),
      async (rc) => rc.text("ok")
    );
    const req = new NextRequest(new URL("http://localhost/?name=J&age=20"));
    const res = await handler.POST(req, {
      params: Promise.resolve({ name: "J", hoge: 30 as unknown as string }),
    });
    expect(res.status).toBe(401);
  });

  it("Should return 400 when query is invalid (default hook used)", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
      query: z.input<typeof schema2>;
    }>().post(
      zValidator("params", schema),
      zValidator("query", schema2),
      async (rc) => rc.text("ok")
    );

    const req = new NextRequest(new URL("http://localhost/?name=J&age=abc")); // invalid because age can't be converted
    const res = await handler.POST(req, {
      params: Promise.resolve({ name: "J", hoge: "30" }),
    });

    expect(res.status).toBe(400);
  });

  it("Should return text when only params are validated and valid", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
    }>().post(zValidator("params", schema), async (rc) =>
      rc.text("only params")
    );
    const req = new NextRequest(new URL("http://localhost/?ignored=true"));
    const res = await handler.POST(req, {
      params: Promise.resolve({ name: "A", hoge: "18" }),
    });
    expect(await res.text()).toBe("only params");
  });

  it("Should return 400 when params are invalid even if query is valid", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
      query: { name: string; age: string };
    }>().post(
      zValidator("params", schema),
      zValidator("query", schema2),
      async (rc) => rc.text("test")
    );
    const req = new NextRequest(new URL("http://localhost/?name=J&age=30"));
    const res = await handler.POST(req, {
      params: Promise.resolve({
        name: 1 as unknown as string,
        hoge: true as unknown as string,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("Should return 200 when params are valid and no custom hook is used", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
    }>().post(zValidator("params", schema), async (rc) => rc.text("clean"));
    const req = new NextRequest(new URL("http://localhost"));
    const res = await handler.POST(req, {
      params: Promise.resolve({ name: "B", hoge: "22" }),
    });
    expect(await res.text()).toBe("clean");
  });

  it("Should return 400 when params are invalid and no custom hook is used", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
    }>().post(zValidator("params", schema), async (rc) =>
      rc.text("never reach")
    );
    const req = new NextRequest(new URL("http://localhost"));
    const res = await handler.POST(req, {
      params: Promise.resolve({
        name: 100 as unknown as string,
        hoge: true as unknown as string,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("Should throw error if custom hook does not return a response on validation failure", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
    }>().post(
      zValidator("params", schema, (_, __) => {
        // Does not return a response on failure
      }),
      async (rc) => rc.text("never reach")
    );
    const req = new NextRequest(new URL("http://localhost"));
    await expect(() =>
      handler.POST(req, {
        params: Promise.resolve({
          name: 100 as unknown as string,
          hoge: "valid",
        }),
      })
    ).rejects.toThrow(
      "If you provide a custom hook, you must explicitly return a response when validation fails."
    );
  });

  it("Should return validated values via rc.req.valid for both params and query", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
      query: z.input<typeof schema2>;
    }>().post(
      zValidator("params", schema),
      zValidator("query", schema2),
      async (rc) => {
        return rc.json({
          params: rc.req.valid("params"),
          query: rc.req.valid("query"),
        });
      }
    );
    const req = new NextRequest(new URL("http://localhost/?name=J&age=20"));
    const res = await handler.POST(req, {
      params: Promise.resolve({ name: "J", hoge: "30" }),
    });
    const json = res.ok ? await res.json() : { params: "", query: "" };
    expect(json.params).toEqual({ name: "J", hoge: "30" });
    expect(json.query).toEqual({ name: "J", age: 20 });
  });

  it("Should call custom hook during validation", async () => {
    const hook = vi.fn((result, rc) => {
      if (!result.success) return rc.json(result, { status: 401 });
    });

    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
      query: z.input<typeof schema2>;
    }>().post(
      zValidator("params", schema, hook),
      zValidator("query", schema2, hook),
      async (rc) => rc.text("ok")
    );

    const req = new NextRequest(new URL("http://localhost/?name=J&age=20"));
    await handler.POST(req, {
      params: Promise.resolve({ name: "J", hoge: "30" }),
    });

    expect(hook).toHaveBeenCalledTimes(2);

    const firstCallArgs = hook.mock.calls[0];
    expect(firstCallArgs[0]).toHaveProperty("success", true);
    expect(typeof firstCallArgs[1].json).toBe("function");

    const secondCallArgs = hook.mock.calls[1];
    expect(secondCallArgs[0]).toHaveProperty("success", true);
    expect(typeof secondCallArgs[1].json).toBe("function");
  });

  it("Should return 200 when json body is valid", async () => {
    const handler = createRouteHandler().post(
      zValidator("json", schema),
      async (rc) => {
        return rc.text("valid json");
      }
    );

    const req = new NextRequest(new URL("http://localhost"), {
      method: "POST",
      body: JSON.stringify({ name: "Taro", hoge: "fuga" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await handler.POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("valid json");
  });

  it("Should return 400 when json body is invalid", async () => {
    const handler = createRouteHandler().post(
      zValidator("json", schema),
      async (rc) => {
        return rc.text("never reach");
      }
    );

    const req = new NextRequest(new URL("http://localhost"), {
      method: "POST",
      body: JSON.stringify({ name: 123, hoge: true }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await handler.POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  describe("Headers validation", () => {
    it("Should return validated headers when headers are valid", async () => {
      const headerSchema = z.object({ "x-test": z.string() });
      vi.spyOn(validatorUtils, "getHeadersObject").mockResolvedValueOnce({
        "x-test": "123",
      });

      const handler = createRouteHandler().post(
        zValidator("headers", headerSchema),
        async (rc) => {
          return rc.json({ header: rc.req.valid("headers") });
        }
      );

      const req = new NextRequest(new URL("http://localhost"));
      const res = await handler.POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await (
        res as TypedNextResponse<
          {
            header: {
              "x-test": string;
            };
          },
          200,
          "application/json"
        >
      ).json();
      expect(json.header).toEqual({ "x-test": "123" });
    });

    it("Should return 400 when headers are invalid", async () => {
      const headerSchema = z.object({ "x-test": z.number() });
      vi.spyOn(validatorUtils, "getHeadersObject").mockResolvedValueOnce({
        "x-test": "not a number",
      });

      const handler = createRouteHandler().post(
        zValidator("headers", headerSchema),
        async (rc) => rc.text("never reach")
      );

      const req = new NextRequest(new URL("http://localhost"));
      const res = await handler.POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });
  });

  describe("Cookies validation", () => {
    it("Should return validated cookies when cookies are valid", async () => {
      const cookieSchema = z.object({ token: z.string() });
      vi.spyOn(validatorUtils, "getCookiesObject").mockResolvedValueOnce({
        token: "abc",
      });

      const handler = createRouteHandler().post(
        zValidator("cookies", cookieSchema),
        async (rc) => {
          return rc.json({ cookie: rc.req.valid("cookies") });
        }
      );

      const req = new NextRequest(new URL("http://localhost"));
      const res = await handler.POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await (
        res as TypedNextResponse<
          {
            cookie: {
              token: string;
            };
          },
          200,
          "application/json"
        >
      ).json();
      expect(json.cookie).toEqual({ token: "abc" });
    });

    it("Should return 400 when cookies are invalid", async () => {
      const cookieSchema = z.object({ token: z.number() });
      vi.spyOn(validatorUtils, "getCookiesObject").mockResolvedValueOnce({
        token: "def",
      });

      const handler = createRouteHandler().post(
        zValidator("cookies", cookieSchema),
        async (rc) => rc.text("never reach")
      );

      const req = new NextRequest(new URL("http://localhost"));
      const res = await handler.POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });
  });

  it("should throw an error if unexpected target is provided", async () => {
    const handler = createRouteHandler().post(
      // @ts-expect-error - force an invalid target for testing
      zValidator("invalidTarget", schema),
      async (rc) => {
        return rc.text("never reach");
      }
    );

    const req = new NextRequest(new URL("http://localhost"));
    await expect(() =>
      handler.POST(req, { params: Promise.resolve({}) })
    ).rejects.toThrowError(new Error("Unexpected target: invalidTarget"));
  });
});

describe("zValidator type definitions", () => {
  it("should infer params and query types correctly", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
      query: { name: string; age: string };
    }>().post(
      zValidator("params", schema, (result, rc) => {
        if (!result.success) return rc.json(result, { status: 401 });
      }),
      zValidator("query", schema2),
      async (rc) => {
        const _validParams = rc.req.valid("params");
        const _validQuery = rc.req.valid("query");

        type ExpectedOutput = z.output<typeof schema>;
        type ExpectedQuery = z.output<typeof schema2>;

        expectTypeOf<typeof _validParams>().toEqualTypeOf<ExpectedOutput>();
        expectTypeOf<typeof _validQuery>().toEqualTypeOf<ExpectedQuery>();

        if (_validQuery) {
          return rc.text("ok1");
        }

        return rc.text("ok2");
      }
    );
    const req = new NextRequest(new URL("http://localhost/?name=J&age=20"));
    const _res = await handler.POST(req, {
      params: Promise.resolve({ name: "J", hoge: "30" }),
    });

    type ExpectedHookDefaultResponse = TypedNextResponse<
      z.ZodSafeParseError<{
        name: string;
        age: string;
      }>,
      400,
      "application/json"
    >;

    type ExpectedHookResponse = TypedNextResponse<
      z.ZodSafeParseError<{
        name: string;
        hoge: string;
      }>,
      401,
      "application/json"
    >;

    type ExpectedLastResponse =
      | TypedNextResponse<"ok1", 200, "text/plain">
      | TypedNextResponse<"ok2", 200, "text/plain">;

    type ExpectedResponse =
      | ExpectedHookDefaultResponse
      | ExpectedHookResponse
      | ExpectedLastResponse;

    expectTypeOf<typeof _res>().toEqualTypeOf<ExpectedResponse>();
  });

  it("should infer json types correctly", async () => {
    const handler = createRouteHandler().post(
      zValidator("json", schema2),
      async (rc) => {
        const _validJson = rc.req.valid("json");
        type ExpectedJson = z.output<typeof schema2>;

        expectTypeOf<typeof _validJson>().toEqualTypeOf<ExpectedJson>();

        return rc.text("ok");
      }
    );
    const req = new NextRequest(new URL("http://localhost/?name=J&age=20"), {
      method: "post",
      body: JSON.stringify({ name: "", age: 0 }),
    });
    const post = await handler.POST;
    const _res = await post(req, {
      params: Promise.resolve({}),
    });

    type ExpectedHookDefaultResponse = TypedNextResponse<
      z.ZodSafeParseError<{
        name: string;
        age: string;
      }>,
      400,
      "application/json"
    >;

    type ExpectedLastResponse = TypedNextResponse<"ok", 200, "text/plain">;

    type ExpectedResponse = ExpectedHookDefaultResponse | ExpectedLastResponse;

    expectTypeOf<typeof _res>().toEqualTypeOf<ExpectedResponse>();

    type ExpectedValidated = {
      input: Record<
        "json",
        {
          name: string;
          age: string;
        }
      >;
      output: Record<
        "json",
        {
          name: string;
          age: number;
        }
      >;
    };

    type ExpectedHttpFunc = RouteHandler<
      Params,
      | Promise<ExpectedHookDefaultResponse | undefined>
      | Promise<ExpectedLastResponse>,
      ExpectedValidated
    >;

    expectTypeOf<typeof post>().toEqualTypeOf<ExpectedHttpFunc>();
  });

  it("should infer header types correctly", async () => {
    const headerSchema = z.object({ "x-custom": z.string() });
    vi.spyOn(validatorUtils, "getHeadersObject").mockResolvedValueOnce({
      "x-custom": "not a number",
    });
    const handler = createRouteHandler().post(
      zValidator("headers", headerSchema),
      async (rc) => {
        const _validHeaders = rc.req.valid("headers");
        type ExpectedHeader = z.output<typeof headerSchema>;
        expectTypeOf<typeof _validHeaders>().toEqualTypeOf<ExpectedHeader>();

        return rc.text("header ok");
      }
    );
    const req = new NextRequest(new URL("http://localhost"));
    const post = await handler.POST;
    const _res = await post(req, { params: Promise.resolve({}) });

    type ExpectedHookDefaultResponse = TypedNextResponse<
      z.ZodSafeParseError<{
        "x-custom": string;
      }>,
      400,
      "application/json"
    >;

    type ExpectedLastResponse = TypedNextResponse<
      "header ok",
      200,
      "text/plain"
    >;

    type ExpectedResponse = ExpectedHookDefaultResponse | ExpectedLastResponse;

    expectTypeOf<typeof _res>().toEqualTypeOf<ExpectedResponse>();

    type ExpectedValidated = {
      input: Record<
        "headers",
        {
          "x-custom": string;
        }
      >;
      output: Record<
        "headers",
        {
          "x-custom": string;
        }
      >;
    };

    type ExpectedHttpFunc = RouteHandler<
      Params,
      | Promise<ExpectedHookDefaultResponse | undefined>
      | Promise<ExpectedLastResponse>,
      ExpectedValidated
    >;

    expectTypeOf<typeof post>().toEqualTypeOf<ExpectedHttpFunc>();
  });

  it("should infer cookie types correctly", async () => {
    const cookieSchema = z.object({ session: z.string() });
    vi.spyOn(validatorUtils, "getCookiesObject").mockResolvedValueOnce({
      session: "abc",
    });
    const handler = createRouteHandler().post(
      zValidator("cookies", cookieSchema),
      async (rc) => {
        const _validCookies = rc.req.valid("cookies");
        type ExpectedCookie = z.output<typeof cookieSchema>;
        expectTypeOf<typeof _validCookies>().toEqualTypeOf<ExpectedCookie>();

        return rc.text("cookie ok");
      }
    );
    const req = new NextRequest(new URL("http://localhost"));
    const post = await handler.POST;
    const _res = await post(req, { params: Promise.resolve({}) });

    type ExpectedHookDefaultResponse = TypedNextResponse<
      z.ZodSafeParseError<{
        session: string;
      }>,
      400,
      "application/json"
    >;

    type ExpectedLastResponse = TypedNextResponse<
      "cookie ok",
      200,
      "text/plain"
    >;

    type ExpectedResponse = ExpectedHookDefaultResponse | ExpectedLastResponse;

    expectTypeOf<typeof _res>().toEqualTypeOf<ExpectedResponse>();

    type ExpectedValidated = {
      input: Record<
        "cookies",
        {
          session: string;
        }
      >;
      output: Record<
        "cookies",
        {
          session: string;
        }
      >;
    };

    type ExpectedHttpFunc = RouteHandler<
      Params,
      | Promise<ExpectedHookDefaultResponse | undefined>
      | Promise<ExpectedLastResponse>,
      ExpectedValidated
    >;

    expectTypeOf<typeof post>().toEqualTypeOf<ExpectedHttpFunc>();
  });

  it("should infer validate type correctly", async () => {
    createRouteHandler().get(
      // @ts-expect-error get does not accept "json" validator
      zValidator("json", schema2),
      async (rc) => {
        // @ts-expect-error get does not accept "json" validator
        const _validated = rc.req.valid("json");

        type ExpectedValid = never;
        expectTypeOf<typeof _validated>().toEqualTypeOf<ExpectedValid>();

        return rc.text("ok");
      }
    );

    createRouteHandler().head(
      // @ts-expect-error get does not accept "json" validator
      zValidator("json", schema2),
      async (rc) => {
        // @ts-expect-error get does not accept "json" validator
        const _validated = rc.req.valid("json");

        type ExpectedValid = never;
        expectTypeOf<typeof _validated>().toEqualTypeOf<ExpectedValid>();

        return rc.text("ok");
      }
    );

    createRouteHandler().get(zValidator("headers", schema2), async (rc) => {
      const _valid = rc.req.valid;

      type ExpectedValid = [target: "headers"];
      expectTypeOf<Parameters<typeof _valid>>().toEqualTypeOf<ExpectedValid>();

      return rc.text("ok");
    });

    createRouteHandler().get(
      zValidator("headers", schema2),
      zValidator("cookies", schema2),
      async (rc) => {
        const _valid = rc.req.valid;

        type ExpectedValid = [target: "headers" | "cookies"];
        expectTypeOf<
          Parameters<typeof _valid>
        >().toEqualTypeOf<ExpectedValid>();

        return rc.text("ok");
      }
    );
  });
});

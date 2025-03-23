import { NextRequest } from "next/server";
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { zodValidator } from "./zod-validator";
import { createRouteHandler } from "../../create-route-handler";
import { Expect, Equal } from "../../../../__tests__/types";
import { TypedNextResponse } from "../../types";

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
      zodValidator("params", schema, (result, rc) => {
        if (!result.success) return rc.json(result, { status: 401 });
      }),
      zodValidator("query", schema2),
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
      zodValidator("params", schema, (result, rc) => {
        if (!result.success) return rc.json(result, { status: 401 });
      }),
      zodValidator("query", schema2),
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
      zodValidator("params", schema),
      zodValidator("query", schema2),
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
    }>().post(zodValidator("params", schema), async (rc) =>
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
      zodValidator("params", schema),
      zodValidator("query", schema2),
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
    }>().post(zodValidator("params", schema), async (rc) => rc.text("clean"));
    const req = new NextRequest(new URL("http://localhost"));
    const res = await handler.POST(req, {
      params: Promise.resolve({ name: "B", hoge: "22" }),
    });
    expect(await res.text()).toBe("clean");
  });

  it("Should return 400 when params are invalid and no custom hook is used", async () => {
    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
    }>().post(zodValidator("params", schema), async (rc) =>
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
      zodValidator("params", schema, (_, __) => {
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
      zodValidator("params", schema),
      zodValidator("query", schema2),
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
      zodValidator("params", schema, hook),
      zodValidator("query", schema2, hook),
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
});

describe("createHandler type definitions", () => {
  it("should infer types correctly", async () => {
    type ExpectOutput = z.output<typeof schema>;
    type ExpectQuery = z.output<typeof schema2>;

    const handler = createRouteHandler<{
      params: z.infer<typeof schema>;
      query: { name: string; age: string };
    }>().post(
      zodValidator("params", schema, (result, rc) => {
        if (!result.success) return rc.json(result, { status: 401 });
      }),
      zodValidator("query", schema2),
      async (rc) => {
        const validParams = rc.req.valid("params");
        const ValidQuery = rc.req.valid("query");

        type Result1 = Expect<Equal<ExpectOutput, typeof validParams>>;
        type Result2 = Expect<Equal<ExpectQuery, typeof ValidQuery>>;

        if (ValidQuery) {
          return rc.text("ok1");
        }

        return rc.text("ok2");
      }
    );
    const req = new NextRequest(new URL("http://localhost/?name=J&age=20"));
    const res = await handler.POST(req, {
      params: Promise.resolve({ name: "J", hoge: "30" }),
    });

    type ExpectHookDefaultResponse = TypedNextResponse<
      z.SafeParseError<{
        name: string;
        age: string;
      }>,
      400,
      "application/json"
    >;

    type ExpectHookResponse = TypedNextResponse<
      z.SafeParseError<{
        name: string;
        hoge: string;
      }>,
      401,
      "application/json"
    >;

    type ExpectLastResponse =
      | TypedNextResponse<"ok1", 200, "text/plain">
      | TypedNextResponse<"ok2", 200, "text/plain">;

    type ExpectResponse =
      | ExpectHookDefaultResponse
      | ExpectHookResponse
      | ExpectLastResponse;

    type Result3 = Expect<Equal<ExpectResponse, typeof res>>;
  });
});

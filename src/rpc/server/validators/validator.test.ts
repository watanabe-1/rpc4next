import { NextRequest } from "next/server";
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validator } from "./validator";
import { routeHandlerFactory } from "../route-handler-factory";
import * as validatorUtils from "./validator-utils";
import type { ValidatedData } from "../types";

const createRouteHandler = routeHandlerFactory();

const schema = z.object({ name: z.string(), hoge: z.string() });
const schema2 = z.object({
  name: z.string(),
  age: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => !Number.isNaN(v)),
});

describe("validator", () => {
  // Params and Query Validation
  describe("Params and Query Validation", () => {
    it("should return 200 and 'ok' when both params and query are valid", async () => {
      const handler = createRouteHandler<{
        params: z.infer<typeof schema>;
        query: z.input<typeof schema2>;
      }>().post(
        validator()("params", async (value, rc) => {
          const parsed = schema.safeParse(value);
          if (!parsed.success) return rc.json(parsed.error, { status: 401 });

          return parsed.data as unknown as ValidatedData;
        }),
        validator()("query", async (value, rc) => {
          const parsed = schema2.safeParse(value);
          if (!parsed.success) return rc.json(parsed.error, { status: 400 });

          return parsed.data as unknown as ValidatedData;
        }),
        async (rc) => rc.text("ok")
      );

      const req = new NextRequest(new URL("http://localhost/?name=J&age=20"));
      const res = await handler.POST(req, {
        params: Promise.resolve({ name: "J", hoge: "30" }),
      });

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });

    it("should return 401 when params validation fails", async () => {
      const handler = createRouteHandler<{
        params: z.infer<typeof schema>;
      }>().post(
        validator()("params", async (value, rc) => {
          const parsed = schema.safeParse(value);
          if (!parsed.success) return rc.json(parsed.error, { status: 401 });

          return parsed.data as unknown as ValidatedData;
        }),
        async (rc) => rc.text("ok")
      );

      const res = await handler.POST(
        new NextRequest(new URL("http://localhost")),
        {
          params: Promise.resolve({ name: "J", hoge: 30 as unknown as string }),
        }
      );

      expect(res.status).toBe(401);
    });

    it("should return 400 when query validation fails", async () => {
      const handler = createRouteHandler<{
        params: z.infer<typeof schema>;
        query: z.input<typeof schema2>;
      }>().post(
        validator()("params", async (value, rc) => {
          const parsed = schema.safeParse(value);
          if (!parsed.success) return rc.json(parsed.error, { status: 400 });

          return parsed.data as unknown as ValidatedData;
        }),
        validator()("query", async (value, rc) => {
          const parsed = schema2.safeParse(value);
          if (!parsed.success) return rc.json(parsed.error, { status: 400 });

          return parsed.data as unknown as ValidatedData;
        }),
        async (rc) => rc.text("ok")
      );

      const res = await handler.POST(
        new NextRequest(new URL("http://localhost/?name=J&age=abc")),
        { params: Promise.resolve({ name: "J", hoge: "30" }) }
      );

      expect(res.status).toBe(400);
    });

    it("should skip query validation when only params are used", async () => {
      const handler = createRouteHandler<{
        params: z.infer<typeof schema>;
      }>().post(
        validator()("params", async (value, rc) => {
          const parsed = schema.safeParse(value);
          if (!parsed.success) return rc.json(parsed.error, { status: 400 });

          return parsed.data as unknown as ValidatedData;
        }),
        async (rc) => rc.text("only params")
      );

      const res = await handler.POST(
        new NextRequest(new URL("http://localhost/?ignored=true")),
        { params: Promise.resolve({ name: "A", hoge: "18" }) }
      );

      expect(await res.text()).toBe("only params");
    });

    it("should add and retrieve validated params and query", async () => {
      const handler = createRouteHandler<{
        params: z.infer<typeof schema>;
        query: z.input<typeof schema2>;
      }>().post(
        validator()(
          "params",
          async (v) => schema.parseAsync(v) as unknown as ValidatedData
        ),
        validator()(
          "query",
          async (v) => schema2.parseAsync(v) as unknown as ValidatedData
        ),
        async (rc) =>
          rc.json({ p: rc.req.valid("params"), q: rc.req.valid("query") })
      );

      const res = await handler.POST(
        new NextRequest(new URL("http://localhost/?name=J&age=20")),
        { params: Promise.resolve({ name: "J", hoge: "30" }) }
      );
      const json = await res.json();

      expect(json).toEqual({
        p: { name: "J", hoge: "30" },
        q: { name: "J", age: 20 },
      });
    });
  });

  // JSON Body Validation
  describe("JSON Body Validation", () => {
    const postJson = async (body: unknown) => {
      const handler = createRouteHandler().post(
        validator()("json", async (value, rc) => {
          const parsed = schema.safeParse(value);
          if (!parsed.success) return rc.json(parsed.error, { status: 400 });

          return parsed.data as unknown as ValidatedData;
        }),
        async (rc) => rc.text("valid json")
      );

      return handler.POST(
        new NextRequest(new URL("http://localhost"), {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
        { params: Promise.resolve({}) }
      );
    };

    it("should return 200 for valid JSON body", async () => {
      const res = await postJson({ name: "Taro", hoge: "fuga" });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("valid json");
    });

    it("should return 400 for invalid JSON body", async () => {
      const res = await postJson({ name: 123, hoge: true });
      expect(res.status).toBe(400);
    });

    it("should add and retrieve validated JSON body", async () => {
      const handler = createRouteHandler().post(
        validator()("json", async (v, rc) => {
          const parsed = schema.safeParse(v);
          if (!parsed.success) return rc.json(parsed.error, { status: 400 });

          return parsed.data as unknown as ValidatedData;
        }),
        async (rc) => rc.json({ body: rc.req.valid("json") })
      );

      const res = await handler.POST(
        new NextRequest(new URL("http://localhost"), {
          method: "POST",
          body: JSON.stringify({ name: "J", hoge: "30" }),
          headers: { "Content-Type": "application/json" },
        }),
        { params: Promise.resolve({}) }
      );
      const json = await res.json();

      expect(json).toEqual({ body: { name: "J", hoge: "30" } });
    });
  });

  // Headers Validation
  describe("Headers Validation", () => {
    const headerSchema = z.object({ "x-test": z.string() });

    it("should return valid headers data", async () => {
      vi.spyOn(validatorUtils, "getHeadersObject").mockResolvedValueOnce({
        "x-test": "123",
      });

      const handler = createRouteHandler().post(
        validator()("headers", async (value, rc) => {
          const parsed = headerSchema.safeParse(value);
          if (!parsed.success) return rc.json(parsed.error, { status: 400 });

          return parsed.data as unknown as ValidatedData;
        }),
        async (rc) => rc.json({ header: rc.req.valid("headers") })
      );

      const res = await handler.POST(
        new NextRequest(new URL("http://localhost")),
        { params: Promise.resolve({}) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ header: { "x-test": "123" } });
    });

    it("should return 400 for invalid headers data", async () => {
      vi.spyOn(validatorUtils, "getHeadersObject").mockResolvedValueOnce({
        "x-test2": "invalid",
      });

      const res = await createRouteHandler()
        .post(
          validator()("headers", async (value, rc) => {
            const parsed = headerSchema.safeParse(value);
            if (!parsed.success) return rc.json(parsed.error, { status: 400 });

            return parsed.data as unknown as ValidatedData;
          }),
          async (rc) => rc.text("never reach")
        )
        .POST(new NextRequest(new URL("http://localhost")), {
          params: Promise.resolve({}),
        });

      expect(res.status).toBe(400);
    });
  });

  // Cookies Validation
  describe("Cookies Validation", () => {
    const cookieSchema = z.object({ token: z.string() });

    it("should return valid cookies data", async () => {
      vi.spyOn(validatorUtils, "getCookiesObject").mockResolvedValueOnce({
        token: "abc",
      });

      const handler = createRouteHandler().post(
        validator()("cookies", async (value, rc) => {
          const parsed = cookieSchema.safeParse(value);
          if (!parsed.success) return rc.json(parsed.error, { status: 400 });

          return parsed.data as unknown as ValidatedData;
        }),
        async (rc) => rc.json({ cookie: rc.req.valid("cookies") })
      );

      const res = await handler.POST(
        new NextRequest(new URL("http://localhost")),
        { params: Promise.resolve({}) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ cookie: { token: "abc" } });
    });

    it("should return 400 for invalid cookies data", async () => {
      vi.spyOn(validatorUtils, "getCookiesObject").mockResolvedValueOnce({
        token2: "def",
      });

      const res = await createRouteHandler()
        .post(
          validator()("cookies", async (value, rc) => {
            const parsed = cookieSchema.safeParse(value);
            if (!parsed.success) return rc.json(parsed.error, { status: 400 });

            return parsed.data as unknown as ValidatedData;
          }),
          async (rc) => rc.text("never reach")
        )
        .POST(new NextRequest(new URL("http://localhost")), {
          params: Promise.resolve({}),
        });

      expect(res.status).toBe(400);
    });
  });

  // Unexpected Target Error
  describe("Unexpected Target Error", () => {
    it("should throw when an unsupported target is provided", async () => {
      const handler = createRouteHandler().post(
        // @ts-expect-error - force an invalid target for testing
        validator()<ValidatedData>(
          "invalid",
          async () => ({}) as ValidatedData
        ),
        async (rc) => rc.text("should not reach")
      );

      await expect(
        handler.POST(new NextRequest(new URL("http://localhost")), {
          params: Promise.resolve({}),
        })
      ).rejects.toThrowError("Unexpected target: invalid");
    });
  });
});

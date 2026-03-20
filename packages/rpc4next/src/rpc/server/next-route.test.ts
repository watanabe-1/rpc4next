import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { rpcError } from "./error";
import { nextRoute } from "./next-route";
import { procedure } from "./procedure";
import { getProcedureDefinition } from "./procedure-types";
import type { TypedNextResponse } from "./types";
import * as validatorUtils from "./validators/validator-utils";

describe("nextRoute", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes validated input, middleware context, and response contracts", async () => {
    vi.spyOn(validatorUtils, "getHeadersObject").mockResolvedValueOnce({
      "x-procedure-test": "header-ok",
    });
    vi.spyOn(validatorUtils, "getCookiesObject").mockResolvedValueOnce({
      session: "cookie-ok",
    });

    const route = nextRoute(
      procedure
        .meta({ tags: ["procedure-contract"], auth: "optional" as const })
        .params(z.object({ userId: z.string().min(1) }))
        .query(
          z.object({
            includePosts: z.enum(["true", "false"]).optional(),
          }),
        )
        .json(z.object({ title: z.string().min(1) }))
        .headers(z.object({ "x-procedure-test": z.string().min(1) }))
        .cookies(z.object({ session: z.string().min(1) }))
        .output({
          _output: {
            ok: true as const,
            userId: "" as string,
            includePosts: false as boolean,
            title: "" as string,
            header: "" as string,
            session: "" as string,
            requestId: "" as string,
          },
        })
        .use(async ({ headers }) => ({
          ctx: {
            requestId: headers["x-procedure-test"],
          },
        }))
        .handle(async ({ params, query, json, headers, cookies, ctx }) => ({
          status: 200,
          body: {
            ok: true,
            userId: params.userId,
            includePosts: query.includePosts === "true",
            title: json.title,
            header: headers["x-procedure-test"],
            session: cookies.session,
            requestId: ctx.requestId,
          },
        })),
      { method: "POST" },
    );

    const definition = getProcedureDefinition(route);
    expect(definition).toMatchObject({
      method: "POST",
      meta: { tags: ["procedure-contract"], auth: "optional" },
      output: {
        schema: {
          _output: {
            ok: true,
          },
        },
      },
    });

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/procedure/user-1", {
        method: "POST",
        body: JSON.stringify({ title: "phase-3" }),
        headers: {
          "content-type": "application/json",
        },
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      userId: "user-1",
      includePosts: false,
      title: "phase-3",
      header: "header-ok",
      session: "cookie-ok",
      requestId: "header-ok",
    });
  });

  it("preserves repeated query parameters for procedure validation", async () => {
    const route = nextRoute(
      procedure
        .query(
          z.object({
            tag: z.array(z.string()).min(2),
          }),
        )
        .handle(async ({ query }) => ({
          body: query,
        })),
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/procedure?tag=a&tag=b"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tag: ["a", "b"],
    });
  });

  it("serializes thrown RpcError with the default envelope", async () => {
    const route = nextRoute(
      procedure.handle(async () => {
        throw rpcError("FORBIDDEN", {
          message: "blocked",
        });
      }),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "blocked",
      },
    });
  });

  it("can attach an explicit method to the generated route contract", () => {
    const route = nextRoute(
      procedure.handle(async () => ({
        status: 204 as const,
      })),
      { method: "GET" },
    );

    expect(getProcedureDefinition(route)).toEqual({ method: "GET" });
  });

  it("rejects JSON contracts on GET and HEAD requests", async () => {
    const route = nextRoute(
      procedure
        .json(z.object({ title: z.string() }))
        .handle(async ({ json }) => ({
          body: json,
        })),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message:
          "JSON input contracts are not supported for GET or HEAD requests.",
      },
    });
  });

  it("serializes malformed JSON bodies as BAD_REQUEST errors", async () => {
    const route = nextRoute(
      procedure
        .json(z.object({ title: z.string() }))
        .handle(async ({ json }) => ({
          body: json,
        })),
      { method: "POST" },
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api", {
        method: "POST",
        body: "{",
        headers: {
          "content-type": "application/json",
        },
      }),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid JSON body.",
      },
    });
  });

  it("preserves raw Response escape hatches", async () => {
    const route = nextRoute(
      procedure.handle(async () => {
        return new Response("raw-response", {
          status: 202,
          headers: {
            "content-type": "text/plain",
          },
        });
      }),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(202);
    await expect(response.text()).resolves.toBe("raw-response");
  });

  it("supports redirects from normalized procedure results", async () => {
    const route = nextRoute(
      procedure.handle(async () => ({
        redirect: "http://127.0.0.1:3000/feed",
      })),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/feed");
  });

  it("short-circuits middleware responses before later middleware or handler execution", async () => {
    const laterMiddleware = vi.fn(() => ({
      ctx: { reached: true },
    }));
    const handler = vi.fn(async () => ({
      body: { ok: true },
    }));
    const route = nextRoute(
      procedure
        .use(() => ({
          body: { ok: false, source: "middleware" as const },
          status: 202,
        }))
        .use(laterMiddleware)
        .handle(handler),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      source: "middleware",
    });
    expect(laterMiddleware).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("preserves explicit procedure error contracts in the route type", () => {
    const route = nextRoute(
      procedure
        .error<"FORBIDDEN", { reason: string }>("FORBIDDEN")
        .handle(async () => ({
          status: 204 as const,
        })),
    );

    type ActualResponse = Awaited<ReturnType<typeof route>>;
    type ExpectedResponse =
      | TypedNextResponse<
          undefined,
          204,
          import("../lib/content-type-types").ContentType
        >
      | TypedNextResponse<
          {
            error: {
              code: "FORBIDDEN";
              message: string;
              details?: { reason: string };
            };
          },
          403,
          "application/json"
        >;
    const _fromActual: ExpectedResponse = {} as ActualResponse;
    const _fromExpected: ActualResponse = {} as ExpectedResponse;

    void _fromActual;
    void _fromExpected;
    expect(true).toBe(true);
  });

  it("includes implicit BAD_REQUEST responses for validated procedure routes", () => {
    const route = nextRoute(
      procedure
        .query(
          z.object({
            includePosts: z.enum(["true", "false"]).optional(),
          }),
        )
        .handle(async ({ query }) => ({
          body: {
            ok: true as const,
            includePosts: query.includePosts === "true",
          },
        })),
    );

    type ActualResponse = Awaited<ReturnType<typeof route>>;
    type ExpectedResponse =
      | TypedNextResponse<
          {
            ok: true;
            includePosts: boolean;
          },
          200,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "BAD_REQUEST";
              message: string;
              details?: unknown;
            };
          },
          400,
          "application/json"
        >;
    const _fromActual: ExpectedResponse = {} as ActualResponse;
    const _fromExpected: ActualResponse = {} as ExpectedResponse;

    void _fromActual;
    void _fromExpected;
    expect(true).toBe(true);
  });
});

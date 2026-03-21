import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { rpcError } from "./error";
import { nextRoute } from "./next-route";
import { procedure } from "./procedure";
import {
  getProcedureDefinition,
  type ProcedureRouteContract,
} from "./procedure-types";
import type { StandardSchemaV1 } from "./standard-schema";
import type { TypedNextResponse } from "./types";

describe("nextRoute", () => {
  type EmptyParams = Record<never, never>;

  const staticRouteContract = {
    pathname: "/api/test",
    params: {} as EmptyParams,
  } as ProcedureRouteContract<"/api/test", EmptyParams>;
  const dynamicUserRouteContract = {
    pathname: "/api/procedure/[userId]",
    params: {} as { userId: string },
  } as ProcedureRouteContract<"/api/procedure/[userId]", { userId: string }>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes validated input, middleware context, and response contracts", async () => {
    const route = nextRoute(
      procedure
        .forRoute(dynamicUserRouteContract)
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
          "x-procedure-test": "header-ok",
          cookie: "session=cookie-ok",
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
        .forRoute(staticRouteContract)
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

  it("runs validator-stage custom branches before the procedure pipeline", async () => {
    const errorFormatter = vi.fn((error: unknown, rc) =>
      rc.json(
        {
          source: "formatter",
          error: error instanceof Error ? error.message : "unknown",
        },
        { status: 499 },
      ),
    );
    const middleware = vi.fn(() => ({
      ctx: { reached: true },
    }));
    const handler = vi.fn(() => ({
      body: {
        ok: true,
      },
    }));
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(
          z.object({
            page: z.coerce.number().int().positive(),
          }),
          {
            onValidationError: ({ issues, routeContext, target, value }) =>
              routeContext.json(
                {
                  source: "validator",
                  target,
                  issueCount: issues.length,
                  receivedPage:
                    typeof value === "object" &&
                    value !== null &&
                    "page" in value
                      ? value.page
                      : undefined,
                },
                { status: 422 },
              ),
          },
        )
        .use(middleware)
        .handle(handler),
      {
        errorFormatter,
      },
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test?page=0"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      source: "validator",
      target: "query",
      issueCount: 1,
      receivedPage: "0",
    });
    expect(errorFormatter).not.toHaveBeenCalled();
    expect(middleware).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps the default BAD_REQUEST normalization when no custom branch is configured", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(
          z.object({
            page: z.coerce.number().int().positive(),
          }),
        )
        .handle(async ({ query }) => ({
          body: query,
        })),
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test?page=0"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toMatchObject({
      error: {
        code: "BAD_REQUEST",
        details: expect.any(Array),
      },
    });
    expect(
      typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "object" &&
        payload.error !== null &&
        "message" in payload.error
        ? payload.error.message
        : "",
    ).toContain(">0");
  });

  it("lets errorFormatter shape validation errors when validator-stage customization falls back", async () => {
    const errorFormatter = vi.fn((error: unknown, rc) => {
      if (!(error instanceof Error)) {
        return undefined;
      }

      return rc.json(
        {
          source: "formatter",
          message: error.message,
        },
        { status: 418 },
      );
    });
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(
          z.object({
            page: z.coerce.number().int().positive(),
          }),
          {
            onValidationError: () => undefined,
          },
        )
        .handle(async ({ query }) => ({
          body: query,
        })),
      {
        errorFormatter,
      },
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test?page=0"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(errorFormatter).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(418);
    const payload = await response.json();
    expect(payload).toMatchObject({
      source: "formatter",
    });
    expect(
      typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string"
        ? payload.message
        : "",
    ).toContain(">0");
  });

  it("supports injected procedure validators", async () => {
    const pageSchema: StandardSchemaV1<
      { page?: string | string[] },
      { page: number }
    > = {
      "~standard": {
        version: 1,
        vendor: "rpc4next-test",
        validate: (value) => {
          const input =
            typeof value === "object" && value !== null
              ? (value as { page?: string | string[] })
              : {};
          const page = "page" in input ? input.page : "";
          const first = Array.isArray(page) ? page[0] : page;
          const parsed = Number(first ?? "1");

          if (!Number.isInteger(parsed) || parsed < 1) {
            return {
              issues: [{ message: "page must be a positive integer" }],
            };
          }

          return {
            value: { page: parsed },
          };
        },
      },
    };

    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(pageSchema)
        .handle(async ({ query }) => ({
          body: query,
        })),
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/procedure?page=2"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      page: 2,
    });
  });

  it("serializes thrown RpcError with the default envelope", async () => {
    const route = nextRoute(
      procedure.forRoute(staticRouteContract).handle(async () => {
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

  it("prefers a route-level custom errorFormatter over the default envelope", async () => {
    const errorFormatter = vi.fn((error: unknown, rc) => {
      if (!(error instanceof Error)) {
        return undefined;
      }

      return rc.json(
        {
          success: false,
          message: error.message,
        },
        { status: 500 },
      );
    });
    const route = nextRoute(
      procedure.forRoute(staticRouteContract).handle(async () => {
        throw new Error("custom formatter");
      }),
      {
        errorFormatter,
      },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(errorFormatter).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "custom formatter",
    });
  });

  it("falls back to the default formatter when a route-level errorFormatter skips an RpcError", async () => {
    const errorFormatter = vi.fn(() => undefined);
    const route = nextRoute(
      procedure.forRoute(staticRouteContract).handle(async () => {
        throw rpcError("FORBIDDEN", {
          message: "blocked",
        });
      }),
      {
        errorFormatter,
      },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(errorFormatter).toHaveBeenCalledTimes(1);
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
      procedure.forRoute(staticRouteContract).handle(async () => ({
        status: 204 as const,
      })),
      { method: "GET" },
    );

    expect(getProcedureDefinition(route)).toMatchObject({ method: "GET" });
  });

  it("rejects JSON contracts on GET and HEAD requests", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
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

  it("rejects GET procedure definitions with JSON contracts at compile time", () => {
    const invalidProcedure = procedure
      .forRoute(staticRouteContract)
      .json(z.object({ title: z.string() }))
      .handle(async ({ json }) => ({
        body: json,
      }));

    // @ts-expect-error GET procedures must not declare JSON input contracts
    nextRoute(invalidProcedure, { method: "GET" });

    expect(true).toBe(true);
  });

  it("normalizes multipart form-data into validator-friendly input", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .formData(
          z.object({
            displayName: z.string().min(1),
            avatar: z.instanceof(File),
            tags: z.array(z.string()).optional(),
          }),
        )
        .handle(async ({ formData }) => ({
          body: {
            displayName: formData.displayName,
            filename: formData.avatar.name,
            tags: formData.tags ?? [],
          },
        })),
      { method: "POST" },
    );

    const payload = new FormData();
    payload.set("displayName", "demo-user");
    payload.set(
      "avatar",
      new File(["avatar"], "avatar.png", { type: "image/png" }),
    );
    payload.append("tags", "alpha");
    payload.append("tags", "beta");

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/procedure", {
        method: "POST",
        body: payload,
      }),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      displayName: "demo-user",
      filename: "avatar.png",
      tags: ["alpha", "beta"],
    });
  });

  it("keeps single form-data values scalar after normalization", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .formData(
          z.object({
            displayName: z.string(),
            avatar: z.instanceof(File),
          }),
        )
        .handle(async ({ formData }) => ({
          body: {
            displayName: formData.displayName,
            avatarName: formData.avatar.name,
          },
        })),
      { method: "POST" },
    );

    const payload = new FormData();
    payload.set("displayName", "scalar-user");
    payload.set(
      "avatar",
      new File(["avatar"], "scalar.png", { type: "image/png" }),
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/procedure", {
        method: "POST",
        body: payload,
      }),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      displayName: "scalar-user",
      avatarName: "scalar.png",
    });
  });

  it("rejects GET procedure definitions with formData contracts at compile time", () => {
    const invalidProcedure = procedure
      .forRoute(staticRouteContract)
      .formData(
        z.object({
          displayName: z.string(),
        }),
      )
      .handle(async ({ formData }) => ({
        body: formData,
      }));

    // @ts-expect-error GET procedures must not declare FormData input contracts
    nextRoute(invalidProcedure, { method: "GET" });

    expect(true).toBe(true);
  });

  it("rejects formData contracts on GET and HEAD requests", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .formData(
          z.object({
            displayName: z.string(),
          }),
        )
        .handle(async ({ formData }) => ({
          body: formData,
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
          "FormData input contracts are not supported for GET or HEAD requests.",
      },
    });
  });

  it("serializes malformed JSON bodies as BAD_REQUEST errors", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
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
      procedure.forRoute(staticRouteContract).handle(async () => {
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

  it("validates procedure output bodies at runtime when enabled", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.object({
            ok: z.literal(true),
            count: z.number().int().nonnegative(),
          }),
        )
        .handle(async () => ({
          status: 200,
          body: {
            ok: true,
            count: 1,
          },
        })),
      { method: "GET", validateOutput: true },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      count: 1,
    });
  });

  it("normalizes invalid runtime output as INTERNAL_SERVER_ERROR", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.object({
            ok: z.literal(true),
            count: z.number().int().nonnegative(),
          }),
        )
        .handle(async () => ({
          status: 200,
          body: {
            ok: true,
            count: -1,
          },
        })),
      { method: "GET", validateOutput: true },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Procedure output validation failed.",
        details: expect.any(Array),
      },
    });
  });

  it("skips runtime output validation for raw Response escape hatches", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.object({
            ok: z.literal(true),
          }),
        )
        .handle(async () => {
          return new Response(JSON.stringify({ ok: false }), {
            status: 202,
            headers: {
              "content-type": "application/json",
            },
          });
        }),
      { method: "GET", validateOutput: true },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: false,
    });
  });

  it("requires Standard Schema output contracts when runtime validation is enabled", () => {
    expect(() =>
      nextRoute(
        procedure
          .forRoute(staticRouteContract)
          .output({
            _output: {
              ok: true as const,
            },
          })
          .handle(async () => ({
            body: {
              ok: true,
            },
          })),
        { method: "GET", validateOutput: true },
      ),
    ).toThrow(
      "Procedure output contracts must implement Standard Schema V1 when validateOutput is enabled.",
    );
  });

  it("supports redirects from normalized procedure results", async () => {
    const route = nextRoute(
      procedure.forRoute(staticRouteContract).handle(async () => ({
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
        .forRoute(staticRouteContract)
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

  it("reuses shared baseProcedure presets without mutating earlier routes", async () => {
    const baseProcedure = procedure
      .forRoute(staticRouteContract)
      .headers(
        z.object({
          "x-demo-role": z.enum(["reader", "editor"]).optional(),
        }),
      )
      .use(({ headers }) => ({
        ctx: {
          viewer: {
            role: headers["x-demo-role"] ?? "reader",
          },
        },
      }));

    const baseRoute = nextRoute(
      baseProcedure.handle(async ({ ctx }) => ({
        body: {
          ok: true,
          role: ctx.viewer.role,
          source: "base",
        },
      })),
      { method: "GET" },
    );

    const extendedRoute = nextRoute(
      baseProcedure
        .query(
          z.object({
            includeDrafts: z.enum(["true", "false"]).optional(),
          }),
        )
        .handle(async ({ query, ctx }) => ({
          body: {
            ok: true,
            role: ctx.viewer.role,
            includeDrafts: query.includeDrafts === "true",
            source: "extended",
          },
        })),
      { method: "GET" },
    );

    const baseResponse = await baseRoute(
      new NextRequest("http://127.0.0.1:3000/api/base", {
        headers: {
          "x-demo-role": "editor",
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(baseResponse.status).toBe(200);
    await expect(baseResponse.json()).resolves.toEqual({
      ok: true,
      role: "editor",
      source: "base",
    });

    const extendedResponse = await extendedRoute(
      new NextRequest("http://127.0.0.1:3000/api/extended?includeDrafts=true", {
        headers: {
          "x-demo-role": "editor",
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(extendedResponse.status).toBe(200);
    await expect(extendedResponse.json()).resolves.toEqual({
      ok: true,
      role: "editor",
      includeDrafts: true,
      source: "extended",
    });
  });

  it("supports validator-stage customization on shared baseProcedure presets", async () => {
    const baseProcedure = procedure.forRoute(staticRouteContract).query(
      z.object({
        page: z.coerce.number().int().positive(),
      }),
      {
        onValidationError: ({ routeContext, target }) =>
          routeContext.json(
            {
              source: "shared-base",
              target,
            },
            { status: 409 },
          ),
      },
    );

    const route = nextRoute(
      baseProcedure.handle(async ({ query }) => ({
        body: {
          page: query.page,
        },
      })),
      { method: "GET" },
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test?page=0"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      source: "shared-base",
      target: "query",
    });
  });

  it("preserves explicit procedure error contracts in the route type", () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
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

  it("preserves shared procedure error contracts in extended route types", () => {
    const guardedBaseProcedure = procedure
      .forRoute(staticRouteContract)
      .error<"UNAUTHORIZED", { reason: "missing_demo_user" }>("UNAUTHORIZED")
      .error<"FORBIDDEN", { reason: "suspended_account" }>("FORBIDDEN");

    const route = nextRoute(
      guardedBaseProcedure
        .error<"FORBIDDEN", { reason: "editor_only" }>("FORBIDDEN")
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
              code: "UNAUTHORIZED";
              message: string;
              details?: { reason: "missing_demo_user" };
            };
          },
          401,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "FORBIDDEN";
              message: string;
              details?: { reason: "suspended_account" };
            };
          },
          403,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "FORBIDDEN";
              message: string;
              details?: { reason: "editor_only" };
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
        .forRoute(staticRouteContract)
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

  it("includes implicit INTERNAL_SERVER_ERROR responses for runtime-enforced output routes", () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.object({
            ok: z.literal(true),
          }),
        )
        .handle(async () => ({
          body: {
            ok: true,
          },
        })),
      { method: "GET", validateOutput: true },
    );

    type ActualResponse = Awaited<ReturnType<typeof route>>;
    type ExpectedResponse =
      | TypedNextResponse<
          {
            ok: true;
          },
          200,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "INTERNAL_SERVER_ERROR";
              message: string;
              details?: unknown;
            };
          },
          500,
          "application/json"
        >;
    const _fromActual: ExpectedResponse = {} as ActualResponse;
    const _fromExpected: ActualResponse = {} as ExpectedResponse;

    void _fromActual;
    void _fromExpected;
    expect(true).toBe(true);
  });
});

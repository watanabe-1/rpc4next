import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { nextRoute } from "./next-route";
import { procedure } from "./procedure";
import type { ProcedureRouteContract } from "./procedure-types";

describe("nextRoute zod integration", () => {
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
            onValidationError: ({ issues, response, target, value }) =>
              response.json(
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

  it("allows validation hooks to use the same text helper surface as handlers", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(
          z.object({
            page: z.coerce.number().int().positive(),
          }),
          {
            onValidationError: ({ response, target }) =>
              response.text(`validator:${target}`, { status: 422 }),
          },
        )
        .handle(async ({ query }) => ({
          body: query,
        })),
      { method: "GET" },
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test?page=0"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("validator:query");
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

  it("supports narrow response helpers inside procedure handlers", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(
          z.object({
            page: z.coerce.number().int().positive(),
          }),
        )
        .output(
          z.object({
            ok: z.literal(true),
            page: z.number().int().positive(),
          }),
        )
        .handle(async ({ query, response }) =>
          response.json({
            ok: true,
            page: query.page,
          }),
        ),
      { method: "GET" },
    );

    const result = await route(
      new NextRequest("http://127.0.0.1:3000/api/test?page=2"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toEqual({
      ok: true,
      page: 2,
    });
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

  it("replaces ProcedureResult bodies with parsed output values", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.object({
            ok: z.literal(true),
            count: z.coerce
              .number()
              .int()
              .transform((value) => value + 1),
          }),
        )
        .handle(async () => ({
          status: 200,
          body: {
            ok: true,
            count: "1" as unknown as number,
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
      count: 2,
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

  it("validates response helper payloads when runtime output validation is enabled", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.object({
            ok: z.literal(true),
            count: z.number().int().nonnegative(),
          }),
        )
        .handle(async ({ response }) =>
          response.json({
            ok: true,
            count: -1,
          }),
        ),
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

  it("replaces response.json payloads with parsed output values", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.object({
            ok: z.literal(true),
            slug: z.string().transform((value) => value.toUpperCase()),
          }),
        )
        .handle(async ({ response }) =>
          response.json({
            ok: true,
            slug: "draft-post",
          }),
        ),
      { method: "GET", validateOutput: true },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      slug: "DRAFT-POST",
    });
  });

  it("skips runtime output validation for raw Response escape hatches", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.object({
            ok: z.literal(true),
            slug: z.string().transform((value) => value.toUpperCase()),
          }),
        )
        .handle(async () => {
          return new Response(
            JSON.stringify({ ok: true, slug: "raw-response" }),
            {
              status: 202,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }),
      { method: "GET", validateOutput: true },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      slug: "raw-response",
    });
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
        onValidationError: ({ response, target }) =>
          response.json(
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
});

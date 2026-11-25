import { NextRequest, type NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";

import type {
  DynamicPathProxyAsFunction,
  RpcEndpoint,
  RpcGeneratedPathStructure,
} from "../client/types";
import { createNextRoute as basecreateNextRoute } from "./next-route";
import { defaultProcedureOnError } from "./on-error";
import { createRouteProcedure, procedure } from "./procedure";
import type { ProcedureRouteContract } from "./procedure-types";

const createNextRoute = <
  TProcedure,
  TMethod extends HttpMethod = "GET",
  TValidateOutput extends boolean = false,
>(
  procedureDefinition: TProcedure,
  options?: {
    method?: TMethod;
    validateOutput?: TValidateOutput;
    onError?: unknown;
  },
) => {
  const method = options?.method ?? ("GET" as TMethod);
  const resolvedOptions =
    options && "onError" in options
      ? { ...options, method }
      : { ...options, method, onError: defaultProcedureOnError };

  const routes = basecreateNextRoute<
    TProcedure & Parameters<typeof basecreateNextRoute>[0],
    TMethod,
    TValidateOutput
  >(procedureDefinition as never, resolvedOptions as never);

  return routes[method];
};

describe("createNextRoute zod integration", () => {
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

  it("runs authentication before body parsing and validates in declaration order", async () => {
    const order: string[] = [];
    const schema = z.object({ title: z.string() }).refine(() => {
      order.push("validate");

      return true;
    });
    const base = createRouteProcedure({ onError: defaultProcedureOnError }).use(
      ({ request, response }) => {
        order.push("auth");
        if (!request.headers.has("authorization")) return response.error("UNAUTHORIZED");
      },
    );
    const route = base
      .forRoute(staticRouteContract)
      .json(schema)
      .use(({ json }) => {
        order.push(json.title);
      })
      .handle(() => ({ body: "ok" }))
      .post().POST;
    const request = (body: string, authorized: boolean) =>
      new NextRequest("http://localhost/api/test", {
        method: "POST",
        body,
        headers: authorized ? { authorization: "Bearer token" } : {},
      });
    const segment = { params: Promise.resolve({}) };
    expect((await route(request("invalid", false), segment)).status).toBe(401);
    expect(order).toEqual(["auth"]);
    order.length = 0;
    expect((await route(request("invalid", true), segment)).status).toBe(400);
    expect(order).toEqual(["auth"]);
    order.length = 0;
    expect((await route(request('{"title":"post"}', true), segment)).status).toBe(200);
    expect(order).toEqual(["auth", "validate", "post"]);
  });

  it("stops before middleware when an earlier input is invalid", async () => {
    const middleware = vi.fn<() => undefined>(() => undefined);
    const route = createRouteProcedure({ onError: defaultProcedureOnError })
      .forRoute(staticRouteContract)
      .json(z.object({ title: z.string() }))
      .use(middleware)
      .handle(() => ({ body: "ok" }))
      .post().POST;

    const response = await route(
      new NextRequest("http://localhost/api/test", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(400);
    expect(middleware).not.toHaveBeenCalled();
  });

  it("validates and executes middleware for a structurally constructed procedure", async () => {
    const middleware = vi.fn<
      (context: {
        request: NextRequest;
        response: { error: (code: "UNAUTHORIZED") => Response };
      }) => Response | undefined
    >(({ request, response }) => {
      if (!request.headers.has("authorization")) return response.error("UNAUTHORIZED");
    });
    const handler = vi.fn<() => { body: string }>(() => ({ body: "ok" }));
    const built = createRouteProcedure({ onError: defaultProcedureOnError })
      .forRoute(staticRouteContract)
      .json(z.object({ title: z.string() }))
      .use(middleware)
      .handle(handler);
    const definition = Object.fromEntries(
      Object.entries(built.definition),
    ) as typeof built.definition;
    const route = createNextRoute({ ...built, definition }, { method: "POST" });
    const request = (body: string, authorization?: string) =>
      new NextRequest("http://localhost/api/test", {
        method: "POST",
        body,
        headers: authorization ? { authorization } : {},
      });
    const segment = { params: Promise.resolve({}) };

    expect((await route(request("{}"), segment)).status).toBe(400);
    expect(middleware).not.toHaveBeenCalled();
    expect((await route(request('{"title":"ok"}'), segment)).status).toBe(401);
    expect(middleware).toHaveBeenCalledOnce();
    expect(handler).not.toHaveBeenCalled();
    expect((await route(request('{"title":"ok"}', "Bearer token"), segment)).status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("executes authentication appended to a builder-made procedure", async () => {
    const handler = vi.fn<() => { body: string }>(() => ({ body: "secret" }));
    const auth = vi.fn<() => Response>(() => new Response("Unauthorized", { status: 401 }));
    const built = procedure
      .forRoute(staticRouteContract)
      .json(z.object({ title: z.string() }))
      .use(() => undefined)
      .handle(handler);
    const route = createNextRoute(
      { ...built, middlewares: [...built.middlewares, auth] },
      { method: "POST" },
    );
    const response = await route(
      new NextRequest("http://localhost/api/test", {
        method: "POST",
        body: '{"title":"ok"}',
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(401);
    expect(auth).toHaveBeenCalledOnce();
    expect(handler).not.toHaveBeenCalled();
  });

  it("validates a contract added to a copied builder definition", async () => {
    const handler = vi.fn<(context: { json: { title: string } }) => { body: string }>(
      ({ json }) => ({ body: json.title }),
    );
    const built = procedure
      .forRoute(staticRouteContract)
      .query(z.object({}))
      .handle(() => ({ body: "unused" }));
    const definition = {
      ...built.definition,
      input: {
        ...built.definition.input,
        contracts: {
          ...built.definition.input.contracts,
          json: z.object({
            title: z.string().transform((title) => title.toUpperCase()),
          }),
        },
      },
    };
    const route = createNextRoute({ ...built, definition, handler }, { method: "POST" });
    const request = (body: string) =>
      new NextRequest("http://localhost/api/test", { method: "POST", body });
    const segment = { params: Promise.resolve({}) };

    expect((await route(request("{}"), segment)).status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    const response = await route(request('{"title":"post"}'), segment);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ json: { title: "POST" } }));
  });

  it("normalizes validated input, middleware context, and response contracts", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(dynamicUserRouteContract)
        .meta({
          summary: "Procedure contract route",
          tags: ["procedure-contract"],
        })
        .params(z.object({ userId: z.string().min(1) }))
        .query(
          z.object({
            includePosts: z.enum(["true", "false"]).optional(),
          }),
        )
        .json(z.object({ title: z.string().min(1) }))
        .headers(z.object({ "x-procedure-test": z.string().min(1) }))
        .cookies(z.object({ session: z.string().min(1) }))
        .output(
          z.object({
            ok: z.literal(true),
            userId: z.string(),
            includePosts: z.boolean(),
            title: z.string(),
            header: z.string(),
            session: z.string(),
            requestId: z.string(),
          }),
        )
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
    const route = createNextRoute(
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

  it.each([
    ["", undefined],
    ["?tag=a", ["a"]],
    ["?tag=a&tag=b", ["a", "b"]],
  ])("normalizes repeatable query values for %s", async (search, expected) => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(
          z.object({
            tag: z.preprocess(
              (value) => (value === undefined || Array.isArray(value) ? value : [value]),
              z.array(z.string()).optional(),
            ),
          }),
        )
        .handle(({ query }) => ({ body: { tags: query.tag ?? null } })),
    );

    const response = await route(new NextRequest(`http://localhost/api${search}`), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tags: expected ?? null });
  });

  it("stops the route when params validation fails", async () => {
    const handler = vi.fn<() => { body: string }>(() => ({
      body: "unexpected",
    }));
    const route = createNextRoute(
      procedure
        .forRoute(dynamicUserRouteContract)
        .params(z.object({ userId: z.string().min(1) }), {
          onValidationError: ({ response, target }) => response.text(`invalid:${target}`, 422),
        })
        .handle(handler),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({ userId: "" }),
    });

    expect(response.status).toBe(422);
    await expect(response.text()).resolves.toBe("invalid:params");
    expect(handler).not.toHaveBeenCalled();
  });

  it("stops the route when cookie validation fails", async () => {
    const handler = vi.fn<() => { body: string }>(() => ({
      body: "unexpected",
    }));
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .cookies(z.object({ session: z.string().min(1) }), {
          onValidationError: ({ response, target }) => response.text(`invalid:${target}`, 422),
        })
        .handle(handler),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(422);
    await expect(response.text()).resolves.toBe("invalid:cookies");
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs validator-stage custom branches before the procedure pipeline", async () => {
    const onError = vi.fn<(error: unknown, context: { response: typeof NextResponse }) => Response>(
      (error: unknown, { response }) =>
        response.json(
          {
            source: "onError",
            error: error instanceof Error ? error.message : "unknown",
          },
          { status: 499 },
        ),
    );
    const middleware = vi.fn<() => { ctx: { reached: boolean } }>(() => ({
      ctx: { reached: true },
    }));
    const handler = vi.fn<() => { body: { ok: boolean } }>(() => ({
      body: {
        ok: true,
      },
    }));
    const route = createNextRoute(
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
                    typeof value === "object" && value !== null && "page" in value
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
        onError,
      },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=0"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      source: "validator",
      target: "query",
      issueCount: 1,
      receivedPage: "0",
    });
    expect(onError).not.toHaveBeenCalled();
    expect(middleware).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows validation hooks to use the same text helper surface as handlers", async () => {
    const route = createNextRoute(
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

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=0"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("validator:query");
  });

  it("keeps the default BAD_REQUEST normalization when no custom branch is configured", async () => {
    const route = createNextRoute(
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

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=0"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toMatchObject({
      error: {
        code: "BAD_REQUEST",
      },
    });
    expect(payload.error).not.toHaveProperty("details");
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

  it("uses shared validation error handling from createRouteProcedure", async () => {
    const appProcedure = createRouteProcedure({
      onError: defaultProcedureOnError,
      onValidationError: ({ issues, response, target }) =>
        response.error("BAD_REQUEST", {
          message: "Shared validation failed.",
          details: {
            target,
            issues: (issues ?? []).map(({ message, path }) => ({
              message,
              path,
            })),
          },
        }),
    });

    const { GET: route } = appProcedure
      .forRoute(staticRouteContract)
      .query(
        z.object({
          page: z.coerce.number().int().positive(),
        }),
      )
      .handle(async ({ query }) => ({
        body: query,
      }))
      .get({});

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=0"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "BAD_REQUEST",
        message: "Shared validation failed.",
        details: {
          target: "query",
          issues: [
            {
              message: expect.stringContaining(">0"),
              path: ["page"],
            },
          ],
        },
      },
    });
  });

  it("lets route-local validation error handling override createRouteProcedure defaults", async () => {
    const appProcedure = createRouteProcedure({
      onError: defaultProcedureOnError,
      onValidationError: ({ response }) =>
        response.text("shared-validation", {
          status: 409,
        }),
    });

    const { GET: route } = appProcedure
      .forRoute(staticRouteContract)
      .query(
        z.object({
          page: z.coerce.number().int().positive(),
        }),
        {
          onValidationError: ({ response }) =>
            response.text("local-validation", {
              status: 422,
            }),
        },
      )
      .handle(async ({ query }) => ({
        body: query,
      }))
      .get({});

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=0"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(422);
    await expect(response.text()).resolves.toBe("local-validation");
  });

  it("lets method options override the shared validation error handler", async () => {
    const appProcedure = createRouteProcedure({
      onError: defaultProcedureOnError,
      onValidationError: ({ response }) => response.text("shared-validation", { status: 409 }),
    });
    const { GET } = appProcedure
      .forRoute(staticRouteContract)
      .query(z.object({ page: z.coerce.number().int().positive() }))
      .handle(({ query }) => ({ body: query }))
      .get({
        onValidationError: ({ response }) => response.text("method-validation", { status: 422 }),
      });

    const response = await GET(new NextRequest("http://127.0.0.1:3000/api/test?page=0"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(422);
    await expect(response.text()).resolves.toBe("method-validation");
  });

  it("does not call shared validation hooks after an input hook returns undefined", async () => {
    const sharedHook = vi.fn<() => Response>(() => new Response("shared", { status: 422 }));
    const inputHook = vi.fn<() => Promise<undefined>>(async () => undefined);
    const { GET: route } = createRouteProcedure({
      onError: defaultProcedureOnError,
      onValidationError: sharedHook,
    })
      .forRoute(staticRouteContract)
      .query(z.object({ page: z.coerce.number().positive() }), {
        onValidationError: inputHook,
      })
      .handle(({ query }) => ({ body: query }))
      .get();
    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=0"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(400);
    expect(inputHook).toHaveBeenCalledTimes(1);
    expect(sharedHook).not.toHaveBeenCalled();
  });

  it("returns default validation errors when validator-stage customization falls back", async () => {
    const onError = vi.fn<(error: unknown, context: { response: typeof NextResponse }) => Response>(
      (error: unknown, { response }) => {
        return response.json(
          {
            source: "onError",
            message: error instanceof Error ? error.message : "unknown",
          },
          { status: 418 },
        );
      },
    );
    const route = createNextRoute(
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
        onError,
      },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=0"), {
      params: Promise.resolve({}),
    });

    expect(onError).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toMatchObject({
      error: {
        code: "BAD_REQUEST",
      },
    });
    expect(
      typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "object" &&
        payload.error !== null &&
        "message" in payload.error &&
        typeof payload.error.message === "string"
        ? payload.error.message
        : "",
    ).toContain(">0");
  });

  it.each(["GET", "HEAD"] as const)(
    "rejects JSON contracts on %s requests at runtime",
    async (method) => {
      const route = createNextRoute(
        procedure
          .forRoute(staticRouteContract)
          .json(z.object({ title: z.string() }))
          .handle(async ({ json }) => ({
            body: json,
          })),
        { method },
      );

      const response = await route(
        new NextRequest("http://127.0.0.1:3000/api", {
          method,
        }),
        {
          params: Promise.resolve({}),
        },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "BAD_REQUEST",
          message: "JSON input contracts are not supported for GET or HEAD requests.",
        },
      });
    },
  );

  it("normalizes multipart form-data into validator-friendly input", async () => {
    const route = createNextRoute(
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
    payload.set("avatar", new File(["avatar"], "avatar.png", { type: "image/png" }));
    payload.append("tags", "alpha");
    payload.append("tags", "beta");
    payload.append("tags", "gamma");

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
      tags: ["alpha", "beta", "gamma"],
    });
  });

  it.each([[[]], [["alpha"]], [["alpha", "beta"]]])(
    "normalizes repeatable form fields: %j",
    async (tags) => {
      const route = createNextRoute(
        procedure
          .forRoute(staticRouteContract)
          .formData(
            z.object({
              tags: z.preprocess(
                (value) => (value === undefined || Array.isArray(value) ? value : [value]),
                z.array(z.string().min(1).max(40)).max(10).optional(),
              ),
            }),
          )
          .handle(({ formData }) => ({ body: { tags: formData.tags ?? null } })),
        { method: "POST" },
      );
      const payload = new FormData();
      for (const tag of tags) payload.append("tags", tag);

      const response = await route(
        new NextRequest("http://localhost/api", {
          method: "POST",
          body: payload,
        }),
        { params: Promise.resolve({}) },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        tags: tags.length ? tags : null,
      });
    },
  );

  it("keeps single form-data values scalar after normalization", async () => {
    const route = createNextRoute(
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
    payload.set("avatar", new File(["avatar"], "scalar.png", { type: "image/png" }));

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

  it.each(["GET", "HEAD"] as const)(
    "rejects formData contracts on %s requests at runtime",
    async (method) => {
      const route = createNextRoute(
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
        { method },
      );

      const response = await route(
        new NextRequest("http://127.0.0.1:3000/api", {
          method,
        }),
        {
          params: Promise.resolve({}),
        },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "BAD_REQUEST",
          message: "FormData input contracts are not supported for GET or HEAD requests.",
        },
      });
    },
  );

  it("supports narrow response helpers inside procedure handlers", async () => {
    const route = createNextRoute(
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

    const result = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=2"), {
      params: Promise.resolve({}),
    });

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toEqual({
      ok: true,
      page: 2,
    });
  });

  it("validates procedure output bodies at runtime when enabled", async () => {
    const route = createNextRoute(
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
      { method: "GET" },
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
    const route = createNextRoute(
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
            count: "1",
          },
        })),
      { method: "GET" },
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

  it("accepts output schema input and exposes the transformed result to clients", async () => {
    const schema = z.object({ count: z.string().transform(Number) });
    const { GET } = procedure
      .forRoute(staticRouteContract)
      .output(schema)
      .handle(({ response }) => response.json({ count: "42" }))
      .get({ onError: defaultProcedureOnError });

    type ClientResponse = Awaited<
      ReturnType<
        DynamicPathProxyAsFunction<
          RpcGeneratedPathStructure<RpcEndpoint & { $get: typeof GET }>
        >["$get"]
      >
    >;
    type Success = Extract<ClientResponse, { status: 200 }>;
    type DirectSuccess = Extract<Awaited<ReturnType<typeof GET>>, { status: 200 }>;
    expectTypeOf<Awaited<ReturnType<DirectSuccess["json"]>>>().toEqualTypeOf<{
      count: number | null;
    }>();
    expectTypeOf<Awaited<ReturnType<Success["json"]>>>().toEqualTypeOf<{
      count: number | null;
    }>();
    const response = await GET(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 42 });
  });

  it("preserves successful input validation responses in client types and at runtime", async () => {
    const { GET } = procedure
      .forRoute(staticRouteContract)
      .query(z.object({ id: z.string() }), {
        onValidationError: ({ response }) => response.json({ message: "invalid" as const }, 200),
      })
      .output(z.object({ count: z.number() }))
      .handle(({ response }) => response.json({ count: 1 }, 200))
      .get({ onError: defaultProcedureOnError });

    type ClientResponse = Awaited<
      ReturnType<
        DynamicPathProxyAsFunction<
          RpcGeneratedPathStructure<RpcEndpoint & { $get: typeof GET }>
        >["$get"]
      >
    >;
    type Success = Extract<ClientResponse, { status: 200 }>;
    expectTypeOf<Awaited<ReturnType<Success["json"]>>>().toEqualTypeOf<
      { count: number | null } | { message: "invalid" }
    >();
    const response = await GET(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "invalid" });
  });

  it("preserves successful onError responses in client types and at runtime", async () => {
    const { GET } = procedure
      .forRoute(staticRouteContract)
      .output(z.object({ count: z.number() }))
      .handle(({ request, response }) => {
        if (request.nextUrl.searchParams.has("throw")) throw new Error("failed");

        return response.json({ count: 1 }, 200);
      })
      .get({
        onError: (_error, { response }) => response.json({ message: "failed" as const }, 200),
      });

    type ClientResponse = Awaited<
      ReturnType<
        DynamicPathProxyAsFunction<
          RpcGeneratedPathStructure<RpcEndpoint & { $get: typeof GET }>
        >["$get"]
      >
    >;
    type Success = Extract<ClientResponse, { status: 200 }>;
    expectTypeOf<Awaited<ReturnType<Success["json"]>>>().toEqualTypeOf<
      { count: number | null } | { message: "failed" }
    >();
    const response = await GET(new NextRequest("http://127.0.0.1:3000/api?throw=1"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "failed" });
  });

  it("exposes transformed JSON helper values from the route handler", async () => {
    const { GET } = procedure
      .forRoute(staticRouteContract)
      .output(z.string().transform(Number))
      .handle(({ response }) => response.json("42"))
      .get({ onError: defaultProcedureOnError });

    type Success = Extract<Awaited<ReturnType<typeof GET>>, { status: 200 }>;
    expectTypeOf<Awaited<ReturnType<Success["json"]>>>().toEqualTypeOf<number | null>();
    const response = await GET(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toBe(42);
  });

  it.each([{}, { status: 200 as const }])(
    "exposes a body produced from an empty success result: %j",
    async (result) => {
      const { GET } = procedure
        .forRoute(staticRouteContract)
        .output(z.undefined().transform(() => "ready" as const))
        .handle(() => result)
        .get({ onError: defaultProcedureOnError });

      type Success = Extract<Awaited<ReturnType<typeof GET>>, { status: 200 }>;
      expectTypeOf<Awaited<ReturnType<Success["text"]>>>().toEqualTypeOf<"ready">();
      const response = await GET(new NextRequest("http://127.0.0.1:3000/api"), {
        params: Promise.resolve({}),
      });
      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe("ready");
    },
  );

  it("reflects a transformed primitive body and its content type", async () => {
    const { GET } = procedure
      .forRoute(staticRouteContract)
      .output(z.string().transform(Number))
      .handle(() => ({ body: "42" }))
      .get({ onError: defaultProcedureOnError });

    type ClientResponse = Awaited<
      ReturnType<
        DynamicPathProxyAsFunction<
          RpcGeneratedPathStructure<RpcEndpoint & { $get: typeof GET }>
        >["$get"]
      >
    >;
    type Success = Extract<ClientResponse, { status: 200 }>;
    expectTypeOf<Awaited<ReturnType<Success["json"]>>>().toEqualTypeOf<number | null>();
    const response = await GET(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toBe(42);
  });

  it("distributes a union status between transformed success and unchanged failure bodies", async () => {
    const { GET } = procedure
      .forRoute(staticRouteContract)
      .output(z.string().transform(Number))
      .handle(({ request }) => ({
        status: request.nextUrl.searchParams.has("fail") ? (400 as const) : (200 as const),
        body: "42",
      }))
      .get({ onError: defaultProcedureOnError });

    type Result = Awaited<
      ReturnType<
        DynamicPathProxyAsFunction<
          RpcGeneratedPathStructure<RpcEndpoint & { $get: typeof GET }>
        >["$get"]
      >
    >;
    type Success = Extract<Result, { status: 200 }>;
    type Failure = Extract<Result, { status: 400 }>;
    expectTypeOf<Awaited<ReturnType<Success["json"]>>>().toEqualTypeOf<number | null>();
    expectTypeOf<Awaited<ReturnType<Failure["text"]>>>().toEqualTypeOf<string>();

    const success = await GET(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });
    const failure = await GET(new NextRequest("http://127.0.0.1:3000/api?fail=1"), {
      params: Promise.resolve({}),
    });
    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toBe(42);
    expect(failure.status).toBe(400);
    await expect(failure.text()).resolves.toBe("42");
  });

  it("normalizes invalid runtime output as INTERNAL_SERVER_ERROR", async () => {
    const onError = vi.fn<typeof defaultProcedureOnError>(defaultProcedureOnError);
    const route = createNextRoute(
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
      { method: "GET", onError },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: "Procedure output validation failed.",
      }),
      expect.any(Object),
    );
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  });

  it("validates response helper payloads when runtime output validation is enabled", async () => {
    const route = createNextRoute(
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
      { method: "GET" },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  });

  it.each(["Headers", "tuples"])(
    "preserves cookies after output parsing with %s",
    async (format) => {
      const cookies = [
        "session=abc; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT; HttpOnly",
        "theme=dark; Path=/; Expires=Thu, 22 Oct 2037 07:28:00 GMT",
      ];
      const tuples: [string, string][] = [
        ["Set-Cookie", cookies[0]],
        ["set-cookie", cookies[1]],
      ];
      const headersInit = format === "Headers" ? new Headers(tuples) : tuples;

      for (const kind of ["json", "text", "body"] as const) {
        const route = createNextRoute(
          procedure
            .forRoute(staticRouteContract)
            .output(z.string().transform((value) => value.toUpperCase()))
            .handle(async ({ response }) => {
              if (kind === "json") return response.json("draft-post", { headersInit });
              if (kind === "text") return response.text("draft-post", { headersInit });

              return response.body("draft-post", { headersInit });
            }),
          { method: "GET" },
        );
        const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
          params: Promise.resolve({}),
        });

        expect(response.status).toBe(200);
        expect(response.headers.getSetCookie()).toEqual(cookies);
        await expect(kind === "json" ? response.json() : response.text()).resolves.toBe(
          "DRAFT-POST",
        );
      }
    },
  );

  it("replaces response.json payloads with parsed output values", async () => {
    const route = createNextRoute(
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
      { method: "GET" },
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

  it.each(["json", "text", "body", "result"] as const)(
    "removes stale Content-Length after transforming a %s response",
    async (kind) => {
      const { GET } = procedure
        .forRoute(staticRouteContract)
        .output(z.string().transform((value) => `${value}-longer`))
        .handle(({ response }) => {
          const headers = { "content-length": "1", "x-preserved": "yes" };
          if (kind === "json") return response.json("a", { headersInit: headers });
          if (kind === "text") return response.text("a", { headersInit: headers });
          if (kind === "body") return response.body("a", { headersInit: headers });

          return { body: "a", headers };
        })
        .get({ onError: defaultProcedureOnError });

      const response = await GET(new NextRequest("http://127.0.0.1:3000/api"), {
        params: Promise.resolve({}),
      });
      expect(response.headers.get("content-length")).toBeNull();
      expect(response.headers.get("x-preserved")).toBe("yes");
      await expect(kind === "json" ? response.json() : response.text()).resolves.toBe("a-longer");
    },
  );

  it("preserves statusText when helper responses are rebuilt after output parsing", async () => {
    const jsonRoute = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.object({
            ok: z.literal(true),
            slug: z.string().transform((value) => value.toUpperCase()),
          }),
        )
        .handle(async ({ response }) =>
          response.json(
            {
              ok: true,
              slug: "draft-post",
            },
            { status: 201, statusText: "Created via helper" },
          ),
        ),
      { method: "GET" },
    );

    const jsonResponse = await jsonRoute(new NextRequest("http://127.0.0.1:3000/api/json"), {
      params: Promise.resolve({}),
    });

    expect(jsonResponse.status).toBe(201);
    expect(jsonResponse.statusText).toBe("Created via helper");
    await expect(jsonResponse.json()).resolves.toEqual({
      ok: true,
      slug: "DRAFT-POST",
    });

    const textRoute = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(z.string().transform((value) => value.toUpperCase()))
        .handle(async ({ response }) =>
          response.text("draft-post", {
            status: 202,
            statusText: "Accepted via helper",
          }),
        ),
      { method: "GET" },
    );

    const textResponse = await textRoute(new NextRequest("http://127.0.0.1:3000/api/text"), {
      params: Promise.resolve({}),
    });

    expect(textResponse.status).toBe(202);
    expect(textResponse.statusText).toBe("Accepted via helper");
    await expect(textResponse.text()).resolves.toBe("DRAFT-POST");

    const bodyRoute = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(z.string().transform((value) => value.toUpperCase()))
        .handle(async ({ response }) =>
          response.body("draft-post", {
            status: 203,
            statusText: "Non-Authoritative via helper",
          }),
        ),
      { method: "GET" },
    );

    const bodyResponse = await bodyRoute(new NextRequest("http://127.0.0.1:3000/api/body"), {
      params: Promise.resolve({}),
    });

    expect(bodyResponse.status).toBe(203);
    expect(bodyResponse.statusText).toBe("Non-Authoritative via helper");
    await expect(bodyResponse.text()).resolves.toBe("DRAFT-POST");
  });

  it("replaces response.body payloads with parsed output values", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(z.string().transform((value) => value.toUpperCase()))
        .handle(async ({ response }) => response.body("draft-post")),
      { method: "GET" },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("DRAFT-POST");
  });

  it("allows a parsed null value as an empty response.body", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(z.string().transform(() => null))
        .handle(async ({ response }) => response.body("draft-post")),
      { method: "GET" },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    await expect(response.text()).resolves.toBe("");
  });

  it("fails response.body output validation when parsed values cannot be reflected", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.string().transform((value) => ({
            slug: value.toUpperCase(),
          })),
        )
        .handle(async ({ response }) => response.body("draft-post")),
      { method: "GET" },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  });

  it("rejects non-string parsed values for response.text", async () => {
    const onError = vi.fn<typeof defaultProcedureOnError>(defaultProcedureOnError);
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(z.string().transform((value) => new Blob([value])))
        .handle(async ({ response }) => response.text("draft-post")),
      { method: "GET", onError },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message:
          "Procedure output validation produced a value that cannot be reflected by response.text(...).",
      }),
      expect.any(Object),
    );
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  });

  it("rejects raw successful responses when runtime output validation is enabled", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          z.object({
            ok: z.literal(true),
            slug: z.string().transform((value) => value.toUpperCase()),
          }),
        )
        .handle(async () => {
          return new Response(JSON.stringify({ ok: true, slug: "raw-response" }), {
            status: 202,
            headers: {
              "content-type": "application/json",
            },
          });
        }),
      { method: "GET" },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  });

  it("validates an undefined success body against the output schema", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(z.string())
        // @ts-expect-error Exercise runtime validation when the handler violates its output contract.
        .handle(async () => ({})),
      { method: "GET" },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
  });

  it("allows an empty success body when the output schema accepts undefined", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(z.undefined())
        .handle(async () => ({})),
      { method: "GET" },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("does not apply successful output transforms to status 300 responses", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(z.string().transform((value) => value.toUpperCase()))
        .handle(async () => ({
          status: 300 as const,
          body: "multiple choices",
        })),
      { method: "GET" },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(300);
    await expect(response.text()).resolves.toBe("multiple choices");
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

    const baseRoute = createNextRoute(
      baseProcedure.handle(async ({ ctx }) => ({
        body: {
          ok: true,
          role: ctx.viewer.role,
          source: "base",
        },
      })),
      { method: "GET" },
    );

    const extendedRoute = createNextRoute(
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

    const route = createNextRoute(
      baseProcedure.handle(async ({ query }) => ({
        body: {
          page: query.page,
        },
      })),
      { method: "GET" },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=0"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      source: "shared-base",
      target: "query",
    });
  });
});

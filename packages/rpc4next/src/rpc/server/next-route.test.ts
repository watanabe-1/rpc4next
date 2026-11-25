import { notFound, permanentRedirect, redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createNextRoute as basecreateNextRoute } from "./next-route";
import { defaultProcedureOnError } from "./on-error";
import { createRouteProcedure, procedure } from "./procedure";
import { getProcedureDefinition } from "./procedure-definition";
import type { ProcedureRouteContract } from "./procedure-types";
import type { StandardSchemaV1 } from "./standard-schema";

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

describe("createNextRoute", () => {
  it("creates an executable HEAD handler", async () => {
    const handler = vi.fn<() => { status: 204 }>(() => ({ status: 204 }));
    const { HEAD } = createRouteProcedure({ onError: defaultProcedureOnError })
      .forRoute(staticRouteContract)
      .handle(handler)
      .head();

    const response = await HEAD(new NextRequest("http://localhost/api", { method: "HEAD" }), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each(["PUT", "PATCH", "DELETE"] as const)(
    "creates an executable %s handler",
    async (method) => {
      const handler = vi.fn<() => { status: 204 }>(() => ({ status: 204 }));
      const handled = createRouteProcedure({ onError: defaultProcedureOnError })
        .forRoute(staticRouteContract)
        .handle(handler);
      const route = {
        PUT: () => handled.put().PUT,
        PATCH: () => handled.patch().PATCH,
        DELETE: () => handled.delete().DELETE,
      }[method]();

      const response = await route(new NextRequest("http://localhost/api", { method }), {
        params: Promise.resolve({}),
      });

      expect(response.status).toBe(204);
      expect(handler).toHaveBeenCalledOnce();
    },
  );

  it.each([false, true])(
    "returns an empty handler result without onError (async: %s)",
    async (asyncHandler) => {
      for (const [result, status] of [
        [{}, 200],
        [{ body: undefined }, 200],
        [{ status: 204 as const }, 204],
      ] as const) {
        const onError = vi.fn<typeof defaultProcedureOnError>(defaultProcedureOnError);
        const { GET } = createRouteProcedure({ onError })
          .forRoute(staticRouteContract)
          .handle(asyncHandler ? async () => result : () => result)
          .get();

        const response = await GET(new NextRequest("http://localhost/api"), {
          params: Promise.resolve({}),
        });

        expect(response.status).toBe(status);
        expect(response.body).toBeNull();
        await expect(response.text()).resolves.toBe("");
        expect(onError).not.toHaveBeenCalled();
      }
    },
  );

  it("continues through empty and context middleware before an empty handler result", async () => {
    const handler = vi.fn<(ctx: { user: string }) => object>((ctx) => {
      expect(ctx.user).toBe("reader");

      return {};
    });
    const { GET } = createRouteProcedure({ onError: defaultProcedureOnError })
      .forRoute(staticRouteContract)
      .use(() => undefined)
      .use(() => ({}))
      .use(() => ({ ctx: { user: "reader" } }))
      .handle(({ ctx }) => handler(ctx))
      .get();

    const response = await GET(new NextRequest("http://localhost/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each([{ body: undefined }, { status: 204 as const }])(
    "short-circuits an explicit empty middleware response %j",
    async (result) => {
      const laterMiddleware = vi.fn<() => undefined>(() => undefined);
      const handler = vi.fn<() => object>(() => ({}));
      const { GET } = createRouteProcedure({ onError: defaultProcedureOnError })
        .forRoute(staticRouteContract)
        .use(() => result)
        .use(laterMiddleware)
        .handle(handler)
        .get();

      const response = await GET(new NextRequest("http://localhost/api"), {
        params: Promise.resolve({}),
      });

      expect(response.status).toBe("status" in result ? result.status : 200);
      expect(response.body).toBeNull();
      expect(laterMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    },
  );

  type EmptyParams = Record<never, never>;

  const staticRouteContract = {
    pathname: "/api/test",
    params: {} as EmptyParams,
  } as ProcedureRouteContract<"/api/test", EmptyParams>;

  const pageSchema: StandardSchemaV1<{ page?: string | string[] }, { page: number }> = {
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

  const outputSchema: StandardSchemaV1<{ ok: boolean; slug: string }, { ok: true; slug: string }> =
    {
      "~standard": {
        version: 1,
        vendor: "rpc4next-test",
        types: {
          input: {} as { ok: boolean; slug: string },
          output: {} as { ok: true; slug: string },
        },
        validate: (value) => {
          const input =
            typeof value === "object" && value !== null
              ? (value as { ok?: boolean; slug?: string })
              : {};

          if (input.ok !== true || typeof input.slug !== "string") {
            return {
              issues: [{ message: "ok must be true and slug must be a string" }],
            };
          }

          return {
            value: {
              ok: true as const,
              slug: input.slug,
            },
          };
        },
      },
    };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an object keyed by the configured Next.js HTTP method", async () => {
    const routes = basecreateNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .handle(async ({ response }) => response.text("object route")),
      {
        method: "GET",
        onError: defaultProcedureOnError,
      },
    );

    expect(Object.keys(routes)).toEqual(["GET"]);
    expect(routes).not.toHaveProperty("POST");

    const response = await routes.GET(new NextRequest("http://127.0.0.1:3000/api/test"), {
      params: Promise.resolve({}),
    });

    await expect(response.text()).resolves.toBe("object route");
  });

  it("does not resolve params when no params contract is declared", async () => {
    const readParams = vi.fn<() => void>();
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .handle(async ({ response }) => response.text("no params")),
    );
    const segmentData = {
      get params() {
        readParams();

        return Promise.resolve({});
      },
    } as { params: Promise<EmptyParams> };

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test"), segmentData);

    expect(readParams).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe("no params");
  });

  it("supports injected procedure validators", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(pageSchema)
        .handle(async ({ query }) => ({
          body: query,
        })),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/procedure?page=2"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      page: 2,
    });
  });

  it("returns typed procedure errors with the default envelope", async () => {
    const route = createNextRoute(
      procedure.forRoute(staticRouteContract).handle(async ({ response }) => {
        return response.error("FORBIDDEN", {
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

  it("lets a route-level onError replace the default envelope", async () => {
    const onError = vi.fn<(error: unknown, context: { response: typeof NextResponse }) => Response>(
      (error: unknown, { response }) => {
        if (error instanceof Error) {
          return response.json(
            {
              success: false,
              message: error.message,
            },
            { status: 500 },
          );
        }

        return response.json(
          {
            success: false,
            message: "unexpected",
          },
          { status: 500 },
        );
      },
    );
    const route = createNextRoute(
      procedure.forRoute(staticRouteContract).handle(async () => {
        throw new Error("custom onError");
      }),
      {
        onError,
      },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "custom onError",
    });
  });

  describe.each(["handler", "middleware"] as const)("errors from %s", (source) => {
    it.each([
      { name: "redirect", navigate: () => redirect("/login") },
      {
        name: "permanentRedirect",
        navigate: () => permanentRedirect("/login"),
      },
      { name: "notFound", navigate: () => notFound() },
    ])("rethrows $name before onError", async ({ navigate }) => {
      const onError = vi.fn<() => Response>(() => new Response("unexpected", { status: 500 }));
      let navigationError: unknown;
      const interrupt = () => {
        try {
          navigate();
        } catch (error) {
          navigationError = error;
          throw error;
        }
      };
      const route = createNextRoute(
        procedure
          .forRoute(staticRouteContract)
          .use(async () => {
            if (source === "middleware") interrupt();
          })
          .handle(async ({ response }) => {
            if (source === "handler") interrupt();

            return response.text("unexpected success");
          }),
        { onError },
      );

      const result = route(new NextRequest("http://127.0.0.1:3000/api/test"), {
        params: Promise.resolve({}),
      });

      await expect(result).rejects.toBeInstanceOf(Error);
      await expect(result).rejects.toBe(navigationError);
      expect(onError).not.toHaveBeenCalled();
    });

    it("returns the onError response for ordinary errors", async () => {
      const error = new Error("ordinary failure");
      const fallback = new Response("handled failure", { status: 500 });
      const onError = vi.fn<() => Response>(() => fallback);
      const route = createNextRoute(
        procedure
          .forRoute(staticRouteContract)
          .use(async () => {
            if (source === "middleware") throw error;
          })
          .handle(async () => {
            throw error;
          }),
        { onError },
      );

      const response = await route(new NextRequest("http://127.0.0.1:3000/api/test"), {
        params: Promise.resolve({}),
      });

      expect(onError).toHaveBeenCalledExactlyOnceWith(error, expect.any(Object));
      expect(response).toBe(fallback);
      expect(response.status).toBe(500);
      await expect(response.text()).resolves.toBe("handled failure");
    });
  });

  it("passes thrown Response values through onError for the final decision", async () => {
    const onError = vi.fn<(error: unknown) => Response>((error: unknown) =>
      error instanceof Response ? error : new Response("unexpected", { status: 500 }),
    );
    const route = createNextRoute(
      procedure.forRoute(staticRouteContract).handle(async () => {
        throw new Response("blocked", { status: 418 });
      }),
      {
        onError,
      },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(418);
    await expect(response.text()).resolves.toBe("blocked");
  });

  it("preserves a thrown Response through the default error handler", async () => {
    const thrown = new Response("blocked", {
      status: 418,
      headers: { "x-reason": "policy" },
    });
    const route = createNextRoute(
      procedure.forRoute(staticRouteContract).handle(() => {
        throw thrown;
      }),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response).toBe(thrown);
    expect(response.status).toBe(418);
    expect(response.headers.get("x-reason")).toBe("policy");
    await expect(response.text()).resolves.toBe("blocked");
  });

  it("can attach an explicit method to the generated route contract", () => {
    const route = createNextRoute(
      procedure.forRoute(staticRouteContract).handle(async () => ({
        status: 204 as const,
      })),
      { method: "GET" },
    );

    expect(getProcedureDefinition(route)).toMatchObject({ method: "GET" });
  });

  it("serializes malformed JSON bodies as BAD_REQUEST errors", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .json({
          "~standard": {
            version: 1,
            vendor: "rpc4next-test",
            validate: (value) => ({
              value: value as { title: string },
            }),
            types: {
              input: {} as { title: string },
              output: {} as { title: string },
            },
          },
        })
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

  it("serializes malformed multipart bodies as BAD_REQUEST errors", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .formData({
          "~standard": {
            version: 1,
            vendor: "rpc4next-test",
            validate: (value) => ({ value }),
          },
        })
        .handle(async () => ({ body: "unexpected" })),
      { method: "POST" },
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api", {
        method: "POST",
        body: "not a multipart body",
        headers: {
          "content-type": "multipart/form-data; boundary=test-boundary",
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "BAD_REQUEST", message: "Invalid form-data body." },
    });
  });

  it.each(["json", "formData"] as const)(
    "runs the input hook for malformed %s before the shared hook",
    async (target) => {
      const local = vi.fn(({ kind, target, response }) => response.json({ kind, target }, 422));
      const shared = vi.fn(() => {
        throw new Error("shared hook called");
      });
      const schema = {
        "~standard": {
          version: 1 as const,
          vendor: "test",
          validate: vi.fn((value: unknown) => ({ value })),
        },
      };
      const base = createRouteProcedure({
        onError: defaultProcedureOnError,
        onValidationError: shared,
      }).forRoute(staticRouteContract);
      const input =
        target === "json"
          ? base.json(schema, { onValidationError: local }).handle(() => ({ body: "unexpected" }))
          : base
              .formData(schema, { onValidationError: local })
              .handle(() => ({ body: "unexpected" }));
      const route = createNextRoute(input, { method: "POST" });
      const result = await route(
        new NextRequest("http://localhost/api", {
          method: "POST",
          body: target === "json" ? "{" : "invalid",
          headers: {
            "content-type":
              target === "json" ? "application/json" : "multipart/form-data; boundary=test",
          },
        }),
        { params: Promise.resolve({}) },
      );
      expect(result.status).toBe(422);
      await expect(result.json()).resolves.toEqual({ kind: "parse", target });
      expect(local).toHaveBeenCalledOnce();
      expect(shared).not.toHaveBeenCalled();
      expect(schema["~standard"].validate).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    "uses the shared parse hook and falls back when it returns no response: %s",
    async (returnsResponse) => {
      const hook = vi.fn(({ response }) =>
        returnsResponse ? response.text("custom", 422) : undefined,
      );
      const schema = {
        "~standard": {
          version: 1 as const,
          vendor: "test",
          validate: (value: unknown) => ({ value }),
        },
      };
      const { POST } = createRouteProcedure({
        onError: defaultProcedureOnError,
        onValidationError: hook,
      })
        .forRoute(staticRouteContract)
        .json(schema)
        .handle(() => ({ body: "unexpected" }))
        .post();
      const result = await POST(
        new NextRequest("http://localhost/api", {
          method: "POST",
          body: "{",
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({}) },
      );
      expect(hook).toHaveBeenCalledOnce();
      expect(hook.mock.calls[0]?.[0]).toMatchObject({
        kind: "parse",
        target: "json",
      });
      expect(result.status).toBe(returnsResponse ? 422 : 400);
      expect(await result.text()).toBe(
        returnsResponse
          ? "custom"
          : JSON.stringify({ error: { code: "BAD_REQUEST", message: "Invalid JSON body." } }),
      );
    },
  );

  it("uses a fallback message when input validation returns an empty issue list", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query({
          "~standard": {
            version: 1,
            vendor: "rpc4next-test",
            validate: () => ({ issues: [] }),
          },
        })
        .handle(async () => ({ body: "unexpected" })),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "BAD_REQUEST", message: "Validation failed." },
    });
  });

  it("keeps prototype-like formData keys as data properties", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .formData({
          "~standard": {
            version: 1,
            vendor: "rpc4next-test",
            validate: (value) => {
              if (
                typeof value === "object" &&
                value !== null &&
                Object.getPrototypeOf(value) === null
              ) {
                return {
                  value: {
                    proto: (value as Record<string, string>).__proto__,
                    constructor: (value as Record<string, string>).constructor,
                  },
                };
              }

              return {
                issues: [{ message: "expected a null-prototype formData object" }],
              };
            },
          },
        })
        .handle(async ({ formData }) => ({
          body: formData,
        })),
      { method: "POST" },
    );

    const body = new FormData();
    body.append("__proto__", "polluted");
    body.append("constructor", "value");

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api", {
        method: "POST",
        body,
      }),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      proto: "polluted",
      constructor: "value",
    });
  });

  it("preserves raw Response escape hatches", async () => {
    const route = createNextRoute(
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

  it("requires Standard Schema output contracts when runtime validation is enabled", () => {
    expect(() =>
      createNextRoute(
        procedure
          .forRoute(staticRouteContract)
          .output({
            // @ts-expect-error Invalid schemas are rejected by the type system.
            _output: {
              ok: true as const,
            },
          })
          .handle(async () => ({
            body: {
              ok: true,
            },
          })),
        { method: "GET" },
      ),
    ).toThrow("Procedure output contracts must implement Standard Schema V1 when declared.");
  });

  it.each([
    ["null", null],
    ["a primitive", "invalid"],
    ["null metadata", { "~standard": null }],
    ["primitive metadata", { "~standard": "invalid" }],
    ["a non-function validator", { "~standard": { validate: "invalid" } }],
  ])("rejects %s as a runtime output schema", (_description, schema) => {
    expect(() =>
      createNextRoute(
        procedure
          .forRoute(staticRouteContract)
          // @ts-expect-error Invalid schemas are rejected by the type system.
          .output(schema)
          .handle(async () => ({ body: "value" })),
        { method: "GET" },
      ),
    ).toThrow("Procedure output contracts must implement Standard Schema V1 when declared.");
  });

  it("supports redirects from normalized procedure results", async () => {
    const route = createNextRoute(
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

  it("preserves a redirect result's status and headers", async () => {
    const route = createNextRoute(
      procedure.forRoute(staticRouteContract).handle(async () => ({
        redirect: "http://127.0.0.1:3000/feed",
        status: 308 as const,
        headers: { "x-reason": "moved" },
      })),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/feed");
    expect(response.headers.get("x-reason")).toBe("moved");
  });

  it("returns a string procedure result as text with its status and headers", async () => {
    const route = createNextRoute(
      procedure.forRoute(staticRouteContract).handle(async () => ({
        body: "hello",
        status: 201 as const,
        headers: { "x-result": "created" },
      })),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("x-result")).toBe("created");
    await expect(response.text()).resolves.toBe("hello");
  });

  it("short-circuits middleware responses before later middleware or handler execution", async () => {
    const laterMiddleware = vi.fn<() => { ctx: { reached: boolean } }>(() => ({
      ctx: { reached: true },
    }));
    const handler = vi.fn<() => Promise<{ body: { ok: boolean } }>>(async () => ({
      body: { ok: true },
    }));
    const route = createNextRoute(
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

  it("preserves middleware error responses as terminal results", async () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .use(({ response }) => {
          return response.error("UNAUTHORIZED", {
            message: "middleware-denied",
            details: {
              reason: "missing_demo_user" as const,
            },
          });
        })
        .handle(async () => ({
          status: 204 as const,
        })),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "middleware-denied",
        details: {
          reason: "missing_demo_user",
        },
      },
    });
  });

  it("includes implicit BAD_REQUEST responses for validated procedure routes", () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(pageSchema)
        .handle(async ({ query }) => ({
          body: {
            ok: true as const,
            includePosts: query.page > 0,
          },
        })),
    );

    type ActualResponse = Awaited<ReturnType<typeof route>>;
    expectTypeOf<ActualResponse>().toExtend<Response>();
  });

  it("reflects helper-based custom validation json responses in the route type", () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(pageSchema, {
          onValidationError: ({ response, target }) =>
            response.json(
              {
                ok: false as const,
                target,
              },
              { status: 422 },
            ),
        })
        .handle(async ({ query }) => ({
          body: {
            ok: true as const,
            page: query.page,
          },
        })),
    );

    type ActualResponse = Awaited<ReturnType<typeof route>>;
    expectTypeOf<ActualResponse>().toExtend<Response>();
  });

  it("reflects helper-based custom validation text responses in the route type", () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(pageSchema, {
          onValidationError: ({ response, target }) =>
            response.text(`validator:${target}`, { status: 422 }),
        })
        .handle(async ({ query }) => ({
          body: {
            ok: true as const,
            page: query.page,
          },
        })),
    );

    type ActualResponse = Awaited<ReturnType<typeof route>>;
    expectTypeOf<ActualResponse>().toExtend<Response>();
  });

  it("supports procedure.handle(...).get(...) as method terminal sugar", async () => {
    const onError = vi.fn<typeof defaultProcedureOnError>(defaultProcedureOnError);
    const { GET: route } = procedure
      .forRoute(staticRouteContract)
      .query(pageSchema)
      .handle(async ({ query }) => ({
        body: {
          page: query.page,
        },
      }))
      .get({
        onError,
      });

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=2"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      page: 2,
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps the internal createNextRoute adapter aligned with procedure method terminals", async () => {
    const standaloneProcedure = procedure
      .forRoute(staticRouteContract)
      .handle(async ({ response }) => response.text("standalone"));
    const sugarProcedure = procedure
      .forRoute(staticRouteContract)
      .handle(async ({ response }) => response.text("sugar"));

    const standaloneRoute = createNextRoute(standaloneProcedure, {
      method: "GET",
    });
    const { GET: sugarRoute } = sugarProcedure.get({
      onError: defaultProcedureOnError,
    });

    await expect(
      standaloneRoute(new NextRequest("http://127.0.0.1:3000/api/test"), {
        params: Promise.resolve({}),
      }).then((response) => response.text()),
    ).resolves.toBe("standalone");

    await expect(
      sugarRoute(new NextRequest("http://127.0.0.1:3000/api/test"), {
        params: Promise.resolve({}),
      }).then((response) => response.text()),
    ).resolves.toBe("sugar");
  });

  it("applies validateOutput through procedure method terminals", async () => {
    const { GET: route } = procedure
      .forRoute(staticRouteContract)
      .output(outputSchema)
      .handle(async () => ({
        body: {
          ok: false,
          slug: "draft",
        },
      }))
      .get({
        onError: defaultProcedureOnError,
      });

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test"), {
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

  it("preserves raw validation error responses in runtime and route types", async () => {
    const rawResponseRoute = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(pageSchema, {
          onValidationError: () =>
            new Response("validator:raw", {
              status: 422,
              headers: {
                "content-type": "text/plain",
              },
            }),
        })
        .handle(async ({ query }) => ({
          body: {
            ok: true as const,
            page: query.page,
          },
        })),
    );

    const response = await rawResponseRoute(
      new NextRequest("http://127.0.0.1:3000/api/test?page=0"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(422);
    await expect(response.text()).resolves.toBe("validator:raw");

    type RawResponseRouteResponse = Awaited<ReturnType<typeof rawResponseRoute>>;
    expectTypeOf<RawResponseRouteResponse>().toExtend<Response>();

    const rawNextResponseRoute = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(pageSchema, {
          onValidationError: ({ target }) =>
            NextResponse.json(
              {
                ok: false as const,
                target,
              },
              { status: 422 },
            ),
        })
        .handle(async ({ query }) => ({
          body: {
            ok: true as const,
            page: query.page,
          },
        })),
    );

    type RawNextResponseRouteResponse = Awaited<ReturnType<typeof rawNextResponseRoute>>;
    expectTypeOf<RawNextResponseRouteResponse>().toExtend<Response>();
  });

  it("includes implicit INTERNAL_SERVER_ERROR responses for runtime-enforced output routes", () => {
    const route = createNextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output({
          "~standard": {
            version: 1,
            vendor: "rpc4next-test",
            validate: (value: unknown) => ({ value: value as { ok: true } }),
            types: {
              input: {} as unknown,
              output: {} as { ok: true },
            },
          },
        })
        .handle(async () => ({
          body: {
            ok: true,
          },
        })),
      { method: "GET" },
    );

    type ActualResponse = Awaited<ReturnType<typeof route>>;
    expectTypeOf<ActualResponse>().toExtend<Response>();
  });
});

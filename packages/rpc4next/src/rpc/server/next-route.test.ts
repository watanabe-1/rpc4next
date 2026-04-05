import { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { rpcError } from "./error";
import { nextRoute as baseNextRoute } from "./next-route";
import { defaultProcedureOnError } from "./on-error";
import { defineProcedureMiddleware, procedure } from "./procedure";
import {
  getProcedureDefinition,
  type ProcedureRouteContract,
} from "./procedure-types";
import type { StandardSchemaV1 } from "./standard-schema";

const nextRoute = <
  TProcedure,
  TMethod extends HttpMethod | undefined = undefined,
  TValidateOutput extends boolean = false,
>(
  procedureDefinition: TProcedure,
  options?: {
    method?: Exclude<TMethod, undefined>;
    validateOutput?: TValidateOutput;
    onError?: unknown;
  },
) => {
  const resolvedOptions =
    options && "onError" in options
      ? options
      : { ...(options ?? {}), onError: defaultProcedureOnError };

  return baseNextRoute<
    TProcedure & Parameters<typeof baseNextRoute>[0],
    TMethod,
    TValidateOutput
  >(procedureDefinition as never, resolvedOptions as never);
};

describe("nextRoute", () => {
  type EmptyParams = Record<never, never>;

  const staticRouteContract = {
    pathname: "/api/test",
    params: {} as EmptyParams,
  } as ProcedureRouteContract<"/api/test", EmptyParams>;

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

  const outputSchema: StandardSchemaV1<
    { ok: boolean; slug: string },
    { ok: true; slug: string }
  > = {
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

  it("supports injected procedure validators", async () => {
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

  it("lets a route-level onError replace the default envelope", async () => {
    const onError = vi.fn((error: unknown, { response }) => {
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
    });
    const route = nextRoute(
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

  it("passes thrown Response values through onError for the final decision", async () => {
    const onError = vi.fn((error: unknown) =>
      error instanceof Response
        ? error
        : new Response("unexpected", { status: 500 }),
    );
    const route = nextRoute(
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

  it("can attach an explicit method to the generated route contract", () => {
    const route = nextRoute(
      procedure.forRoute(staticRouteContract).handle(async () => ({
        status: 204 as const,
      })),
      { method: "GET" },
    );

    expect(getProcedureDefinition(route)).toMatchObject({ method: "GET" });
  });

  it("serializes malformed JSON bodies as BAD_REQUEST errors", async () => {
    const route = nextRoute(
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

  it("preserves middleware-thrown RpcError responses through required onError", async () => {
    const guardedMiddleware = defineProcedureMiddleware(() => {
      throw rpcError("UNAUTHORIZED", {
        message: "middleware-denied",
        details: {
          reason: "missing_demo_user" as const,
        },
      });
    });

    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .use(guardedMiddleware)
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
    const route = nextRoute(
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
    const route = nextRoute(
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
    const route = nextRoute(
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

  it("supports procedure.handle(...).nextRoute(...) as thin sugar", async () => {
    const onError = vi.fn(defaultProcedureOnError);
    const route = procedure
      .forRoute(staticRouteContract)
      .query(pageSchema)
      .handle(async ({ query }) => ({
        body: {
          page: query.page,
        },
      }))
      .nextRoute({
        method: "GET",
        onError,
      });

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test?page=2"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      page: 2,
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps standalone nextRoute(...) available alongside procedure.nextRoute(...)", async () => {
    const standaloneProcedure = procedure
      .forRoute(staticRouteContract)
      .handle(async ({ response }) => response.text("standalone"));
    const sugarProcedure = procedure
      .forRoute(staticRouteContract)
      .handle(async ({ response }) => response.text("sugar"));

    const standaloneRoute = nextRoute(standaloneProcedure, {
      method: "GET",
    });
    const sugarRoute = sugarProcedure.nextRoute({
      method: "GET",
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

  it("applies validateOutput through procedure.nextRoute(...)", async () => {
    const route = procedure
      .forRoute(staticRouteContract)
      .output<typeof outputSchema, unknown>(outputSchema)
      .handle(async () => ({
        body: {
          ok: false,
          slug: "draft",
        },
      }))
      .nextRoute({
        method: "GET",
        validateOutput: true,
        onError: defaultProcedureOnError,
      });

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Procedure output validation failed.",
        details: [{ message: "ok must be true and slug must be a string" }],
      },
    });
  });

  it("preserves raw validation error responses in runtime and route types", async () => {
    const rawResponseRoute = nextRoute(
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

    type RawResponseRouteResponse = Awaited<
      ReturnType<typeof rawResponseRoute>
    >;
    expectTypeOf<RawResponseRouteResponse>().toExtend<Response>();

    const rawNextResponseRoute = nextRoute(
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

    type RawNextResponseRouteResponse = Awaited<
      ReturnType<typeof rawNextResponseRoute>
    >;
    expectTypeOf<RawNextResponseRouteResponse>().toExtend<Response>();
  });

  it("includes implicit INTERNAL_SERVER_ERROR responses for runtime-enforced output routes", () => {
    const route = nextRoute(
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
      { method: "GET", validateOutput: true },
    );

    type ActualResponse = Awaited<ReturnType<typeof route>>;
    expectTypeOf<ActualResponse>().toExtend<Response>();
  });
});

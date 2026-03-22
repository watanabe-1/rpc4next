import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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
        .query(pageSchema)
        .handle(async ({ query }) => ({
          body: {
            ok: true as const,
            includePosts: query.page > 0,
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
    type ExpectedResponse =
      | TypedNextResponse<
          {
            ok: true;
            page: number;
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
        >
      | TypedNextResponse<
          {
            ok: false;
            target: "query";
          },
          422,
          "application/json"
        >;
    const _fromActual: ExpectedResponse = {} as ActualResponse;
    const _fromExpected: ActualResponse = {} as ExpectedResponse;

    void _fromActual;
    void _fromExpected;
    expect(true).toBe(true);
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
    type ExpectedResponse =
      | TypedNextResponse<
          {
            ok: true;
            page: number;
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
        >
      | TypedNextResponse<"validator:query", 422, "text/plain">;
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

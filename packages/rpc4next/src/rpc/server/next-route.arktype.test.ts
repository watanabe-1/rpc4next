import { type as arktype } from "arktype";
import { NextRequest } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import { describe, expect, it } from "vitest";
import { nextRoute as baseNextRoute } from "./next-route";
import { defaultProcedureOnError } from "./on-error";
import { procedure } from "./procedure";
import type { ProcedureRouteContract } from "./procedure-types";
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

describe("nextRoute arktype integration", () => {
  type EmptyParams = Record<never, never>;

  const staticRouteContract = {
    pathname: "/api/test",
    params: {} as EmptyParams,
  } as ProcedureRouteContract<"/api/test", EmptyParams>;

  it("normalizes json, headers, and cookies for arktype contracts", async () => {
    const jsonSchema: StandardSchemaV1<{ title: string }, { title: string }> =
      arktype({
        title: "string",
      });
    const headerSchema: StandardSchemaV1<
      { "x-request-id": string },
      { "x-request-id": string }
    > = arktype({
      "x-request-id": "string",
    });
    const cookieSchema: StandardSchemaV1<
      { session: string },
      { session: string }
    > = arktype({
      session: "string",
    });

    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .json(jsonSchema)
        .headers(headerSchema)
        .cookies(cookieSchema)
        .handle(async ({ json, headers, cookies }) => ({
          body: {
            title: json.title,
            requestId: headers["x-request-id"],
            session: cookies.session,
          },
        })),
      { method: "POST" },
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test", {
        method: "POST",
        body: JSON.stringify({ title: "arktype-json" }),
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-arktype",
          cookie: "session=cookie-arktype",
        },
      }),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      title: "arktype-json",
      requestId: "req-arktype",
      session: "cookie-arktype",
    });
  });

  it("accepts arktype input contracts at the Standard Schema boundary", async () => {
    const pageSchema: StandardSchemaV1<{ page: string }, { page: string }> =
      arktype({ page: "string" });

    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(pageSchema)
        .handle(async ({ query }) => {
          const _query: { page: string } = query;

          void _query;

          return {
            body: {
              page: query.page,
            },
          };
        }),
    );

    const success = await route(
      new NextRequest("http://127.0.0.1:3000/api/test?page=ark"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toEqual({
      page: "ark",
    });

    const failure = await route(
      new NextRequest("http://127.0.0.1:3000/api/test"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(failure.status).toBe(400);
    const payload = await failure.json();
    expect(payload).toMatchObject({
      error: {
        code: "BAD_REQUEST",
      },
    });
  });

  it("validates arktype output contracts when runtime output validation is enabled", async () => {
    const outputSchema: StandardSchemaV1<unknown, { ok: boolean }> = arktype({
      ok: "boolean",
    });

    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(outputSchema)
        .handle(async ({ response }) =>
          response.json({
            ok: true,
          }),
        ),
      { method: "GET", validateOutput: true },
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
    });
  });

  it("normalizes invalid arktype runtime output as INTERNAL_SERVER_ERROR", async () => {
    const outputSchema: StandardSchemaV1<unknown, { count: number }> = arktype({
      count: "number > 0",
    });

    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(outputSchema)
        .handle(async () => ({
          body: {
            count: 0,
          },
        })),
      { method: "GET", validateOutput: true },
    );

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
        details: expect.any(Array),
      },
    });
  });

  it("supports validator-stage customization on shared arktype baseProcedure presets", async () => {
    const pageSchema: StandardSchemaV1<{ page: string }, { page: string }> =
      arktype({
        page: "string",
      });

    const baseProcedure = procedure
      .forRoute(staticRouteContract)
      .query(pageSchema, {
        onValidationError: ({ response, target }) =>
          response.json(
            {
              source: "arktype-base",
              target,
            },
            { status: 409 },
          ),
      });

    const route = nextRoute(
      baseProcedure.handle(async ({ query }) => ({
        body: {
          page: query.page,
        },
      })),
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      source: "arktype-base",
      target: "query",
    });
  });
});

import { NextRequest } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import * as v from "valibot";
import { describe, expect, expectTypeOf, it } from "vitest";
import { nextRoute as baseNextRoute } from "./next-route";
import { defaultProcedureOnError } from "./on-error";
import { procedure } from "./procedure";
import type { ProcedureRouteContract } from "./procedure-types";
import type { TypedNextResponse } from "./types";

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

describe("procedure builder valibot integration", () => {
  type EmptyParams = Record<never, never>;

  const staticRouteContract = {
    pathname: "/api/test",
    params: {} as EmptyParams,
  } as ProcedureRouteContract<"/api/test", EmptyParams>;

  it("accepts valibot schemas as direct procedure query contracts", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(
          v.object({
            page: v.string(),
          }),
          {
            onValidationError: ({ response, target, issues }) =>
              response.json(
                {
                  vendor: "valibot",
                  target,
                  issueCount: issues.length,
                },
                { status: 422 },
              ),
          },
        )
        .handle(async ({ query }) => ({
          body: {
            page: query.page,
          },
        })),
    );

    const success = await route(
      new NextRequest("http://127.0.0.1:3000/api/test?page=2"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toEqual({
      page: "2",
    });

    const failure = await route(
      new NextRequest("http://127.0.0.1:3000/api/test"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(failure.status).toBe(422);
    await expect(failure.json()).resolves.toEqual({
      vendor: "valibot",
      target: "query",
      issueCount: 1,
    });
  });

  it("types response helpers from valibot output contracts", () => {
    const outputSchema = v.object({
      ok: v.literal(true),
      vendor: v.literal("valibot"),
    });

    procedure.output(outputSchema).handle(({ response }) => {
      const jsonResponse = response.json({
        ok: true,
        vendor: "valibot",
      });

      expectTypeOf(jsonResponse).toEqualTypeOf<
        TypedNextResponse<
          {
            ok: true;
            vendor: "valibot";
          },
          200,
          "application/json"
        >
      >();

      response.json({
        // @ts-expect-error valibot output contracts should shape response.json payloads
        ok: false,
        vendor: "valibot",
      });

      return jsonResponse;
    });

    expect(true).toBe(true);
  });
});

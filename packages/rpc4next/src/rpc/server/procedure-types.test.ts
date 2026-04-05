import { NextRequest } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import { describe, expect, expectTypeOf, it } from "vitest";
import { nextRoute as baseNextRoute } from "./next-route";
import { defaultProcedureOnError } from "./on-error";
import { procedure } from "./procedure";
import {
  getProcedureDefinition,
  type ProcedureDefinition,
  type ProcedureInputContract,
  type ProcedureRouteContract,
  procedureDefinitionSymbol,
} from "./procedure-types";
import type { ValidationSchema } from "./route-types";
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

describe("procedure contract internals", () => {
  it("attaches an internal procedure definition to route handlers", async () => {
    const routeContract = {
      pathname: "/api/test",
      params: {} as Record<never, never>,
    } as ProcedureRouteContract<"/api/test", Record<never, never>>;
    const handler = nextRoute(
      procedure
        .forRoute(routeContract)
        .handle(async ({ response }) => response.text("ok")),
      { method: "GET" },
    );

    const definition = getProcedureDefinition(handler);
    expect(definition).toEqual({
      method: "GET",
      route: {
        pathname: "/api/test",
        params: {},
      },
    });
    expect(Object.keys(handler)).not.toContain(
      String(procedureDefinitionSymbol),
    );

    const response = await handler(new NextRequest("http://localhost"), {
      params: Promise.resolve({}),
    });
    expect(await response.text()).toBe("ok");
  });

  it("keeps internal contract primitives composable at the type level", () => {
    type ExpectedInput = ProcedureInputContract<{
      input: { query: { page: string } };
      output: { query: { page: number } };
    }>;
    type ExpectedDefinition = ProcedureDefinition<
      "GET",
      {
        input: { query: { page: string } };
        output: { query: { page: number } };
      },
      { ok: true },
      { tags: string[] }
    >;

    expectTypeOf<ExpectedInput>().toExtend<{
      contracts?: Partial<
        Record<
          "params" | "query" | "json" | "formData" | "headers" | "cookies",
          StandardSchemaV1
        >
      >;
      validationSchema?: {
        input: { query: { page: string } };
        output: { query: { page: number } };
      };
    }>();
    expectTypeOf<ExpectedDefinition>().toExtend<{
      method?: "GET";
      meta?: { tags: string[] };
    }>();
  });

  it("keeps procedure definitions centered on input output meta and route data", () => {
    type Definition = ProcedureDefinition<
      "GET",
      ValidationSchema,
      { ok: true },
      { auth: "required" }
    >;

    expectTypeOf<Definition>().toExtend<{
      method?: "GET";
      meta?: { auth: "required" };
    }>();
  });
});

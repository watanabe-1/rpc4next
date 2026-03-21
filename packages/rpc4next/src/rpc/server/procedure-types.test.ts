import { NextRequest } from "next/server";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  getProcedureDefinition,
  type ProcedureDefinition,
  type ProcedureErrorContract,
  type ProcedureInputContract,
  procedureDefinitionSymbol,
} from "./procedure-types";
import { routeHandlerFactory } from "./route-handler-factory";
import type { ValidationSchema } from "./route-types";
import type { StandardSchemaV1 } from "./standard-schema";

describe("procedure contract internals", () => {
  it("attaches an internal procedure definition to route handlers", async () => {
    const createRouteHandler = routeHandlerFactory()();
    const handler = createRouteHandler.get(async (rc) => rc.text("ok"));

    const definition = getProcedureDefinition(handler.GET);
    expect(definition).toEqual({ method: "GET" });
    expect(Object.keys(handler.GET)).not.toContain(
      String(procedureDefinitionSymbol),
    );

    const response = await handler.GET(new NextRequest("http://localhost"), {
      params: Promise.resolve({}),
    });
    expect(await response.text()).toBe("ok");
  });

  it("keeps internal contract primitives composable at the type level", () => {
    type ExpectedInput = ProcedureInputContract<{
      input: { query: { page: string } };
      output: { query: { page: number } };
    }>;
    type ExpectedError = ProcedureErrorContract<
      "BAD_REQUEST",
      {
        issue: string;
      }
    >;
    type ExpectedDefinition = ProcedureDefinition<
      "GET",
      {
        input: { query: { page: string } };
        output: { query: { page: number } };
      },
      { ok: true },
      { tags: string[] },
      ProcedureErrorContract<
        "BAD_REQUEST",
        {
          issue: string;
        }
      >
    >;

    expectTypeOf<ExpectedInput>().toEqualTypeOf<{
      contracts?: Partial<
        Record<
          "params" | "query" | "json" | "headers" | "cookies",
          StandardSchemaV1
        >
      >;
      validationSchema?: {
        input: { query: { page: string } };
        output: { query: { page: number } };
      };
    }>();
    expectTypeOf<ExpectedError>().toEqualTypeOf<{
      code?: "BAD_REQUEST";
      envelope?: {
        error: {
          code: "BAD_REQUEST";
          message: string;
          details?: {
            issue: string;
          };
        };
      };
      variants?: readonly ProcedureErrorContract[];
    }>();
    expectTypeOf<ExpectedDefinition>().toMatchTypeOf<{
      method?: "GET";
      meta?: { tags: string[] };
    }>();
  });

  it("supports unioned error contracts for shared procedure presets", () => {
    type SharedErrors =
      | ProcedureErrorContract<"UNAUTHORIZED", { reason: "missing_demo_user" }>
      | ProcedureErrorContract<"FORBIDDEN", { reason: "suspended_account" }>;

    type Definition = ProcedureDefinition<
      "GET",
      ValidationSchema,
      { ok: true },
      { auth: "required" },
      SharedErrors
    >;

    expectTypeOf<Definition>().toMatchTypeOf<{
      error?: SharedErrors;
    }>();
  });
});

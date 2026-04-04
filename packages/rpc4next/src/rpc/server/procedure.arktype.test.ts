import { type as arktype } from "arktype";
import { describe, expect, expectTypeOf, it } from "vitest";
import { procedure } from "./procedure";
import type { StandardSchemaV1 } from "./standard-schema";
import type { TypedNextResponse } from "./types";

describe("procedure builder arktype integration", () => {
  it("threads arktype input contracts into the handler context", () => {
    const pageSchema: StandardSchemaV1<{ page: string }, { page: string }> =
      arktype({ page: "string" });

    const arktypeProcedure = procedure.query(pageSchema).handle(({ query }) => {
      const _query: { page: string } = query;

      void _query;

      return {
        status: 200 as const,
      };
    });

    expectTypeOf(arktypeProcedure.handler).parameters.toExtend<
      [
        {
          query: {
            page: string;
          };
        },
      ]
    >();
  });

  it("types response helpers from arktype output contracts", () => {
    const outputSchema: StandardSchemaV1<
      unknown,
      {
        ok: boolean;
        vendor: string;
      }
    > = arktype({
      ok: "boolean",
      vendor: "string",
    });

    procedure.output(outputSchema).handle(({ response }) => {
      const jsonResponse = response.json({
        ok: true,
        vendor: "arktype",
      });

      expectTypeOf(jsonResponse).toEqualTypeOf<
        TypedNextResponse<
          {
            ok: boolean;
            vendor: string;
          },
          200,
          "application/json"
        >
      >();

      response.json({
        ok: true,
        // @ts-expect-error arktype output contracts should shape response.json payloads
        vendor: 1,
      });

      return jsonResponse;
    });

    expect(true).toBe(true);
  });
});

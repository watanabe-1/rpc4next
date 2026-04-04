import { describe, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import { procedure } from "./procedure";
import type {
  ProcedureRouteContract,
  ProcedureValidationErrorContext,
} from "./procedure-types";
import type { TypedNextResponse } from "./types";

describe("procedure builder zod integration", () => {
  const guardedUserRouteContract = {
    pathname: "/api/procedure-guarded/[userId]",
    params: {} as { userId: string },
  } as ProcedureRouteContract<
    "/api/procedure-guarded/[userId]",
    { userId: string }
  >;

  it("threads input, middleware context, and output contracts", () => {
    const userProcedure = procedure
      .meta({ tags: ["procedure"], auth: "optional" as const })
      .params(z.object({ userId: z.string() }))
      .query(
        z.object({
          includePosts: z.enum(["true", "false"]).optional(),
        }),
      )
      .json(z.object({ title: z.string() }))
      .headers(z.object({ "x-procedure-test": z.string() }))
      .cookies(z.object({ session: z.string() }))
      .output({
        _output: {
          ok: true as const,
          userId: "" as string,
          source: "procedure" as const,
        },
      })
      .use(async ({ headers }) => ({
        ctx: {
          requestId: headers["x-procedure-test"],
        },
      }))
      .handle(
        async ({ params, query, json, headers, cookies, ctx, response }) => {
          const _params: { userId: string } = params;
          const _query: {
            includePosts?: "true" | "false" | undefined;
          } = query;
          const _json: { title: string } = json;
          const _headers: { "x-procedure-test": string } = headers;
          const _cookies: { session: string } = cookies;
          const _ctx: { requestId: string } = ctx;
          const _response: {
            json: (data: {
              ok: true;
              userId: string;
              source: "procedure";
            }) => unknown;
          } = response;

          void _params;
          void _query;
          void _json;
          void _headers;
          void _cookies;
          void _ctx;
          void _response;

          return response.json({
            ok: true as const,
            userId: params.userId,
            source: "procedure" as const,
          });
        },
      );

    expectTypeOf(userProcedure.definition).toExtend<{
      input?: {
        validationSchema?: {
          output: {
            params: { userId: string };
            query: {
              includePosts?: "true" | "false" | undefined;
            };
            json: { title: string };
            headers: { "x-procedure-test": string };
            cookies: { session: string };
          };
        };
      };
      meta?: {
        tags: string[];
        auth: "optional";
      };
      output?: {
        response?: {
          ok: true;
          userId: string;
          source: "procedure";
        };
      };
    }>();
  });

  it("threads formData contracts into the handler context", () => {
    const uploadProcedure = procedure
      .forRoute(guardedUserRouteContract)
      .params(z.object({ userId: z.string() }))
      .formData(
        z.object({
          displayName: z.string(),
          avatar: z.instanceof(File),
          tags: z.array(z.string()).optional(),
        }),
      )
      .headers(z.object({ "x-procedure-test": z.string() }))
      .cookies(z.object({ session: z.string() }))
      .output({
        _output: {
          ok: true as const,
          displayName: "" as string,
          source: "procedure" as const,
        },
      })
      .use(async ({ headers }) => ({
        ctx: {
          requestId: headers["x-procedure-test"],
        },
      }))
      .handle(async ({ params, formData, headers, cookies, ctx }) => {
        const _params: { userId: string } = params;
        const _formData: {
          displayName: string;
          avatar: File;
          tags?: string[] | undefined;
        } = formData;
        const _headers: { "x-procedure-test": string } = headers;
        const _cookies: { session: string } = cookies;
        const _ctx: { requestId: string } = ctx;

        void _params;
        void _formData;
        void _headers;
        void _cookies;
        void _ctx;

        return {
          status: 200 as const,
          body: {
            ok: true as const,
            displayName: formData.displayName,
            source: "procedure" as const,
          },
        };
      });

    expectTypeOf(uploadProcedure.definition).toExtend<{
      route?: {
        pathname: "/api/procedure-guarded/[userId]";
        params: { userId: string };
      };
      input?: {
        validationSchema?: {
          output: {
            params: { userId: string };
            formData: {
              displayName: string;
              avatar: File;
              tags?: string[] | undefined;
            };
            headers: { "x-procedure-test": string };
            cookies: { session: string };
          };
        };
      };
      output?: {
        response?: {
          ok: true;
          displayName: string;
          source: "procedure";
        };
      };
    }>();
  });

  it("types validator-stage customization against the target input shape", () => {
    const onValidationError = vi.fn(
      ({ target, value, issues }: ProcedureValidationErrorContext<"query">) => {
        const _target: "query" = target;
        const _value: unknown = value;
        const _issues: readonly { message: string }[] = issues;

        void _target;
        void _value;
        void _issues;

        return undefined;
      },
    );

    const pagedProcedure = procedure
      .query(
        z.object({
          page: z.coerce.number().int().positive(),
        }),
        {
          onValidationError,
        },
      )
      .handle(({ query }) => ({
        body: {
          page: query.page,
        },
      }));

    expectTypeOf(pagedProcedure.handler).parameters.toExtend<
      [
        {
          query: {
            page: number;
          };
        },
      ]
    >();
  });

  it("keeps zod output property types on response helpers", () => {
    procedure
      .output(
        z.object({
          ok: z.literal(true),
          page: z.number().int().positive(),
          source: z.literal("procedure"),
        }),
      )
      .handle(({ response }) => {
        const jsonResponse = response.json({
          ok: true,
          page: 1,
          source: "procedure",
        });

        expectTypeOf(jsonResponse).toEqualTypeOf<
          TypedNextResponse<
            {
              ok: true;
              page: number;
              source: "procedure";
            },
            200,
            "application/json"
          >
        >();

        response.json({
          ok: true,
          // @ts-expect-error response.json should preserve the zod output property type
          page: "1",
          source: "procedure",
        });

        return jsonResponse;
      });
  });

  it("preserves literal output types for procedure-validation-branch style responses", () => {
    procedure
      .query(
        z.object({
          page: z.coerce.number().int().positive(),
        }),
      )
      .output(
        z.object({
          ok: z.literal(true),
          source: z.literal("procedure-validation-branch"),
          page: z.number().int().positive(),
        }),
      )
      .handle(({ query, response }) => {
        const jsonResponse = response.json({
          ok: true,
          source: "procedure-validation-branch",
          page: query.page,
        });

        expectTypeOf(jsonResponse).toEqualTypeOf<
          TypedNextResponse<
            {
              ok: true;
              source: "procedure-validation-branch";
              page: number;
            },
            200,
            "application/json"
          >
        >();

        response.json({
          // @ts-expect-error ok should remain the true literal from the output contract
          ok: false,
          source: "procedure-validation-branch",
          page: query.page,
        });

        response.json({
          ok: true,
          // @ts-expect-error source should remain the procedure-validation-branch literal
          source: "other",
          page: query.page,
        });

        return jsonResponse;
      });
  });

  it("supports validator-stage customization on shared baseProcedure presets", () => {
    const baseProcedure = procedure.query(
      z.object({
        page: z.coerce.number().int().positive(),
      }),
      {
        onValidationError: ({ target, value }) => {
          const _target: "query" = target;
          const _value: { page: unknown } = value;

          void _target;
          void _value;

          return undefined;
        },
      },
    );

    const derivedProcedure = baseProcedure.handle(({ query }) => ({
      body: {
        page: query.page,
      },
    }));

    expectTypeOf(derivedProcedure.handler).parameters.toExtend<
      [
        {
          query: {
            page: number;
          };
        },
      ]
    >();
  });
});

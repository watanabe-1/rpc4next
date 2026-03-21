import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import { procedure } from "./procedure";
import type {
  ProcedureErrorContract,
  ProcedureRouteContract,
  ProcedureValidationErrorContext,
} from "./procedure-types";
import type { StandardSchemaV1 } from "./standard-schema";

describe("procedure builder type definitions", () => {
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

    expectTypeOf(userProcedure.definition).toMatchTypeOf<{
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

    expectTypeOf(uploadProcedure.definition).toMatchTypeOf<{
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

  it("supports custom procedure validators without zod coupling", () => {
    const parsePage: StandardSchemaV1<
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

    const customValidatorProcedure = procedure
      .query(parsePage)
      .handle(({ query }) => {
        const _query: { page: number } = query;

        void _query;

        return {
          status: 200 as const,
        };
      });

    expectTypeOf(customValidatorProcedure.handler).parameters.toMatchTypeOf<
      [
        {
          query: {
            page: number;
          };
        },
      ]
    >();
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

    expectTypeOf(pagedProcedure.handler).parameters.toMatchTypeOf<
      [
        {
          query: {
            page: number;
          };
        },
      ]
    >();
  });

  it("limits handle context to validated inputs only", () => {
    procedure
      .query(
        z.object({
          page: z.coerce.number().int().positive(),
        }),
      )
      .handle((context) => {
        const { query, request, ctx, response } = context;
        const _query: { page: number } = query;
        const _request: Request = request;
        const _ctx: Record<never, never> = ctx;
        const _response = response.json({
          page: query.page,
        });

        void _query;
        void _request;
        void _ctx;
        void _response;

        // @ts-expect-error params are not available without params(schema)
        void context.params;
        // @ts-expect-error json is not available without json(schema)
        void context.json;

        return {
          status: 200 as const,
        };
      });

    expect(true).toBe(true);
  });

  it("types response helpers against explicit output contracts", () => {
    procedure
      .output(
        z.object({
          ok: z.literal(true),
          count: z.number().int().nonnegative(),
        }),
      )
      .handle(({ response }) => {
        response.json({
          ok: true,
          count: 1,
        });

        response.json({
          // @ts-expect-error response.json payload should follow the output contract
          ok: false,
          count: 1,
        });

        const _text = response.text("ok");
        const _body = response.body("ok", {
          headers: {
            "Content-Type": "text/plain",
          },
        });
        const _redirect = response.redirect("http://localhost/next");

        void _text;
        void _body;
        void _redirect;

        return response.json({
          ok: true,
          count: 1,
        });
      });

    expect(true).toBe(true);
  });

  it("rejects formData after json at compile time", () => {
    procedure
      .json(z.object({ title: z.string() }))
      // @ts-expect-error procedure body contracts are mutually exclusive
      .formData(z.object({ title: z.string() }));

    expect(true).toBe(true);
  });

  it("rejects json after formData at compile time", () => {
    procedure
      .formData(z.object({ title: z.string() }))
      // @ts-expect-error procedure body contracts are mutually exclusive
      .json(z.object({ title: z.string() }));

    expect(true).toBe(true);
  });

  it("widens middleware context across multiple use calls", () => {
    const contextProcedure = procedure
      .headers(z.object({ "x-request-id": z.string() }))
      .use(({ headers }) => ({
        ctx: {
          requestId: headers["x-request-id"],
        },
      }))
      .use(({ ctx }) => ({
        ctx: {
          traceId: `${ctx.requestId}:trace`,
        },
      }))
      .handle(({ ctx }) => {
        const _ctx: {
          requestId: string;
          traceId: string;
        } = ctx;

        void _ctx;

        return {
          status: 204 as const,
        };
      });

    expectTypeOf(contextProcedure.handler).parameters.toMatchTypeOf<
      [
        {
          ctx: {
            requestId: string;
            traceId: string;
          };
        },
      ]
    >();
  });

  it("limits middleware context to validated inputs only", () => {
    procedure
      .query(
        z.object({
          page: z.coerce.number().int().positive(),
        }),
      )
      .use((context) => {
        const _query: { page: number } = context.query;
        const _request: Request = context.request;
        const _ctx: Record<never, never> = context.ctx;

        void _query;
        void _request;
        void _ctx;

        // @ts-expect-error params are not available without params(schema)
        void context.params;
        // @ts-expect-error json is not available without json(schema)
        void context.json;
        // @ts-expect-error response helpers are only available inside handle(...)
        void context.response;

        return undefined;
      })
      .handle(({ query }) => ({
        body: {
          page: query.page,
        },
      }));

    expect(true).toBe(true);
  });

  it("exposes params to middleware after params(schema)", () => {
    procedure
      .forRoute(guardedUserRouteContract)
      .params(z.object({ userId: z.string().min(1) }))
      .use(({ params }) => ({
        ctx: {
          requestId: params.userId,
        },
      }))
      .handle(({ ctx }) => ({
        body: {
          requestId: ctx.requestId,
        },
      }));

    expect(true).toBe(true);
  });

  it("supports immutable shared baseProcedure presets", () => {
    const baseProcedure = procedure
      .headers(
        z.object({
          "x-demo-role": z.enum(["reader", "editor"]).optional(),
        }),
      )
      .meta({
        tags: ["shared-base-procedure"],
        auth: "optional" as const,
      })
      .use(({ headers }) => ({
        ctx: {
          viewer: {
            role: headers["x-demo-role"] ?? "reader",
          },
        },
      }));

    const listUsersProcedure = baseProcedure.handle(({ ctx }) => {
      const _ctx: {
        viewer: {
          role: "reader" | "editor";
        };
      } = ctx;

      void _ctx;

      return {
        status: 200 as const,
        body: {
          ok: true as const,
        },
      };
    });

    const getUserProcedure = baseProcedure
      .params(z.object({ userId: z.string() }))
      .query(
        z.object({
          includeDrafts: z.enum(["true", "false"]).optional(),
        }),
      )
      .handle(({ params, query, ctx }) => {
        const _params: { userId: string } = params;
        const _query: { includeDrafts?: "true" | "false" | undefined } = query;
        const _ctx: {
          viewer: {
            role: "reader" | "editor";
          };
        } = ctx;

        void _params;
        void _query;
        void _ctx;

        return {
          status: 200 as const,
          body: {
            ok: true as const,
            userId: params.userId,
          },
        };
      });

    expectTypeOf(listUsersProcedure.definition).toMatchTypeOf<{
      meta?: {
        tags: string[];
        auth: "optional";
      };
      input?: {
        validationSchema?: {
          output: {
            headers: {
              "x-demo-role"?: "reader" | "editor" | undefined;
            };
          };
        };
      };
    }>();

    expectTypeOf(getUserProcedure.definition).toMatchTypeOf<{
      input?: {
        validationSchema?: {
          output: {
            params: { userId: string };
            query: {
              includeDrafts?: "true" | "false" | undefined;
            };
            headers: {
              "x-demo-role"?: "reader" | "editor" | undefined;
            };
          };
        };
      };
    }>();
  });

  it("supports route-bound shared baseProcedure presets", () => {
    const guardedBaseProcedure = procedure
      .forRoute(guardedUserRouteContract)
      .headers(
        z.object({
          "x-demo-role": z.enum(["reader", "editor"]).optional(),
        }),
      )
      .use(({ headers }) => ({
        ctx: {
          requestId: "guarded",
          viewer: {
            role: headers["x-demo-role"] ?? "reader",
          },
        },
      }));

    const guardedProcedure = guardedBaseProcedure
      .params(z.object({ userId: z.string().min(1) }))
      .handle(({ params, ctx }) => {
        const _params: { userId: string } = params;
        const _ctx: {
          requestId: string;
          viewer: {
            role: "reader" | "editor";
          };
        } = ctx;

        void _params;
        void _ctx;

        return {
          status: 200 as const,
        };
      });

    expectTypeOf(guardedProcedure.definition).toMatchTypeOf<{
      route?: {
        pathname: "/api/procedure-guarded/[userId]";
        params: { userId: string };
      };
      input?: {
        validationSchema?: {
          output: {
            params: { userId: string };
          };
        };
      };
    }>();
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

    expectTypeOf(derivedProcedure.handler).parameters.toMatchTypeOf<
      [
        {
          query: {
            page: number;
          };
        },
      ]
    >();
  });

  it("requires params before handling bound routes with generated params", () => {
    // @ts-expect-error bound routes with params must declare params(schema) before handle()
    procedure.forRoute(guardedUserRouteContract).handle(({ params }) => ({
      status: 200 as const,
      body: {
        userId: params.userId,
      },
    }));

    expect(true).toBe(true);
  });

  it("rejects params schemas that do not cover generated route params", () => {
    procedure
      .forRoute(guardedUserRouteContract)
      // @ts-expect-error bound route params schema output must cover the generated params contract
      .params(z.object({ userId: z.string().optional() }));

    expect(true).toBe(true);
  });

  it("accumulates shared and route-local procedure error contracts", () => {
    const guardedBaseProcedure = procedure
      .error<"UNAUTHORIZED", { reason: "missing_demo_user" }>("UNAUTHORIZED")
      .error<"FORBIDDEN", { reason: "suspended_account" }>("FORBIDDEN");

    const guardedProcedure = guardedBaseProcedure
      .error<"FORBIDDEN", { reason: "editor_only" }>("FORBIDDEN")
      .handle(() => ({
        status: 204 as const,
      }));

    type ExpectedErrors =
      | ProcedureErrorContract<"UNAUTHORIZED", { reason: "missing_demo_user" }>
      | ProcedureErrorContract<"FORBIDDEN", { reason: "suspended_account" }>
      | ProcedureErrorContract<"FORBIDDEN", { reason: "editor_only" }>;

    expectTypeOf(guardedProcedure.definition.error).toMatchTypeOf<
      ExpectedErrors | undefined
    >();
  });
});

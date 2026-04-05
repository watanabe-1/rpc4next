import { describe, expect, expectTypeOf, it } from "vitest";
import { defaultProcedureOnError } from "./on-error";
import { defineProcedureMiddleware, procedure } from "./procedure";
import type { ProcedureRouteContract } from "./procedure-types";
import type { StandardSchemaV1 } from "./standard-schema";

describe("procedure builder type definitions", () => {
  const guardedUserRouteContract = {
    pathname: "/api/procedure-guarded/[userId]",
    params: {} as { userId: string },
  } as ProcedureRouteContract<
    "/api/procedure-guarded/[userId]",
    { userId: string }
  >;

  const parsePage: StandardSchemaV1<
    { page?: string | string[] },
    { page: number }
  > = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as { page?: string | string[] },
        output: {} as { page: number },
      },
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

  const userIdSchema: StandardSchemaV1<{ userId: string }, { userId: string }> =
    {
      "~standard": {
        version: 1,
        vendor: "rpc4next-test",
        types: {
          input: {} as { userId: string },
          output: {} as { userId: string },
        },
        validate: (value) => ({
          value: value as { userId: string },
        }),
      },
    };

  const invalidUserIdSchema: StandardSchemaV1<
    { userId?: string },
    { userId?: string }
  > = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as { userId?: string },
        output: {} as { userId?: string },
      },
      validate: (value) => ({
        value: value as { userId?: string },
      }),
    },
  };

  const requestIdHeaderSchema: StandardSchemaV1<
    { "x-request-id": string },
    { "x-request-id": string }
  > = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as { "x-request-id": string },
        output: {} as { "x-request-id": string },
      },
      validate: (value) => ({
        value: value as { "x-request-id": string },
      }),
    },
  };

  const roleHeaderSchema: StandardSchemaV1<
    { "x-demo-role"?: "reader" | "editor" },
    { "x-demo-role"?: "reader" | "editor" }
  > = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as { "x-demo-role"?: "reader" | "editor" },
        output: {} as { "x-demo-role"?: "reader" | "editor" },
      },
      validate: (value) => ({
        value: value as { "x-demo-role"?: "reader" | "editor" },
      }),
    },
  };

  const includeDraftsSchema: StandardSchemaV1<
    { includeDrafts?: "true" | "false" },
    { includeDrafts?: "true" | "false" }
  > = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as { includeDrafts?: "true" | "false" },
        output: {} as { includeDrafts?: "true" | "false" },
      },
      validate: (value) => ({
        value: value as { includeDrafts?: "true" | "false" },
      }),
    },
  };

  const titleSchema: StandardSchemaV1<{ title: string }, { title: string }> = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as { title: string },
        output: {} as { title: string },
      },
      validate: (value) => ({
        value: value as { title: string },
      }),
    },
  };

  const avatarSchema: StandardSchemaV1<{ avatar: string }, { avatar: string }> =
    {
      "~standard": {
        version: 1,
        vendor: "rpc4next-test",
        types: {
          input: {} as { avatar: string },
          output: {} as { avatar: string },
        },
        validate: (value) => ({
          value: value as { avatar: string },
        }),
      },
    };

  it("supports custom procedure validators without zod coupling", () => {
    const customValidatorProcedure = procedure
      .query(parsePage)
      .handle(({ query }) => {
        const _query: { page: number } = query;

        void _query;

        return {
          status: 200 as const,
        };
      });

    expectTypeOf(customValidatorProcedure.handler).parameters.toExtend<
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
    procedure.query(parsePage).handle((context) => {
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
      .output({
        _output: {
          ok: true as const,
          count: 0 as number,
        },
      })
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

        return response.json({
          ok: true,
          count: 1,
        });
      });

    expect(true).toBe(true);
  });

  it("rejects formData after json at compile time", () => {
    procedure
      .json(titleSchema)
      // @ts-expect-error procedure body contracts are mutually exclusive
      .formData(titleSchema);

    expect(true).toBe(true);
  });

  it("rejects json after formData at compile time", () => {
    procedure
      .formData(titleSchema)
      // @ts-expect-error procedure body contracts are mutually exclusive
      .json(titleSchema);

    expect(true).toBe(true);
  });

  it("widens middleware context across multiple use calls", () => {
    const contextProcedure = procedure
      .headers(requestIdHeaderSchema)
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

    expectTypeOf(contextProcedure.handler).parameters.toExtend<
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
      .query(parsePage)
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
      .params(userIdSchema)
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
      .headers(roleHeaderSchema)
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
      .params(userIdSchema)
      .query(includeDraftsSchema)
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

    expectTypeOf(listUsersProcedure.handler).parameters.toExtend<
      [
        {
          ctx: {
            viewer: {
              role: "reader" | "editor";
            };
          };
        },
      ]
    >();

    expectTypeOf(getUserProcedure.handler).parameters.toExtend<
      [
        {
          params: { userId: string };
          query: { includeDrafts?: "true" | "false" | undefined };
          ctx: {
            viewer: {
              role: "reader" | "editor";
            };
          };
        },
      ]
    >();
  });

  it("supports route-bound shared baseProcedure presets", () => {
    const guardedBaseProcedure = procedure
      .forRoute(guardedUserRouteContract)
      .headers(roleHeaderSchema)
      .use(({ headers }) => ({
        ctx: {
          requestId: "guarded",
          viewer: {
            role: headers["x-demo-role"] ?? "reader",
          },
        },
      }));

    const guardedProcedure = guardedBaseProcedure
      .params(userIdSchema)
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

    expectTypeOf(guardedProcedure.handler).parameters.toExtend<
      [
        {
          params: { userId: string };
          ctx: {
            requestId: string;
            viewer: {
              role: "reader" | "editor";
            };
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
      .params(invalidUserIdSchema);

    expect(true).toBe(true);
  });

  it("keeps middleware reuse focused on immutable builder composition", () => {
    const guardedMiddleware = defineProcedureMiddleware(() => undefined);
    const guardedBaseProcedure = procedure.use(guardedMiddleware);

    const guardedProcedure = guardedBaseProcedure.handle(() => ({
      status: 204 as const,
    }));

    expectTypeOf(guardedProcedure.definition).toExtend<object>();
  });

  it("preserves immutable reuse when middleware is shared across procedures", () => {
    const guardedMiddleware = defineProcedureMiddleware(() => undefined);
    const baseProcedure = procedure.use(guardedMiddleware);
    const publicProcedure = baseProcedure.handle(() => ({
      status: 204 as const,
    }));
    const editorProcedure = baseProcedure.handle(() => ({
      status: 204 as const,
    }));

    expectTypeOf(publicProcedure.definition).toExtend<object>();
    expectTypeOf(editorProcedure.definition).toExtend<object>();
  });

  it("adds nextRoute sugar without changing validated input and output inference", () => {
    const queryRoute = procedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .query(includeDraftsSchema)
      .output({
        _output: {
          ok: true as const,
          userId: "" as string,
          includeDrafts: false as boolean,
        },
      })
      .handle(async ({ params, query, response }) =>
        response.json({
          ok: true,
          userId: params.userId,
          includeDrafts: query.includeDrafts === "true",
        }),
      )
      .nextRoute({
        method: "GET",
        onError: defaultProcedureOnError,
      });

    type QueryRouteResponse = Awaited<ReturnType<typeof queryRoute>>;
    expectTypeOf<QueryRouteResponse>().toExtend<Response>();

    const formDataRoute = procedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .formData(avatarSchema)
      .handle(({ formData }) => ({
        body: {
          avatar: formData.avatar,
        },
      }))
      .nextRoute({
        method: "POST",
        onError: defaultProcedureOnError,
      });

    type FormDataRouteResponse = Awaited<ReturnType<typeof formDataRoute>>;
    expectTypeOf<FormDataRouteResponse>().toExtend<Response>();
  });

  it("lets procedure.defaults({ onError }) make terminal nextRoute onError optional", () => {
    const appProcedure = procedure.defaults({
      onError: defaultProcedureOnError,
    });

    const route = appProcedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .query(includeDraftsSchema)
      .output({
        _output: {
          ok: true as const,
          userId: "" as string,
          includeDrafts: false as boolean,
        },
      })
      .handle(async ({ params, query, response }) =>
        response.json({
          ok: true,
          userId: params.userId,
          includeDrafts: query.includeDrafts === "true",
        }),
      )
      .nextRoute({
        method: "GET",
      });

    type RouteResponse = Awaited<ReturnType<typeof route>>;
    expectTypeOf<RouteResponse>().toExtend<Response>();
  });

  it("keeps route binding and GET body constraints on procedure.nextRoute", () => {
    const unboundProcedure = procedure.handle(() => ({
      status: 204 as const,
    }));

    // @ts-expect-error nextRoute() only accepts route-bound procedures
    unboundProcedure.nextRoute({
      method: "GET",
      onError: defaultProcedureOnError,
    });

    const bareBoundProcedure = procedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .handle(({ params }) => ({
        body: {
          userId: params.userId,
        },
      }));

    // @ts-expect-error bare procedure.nextRoute still requires onError
    bareBoundProcedure.nextRoute({
      method: "GET",
    });

    const jsonProcedure = procedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .json(titleSchema)
      .handle(({ json }) => ({
        body: json,
      }));

    // @ts-expect-error GET nextRoute should reject json contracts
    jsonProcedure.nextRoute({
      method: "GET",
      onError: defaultProcedureOnError,
    });

    const formDataProcedure = procedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .formData(avatarSchema)
      .handle(({ formData }) => ({
        body: formData,
      }));

    // @ts-expect-error HEAD nextRoute should reject formData contracts
    formDataProcedure.nextRoute({
      method: "HEAD",
      onError: defaultProcedureOnError,
    });

    expect(true).toBe(true);
  });

  it("keeps route binding and GET body constraints on defaulted procedure.nextRoute", () => {
    const appProcedure = procedure.defaults({
      onError: defaultProcedureOnError,
    });

    const unboundProcedure = appProcedure.handle(() => ({
      status: 204 as const,
    }));

    // @ts-expect-error nextRoute() only accepts route-bound procedures
    unboundProcedure.nextRoute({
      method: "GET",
    });

    const jsonProcedure = appProcedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .json(titleSchema)
      .handle(({ json }) => ({
        body: json,
      }));

    // @ts-expect-error GET nextRoute should reject json contracts
    jsonProcedure.nextRoute({
      method: "GET",
    });

    const formDataProcedure = appProcedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .formData(avatarSchema)
      .handle(({ formData }) => ({
        body: formData,
      }));

    // @ts-expect-error HEAD nextRoute should reject formData contracts
    formDataProcedure.nextRoute({
      method: "HEAD",
    });

    expect(true).toBe(true);
  });
});

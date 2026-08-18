import { describe, expect, expectTypeOf, it } from "vitest";

import { defaultProcedureOnError } from "./on-error";
import { procedure } from "./procedure";
import type { ProcedureRouteContract } from "./procedure-types";
import type { StandardSchemaV1 } from "./standard-schema";
import type { ResponseHelpers } from "./types";

describe("procedure builder type definitions", () => {
  const guardedUserRouteContract = {
    pathname: "/api/procedure-guarded/[userId]",
    params: {} as { userId: string },
  } as ProcedureRouteContract<"/api/procedure-guarded/[userId]", { userId: string }>;

  const staticPageRouteContract = {
    pathname: "/patterns/search",
    params: {} as Record<never, never>,
  } as ProcedureRouteContract<"/patterns/search", Record<never, never>>;

  const parsePage: StandardSchemaV1<{ page?: string | string[] }, { page: number }> = {
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

  const userIdSchema: StandardSchemaV1<{ userId: string }, { userId: string }> = {
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

  const invalidUserIdSchema: StandardSchemaV1<{ userId?: string }, { userId?: string }> = {
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

  const avatarSchema: StandardSchemaV1<{ avatar: string }, { avatar: string }> = {
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
    const customValidatorProcedure = procedure.query(parsePage).handle(({ query }) => {
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
    expect(() => {
      procedure
        .json(titleSchema)
        // @ts-expect-error formData is not available after json(schema)
        .formData(titleSchema);
    }).toThrow(
      "Procedure body contracts are mutually exclusive; use either .json(schema) or .formData(schema), not both.",
    );

    expect(true).toBe(true);
  });

  it("rejects json after formData at compile time", () => {
    expect(() => {
      procedure
        .formData(titleSchema)
        // @ts-expect-error json is not available after formData(schema)
        .json(titleSchema);
    }).toThrow(
      "Procedure body contracts are mutually exclusive; use either .json(schema) or .formData(schema), not both.",
    );

    expect(true).toBe(true);
  });

  it("omits once-only input contract methods after they are used", () => {
    expect(() => {
      procedure
        .headers(requestIdHeaderSchema)
        // @ts-expect-error headers is not available after headers(schema)
        .headers(roleHeaderSchema);
    }).toThrow('Procedure input contract for "headers" has already been declared.');

    expect(() => {
      procedure
        .json(titleSchema)
        // @ts-expect-error json is not available after json(schema)
        .json(titleSchema);
    }).toThrow('Procedure input contract for "json" has already been declared.');

    expect(() => {
      procedure
        .params(userIdSchema)
        // @ts-expect-error params is not available after params(schema)
        .params(userIdSchema);
    }).toThrow('Procedure input contract for "params" has already been declared.');

    expect(() => {
      procedure
        .query(parsePage)
        // @ts-expect-error query is not available after query(schema)
        .query(parsePage);
    }).toThrow('Procedure input contract for "query" has already been declared.');

    expect(() => {
      procedure
        .cookies(requestIdHeaderSchema)
        // @ts-expect-error cookies is not available after cookies(schema)
        .cookies(requestIdHeaderSchema);
    }).toThrow('Procedure input contract for "cookies" has already been declared.');
  });

  it("omits other once-only builder methods after they are used", () => {
    expect(() => {
      procedure
        .forRoute(guardedUserRouteContract)
        // @ts-expect-error forRoute is not available after forRoute(routeContract)
        .forRoute(guardedUserRouteContract);
    }).toThrow("Procedure route binding has already been declared.");

    expect(() => {
      procedure
        .output({
          _output: {
            ok: true as const,
          },
        })
        // @ts-expect-error output is not available after output(schema)
        .output({
          _output: {
            ok: true as const,
          },
        });
    }).toThrow("Procedure output contract has already been declared.");

    procedure.defaults({
      // @ts-expect-error defaults no longer accepts the old flat { onError } shape
      onError: defaultProcedureOnError,
    });

    const defaultedProcedure = procedure.defaults({
      route: {
        onError: defaultProcedureOnError,
      },
    });

    expect(() => {
      // @ts-expect-error defaults is not available after defaults({ route: { onError } })
      defaultedProcedure.defaults({
        route: {
          onError: defaultProcedureOnError,
        },
      });
    }).toThrow("Procedure defaults have already been declared.");
  });

  it("keeps repeatedly composable builder methods available", () => {
    const composedProcedure = procedure
      .meta({
        summary: "first",
      })
      .meta({
        summary: "second",
      })
      .use(() => ({
        ctx: {
          first: true as const,
        },
      }))
      .use(({ ctx }) => ({
        ctx: {
          second: ctx.first,
        },
      }))
      .handle(({ ctx }) => {
        const _ctx: {
          first: true;
          second: true;
        } = ctx;

        void _ctx;

        return {
          status: 204 as const,
        };
      });

    expectTypeOf(composedProcedure.handler).parameters.toExtend<
      [
        {
          ctx: {
            first: true;
            second: true;
          };
        },
      ]
    >();
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

  it("applies reusable base middleware from the current builder context", () => {
    const guardedProcedure = procedure
      .headers(roleHeaderSchema)
      .use((context) => {
        const { headers, request, ctx, response } = context;
        const role: "reader" | "editor" = headers["x-demo-role"] ?? "reader";
        const _request: Request = request;
        const _ctx: Record<never, never> = ctx;
        const _response: ResponseHelpers = response;

        void _request;
        void _ctx;
        void _response;
        // @ts-expect-error query is not available without query(schema)
        void context.query;

        if (role !== "editor") {
          return response.error("FORBIDDEN", {
            message: "Editor role required.",
            details: { reason: "editor_only" as const },
          });
        }

        return {
          ctx: {
            viewer: {
              role,
            },
          },
        };
      })
      .use(({ ctx }) => ({
        ctx: {
          requestId: `role:${ctx.viewer.role}`,
        },
      }))
      .handle(({ ctx }) => {
        const _ctx: {
          viewer: {
            role: "editor";
          };
          requestId: string;
        } = ctx;

        void _ctx;

        return {
          status: 204 as const,
        };
      });

    expectTypeOf(guardedProcedure.handler).parameters.toExtend<
      [
        {
          ctx: {
            viewer: {
              role: "editor";
            };
            requestId: string;
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
        const _response: ResponseHelpers = context.response;

        void _query;
        void _request;
        void _ctx;
        void _response;

        // @ts-expect-error params are not available without params(schema)
        void context.params;
        // @ts-expect-error json is not available without json(schema)
        void context.json;

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
        summary: "Shared base procedure preset",
        tags: ["shared-base-procedure"],
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

    const guardedProcedure = guardedBaseProcedure.params(userIdSchema).handle(({ params, ctx }) => {
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
    const guardedBaseProcedure = procedure.use(() => undefined);

    const guardedProcedure = guardedBaseProcedure.handle(() => ({
      status: 204 as const,
    }));

    expectTypeOf(guardedProcedure.definition).toExtend<object>();
  });

  it("preserves immutable reuse when middleware is shared across procedures", () => {
    const baseProcedure = procedure.use(() => undefined);
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
    const { GET: queryRoute } = procedure
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

    const { POST: formDataRoute } = procedure
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

  it("exposes validated params and query directly to nextPage renders", () => {
    procedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .query(parsePage)
      .nextPage((context) => {
        const _params: { userId: string } = context.params;
        const _query: { page: number } = context.query;
        const _ctx: Record<never, never> = context.ctx;

        void _params;
        void _query;
        void _ctx;

        // @ts-expect-error data is only available after handle()
        void context.data;
        // @ts-expect-error response helpers are not available in page render context
        void context.response;

        return null;
      });

    procedure
      .forRoute(staticPageRouteContract)
      .query(parsePage)
      .nextPage(({ query }) => {
        const _query: { page: number } = query;

        void _query;

        return null;
      });

    procedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .query(parsePage)
      .handle(({ params, query }) => ({
        body: {
          userId: params.userId,
          page: query.page,
        },
      }))
      .nextPage(({ data, params, query }) => {
        const _data: { userId: string; page: number } = data;
        const _params: { userId: string } = params;
        const _query: { page: number } = query;

        void _data;
        void _params;
        void _query;

        return null;
      });

    expect(true).toBe(true);
  });

  it("requires params before nextPage on bound routes with generated params", () => {
    procedure
      .forRoute(guardedUserRouteContract)
      // @ts-expect-error bound page routes with params must declare params(schema) before nextPage()
      .nextPage(() => null);

    expect(true).toBe(true);
  });

  it("lets procedure.defaults({ route: { onError } }) make terminal nextRoute onError optional", () => {
    const appProcedure = procedure.defaults({
      route: {
        onError: defaultProcedureOnError,
      },
    });

    const { GET: route } = appProcedure
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

  it("switches middleware helpers from defaults adapter intent", () => {
    const routeProcedure = procedure.defaults({
      route: {
        onError: defaultProcedureOnError,
      },
    });

    routeProcedure.use((context) => {
      const _response: ResponseHelpers = context.response;

      void _response;

      // @ts-expect-error route procedures should not expose page helpers
      void context.page;

      return undefined;
    });

    routeProcedure
      .handle(() => ({
        status: 204 as const,
      }))
      // @ts-expect-error route defaults should expose nextRoute only
      .nextPage(() => null);

    const pageProcedure = procedure.defaults({
      page: {
        onError: () => null,
      },
    });

    pageProcedure.use((context) => {
      const _page: {
        redirect: (url: string) => never;
        notFound: () => never;
      } = context.page;

      void _page;

      // @ts-expect-error page procedures should not expose response helpers
      void context.response;

      return undefined;
    });

    pageProcedure.handle(({ page }) => {
      const _page: {
        redirect: (url: string) => never;
        notFound: () => never;
      } = page;

      void _page;

      return {
        body: {
          ok: true as const,
        },
      };
    });

    pageProcedure.use(
      // @ts-expect-error page middleware should not return raw Response values
      () => new Response("page middleware response"),
    );

    pageProcedure.handle(
      // @ts-expect-error page handlers should not return raw Response values
      () => new Response("page handler response"),
    );

    pageProcedure.handle(() => ({
      // @ts-expect-error page handlers should use page.redirect(), not ProcedureResult redirects
      redirect: "/login",
    }));

    pageProcedure
      .forRoute(guardedUserRouteContract)
      .params(userIdSchema)
      .handle(() => ({
        body: {
          ok: true as const,
        },
      }))
      // @ts-expect-error page defaults should expose nextPage only
      .nextRoute({
        method: "GET",
      });

    expect(true).toBe(true);
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
      route: {
        onError: defaultProcedureOnError,
      },
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

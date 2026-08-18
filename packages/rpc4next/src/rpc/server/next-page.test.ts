import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { nextPage as baseNextPage } from "./next-page";
import { procedure } from "./procedure";
import type { ProcedureRouteContract } from "./procedure-types";
import type { StandardSchemaV1 } from "./standard-schema";

describe("nextPage", () => {
  const pageRouteContract = {
    pathname: "/photo/[id]",
    params: {} as { id: string },
  } as ProcedureRouteContract<"/photo/[id]", { id: string }>;

  const paramsSchema: StandardSchemaV1<{ id: string }, { id: string }> = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as { id: string },
        output: {} as { id: string },
      },
      validate: (value) => ({
        value: value as { id: string },
      }),
    },
  };

  const querySchema: StandardSchemaV1<
    { tab?: string | string[] | undefined },
    { tab: "info" | "comments" }
  > = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as { tab?: string | string[] | undefined },
        output: {} as { tab: "info" | "comments" },
      },
      validate: (value) => {
        const input =
          typeof value === "object" && value !== null
            ? (value as { tab?: string | string[] | undefined })
            : {};
        const tab = Array.isArray(input.tab) ? input.tab[0] : input.tab;

        if (tab !== undefined && tab !== "info" && tab !== "comments") {
          return {
            issues: [{ message: "invalid tab" }],
          };
        }

        return {
          value: {
            tab: tab ?? "info",
          },
        };
      },
    },
  };

  const outputSchema: StandardSchemaV1<
    { id: string; tab: "info" | "comments"; requestId: string },
    { id: string; tab: "info" | "comments"; requestId: string }
  > = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as { id: string; tab: "info" | "comments"; requestId: string },
        output: {} as { id: string; tab: "info" | "comments"; requestId: string },
      },
      validate: (value) => {
        const input =
          typeof value === "object" && value !== null
            ? (value as { id?: unknown; tab?: unknown; requestId?: unknown })
            : {};

        if (
          typeof input.id !== "string" ||
          (input.tab !== "info" && input.tab !== "comments") ||
          typeof input.requestId !== "string"
        ) {
          return {
            issues: [{ message: "invalid page output" }],
          };
        }

        return {
          value: {
            id: input.id,
            tab: input.tab,
            requestId: input.requestId,
          },
        };
      },
    },
  };

  it("renders procedure body data for page props", async () => {
    const page = baseNextPage(
      procedure
        .forRoute(pageRouteContract)
        .params(paramsSchema)
        .query(querySchema)
        .output<typeof outputSchema, { id: string; tab: "info" | "comments"; requestId: string }>(
          outputSchema,
        )
        .use(({ params }) => ({
          ctx: {
            requestId: `page:${params.id}`,
          },
        }))
        .handle(({ params, query, ctx }) => ({
          body: {
            id: params.id,
            tab: query.tab,
            requestId: ctx.requestId,
          },
        })),
      ({ data, ctx }) => {
        const _data: { id: string; tab: "info" | "comments"; requestId: string } = data;
        const _ctx: object = ctx;

        void _data;
        void _ctx;

        return `${data.id}:${data.tab}:${data.requestId}`;
      },
    );

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "comments" }),
      }),
    ).resolves.toBe("photo-1:comments:page:photo-1");
  });

  it("renders validated params and query without a page handler", async () => {
    const page = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema)
      .nextPage(({ params, query }) => `${params.id}:${query.tab}`);

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "comments" }),
      }),
    ).resolves.toBe("photo-1:comments");
  });

  it("passes validated params and query alongside handled page data", async () => {
    const page = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema)
      .handle(({ params, query }) => ({
        body: {
          summary: `${params.id}:${query.tab}`,
        },
      }))
      .nextPage(({ data, params, query }) => `${data.summary}:${params.id}:${query.tab}`);

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "comments" }),
      }),
    ).resolves.toBe("photo-1:comments:photo-1:comments");
  });

  it("does not render when page input validation fails without a handler", async () => {
    const onError = vi.fn<() => string>(() => "invalid-page");
    const render = vi.fn<() => string>(() => "rendered");
    const page = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema)
      .nextPage(render, {
        onError,
      });

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "bad" }),
      }),
    ).resolves.toBe("invalid-page");

    expect(render).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("validates page params and query once for handler and render", async () => {
    const countingParamsSchema: typeof paramsSchema = {
      "~standard": {
        ...paramsSchema["~standard"],
        validate: vi.fn<(typeof paramsSchema)["~standard"]["validate"]>(
          paramsSchema["~standard"].validate,
        ),
      },
    };
    const countingQuerySchema: typeof querySchema = {
      "~standard": {
        ...querySchema["~standard"],
        validate: vi.fn<(typeof querySchema)["~standard"]["validate"]>(
          querySchema["~standard"].validate,
        ),
      },
    };

    const page = procedure
      .forRoute(pageRouteContract)
      .params(countingParamsSchema)
      .query(countingQuerySchema)
      .handle(({ params, query }) => ({
        body: {
          id: params.id,
          tab: query.tab,
        },
      }))
      .nextPage(({ data, params, query }) => `${data.id}:${data.tab}:${params.id}:${query.tab}`);

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "comments" }),
      }),
    ).resolves.toBe("photo-1:comments:photo-1:comments");

    expect(countingParamsSchema["~standard"].validate).toHaveBeenCalledTimes(1);
    expect(countingQuerySchema["~standard"].validate).toHaveBeenCalledTimes(1);
  });

  it("passes validation errors to page onError", async () => {
    const onError = vi.fn<() => string>(() => "invalid-page");
    const page = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema)
      .handle(({ params, query }) => ({
        body: {
          id: params.id,
          tab: query.tab,
        },
      }))
      .nextPage(({ data }) => data, {
        onError,
      });

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "bad" }),
      }),
    ).resolves.toBe("invalid-page");

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("validates page output when runtime output validation is enabled", async () => {
    const page = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .output<typeof outputSchema, { id: string; tab: "info" | "comments"; requestId: string }>(
        outputSchema,
      )
      .handle(({ params }) => ({
        body: {
          id: params.id,
          tab: "comments" as const,
          requestId: "before-parse",
        },
      }))
      .nextPage(({ data }) => data, {
        validateOutput: true,
      });

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
      }),
    ).resolves.toEqual({
      id: "photo-1",
      tab: "comments",
      requestId: "before-parse",
    });
  });

  it("passes page output validation failures to page onError", async () => {
    const onError = vi.fn<(error: unknown) => string>(() => "invalid-output");
    const page = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .output<typeof outputSchema, { id: string; tab: "info" | "comments"; requestId: string }>(
        outputSchema,
      )
      .handle(({ params }) => ({
        body: {
          id: params.id,
          tab: "invalid" as unknown as "info",
          requestId: "before-parse",
        },
      }))
      .nextPage(({ data }) => data, {
        onError,
        validateOutput: true,
      });

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
      }),
    ).resolves.toBe("invalid-output");

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("requires Standard Schema output contracts when page runtime validation is enabled", () => {
    expect(() =>
      procedure
        .forRoute(pageRouteContract)
        .params(paramsSchema)
        .output({
          _output: {
            id: "" as string,
          },
        })
        .handle(({ params }) => ({
          body: {
            id: params.id,
          },
        }))
        .nextPage(({ data }) => data, {
          validateOutput: true,
        }),
    ).toThrow(
      "Procedure output contracts must implement Standard Schema V1 when validateOutput is enabled.",
    );
  });

  it("lets page defaults provide nextPage onError", async () => {
    const appProcedure = procedure.defaults({
      page: {
        onError: () => "default-page-error",
      },
    });

    const page = appProcedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema)
      .handle(({ params, query }) => ({
        body: {
          id: params.id,
          tab: query.tab,
        },
      }))
      .nextPage(({ data }) => data);

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "bad" }),
      }),
    ).resolves.toBe("default-page-error");
  });

  it("rethrows page navigation interrupts before page onError", async () => {
    const onError = vi.fn<() => string>(() => "swallowed-navigation-interrupt");
    const page = procedure
      .defaults({
        page: {
          onError,
        },
      })
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .handle(({ page }) => {
        return page.redirect("/photo/next");
      })
      .nextPage(() => "rendered");

    let caught: unknown;

    try {
      await page({
        params: Promise.resolve({ id: "photo-1" }),
      });
    } catch (error) {
      caught = error;
    }

    expect(String((caught as { digest?: unknown } | undefined)?.digest)).toContain("NEXT_REDIRECT");
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps page constraints separate from route constraints", () => {
    const unboundProcedure = procedure.handle(() => ({
      status: 204 as const,
    }));

    // @ts-expect-error nextPage() only accepts route-bound procedures
    unboundProcedure.nextPage(() => null);

    const jsonProcedure = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .json({
        "~standard": {
          version: 1,
          vendor: "rpc4next-test",
          validate: (value: unknown) => ({ value }),
        },
      })
      .handle(() => ({
        body: {
          ok: true as const,
        },
      }));

    // @ts-expect-error page procedures do not support json contracts
    jsonProcedure.nextPage(() => null);

    expectTypeOf(unboundProcedure.definition).toExtend<object>();
  });

  it("rejects route-style terminal results for page procedures", () => {
    const responseProcedure = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .handle(() => new Response("route-response"));

    // @ts-expect-error page procedures cannot return raw Response values
    responseProcedure.nextPage(() => null);

    const responseHelperProcedure = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .handle(({ response }) =>
        response.error("FORBIDDEN", {
          message: "route-style-error",
        }),
      );

    // @ts-expect-error page procedures cannot return response helper values
    responseHelperProcedure.nextPage(() => null);

    const redirectProcedure = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .handle(() => ({
        redirect: "/photo/next",
      }));

    // @ts-expect-error page procedures should throw redirect(), not return ProcedureResult redirects
    redirectProcedure.nextPage(() => null);

    const middlewareResponseProcedure = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .use(() => new Response("middleware-response"))
      .handle(({ params }) => ({
        body: {
          id: params.id,
        },
      }));

    // @ts-expect-error page middleware cannot return raw Response values
    middlewareResponseProcedure.nextPage(() => null);

    expectTypeOf(responseProcedure.definition).toExtend<object>();
  });
});

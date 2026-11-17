import { notFound, redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";

import type { PageInputOptions, PageInputTarget, PageValidationErrorContext } from "./index";
import {
  createNextPage as basecreateNextPage,
  type ProcedurePageOnValidationError,
} from "./next-page";
import { runWithRpcPageTestRequest } from "./page-test-request-context";
import { createPageProcedure, procedure } from "./procedure";
import type { ProcedureRouteContract } from "./procedure-types";
import type { StandardSchemaV1 } from "./standard-schema";

const nextHeadersMock = vi.hoisted(() => ({
  cookies: vi.fn<() => Promise<{ getAll: () => Array<{ name: string; value: string }> }>>(),
  headers: vi.fn<() => Promise<Headers>>(),
}));

vi.mock("next/headers", () => ({
  cookies: nextHeadersMock.cookies,
  headers: nextHeadersMock.headers,
}));

describe("createNextPage", () => {
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

  const headersSchema: StandardSchemaV1<Record<string, string>, { "x-page-test-user": string }> = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as Record<string, string>,
        output: {} as { "x-page-test-user": string },
      },
      validate: (value) => {
        const headers =
          typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
        const user = headers["x-page-test-user"];

        return typeof user === "string"
          ? { value: { "x-page-test-user": user } }
          : { issues: [{ message: "missing user header" }] };
      },
    },
  };

  const cookiesSchema: StandardSchemaV1<Record<string, string>, { session: string }> = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as Record<string, string>,
        output: {} as { session: string },
      },
      validate: (value) => {
        const cookies =
          typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
        const session = cookies.session;

        return typeof session === "string"
          ? { value: { session } }
          : { issues: [{ message: "missing session cookie" }] };
      },
    },
  };

  beforeEach(() => {
    nextHeadersMock.headers.mockReset();
    nextHeadersMock.cookies.mockReset();
  });

  it.each([false, true])(
    "renders undefined data for an empty handler result (async: %s)",
    async (asyncHandler) => {
      const onError = vi.fn<() => string>(() => "error");
      const handler = vi.fn<(ctx: { user: string }) => object>((ctx) => {
        expect(ctx.user).toBe("reader");

        return {};
      });
      const render = vi.fn<(context: { data: unknown }) => unknown>(({ data }) => data);
      const builder = createPageProcedure({ onError })
        .forRoute(pageRouteContract)
        .params(paramsSchema)
        .use(() => undefined)
        .use(() => ({ ctx: { user: "reader" } }));
      const page = builder
        .handle(asyncHandler ? async ({ ctx }) => handler(ctx) : ({ ctx }) => handler(ctx))
        .page(render);

      await expect(page({ params: Promise.resolve({ id: "photo-1" }) })).resolves.toBeUndefined();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(render).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ data: undefined }));
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "keeps middleware-only page execution working (terminal: %s)",
    async (terminal) => {
      const laterMiddleware = vi.fn<() => undefined>(() => undefined);
      const handler = vi.fn<() => { body: string }>(() => ({ body: "handler" }));
      const builder = procedure
        .forRoute(pageRouteContract)
        .params(paramsSchema)
        .use(() => undefined)
        .use(() => ({ ctx: { user: "reader" } }))
        .use(() => (terminal ? { body: "middleware" } : undefined))
        .use(laterMiddleware);
      const page = builder.page(({ ctx }) => ctx.user);
      const handledPage = builder.handle(handler).page(({ data }) => data);
      const props = { params: Promise.resolve({ id: "photo-1" }) };

      await expect(page(props)).resolves.toBe("reader");
      await expect(handledPage(props)).resolves.toBe(terminal ? "middleware" : "handler");
      expect(laterMiddleware).toHaveBeenCalledTimes(terminal ? 0 : 2);
      expect(handler).toHaveBeenCalledTimes(terminal ? 0 : 1);
    },
  );

  it.each([
    ["a?b", "a%3Fb"],
    ["a#b", "a%23b"],
    ["100%", "100%25"],
    ["a b", "a%20b"],
    ["日本語", "%E6%97%A5%E6%9C%AC%E8%AA%9E"],
    ["a%2Fb", "a%2Fb"],
    ["a%2523b", "a%2523b"],
    ["a%252Fb", "a%252Fb"],
    ["%5Bid%5D", "%5Bid%5D"],
    ["%E0%A4%A", "%25E0%25A4%25A"],
  ])("keeps static segment %s separate from search params", async (segment, encoded) => {
    const page = procedure
      .forRoute({ pathname: `/static/${segment}`, params: {} } as ProcedureRouteContract<
        string,
        {}
      >)
      .handle(({ request }) => ({
        body: {
          pathname: request.nextUrl.pathname,
          query: [...request.nextUrl.searchParams],
          hash: request.nextUrl.hash,
        },
      }))
      .page(({ data }) => data);

    await expect(
      page({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ tag: ["a?b", "日本語/#%"], omitted: undefined }),
      }),
    ).resolves.toEqual({
      pathname: `/static/${encoded}`,
      query: [
        ["tag", "a?b"],
        ["tag", "日本語/#%"],
      ],
      hash: "",
    });
    await expect(page({ params: Promise.resolve({}) })).resolves.toEqual({
      pathname: `/static/${encoded}`,
      query: [],
      hash: "",
    });
  });

  it.each([
    ["[id]", { id: "a?b#% /日本語%2F" }, "a%3Fb%23%25%20%2F%E6%97%A5%E6%9C%AC%E8%AA%9E%252F"],
    [
      "[...parts]",
      { parts: ["a/b", "a%2Fb", "?#% 日本語"] },
      "a%2Fb/a%252Fb/%3F%23%25%20%E6%97%A5%E6%9C%AC%E8%AA%9E",
    ],
    ["[[...parts]]", { parts: ["a/b", "a%23b"] }, "a%2Fb/a%2523b"],
    ["[[...parts]]", {}, ""],
    ["[[...parts]]", { parts: [] }, ""],
    ["[...parts]", {}, ""],
    ["[id]", {}, ""],
  ])("substitutes %s without decoding parameter values", async (marker, params, encoded) => {
    const page = procedure
      .forRoute({
        pathname: `/static/a%2Fb/${marker}`,
        params: {} as { id?: string; parts?: string[] },
      } as ProcedureRouteContract<string, { id?: string; parts?: string[] }>)
      .params(z.object({ id: z.string().optional(), parts: z.array(z.string()).optional() }))
      .handle(({ request }) => ({
        body: { pathname: request.nextUrl.pathname, search: request.nextUrl.search },
      }))
      .page(({ data }) => data);

    await expect(page({ params: Promise.resolve(params) })).resolves.toEqual({
      pathname: `/static/a%2Fb/${encoded}`,
      search: "",
    });
  });

  it("renders procedure body data for page props", async () => {
    const page = basecreateNextPage(
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
      .page(({ params, query }) => `${params.id}:${query.tab}`);

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "comments" }),
      }),
    ).resolves.toBe("photo-1:comments");
  });

  it("reads validated headers and cookies from the page test request context", async () => {
    const page = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .headers(headersSchema)
      .cookies(cookiesSchema)
      .handle(({ cookies, headers, params }) => ({
        body: {
          id: params.id,
          session: cookies.session,
          user: headers["x-page-test-user"],
        },
      }))
      .page(({ data }) => data);

    const request = new NextRequest("http://rpc4next.test/photo/photo-1", {
      headers: {
        "x-page-test-user": "alice",
        cookie: "session=abc",
      },
    });

    await expect(
      runWithRpcPageTestRequest(request, () =>
        page({
          params: Promise.resolve({ id: "photo-1" }),
        }),
      ),
    ).resolves.toEqual({
      id: "photo-1",
      session: "abc",
      user: "alice",
    });
    expect(nextHeadersMock.headers).not.toHaveBeenCalled();
    expect(nextHeadersMock.cookies).not.toHaveBeenCalled();
  });

  it("falls back to next/headers when no page test request context exists", async () => {
    nextHeadersMock.headers.mockResolvedValue(new Headers({ "x-page-test-user": "next" }));
    nextHeadersMock.cookies.mockResolvedValue({
      getAll: () => [{ name: "session", value: "cookie-store" }],
    });

    const page = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .headers(headersSchema)
      .cookies(cookiesSchema)
      .handle(({ cookies, headers, params }) => ({
        body: {
          id: params.id,
          session: cookies.session,
          user: headers["x-page-test-user"],
        },
      }))
      .page(({ data }) => data);

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
      }),
    ).resolves.toEqual({
      id: "photo-1",
      session: "cookie-store",
      user: "next",
    });
    expect(nextHeadersMock.headers).toHaveBeenCalledTimes(1);
    expect(nextHeadersMock.cookies).toHaveBeenCalledTimes(1);
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
      .page(({ data, params, query }) => `${data.summary}:${params.id}:${query.tab}`);

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
      .page(render, {
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

  it("uses page validation error handling from createPageProcedure", async () => {
    const onValidationError = (({ issues, target }) => ({
      source: "shared-page-validation" as const,
      target,
      messages: issues.map((issue) => issue.message),
    })) satisfies ProcedurePageOnValidationError;
    const appProcedure = createPageProcedure({
      onError: () => "page-error",
      onValidationError,
    });
    const render = vi.fn<() => string>(() => "rendered");

    const page = appProcedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema)
      .page(render);

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "bad" }),
      }),
    ).resolves.toEqual({
      source: "shared-page-validation",
      target: "query",
      messages: ["invalid tab"],
    });

    expect(render).not.toHaveBeenCalled();
  });

  it("lets page-local validation error handling override createPageProcedure defaults", async () => {
    const onValidationError = (({ target }) =>
      `local-${target}-validation`) satisfies ProcedurePageOnValidationError;
    const appProcedure = createPageProcedure({
      onError: () => "page-error",
      onValidationError: () => "shared-page-validation",
    });

    const page = appProcedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema)
      .page(() => "rendered", {
        onValidationError,
      });

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "bad" }),
      }),
    ).resolves.toBe("local-query-validation");
  });

  it.each(["params", "query", "headers", "cookies"] as const)(
    "prioritizes the %s input hook and passes only page context",
    async (target) => {
      nextHeadersMock.headers.mockResolvedValue(new Headers({ "x-test": "raw-header" }));
      nextHeadersMock.cookies.mockResolvedValue({
        getAll: () => [{ name: "session", value: "raw-cookie" }],
      });
      const fallback = { source: "input" as const };
      const inputHook = vi.fn<() => Promise<typeof fallback>>(async () => fallback);
      const sharedHook = vi.fn<() => string>(() => "shared");
      const localHook = vi.fn<() => string>(() => "local");
      const onError = vi.fn<() => string>(() => "error");
      const middleware = vi.fn<() => undefined>(() => undefined);
      const render = vi.fn<() => string>(() => "rendered");
      const builder = createPageProcedure({ onError, onValidationError: sharedHook })
        .use(middleware)
        .forRoute(pageRouteContract);
      const schema = z.object({ id: z.string().min(20) });
      const input =
        target === "params"
          ? builder.params(schema, { onValidationError: inputHook })
          : builder.params(paramsSchema)[target](schema, { onValidationError: inputHook });
      const page = input.page(render, { onValidationError: localHook });

      await expect(
        page({
          params: Promise.resolve({ id: "photo-1" }),
          searchParams: Promise.resolve({ tab: "bad" }),
        }),
      ).resolves.toBe(fallback);
      expect(inputHook).toHaveBeenCalledExactlyOnceWith({
        target,
        value:
          target === "params"
            ? { id: "photo-1" }
            : target === "query"
              ? { tab: "bad" }
              : target === "headers"
                ? { "x-test": "raw-header" }
                : { session: "raw-cookie" },
        issues: expect.any(Array),
        params: { id: "photo-1" },
        searchParams: { tab: "bad" },
      });
      for (const callback of [sharedHook, localHook, onError, middleware, render]) {
        expect(callback).not.toHaveBeenCalled();
      }
    },
  );

  it.each(["params", "query", "headers", "cookies"] as const)(
    "uses the shared hook for %s when the input hook is absent",
    async (target) => {
      nextHeadersMock.headers.mockResolvedValue(new Headers());
      nextHeadersMock.cookies.mockResolvedValue({ getAll: () => [] });
      const sharedHook = vi.fn<(context: { target: string }) => string>(
        ({ target }) => `shared-${target}`,
      );
      const builder = createPageProcedure({
        onError: () => "error",
        onValidationError: sharedHook,
      }).forRoute(pageRouteContract);
      const schema = z.object({ id: z.string().min(20) });
      const input =
        target === "params" ? builder.params(schema) : builder.params(paramsSchema)[target](schema);
      const page = input.page(() => "rendered");
      await expect(page({ params: Promise.resolve({ id: "photo-1" }) })).resolves.toBe(
        `shared-${target}`,
      );
      expect(sharedHook).toHaveBeenCalledTimes(1);
    },
  );

  it("does not call error hooks when all four inputs are valid", async () => {
    nextHeadersMock.headers.mockResolvedValue(new Headers({ "x-page-test-user": "Ada" }));
    nextHeadersMock.cookies.mockResolvedValue({
      getAll: () => [{ name: "session", value: "token" }],
    });
    const hook = vi.fn<() => string>(() => "invalid");
    const onError = vi.fn<() => string>(() => "error");
    const page = createPageProcedure({ onError, onValidationError: hook })
      .forRoute(pageRouteContract)
      .params(paramsSchema, { onValidationError: hook })
      .query(querySchema, { onValidationError: hook })
      .headers(headersSchema, { onValidationError: hook })
      .cookies(cookiesSchema, { onValidationError: hook })
      .page(() => "rendered");
    await expect(page({ params: Promise.resolve({ id: "photo-1" }) })).resolves.toBe("rendered");
    expect(hook).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it.each([null, false, 0, "", { fallback: true }])(
    "returns defined input hook results (%j) directly",
    async (fallback) => {
      const page = createPageProcedure({ onError: () => "error" })
        .forRoute(pageRouteContract)
        .params(paramsSchema)
        .query(querySchema, { onValidationError: () => fallback })
        .page(() => "rendered");
      await expect(
        page({
          params: Promise.resolve({ id: "photo-1" }),
          searchParams: Promise.resolve({ tab: "bad" }),
        }),
      ).resolves.toBe(fallback);
    },
  );

  it("uses the normal validation error path for undefined without calling shared hooks", async () => {
    const sharedHook = vi.fn<() => string>(() => "shared");
    const inputHook = vi.fn<() => Promise<undefined>>(async () => undefined);
    const onError = vi.fn<(error: unknown) => unknown>((error) => error);
    const page = createPageProcedure({ onError, onValidationError: sharedHook })
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema, { onValidationError: inputHook })
      .page(() => "rendered");
    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "bad" }),
      }),
    ).resolves.toEqual(new Error("invalid tab"));
    expect(inputHook).toHaveBeenCalledTimes(1);
    expect(sharedHook).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledExactlyOnceWith(new Error("invalid tab"), {
      params: { id: "photo-1" },
      searchParams: { tab: "bad" },
    });
  });

  it("rethrows the default validation error after an undefined input hook result", async () => {
    const page = createPageProcedure({
      onError: (error) => {
        throw error;
      },
    })
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema, { onValidationError: () => undefined })
      .page(() => "rendered");
    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "bad" }),
      }),
    ).rejects.toThrow("invalid tab");
  });

  it.each([false, true])(
    "passes thrown or rejected input hook errors to onError (async: %s)",
    async (asyncHook) => {
      const error = new Error("input hook failed");
      const onError = vi.fn<(error: unknown) => string>(() => "caught");
      const sharedHook = vi.fn<() => string>(() => "shared");
      const fail = () => {
        throw error;
      };
      const page = createPageProcedure({ onError, onValidationError: sharedHook })
        .forRoute(pageRouteContract)
        .params(paramsSchema)
        .query(querySchema, { onValidationError: asyncHook ? async () => fail() : fail })
        .page(() => "rendered");
      await expect(
        page({
          params: Promise.resolve({ id: "photo-1" }),
          searchParams: Promise.resolve({ tab: "bad" }),
        }),
      ).resolves.toBe("caught");
      expect(onError.mock.calls[0]?.[0]).toBe(error);
      expect(sharedHook).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: "redirect", navigate: () => redirect("/photo/next") },
    { name: "notFound", navigate: () => notFound() },
  ])("rethrows $name from input validation hooks", async ({ navigate }) => {
    const onError = vi.fn<() => string>(() => "caught");
    let navigationError: unknown;
    const page = createPageProcedure({ onError })
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema, {
        onValidationError: async () => {
          try {
            return navigate();
          } catch (error) {
            navigationError = error;
            throw error;
          }
        },
      })
      .page(() => "rendered");
    const result = page({
      params: Promise.resolve({ id: "photo-1" }),
      searchParams: Promise.resolve({ tab: "bad" }),
    });
    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.toBe(navigationError);
    expect(onError).not.toHaveBeenCalled();
  });

  it("infers input hook results for builder, handled, and direct page adapters", () => {
    expectTypeOf<PageInputTarget>().toEqualTypeOf<"params" | "query" | "headers" | "cookies">();
    expectTypeOf<PageValidationErrorContext["target"]>().toEqualTypeOf<PageInputTarget>();
    const queryOptions = {
      onValidationError: () => "invalid-query" as const,
    } satisfies PageInputOptions<"query", unknown, "invalid-query">;
    const publicPage = createPageProcedure({ onError: () => "error" as const })
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema, queryOptions)
      .page(() => "rendered" as const);
    expectTypeOf<Awaited<ReturnType<typeof publicPage>>>().toEqualTypeOf<
      "rendered" | "error" | "invalid-query"
    >();
    const builder = createPageProcedure({ onError: () => "error" as const })
      .forRoute(pageRouteContract)
      .params(paramsSchema, {
        onValidationError: ({ target, value, params, searchParams }) => {
          expectTypeOf(target).toEqualTypeOf<"params">();
          expectTypeOf(value).toEqualTypeOf<{ id: string }>();
          expectTypeOf(params).toEqualTypeOf<Record<string, string | string[]>>();
          expectTypeOf(searchParams).toEqualTypeOf<Record<string, string | string[]>>();

          return 42 as const;
        },
      })
      .query(querySchema, {
        onValidationError: async (context) => {
          expectTypeOf(context.target).toEqualTypeOf<"query">();
          // @ts-expect-error page hooks do not receive route response helpers
          expectTypeOf(context.response).toBeUnknown();
          // @ts-expect-error page hooks do not receive a synthetic request
          expectTypeOf(context.request).toBeUnknown();

          return Math.random() > 0.5 ? (false as const) : undefined;
        },
      });
    const page = builder.page(() => "rendered" as const);
    const handled = builder.handle(() => ({ body: "data" })).page(() => "rendered" as const);
    const direct = basecreateNextPage(
      builder.handle(() => ({ body: "data" })),
      () => "rendered" as const,
    );
    expectTypeOf<Awaited<ReturnType<typeof page>>>().toEqualTypeOf<
      "rendered" | "error" | 42 | false
    >();
    expectTypeOf<Awaited<ReturnType<typeof handled>>>().toEqualTypeOf<
      "rendered" | "error" | 42 | false
    >();
    expectTypeOf<Awaited<ReturnType<typeof direct>>>().toEqualTypeOf<"rendered" | 42 | false>();
    const routeHook = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema, {
        onValidationError: ({ response }) => response.json({ invalid: true }),
      });
    expect(() => {
      // @ts-expect-error route input hooks require a route context
      routeHook.page(() => "rendered");
    }).toThrow("Route input validation hooks cannot be used by page procedures.");
    const throwingRouteHook = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .query(querySchema, {
        onValidationError: () => {
          throw new Error("route hook");
        },
      });
    expect(() => {
      // @ts-expect-error even hooks returning never still require the route context
      throwingRouteHook.page(() => "rendered");
    }).toThrow("Route input validation hooks cannot be used by page procedures.");
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
      .page(({ data, params, query }) => `${data.id}:${data.tab}:${params.id}:${query.tab}`);

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
      .page(({ data }) => data, {
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
      .page(({ data }) => data, {
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
      .page(({ data }) => data, {
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
        .page(({ data }) => data, {
          validateOutput: true,
        }),
    ).toThrow(
      "Procedure output contracts must implement Standard Schema V1 when validateOutput is enabled.",
    );
  });

  it("lets createPageProcedure provide page terminal onError", async () => {
    const appProcedure = createPageProcedure({
      onError: () => "default-page-error",
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
      .page(({ data }) => data);

    await expect(
      page({
        params: Promise.resolve({ id: "photo-1" }),
        searchParams: Promise.resolve({ tab: "bad" }),
      }),
    ).resolves.toBe("default-page-error");
  });

  it.each(["sync", "async"] as const)(
    "handles %s render errors with page onError",
    async (mode) => {
      const error = new Error("render failed");
      const render = () => {
        throw error;
      };
      const onError = vi.fn<() => "render-fallback">(() => "render-fallback");
      const page = procedure
        .forRoute(pageRouteContract)
        .params(paramsSchema)
        .page(
          mode === "async"
            ? async () => {
                await Promise.resolve();

                return render();
              }
            : render,
          { onError },
        );

      await expect(
        page({
          params: Promise.resolve({ id: "photo-1" }),
          searchParams: Promise.resolve({ tab: "comments" }),
        }),
      ).resolves.toBe("render-fallback");
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(error, {
        params: { id: "photo-1" },
        searchParams: { tab: "comments" },
      });
      expectTypeOf<Awaited<ReturnType<typeof page>>>().toEqualTypeOf<"render-fallback">();
    },
  );

  it("returns async onError fallbacks from createPageProcedure for async render errors", async () => {
    const error = new Error("async render failed");
    const fallback = { source: "page-error" as const };
    const onError = vi.fn<() => Promise<typeof fallback>>(async () => {
      await Promise.resolve();

      return fallback;
    });
    const page = createPageProcedure({ onError })
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .page(async ({ params }) => {
        await Promise.resolve();
        if (params.id === "photo-1") {
          throw error;
        }

        return 42;
      });

    await expect(page({ params: Promise.resolve({ id: "photo-1" }) })).resolves.toBe(fallback);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error, {
      params: { id: "photo-1" },
      searchParams: {},
    });
    await expect(page({ params: Promise.resolve({ id: "photo-2" }) })).resolves.toBe(42);
    expect(onError).toHaveBeenCalledTimes(1);
    expectTypeOf<Awaited<ReturnType<typeof page>>>().toEqualTypeOf<number | typeof fallback>();
  });

  it.each(["sync", "async"] as const)("rethrows %s render errors by default", async (mode) => {
    const error = new Error("render failed");
    const render = () => {
      throw error;
    };
    const page = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .page(
        mode === "async"
          ? async () => {
              await Promise.resolve();

              return render();
            }
          : render,
      );

    await expect(page({ params: Promise.resolve({ id: "photo-1" }) })).rejects.toBe(error);
    expectTypeOf<Awaited<ReturnType<typeof page>>>().toEqualTypeOf<never>();
  });

  it.each([
    { name: "redirect", navigate: () => redirect("/photo/next") },
    { name: "notFound", navigate: () => notFound() },
  ])("rethrows $name from async render before page onError", async ({ navigate }) => {
    const onError = vi.fn<() => string>(() => "swallowed-navigation-interrupt");
    let navigationError: unknown;
    const page = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .page(
        async () => {
          await Promise.resolve();

          try {
            return navigate();
          } catch (error) {
            navigationError = error;
            throw error;
          }
        },
        { onError },
      );

    const result = page({ params: Promise.resolve({ id: "photo-1" }) });
    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.toBe(navigationError);
    expect(onError).not.toHaveBeenCalled();
  });

  it("rethrows page navigation interrupts before page onError", async () => {
    const onError = vi.fn<() => string>(() => "swallowed-navigation-interrupt");
    const page = createPageProcedure({
      onError,
    })
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .handle(({ page }) => {
        return page.redirect("/photo/next");
      })
      .page(() => "rendered");

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

    // @ts-expect-error page() only accepts route-bound procedures
    unboundProcedure.page(() => null);

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
    jsonProcedure.page(() => null);

    expectTypeOf(unboundProcedure.definition).toExtend<object>();
  });

  it("rejects route-style terminal results for page procedures", () => {
    const responseProcedure = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .handle(() => new Response("route-response"));

    // @ts-expect-error page procedures cannot return raw Response values
    responseProcedure.page(() => null);

    const responseHelperProcedure = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .handle(({ response }) =>
        response.error("FORBIDDEN", {
          message: "route-style-error",
        }),
      );

    // @ts-expect-error page procedures cannot return response helper values
    responseHelperProcedure.page(() => null);

    const redirectProcedure = procedure
      .forRoute(pageRouteContract)
      .params(paramsSchema)
      .handle(() => ({
        redirect: "/photo/next",
      }));

    // @ts-expect-error page procedures should throw redirect(), not return ProcedureResult redirects
    redirectProcedure.page(() => null);

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
    middlewareResponseProcedure.page(() => null);

    expectTypeOf(responseProcedure.definition).toExtend<object>();
  });
});

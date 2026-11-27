import { NextRequest } from "next/server";
import {
  HTTP_METHODS,
  encodeRouteParamName,
  type HttpMethod,
  type OPTIONAL_CATCH_ALL_PREFIX,
  type CATCH_ALL_PREFIX,
  type DYNAMIC_PREFIX,
} from "rpc4next-shared";

import { runWithRpcPageTestRequest } from "../server/page-test-request-context";
import type { ProcedureRouteContract } from "../server/procedure-types";
import { makeCreateRpc } from "./rpc";
import { createRpcClient } from "./rpc-client";
import type {
  DynamicPathProxyAsFunction,
  InferPageRenderResult,
  InferPageQuery,
  ParamsKey,
  PathParamsInput,
  QueryKey,
  RpcClientCreationOptions,
  RpcEndpoint,
  RpcGeneratedPathStructure,
  rpc4nextGeneratedSchemaSymbol,
  rpc4nextPageRouteSymbol,
  UrlOptions,
} from "./types";
import { createUrl } from "./url";

/** Dynamic params supplied to route handlers by `createRpcTestClient`. */
export type RpcTestRouteParams = Record<string, string | string[] | undefined>;
/** Resolves test-only route params from the request when pathname inference is not enough. */
export type RpcTestRouteParamsResolver = (context: {
  request: NextRequest;
  url: URL;
}) => RpcTestRouteParams | Promise<RpcTestRouteParams>;

/** Next.js route handler shape loaded by the generated rpc4next test manifest. */
export type RpcTestRouteHandler = (
  request: NextRequest,
  segmentData: { params: Promise<RpcTestRouteParams> },
) => Response | Promise<Response>;

/** Module shape for a route file used by the generated rpc4next test manifest. */
export type RpcTestRouteModule = Partial<Record<HttpMethod, RpcTestRouteHandler>>;

/** Route manifest entry consumed by `createRpcTestClient`. */
export type RpcTestRoute = Pick<ProcedureRouteContract, "pathname"> & {
  load: () => Promise<RpcTestRouteModule>;
  methods: readonly HttpMethod[];
  params?: RpcTestRouteParams | RpcTestRouteParamsResolver;
};

/** Next.js page handler shape loaded by the generated rpc4next test manifest. */
export type RpcTestPageHandler = (props: {
  params: Promise<RpcTestRouteParams>;
  searchParams?: Promise<RpcTestRouteParams>;
}) => unknown | Promise<unknown>;

/** Module shape for a page file used by the generated rpc4next test manifest. */
export type RpcTestPageModule = {
  default: RpcTestPageHandler;
};

/** Page manifest entry consumed by `createRpcTestPageClient`. */
export type RpcTestPage = Pick<ProcedureRouteContract, "pathname"> & {
  /** Import path of the page relative to the generated test manifest. */
  file?: string;
  /** Type-only query override emitted for pages exporting Query. */
  queryType?: unknown;
  load: () => Promise<RpcTestPageModule>;
  params?: RpcTestRouteParams | RpcTestRouteParamsResolver;
};

/** Options for the in-process route test client. */
export type RpcTestClientOptions = Omit<RpcClientCreationOptions, "fetch"> & {
  baseUrl?: string;
};

/** Options for the in-process page render test client. */
export type RpcTestPageRendererOptions = {
  baseUrl?: string;
};

type RpcGeneratedSchemaKey = typeof rpc4nextGeneratedSchemaSymbol;
type RpcPageRouteKey = typeof rpc4nextPageRouteSymbol;
type HasQueryMarker = Record<QueryKey, unknown>;
type AllOptional<T> = Partial<T> extends T ? true : false;
type OptionalCatchAllKey = `${typeof OPTIONAL_CATCH_ALL_PREFIX}${string}`;
type CatchAllKey = `${typeof CATCH_ALL_PREFIX}${string}`;
type DynamicKey = `${typeof DYNAMIC_PREFIX}${string}`;
type NonEmptyArray<T> = [T, ...T[]];
type RpcTestPageRenderUrlOptions<T> = T extends HasQueryMarker
  ? AllOptional<T[QueryKey]> extends true
    ? { query?: T[QueryKey]; hash?: string }
    : { query: T[QueryKey]; hash?: string }
  : { hash?: string };
type RpcTestPageRenderOptions<T, TUrlOptions = RpcTestPageRenderUrlOptions<T>> = {
  init?: RequestInit;
} & (AllOptional<TUrlOptions> extends true ? { url?: TUrlOptions } : { url: TUrlOptions });
type RpcTestPageRenderArgs<T, TOptions = RpcTestPageRenderOptions<T>> =
  AllOptional<TOptions> extends true ? [options?: TOptions] : [options: TOptions];
type RpcTestPagePathProxyAsFunction<T> = {
  $render: (...args: RpcTestPageRenderArgs<T>) => Promise<InferPageRenderResult<T>>;
};
type ParamFunction<T, TParamArgs extends unknown[]> = (
  ...args: TParamArgs
) => RpcTestPageDynamicPathProxyAsFunction<T>;

/** Generated page test proxy shape with `$render()` available at page leaves. */
export type RpcTestPageDynamicPathProxyAsFunction<T> = Omit<
  (T extends RpcEndpoint ? RpcTestPagePathProxyAsFunction<T> : unknown) & {
    [K in keyof T]: K extends OptionalCatchAllKey
      ? ParamFunction<T[K], [value?: string[]]>
      : K extends CatchAllKey
        ? ParamFunction<T[K], [value: NonEmptyArray<string>]>
        : K extends DynamicKey
          ? ParamFunction<T[K], [value: string | number]>
          : RpcTestPageDynamicPathProxyAsFunction<T[K]>;
  },
  QueryKey | ParamsKey | RpcGeneratedSchemaKey | RpcPageRouteKey
>;

const DEFAULT_TEST_BASE_URL = "http://rpc4next.test";
const httpMethods = new Set<string>(HTTP_METHODS);

const safeDecode = (value: string | undefined) => {
  if (value === undefined) return undefined;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSegment = (value: string) => encodeURIComponent(safeDecode(value) ?? "");

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");

  return trimmed ? `/${trimmed}` : "/";
};

const getSegmentPriority = (segment: string) => {
  if (/^\[\[\.\.\.(.+)\]\]$/.test(segment)) return 1;
  if (/^\[\.\.\.(.+)\]$/.test(segment)) return 2;
  if (/^\[(.+)\]$/.test(segment)) return 3;

  return 4;
};

const compareRoutePriority = (
  left: Pick<ProcedureRouteContract, "pathname">,
  right: Pick<ProcedureRouteContract, "pathname">,
) => {
  const leftSegments = normalizePathname(left.pathname).split("/").filter(Boolean);
  const rightSegments = normalizePathname(right.pathname).split("/").filter(Boolean);
  const maxLength = Math.max(leftSegments.length, rightSegments.length);

  for (let index = 0; index < maxLength; index++) {
    const leftSegment = leftSegments[index];
    const rightSegment = rightSegments[index];

    if (leftSegment === undefined) return 1;
    if (rightSegment === undefined) return -1;

    const priorityDiff = getSegmentPriority(rightSegment) - getSegmentPriority(leftSegment);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
  }

  return 0;
};

const createRouteMatcher = (pathname: string) => {
  const match = createRouteParamsMatcher(pathname);

  return (input: string) => match(input) !== null;
};

const createRouteParamsMatcher = (pathname: string) => {
  const params: Array<{ name: string; kind: "dynamic" | "catch-all" | "optional-catch-all" }> = [];
  const segments = normalizePathname(pathname).split("/").filter(Boolean);
  const pattern =
    segments.length === 0
      ? "/"
      : segments.reduce((acc, segment) => {
          const optionalCatchAll = /^\[\[\.\.\.(.+)\]\]$/.exec(segment);
          if (optionalCatchAll) {
            params.push({ name: optionalCatchAll[1], kind: "optional-catch-all" });

            return `${acc}(?:/(.*))?`;
          }

          const catchAll = /^\[\.\.\.(.+)\]$/.exec(segment);
          if (catchAll) {
            params.push({ name: catchAll[1], kind: "catch-all" });

            return `${acc}/(.+)`;
          }

          const dynamic = /^\[(.+)\]$/.exec(segment);
          if (dynamic) {
            params.push({ name: dynamic[1], kind: "dynamic" });

            return `${acc}/([^/]+)`;
          }

          return `${acc}/${escapeRegex(normalizeSegment(segment))}`;
        }, "");
  const matcher = new RegExp(`^${pattern}(?:/)?$`);

  return (input: string): RpcTestRouteParams | null => {
    // Normalize segments separately so encoded slashes remain inside their segment.
    const match = matcher.exec(input.split("/").map(normalizeSegment).join("/"));
    if (!match) return null;

    const result: RpcTestRouteParams = Object.create(null);
    for (let index = 0; index < params.length; index++) {
      const { name, kind } = params[index];
      const captured = match[index + 1];
      if (captured === undefined || captured === "") {
        if (kind === "optional-catch-all") {
          result[name] = undefined;
        }

        continue;
      }

      result[name] =
        kind !== "dynamic"
          ? captured
              .split("/")
              .map((segment) => safeDecode(segment))
              .filter((segment): segment is string => segment !== undefined)
          : (safeDecode(captured) ?? "");
    }

    return result;
  };
};

const searchParamsToPageObject = (searchParams: URLSearchParams): RpcTestRouteParams => {
  const result: RpcTestRouteParams = Object.create(null);

  for (const [key, value] of searchParams) {
    const current = result[key];
    if (current === undefined) {
      result[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      result[key] = [current, value];
    }
  }

  return result;
};

const getInputUrl = (input: RequestInfo | URL, baseUrl = DEFAULT_TEST_BASE_URL) => {
  if (input instanceof Request) {
    return input.url;
  }

  return new URL(input, baseUrl);
};

const createNextRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
  baseUrl = DEFAULT_TEST_BASE_URL,
) => {
  const nextInit: ConstructorParameters<typeof NextRequest>[1] = init
    ? {
        ...init,
        signal: init.signal ?? undefined,
      }
    : undefined;

  return input instanceof Request
    ? new NextRequest(input, nextInit)
    : new NextRequest(new URL(input, baseUrl), nextInit);
};

const getRequestMethod = (input: RequestInfo | URL, init?: RequestInit) => {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
};

const resolveRouteParams = async (
  route: Pick<RpcTestRoute, "pathname" | "params">,
  request: NextRequest,
  url: URL,
): Promise<RpcTestRouteParams> => {
  if (typeof route.params === "function") {
    return route.params({ request, url });
  }

  if (route.params && Object.keys(route.params).length > 0) {
    return route.params;
  }

  const inferredParams = createRouteParamsMatcher(route.pathname)(url.pathname) ?? {};

  return route.params && Object.keys(inferredParams).length === 0 ? route.params : inferredParams;
};

/**
 * Creates an in-process RPC client for route-handler tests.
 *
 * The client keeps the same generated path and input types as `createRpcClient`, but dispatches
 * requests directly to loaded route modules instead of starting Next.js or mocking HTTP with a
 * separate server. Cookie handling defaults to managed mode, as with `createRpcClient`; use
 * `cookieMode: "explicit"` to supply cookie arguments in server-side tests.
 */
export const createRpcTestClient = (<T extends RpcGeneratedPathStructure>(
  routes: readonly RpcTestRoute[],
  options?: RpcTestClientOptions,
) => {
  const matchers = [...routes].sort(compareRoutePriority).map((route) => ({
    route,
    match: createRouteMatcher(route.pathname),
  }));
  const testFetch: typeof fetch = async (input, init) => {
    const url = new URL(getInputUrl(input));
    const method = getRequestMethod(input, init);
    if (!httpMethods.has(method)) {
      return new Response("Method Not Allowed", { status: 405 });
    }

    for (const matcher of matchers) {
      const matched = matcher.match(url.pathname);
      if (!matched) {
        continue;
      }

      const routeModule = await matcher.route.load();
      const handler = routeModule[method as HttpMethod];
      if (!handler) {
        const allowedMethods = matcher.route.methods.filter(
          (allowedMethod) => routeModule[allowedMethod],
        );

        return new Response("Method Not Allowed", {
          status: 405,
          headers: allowedMethods.length ? { Allow: allowedMethods.join(", ") } : undefined,
        });
      }

      const request = createNextRequest(input, init);

      return handler(request, {
        params: resolveRouteParams(matcher.route, request, url),
      });
    }

    return new Response("Not Found", { status: 404 });
  };
  const { baseUrl = DEFAULT_TEST_BASE_URL, ...clientOptions } = options ?? {};

  if (clientOptions.cookieMode !== "explicit") {
    return createRpcClient<T>(baseUrl, {
      ...clientOptions,
      cookieMode: "managed",
      fetch: testFetch,
    });
  }

  return createRpcClient<T>(baseUrl, {
    ...clientOptions,
    cookieMode: "explicit",
    fetch: testFetch,
  });
}) as {
  <T extends RpcGeneratedPathStructure>(
    routes: readonly RpcTestRoute[],
    options?: RpcTestClientOptions & { cookieMode?: "managed" },
  ): DynamicPathProxyAsFunction<T, "managed">;
  <T extends RpcGeneratedPathStructure>(
    routes: readonly RpcTestRoute[],
    options: RpcTestClientOptions & { cookieMode: "explicit" },
  ): DynamicPathProxyAsFunction<T, "explicit">;
  <T extends RpcGeneratedPathStructure>(
    routes: readonly RpcTestRoute[],
    options: RpcTestClientOptions,
  ): DynamicPathProxyAsFunction<T, "explicit"> | DynamicPathProxyAsFunction<T, "managed">;
};

const createRpcTestPageRenderDispatcher = (
  pages: readonly RpcTestPage[],
  options: RpcTestPageRendererOptions = {},
) => {
  const { baseUrl = DEFAULT_TEST_BASE_URL } = options;
  const matchers = [...pages].sort(compareRoutePriority).map((page) => ({
    page,
    match: createRouteMatcher(page.pathname),
  }));

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(getInputUrl(input, baseUrl));

    const candidates = matchers.filter((matcher) => matcher.match(url.pathname));
    const best = candidates[0];
    const matches = best
      ? candidates.filter((candidate) => compareRoutePriority(best.page, candidate.page) === 0)
      : [];
    const selected = matches;
    if (selected.length > 1) {
      throw new Error(
        `Multiple rpc4next test pages matched "${url.pathname}". Use createRpcTestPageFileClient to select a page.`,
      );
    }
    for (const matcher of selected) {
      const request = createNextRequest(input, init, baseUrl);
      const params = await resolveRouteParams(matcher.page, request, url);
      const searchParams = searchParamsToPageObject(url.searchParams);
      const pageModule = await matcher.page.load();

      return runWithRpcPageTestRequest(request, () =>
        pageModule.default({
          params: Promise.resolve(params),
          searchParams: Promise.resolve(searchParams),
        }),
      );
    }

    throw new Error(`No rpc4next test page matched "${url.pathname}".`);
  };
};

/**
 * Creates a generated-path test client for rendering rpc4next page procedures in-process.
 *
 * The request context is intentionally limited to rpc4next page procedure `.headers()` /
 * `.cookies()` validation; user code that calls `next/headers` directly is outside this helper's
 * guarantees.
 */
export const createRpcTestPageClient = <T extends RpcGeneratedPathStructure>(
  pages: readonly RpcTestPage[],
  options: RpcTestPageRendererOptions = {},
) => {
  const { baseUrl = DEFAULT_TEST_BASE_URL } = options;
  const renderPage = createRpcTestPageRenderDispatcher(pages, { baseUrl });
  const createPageClient = makeCreateRpc((key, context) => {
    if (key !== "$render") {
      return undefined;
    }

    return (renderOptions?: { url?: UrlOptions; init?: RequestInit }) => {
      const url = createUrl(
        context.paths,
        context.params as PathParamsInput,
        context.dynamicKeys,
      )(renderOptions?.url);

      return renderPage(url.path, renderOptions?.init);
    };
  });

  return createPageClient<T>(baseUrl) as RpcTestPageDynamicPathProxyAsFunction<T>;
};

type PageFileEntry = {
  file: string;
  pathname: string;
  load: () => Promise<{ default: (...args: never[]) => unknown }>;
  params?: RpcTestRouteParams | RpcTestRouteParamsResolver;
};
type PageFileHandler<T extends PageFileEntry> = Awaited<ReturnType<T["load"]>>["default"];
type PageFileQuery<T extends PageFileEntry> = T extends { queryType: infer Q }
  ? Q
  : InferPageQuery<PageFileHandler<T>>;
type PageSegmentParams<S extends string> = S extends `[[...${infer P}]]`
  ? { [K in P]?: string[] }
  : S extends `[...${infer P}]`
    ? { [K in P]: [string, ...string[]] }
    : S extends `[${infer P}]`
      ? { [K in P]: string | number }
      : object;
type PagePathParams<S extends string> = S extends `${infer Head}/${infer Tail}`
  ? PageSegmentParams<Head> & PagePathParams<Tail>
  : PageSegmentParams<S>;
type PageFileOptions<T extends PageFileEntry, P = PagePathParams<T["pathname"]>> = {
  init?: RequestInit;
} & (keyof P extends never
  ? { params?: never }
  : AllOptional<P> extends true
    ? { params?: P }
    : { params: P }) &
  ([PageFileQuery<T>] extends [never]
    ? { query?: never }
    : AllOptional<PageFileQuery<T>> extends true
      ? { query?: PageFileQuery<T> }
      : { query: PageFileQuery<T> });
type PageFileArgs<T extends PageFileEntry, O = PageFileOptions<T>> =
  AllOptional<O> extends true ? [options?: O] : [options: O];

/** Creates a test client that selects a page by its generated manifest file identifier. */
export const createRpcTestPageFileClient = <const T extends readonly PageFileEntry[]>(
  pages: T,
  options: RpcTestPageRendererOptions = {},
) => ({
  page<const F extends T[number]["file"]>(file: F) {
    type Entry = Extract<T[number], { file: F }>;
    const page = pages.find((entry) => entry.file === file);
    if (!page) throw new Error(`No rpc4next test page file matched "${file}".`);
    const render = createRpcTestPageRenderDispatcher([page as RpcTestPage], options);

    return {
      $render: (async (input?: {
        params?: Record<string, string | number | string[] | undefined>;
        query?: unknown;
        init?: RequestInit;
      }) => {
        const segments = page.pathname.split("/").filter(Boolean);
        const params: PathParamsInput = {};
        const dynamicKeys: string[] = [];
        const dynamicIndexes = new Set<number>();
        const paths = segments.map((segment, index) => {
          const match = /^(\[\[\.\.\.(.+)\]\]|\[\.\.\.(.+)\]|\[(.+)\])$/.exec(segment);
          if (!match) return segment;
          const name = match[2] ?? match[3] ?? match[4];
          const key = `${match[2] ? "_____" : match[3] ? "___" : "_"}${encodeRouteParamName(name)}`;
          dynamicKeys.push(key);
          dynamicIndexes.add(index + 1);
          params[key] = input?.params?.[name];

          return key;
        });
        const url = createUrl(
          [options.baseUrl ?? DEFAULT_TEST_BASE_URL, ...paths],
          params,
          dynamicKeys,
          dynamicIndexes,
        )({ query: input?.query } as UrlOptions);

        return render(url.path, input?.init);
      }) as (...args: PageFileArgs<Entry>) => Promise<Awaited<ReturnType<PageFileHandler<Entry>>>>,
    };
  },
});

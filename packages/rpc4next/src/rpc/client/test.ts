import { NextRequest } from "next/server";
import { HTTP_METHODS, type HttpMethod } from "rpc4next-shared";

import { runWithRpcPageTestRequest } from "../server/page-test-request-context";
import type { ProcedureRouteContract } from "../server/procedure-types";
import { makeCreateRpc } from "./rpc";
import { createRpcClient } from "./rpc-client";
import type {
  InferPageRenderResult,
  ParamsKey,
  PathParamsInput,
  QueryKey,
  RpcClientOptions,
  RpcEndpoint,
  RpcGeneratedPathStructure,
  rpc4nextGeneratedSchemaSymbol,
  rpc4nextPageRouteSymbol,
  UrlOptions,
} from "./types";
import { createUrl } from "./url";

export type RpcTestRouteParams = Record<string, string | string[] | undefined>;
export type RpcTestRouteParamsResolver = (context: {
  request: NextRequest;
  url: URL;
}) => RpcTestRouteParams | Promise<RpcTestRouteParams>;

export type RpcTestRouteHandler = (
  request: NextRequest,
  segmentData: { params: Promise<RpcTestRouteParams> },
) => Response | Promise<Response>;

export type RpcTestRouteModule = Partial<Record<HttpMethod, RpcTestRouteHandler>>;

export type RpcTestRoute = Pick<ProcedureRouteContract, "pathname"> & {
  load: () => Promise<RpcTestRouteModule>;
  methods: readonly HttpMethod[];
  params?: RpcTestRouteParams | RpcTestRouteParamsResolver;
};

export type RpcTestPageHandler = (props: {
  params: Promise<RpcTestRouteParams>;
  searchParams?: Promise<RpcTestRouteParams>;
}) => unknown | Promise<unknown>;

export type RpcTestPageModule = {
  default: RpcTestPageHandler;
};

export type RpcTestPage = Pick<ProcedureRouteContract, "pathname"> & {
  load: () => Promise<RpcTestPageModule>;
  params?: RpcTestRouteParams | RpcTestRouteParamsResolver;
};

export type RpcTestClientOptions = Omit<RpcClientOptions, "fetch"> & {
  baseUrl?: string;
};

export type RpcTestPageRendererOptions = {
  baseUrl?: string;
};

type RpcGeneratedSchemaKey = typeof rpc4nextGeneratedSchemaSymbol;
type RpcPageRouteKey = typeof rpc4nextPageRouteSymbol;
type HasQueryMarker = Record<QueryKey, unknown>;
type AllOptional<T> = Partial<T> extends T ? true : false;
type OptionalCatchAllKey = `_____${string}`;
type CatchAllKey = `___${string}`;
type DynamicKey = `_${string}`;
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
  const params: Array<{ name: string; optional: boolean }> = [];
  const segments = normalizePathname(pathname).split("/").filter(Boolean);
  const pattern =
    segments.length === 0
      ? "/"
      : segments.reduce((acc, segment) => {
          const optionalCatchAll = /^\[\[\.\.\.(.+)\]\]$/.exec(segment);
          if (optionalCatchAll) {
            params.push({ name: optionalCatchAll[1], optional: true });

            return `${acc}(?:/(.*))?`;
          }

          const catchAll = /^\[\.\.\.(.+)\]$/.exec(segment);
          if (catchAll) {
            params.push({ name: catchAll[1], optional: false });

            return `${acc}/(.+)`;
          }

          const dynamic = /^\[(.+)\]$/.exec(segment);
          if (dynamic) {
            params.push({ name: dynamic[1], optional: false });

            return `${acc}/([^/]+)`;
          }

          return `${acc}/${escapeRegex(segment)}`;
        }, "");
  const matcher = new RegExp(`^${pattern}(?:/)?$`);

  return (input: string): RpcTestRouteParams | null => {
    const match = matcher.exec(input);
    if (!match) return null;

    const result: RpcTestRouteParams = Object.create(null);
    for (let index = 0; index < params.length; index++) {
      const { name, optional } = params[index];
      const captured = match[index + 1];
      if (captured === undefined || captured === "") {
        if (optional) {
          result[name] = undefined;
        }

        continue;
      }

      result[name] = captured.includes("/")
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

export const createRpcTestClient = <T extends RpcGeneratedPathStructure>(
  routes: readonly RpcTestRoute[],
  options: RpcTestClientOptions = {},
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
  const { baseUrl = DEFAULT_TEST_BASE_URL, ...clientOptions } = options;

  return createRpcClient<T>(baseUrl, {
    ...clientOptions,
    fetch: testFetch,
  });
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

    for (const matcher of matchers) {
      const matched = matcher.match(url.pathname);
      if (!matched) {
        continue;
      }

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
 * Creates a generated-path test client for rendering rpc4next page procedures in-process. The
 * request context is intentionally limited to rpc4next page procedure .headers()/.cookies()
 * validation; user code that calls next/headers directly is outside this helper's guarantees.
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

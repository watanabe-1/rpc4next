import { NextRequest } from "next/server";
import { HTTP_METHODS, type HttpMethod } from "rpc4next-shared";

import type { ProcedureRouteContract } from "../server/procedure-types";
import { createRpcClient } from "./rpc-client";
import type { RpcClientOptions, RpcGeneratedPathStructure } from "./types";

export type RpcTestRouteParams = Record<string, string | string[] | undefined>;
export type RpcTestRouteParamsResolver = (context: {
  request: NextRequest;
  url: URL;
}) => RpcTestRouteParams | Promise<RpcTestRouteParams>;

export type RpcTestRouteHandler = (
  request: NextRequest,
  segmentData: { params: Promise<RpcTestRouteParams> },
) => Response | Promise<Response>;

export type RpcTestRoute = Pick<ProcedureRouteContract, "pathname"> &
  Partial<Record<HttpMethod, RpcTestRouteHandler>> & {
    params?: RpcTestRouteParams | RpcTestRouteParamsResolver;
  };

export type RpcTestClientOptions = Omit<RpcClientOptions, "fetch"> & {
  baseUrl?: string;
};

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

const compareRoutePriority = (left: RpcTestRoute, right: RpcTestRoute) => {
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

const getInputUrl = (input: RequestInfo | URL) => {
  if (input instanceof Request) {
    return input.url;
  }

  return input;
};

const createNextRequest = (input: RequestInfo | URL, init?: RequestInit) => {
  const nextInit: ConstructorParameters<typeof NextRequest>[1] = init
    ? {
        ...init,
        signal: init.signal ?? undefined,
      }
    : undefined;

  return input instanceof Request
    ? new NextRequest(input, nextInit)
    : new NextRequest(new URL(input), nextInit);
};

const getRequestMethod = (input: RequestInfo | URL, init?: RequestInit) => {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
};

const resolveRouteParams = async (
  route: RpcTestRoute,
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

      const handler = matcher.route[method as HttpMethod];
      if (!handler) {
        const allowedMethods = HTTP_METHODS.filter((allowedMethod) => matcher.route[allowedMethod]);

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

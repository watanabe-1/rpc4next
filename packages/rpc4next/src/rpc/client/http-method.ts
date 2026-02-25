import { deepMerge } from "./client-utils";
import { createUrl } from "./url";
import { normalizeHeaders } from "../lib/headers";
import type {
  FuncParams,
  UrlOptions,
  ClientOptions,
  TypedRequestInit,
  BodyOptions,
  HeadersOptions,
} from "./types";
import type { ContentType } from "../lib/content-type-types";

/** Local, non-breaking extension for future body shapes */
type ExtendedBodyOptions = BodyOptions & {
  text?: string;
  formData?: FormData;
  urlencoded?: URLSearchParams;
  raw?: BodyInit;
};

/** Remove headers/headersInit from a RequestInit-like object (typed, no any). */
const stripHeaders = (
  init?: TypedRequestInit,
): Omit<TypedRequestInit, "headers" | "headersInit"> => {
  if (!init) return {};
  const { headers: _h, headersInit: _hi, ...rest } = init;

  return rest;
};

/** Whether the user already set Content-Type (case-insensitive). */
const hasUserContentType = (h: Record<string, string>): boolean => {
  // normalizeHeaders lowercases keys, but be defensive:
  if ("content-type" in h) return true;

  return Object.keys(h).some((k) => k.toLowerCase() === "content-type");
};

/**
 * Build a typed HTTP method invoker.
 * - Header precedence: default < options.init < methodParam.requestHeaders
 * - Do NOT override user-specified `content-type`.
 * - Merge cookies instead of clobbering.
 * - Never attach a body for GET/HEAD.
 * - Provide basic body-shape inference (json/text/formData/urlencoded) while keeping current types compatible.
 */
export const httpMethod = (
  key: string,
  paths: string[],
  params: FuncParams,
  dynamicKeys: string[],
  defaultOptions: ClientOptions,
) => {
  return async (
    methodParam?: {
      url?: UrlOptions;
      body?: ExtendedBodyOptions;
      requestHeaders?: HeadersOptions;
    },
    options?: ClientOptions,
  ) => {
    // Resolve method (e.g. "$get" -> "GET")
    const method = key.replace(/^\$/, "").toUpperCase();

    // Build URL (path + query from url options)
    const urlObj = createUrl([...paths], params, dynamicKeys)(methodParam?.url);

    // Select fetch implementation
    const customFetch = options?.fetch ?? defaultOptions.fetch ?? fetch;

    // --- Merge headers (default < options.init < methodParam.requestHeaders)
    const defaultInit = defaultOptions.init;
    const innerInit = options?.init;

    const defaultHeaders = normalizeHeaders(
      defaultInit?.headers ?? defaultInit?.headersInit,
    );
    const innerHeaders = normalizeHeaders(
      innerInit?.headers ?? innerInit?.headersInit,
    );
    const methodParamHeaders = normalizeHeaders(
      methodParam?.requestHeaders?.headers as
        | Record<string, string>
        | undefined,
    );

    // Start from low precedence and overlay higher precedence
    const mergedHeaders: Record<string, string> = {
      ...defaultHeaders,
      ...innerHeaders,
      ...methodParamHeaders,
    };

    // ---- Cookies: merge (existing cookie header + methodParam cookies map)
    const existingCookie = mergedHeaders["cookie"];
    const methodParamCookies = methodParam?.requestHeaders?.cookies;
    if (methodParamCookies && Object.keys(methodParamCookies).length > 0) {
      const cookieFromMap = Object.entries(methodParamCookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      mergedHeaders["cookie"] = existingCookie
        ? `${existingCookie}; ${cookieFromMap}`
        : cookieFromMap;
    }

    // --- Body & content-type inference
    let bodyInit: BodyInit | undefined;
    let inferredContentType: ContentType | undefined;

    const b = methodParam?.body;

    if (b?.json !== undefined) {
      bodyInit = JSON.stringify(b.json);
      inferredContentType = "application/json";
    } else if (typeof b?.text === "string") {
      bodyInit = b.text;
      inferredContentType = "text/plain; charset=utf-8";
    } else if (b?.formData instanceof FormData) {
      bodyInit = b.formData; // boundary is auto-generated; do not set Content-Type explicitly
      inferredContentType = undefined;
    } else if (b?.urlencoded instanceof URLSearchParams) {
      bodyInit = b.urlencoded;
      inferredContentType = "application/x-www-form-urlencoded; charset=UTF-8";
    } else if (b?.raw !== undefined) {
      bodyInit = b.raw;
      inferredContentType = undefined;
    }

    // Do not attach a body to GET or HEAD requests
    if (method === "GET" || method === "HEAD") {
      bodyInit = undefined;
    }

    // Only set Content-Type when the user hasn't specified one
    if (!hasUserContentType(mergedHeaders) && bodyInit && inferredContentType) {
      mergedHeaders["content-type"] = inferredContentType;
    }

    // --- Build final init
    const mergedInit: TypedRequestInit = deepMerge(
      stripHeaders(defaultInit),
      stripHeaders(innerInit),
    );
    mergedInit.method = method;

    if (Object.keys(mergedHeaders).length > 0) {
      mergedInit.headers = mergedHeaders;
    }
    if (bodyInit !== undefined) {
      mergedInit.body = bodyInit;
    }

    // ---- Fetch with helpful error surface
    try {
      return await customFetch(urlObj.path, mergedInit);
    } catch (err) {
      // Surface method and URL for easier debugging
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[httpMethod] ${method} ${urlObj.path} failed: ${msg}`, {
        cause: err,
      });
    }
  };
};

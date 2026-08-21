import type { PathParamsInput, UrlOptions, UrlResult } from "./types";

/**
 * Builds a URL suffix string from optional query and hash values.
 *
 * This utility generates the trailing portion of a URL, consisting of: - A query string (e.g.
 * `?key=value&foo=bar`) - A hash fragment (e.g. `#section`)
 *
 * If both are present, they are concatenated in the order: `?query#hash`.
 *
 * If `url` is `undefined` or neither `query` nor `hash` is provided, an empty string is returned.
 *
 * @example
 *   buildUrlSuffix({
 *     query: { page: "1", sort: "asc" },
 *     hash: "top",
 *   });
 *   // => "?page=1&sort=asc#top"
 *
 * @example
 *   buildUrlSuffix({ hash: "section" });
 *   // => "#section"
 *
 * @example
 *   buildUrlSuffix();
 *   // => ""
 *
 * @param url - Optional URL options containing query parameters and/or a hash fragment.
 * @returns A URL suffix string beginning with `?` and/or `#`, or an empty string if none exist.
 */
const buildUrlSuffix = (url?: UrlOptions) => {
  if (!url) return "";
  const queryInput = url.query as Record<string, string | string[] | undefined> | undefined;
  let searchParams: URLSearchParams | undefined;

  if (queryInput) {
    for (const key in queryInput) {
      if (!Object.hasOwn(queryInput, key)) {
        continue;
      }

      const value = queryInput[key];
      if (value === undefined) {
        continue;
      }

      searchParams ??= new URLSearchParams();

      if (Array.isArray(value)) {
        for (const item of value) {
          searchParams.append(key, item);
        }

        continue;
      }

      searchParams.append(key, value);
    }
  }

  const query = searchParams ? `?${searchParams.toString()}` : "";
  const hash = url.hash ? `#${encodeURIComponent(url.hash)}` : "";

  return query + hash;
};

/**
 * Replaces dynamic route segment markers in a base path string.
 *
 * This utility transforms special placeholder patterns in `basePath` into concrete replacement
 * strings.
 *
 * It supports three types of dynamic segments:
 *
 * - **Optional catch-all**: `"/_____<name>"` (5 underscores)
 * - **Catch-all**: `"/___<name>"` (3 underscores)
 * - **Dynamic segment**: `"/_<name>"` (1 underscore)
 *
 * Each matched segment (including its leading slash) is replaced with the corresponding value from
 * the `replacements` object.
 *
 * Replacement is performed in the following order:
 *
 * 1. OptionalCatchAll
 * 2. CatchAll
 * 3. Dynamic
 *
 * This ordering ensures that longer patterns are processed before shorter ones to avoid partial
 * matching.
 *
 * @example
 *   ```ts
 *   replaceDynamicSegments("/users/_id/posts/___slug/files/_____path", {
 *     dynamic: ":id",
 *     catchAll: "*",
 *     optionalCatchAll: "**",
 *   });
 *   ```;
 *
 * @param basePath - The path string containing dynamic segment markers.
 * @param replacements - Replacement strings for each dynamic segment type.
 * @param replacements.optionalCatchAll - Replacement for `"/_____<name>"` segments.
 * @param replacements.catchAll - Replacement for `"/___<name>"` segments.
 * @param replacements.dynamic - Replacement for `"/_<name>"` segments.
 * @returns A new path string with all dynamic segment markers replaced.
 */
const safeDecodeSegment = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const decodeUnreservedPathSegment = (value: string) =>
  value.replace(/%[0-9A-Fa-f]{2}/g, (encoded) => {
    const char = String.fromCharCode(Number.parseInt(encoded.slice(1), 16));

    return /[A-Za-z0-9\-._~]/.test(char) ? char : encoded;
  });

const buildPathFromSegments = (segments: string[]) => {
  const joined = segments.join("/");
  const withLeadingSlash = joined ? `/${joined}` : "/";

  return withLeadingSlash.replace(/\/+/g, "/").replace(/\/+$/, "") || "/";
};

const getPathnameSegment = (segment: string) => {
  if (segment.startsWith("_____")) {
    return `[[...${segment.slice(5)}]]`;
  }
  if (segment.startsWith("___")) {
    return `[...${segment.slice(3)}]`;
  }
  if (segment.startsWith("_")) {
    return `[${segment.slice(1)}]`;
  }

  return safeDecodeSegment(segment);
};

/**
 * Creates a URL builder for a route definition.
 *
 * This function takes a list of path segments (e.g. `["api", "users", "[id]"]`), a params object,
 * and a list of dynamic keys used in the path, then returns a function that can build a concrete
 * URL string plus related metadata.
 *
 * Dynamic segments are replaced using `dynamicKeys`:
 *
 * - If `params[key]` is an array, it is treated as a catch-all segment and each element is
 *   URL-encoded then joined by `/`.
 * - If `params[key]` is `undefined`, the segment is removed (useful for optional segments).
 * - Otherwise, the value is URL-encoded and substituted into the segment.
 *
 * The returned builder optionally appends a suffix (e.g. query/hash) via `buildUrlSuffix(url)` and
 * also produces a Next.js-style `pathname` by converting underscore-prefixed dynamic markers into
 * their bracket form.
 *
 * In addition, params keys are normalized by removing leading underscores (e.g. `__id` -> `id`) in
 * the returned `params`.
 *
 * @example
 *   ```ts
 *   const build = createUrl(["https://example.com", "users", "id"], { id: "a b" }, ["id"]);
 *
 *   const result = build({ query: { page: "1" } });
 *   // result.path: "https://example.com/users/a%20b?page=1"
 *   // result.relativePath: "/users/a%20b?page=1"
 *   // result.pathname: "/users/[id]"
 *   // result.params: { id: "a b" }
 *   ```;
 *
 * @param paths - Path segments. The first element is treated as an optional base URL, and the
 *   remaining segments form the route path.
 * @param params - Parameters used to replace dynamic segments. Values may be `string`, `string[]`,
 *   or `undefined` depending on the segment type.
 * @param dynamicKeys - Keys representing dynamic segments present in the path, used to substitute
 *   values from `params`.
 * @returns A builder function that accepts URL options and returns a `UrlResult`.
 */
export const createUrl = (paths: string[], params: PathParamsInput, dynamicKeys: string[]) => {
  const baseUrl = paths[0];
  const routeSegments: string[] = [];
  const pathnameSegments: string[] = [];

  for (let index = 1; index < paths.length; index++) {
    const segment = paths[index];
    pathnameSegments.push(getPathnameSegment(segment));

    if (!dynamicKeys.includes(segment)) {
      routeSegments.push(decodeUnreservedPathSegment(segment));

      continue;
    }

    const param = params[segment];
    if (param === undefined) {
      continue;
    }

    if (Array.isArray(param)) {
      for (const item of param) {
        routeSegments.push(encodeURIComponent(item));
      }

      continue;
    }

    routeSegments.push(encodeURIComponent(param));
  }

  const dynamicPath = buildPathFromSegments(routeSegments);
  const pathname = buildPathFromSegments(pathnameSegments);
  const cleanedParams: PathParamsInput = Object.create(null);
  for (const key in params) {
    const cleanedKey = key.replace(/^_+/, "");
    cleanedParams[cleanedKey] = params[key];
  }
  const basePath = baseUrl ? baseUrl.replace(/\/$/, "") : undefined;

  return (url?: UrlOptions) => {
    const relativePath = `${dynamicPath}${buildUrlSuffix(url)}`;

    return {
      pathname,
      params: cleanedParams,
      path: basePath ? `${basePath}${relativePath}` : relativePath,
      relativePath,
    } as UrlResult;
  };
};

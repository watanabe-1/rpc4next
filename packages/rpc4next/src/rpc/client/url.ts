import type { UrlOptions, UrlResult, FuncParams } from "./types";

/**
 * Builds a URL suffix string from optional query and hash values.
 *
 * This utility generates the trailing portion of a URL, consisting of:
 * - A query string (e.g. `?key=value&foo=bar`)
 * - A hash fragment (e.g. `#section`)
 *
 * If both are present, they are concatenated in the order:
 * `?query#hash`.
 *
 * If `url` is `undefined` or neither `query` nor `hash` is provided,
 * an empty string is returned.
 *
 * @example
 * buildUrlSuffix({
 *   query: { page: "1", sort: "asc" },
 *   hash: "top"
 * });
 * // => "?page=1&sort=asc#top"
 *
 * @example
 * buildUrlSuffix({ hash: "section" });
 * // => "#section"
 *
 * @example
 * buildUrlSuffix();
 * // => ""
 *
 * @param url - Optional URL options containing query parameters and/or a hash fragment.
 * @returns A URL suffix string beginning with `?` and/or `#`, or an empty string if none exist.
 */
export const buildUrlSuffix = (url?: UrlOptions) => {
  if (!url) return "";
  const query = url.query
    ? "?" + new URLSearchParams(url.query as Record<string, string>).toString()
    : "";
  const hash = url.hash ? `#${url.hash}` : "";

  return query + hash;
};

/**
 * Replaces dynamic route segment markers in a base path string.
 *
 * This utility transforms special placeholder patterns in `basePath`
 * into concrete replacement strings.
 *
 * It supports three types of dynamic segments:
 *
 * - **Optional catch-all**: `"/_____<name>"` (5 underscores)
 * - **Catch-all**: `"/___<name>"` (3 underscores)
 * - **Dynamic segment**: `"/_<name>"` (1 underscore)
 *
 * Each matched segment (including its leading slash) is replaced
 * with the corresponding value from the `replacements` object.
 *
 * Replacement is performed in the following order:
 * 1. optionalCatchAll
 * 2. catchAll
 * 3. dynamic
 *
 * This ordering ensures that longer patterns are processed before
 * shorter ones to avoid partial matching.
 *
 * @example
 * ```ts
 * replaceDynamicSegments(
 *   "/users/_id/posts/___slug/files/_____path",
 *   {
 *     dynamic: ":id",
 *     catchAll: "*",
 *     optionalCatchAll: "**",
 *   }
 * );
 * ```
 *
 * @param basePath - The path string containing dynamic segment markers.
 * @param replacements - Replacement strings for each dynamic segment type.
 * @param replacements.optionalCatchAll - Replacement for `"/_____<name>"` segments.
 * @param replacements.catchAll - Replacement for `"/___<name>"` segments.
 * @param replacements.dynamic - Replacement for `"/_<name>"` segments.
 *
 * @returns A new path string with all dynamic segment markers replaced.
 */
export const replaceDynamicSegments = (
  basePath: string,
  replacements: {
    optionalCatchAll: string;
    catchAll: string;
    dynamic: string;
  },
): string =>
  basePath
    // optionalCatchAll
    .replace(/\/_{5}(\w+)/g, replacements.optionalCatchAll)
    // catchAll
    .replace(/\/_{3}(\w+)/g, replacements.catchAll)
    // dynamic
    .replace(/\/_(\w+)/g, replacements.dynamic);

export const createUrl = (
  paths: string[],
  params: FuncParams,
  dynamicKeys: string[],
) => {
  const baseUrl = paths.shift();
  const basePath = `/${paths.join("/")}`;

  const dynamicPath = dynamicKeys.reduce((acc, key) => {
    const param = params[key];

    if (Array.isArray(param)) {
      return acc.replace(
        `/${key}`,
        `/${param.map(encodeURIComponent).join("/")}`,
      );
    }

    if (param === undefined) {
      return acc.replace(`/${key}`, "");
    }

    return acc.replace(`/${key}`, `/${encodeURIComponent(param)}`);
  }, basePath);

  return (url?: UrlOptions) => {
    const relativePath = `${dynamicPath}${buildUrlSuffix(url)}`;
    const pathname = replaceDynamicSegments(basePath, {
      optionalCatchAll: "/[[...$1]]",
      catchAll: "/[...$1]",
      dynamic: "/[$1]",
    });

    const cleanedParams: FuncParams = {};
    for (const key in params) {
      const cleanedKey = key.replace(/^_+/, "");
      cleanedParams[cleanedKey] = params[key];
    }

    return {
      pathname,
      params: cleanedParams,
      path: baseUrl
        ? `${baseUrl.replace(/\/$/, "")}${relativePath}`
        : relativePath,
      relativePath,
    } as UrlResult;
  };
};

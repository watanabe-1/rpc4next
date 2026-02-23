import { isCatchAllOrOptional } from "./client-utils";
import { replaceDynamicSegments } from "./url";
import { searchParamsToObject } from "../lib/search-params";

type ParamValue = string | string[] | undefined;

const safeDecode = (value: string | undefined | null): string | undefined => {
  if (value === null || value === undefined) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    // Fallback to raw value if malformed percent-encoding is present.
    return value;
  }
};

/**
 * Normalize path segments into a canonical base path string.
 *
 * This function:
 * - Joins the given segments with `/`
 * - Collapses duplicate slashes into a single `/`
 * - Ensures **exactly one leading slash**
 * - Removes any trailing slash (except when the result is the root path)
 * - Returns `/` if the normalized result would otherwise be empty
 *
 * @example
 * ```ts
 * normalizeBasePath(["api", "v1", "users"]);
 * // "/api/v1/users"
 *
 * normalizeBasePath(["/api/", "/v1/", "users/"]);
 * // "/api/v1/users"
 *
 * normalizeBasePath([]);
 * // "/"
 * ```
 *
 * @param segments - Path segments to be combined into a base path.
 * @returns A normalized base path starting with a single `/` and without a trailing slash (unless root).
 */
const normalizeBasePath = (segments: string[]): string => {
  // Join with '/', ensure exactly one leading slash and no trailing slash.
  const joined = segments.join("/").replace(/\/+/g, "/");
  const withLeading = joined.startsWith("/") ? joined : `/${joined}`;

  return withLeading.replace(/\/+$/, "") || "/";
};

/**
 * Match a URL (string) against a pre-defined path pattern array.
 * @param paths e.g. ["/", "users", "_id"] or ["users", "_id"]
 * @param dynamicKeys keys in the same order the capturing groups appear
 */
export const matchPath = (paths: string[], dynamicKeys: string[]) => {
  // Build a normalized base path like "/users/_id"
  const basePath = normalizeBasePath(paths);

  // Build a regex pattern, plugging in capture groups for dynamic segments
  const regexPattern = replaceDynamicSegments(basePath, {
    optionalCatchAll: "(?:/(.*))?", // group captures inner (.*) if present
    catchAll: "/([^/]+(?:/[^/]+)*)", // group for ".../a/b/c"
    dynamic: "/([^/]+)", // group for "[id]"
  });

  // Precompile matcher: allow optional trailing slash
  const matcher = new RegExp(`^${regexPattern}(?:/)?$`);

  return (input: string) => {
    // Parse URL (supports absolute or relative thanks to base)
    let url: URL;
    try {
      url = new URL(input, "http://dummy");
    } catch {
      return null; // Not a valid URL-ish string
    }

    const pathname = url.pathname;
    const match = matcher.exec(pathname);
    if (!match) return null;

    // Build params from the capture groups, aligned with dynamicKeys order
    const params: Record<string, ParamValue> = {};

    for (let i = 0; i < dynamicKeys.length; i++) {
      const keyRaw = dynamicKeys[i];
      const paramKey = keyRaw.replace(/^_+/, ""); // keep your underscore-normalization
      const captured: string | undefined = match[i + 1];

      if (isCatchAllOrOptional(keyRaw)) {
        // Optional or catch-all
        if (captured === undefined || captured === null || captured === "") {
          params[paramKey] = undefined;
        } else {
          const parts = captured
            .split("/")
            .filter(Boolean)
            .map((p) => safeDecode(p)!)
            .filter((p): p is string => p !== undefined);
          params[paramKey] = parts;
        }
      } else {
        // Required single segment
        params[paramKey] = safeDecode(captured);
      }
    }

    const query = searchParamsToObject(url.searchParams);
    const hashRaw = url.hash ? url.hash.slice(1) : undefined;
    const hash = safeDecode(hashRaw);

    return { params, query, hash };
  };
};

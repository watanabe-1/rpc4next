import { searchParamsToObject } from "../lib/search-params";
import { isCatchAllOrOptional } from "./client-utils";

type ParamValue = string | string[] | undefined;

/**
 * Safely decodes a URI component.
 *
 * This function attempts to decode the given string using `decodeURIComponent`.
 * If the input is `null` or `undefined`, it returns `undefined`.
 * If decoding fails due to malformed percent-encoding, the original value is returned.
 *
 * @param value - The URI component string to decode. Can be `string`, `null`, or `undefined`.
 * @returns The decoded string if successful, the original string if decoding fails,
 * or `undefined` if the input is `null` or `undefined`.
 *
 * @example
 * safeDecode("hello%20world"); // "hello world"
 *
 * @example
 * safeDecode("%E0%A4%A"); // "%E0%A4%A" (malformed, returns original)
 *
 * @example
 * safeDecode(undefined); // undefined
 */
function safeDecode<T extends string | undefined | null>(
  value: T,
): T extends string ? string : undefined;
function safeDecode(value: string | undefined | null) {
  if (value === null || value === undefined) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    // Fallback to raw value if malformed percent-encoding is present.
    return value;
  }
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Match a URL (string) against a pre-defined path pattern array.
 * @param paths e.g. ["/", "users", "_id"] or ["users", "_id"]
 * @param dynamicKeys keys in the same order the capturing groups appear
 */
export const matchPath = (paths: string[], dynamicKeys: string[]) => {
  const normalizedSegments = paths
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  const regexPattern =
    normalizedSegments.length === 0
      ? "/"
      : normalizedSegments.reduce((acc, segment) => {
          if (!dynamicKeys.includes(segment)) {
            return `${acc}/${escapeRegex(safeDecode(segment))}`;
          }

          if (segment.startsWith("_____")) {
            return `${acc}(?:/(.*))?`;
          }
          if (segment.startsWith("___")) {
            return `${acc}/([^/]+(?:/[^/]+)*)`;
          }

          return `${acc}/([^/]+)`;
        }, "");

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
            .map((p) => safeDecode(p))
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

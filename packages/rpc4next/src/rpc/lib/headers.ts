/**
 * Normalizes various `HeadersInit` formats into a plain object
 * with lower-cased header names.
 *
 * This utility converts `Headers`, an array of `[key, value]` tuples,
 * or a plain object into a `Record<string, string>`.
 *
 * All header names are converted to lowercase to ensure
 * case-insensitive consistency when accessing header values.
 *
 * @param headers - A `HeadersInit` value (`Headers`, `[string, string][]`, or `Record<string, string>`).
 *                  If `undefined`, an empty object is returned.
 *
 * @returns A plain object whose keys are lower-cased header names
 *          and whose values are header strings.
 *
 * @example
 * ```ts
 * const headers = new Headers({
 *   "Content-Type": "application/json",
 *   "Authorization": "Bearer token",
 * });
 *
 * const normalized = normalizeHeaders(headers);
 * // {
 * //   "content-type": "application/json",
 * //   "authorization": "Bearer token"
 * // }
 * ```
 *
 * @remarks
 * - If duplicate header names exist (ignoring case),
 *   the last encountered value will overwrite previous ones.
 * - This function does not merge multiple values for the same header.
 */
export const normalizeHeaders = (
  headers?: HeadersInit,
): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!headers) return result;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });

    return result;
  }
  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      result[key.toLowerCase()] = value;
    });

    return result;
  }
  Object.entries(headers).forEach(([key, value]) => {
    result[key.toLowerCase()] = value;
  });

  return result;
};

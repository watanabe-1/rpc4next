/**
 * Converts a `URLSearchParams` instance into a plain object.
 *
 * This utility aggregates query parameters into an object where:
 *
 * - The first occurrence of a key becomes a `string`
 * - If the same key appears multiple times, the value becomes a `string[]`
 *
 * The returned object is cast to the generic type `T`. This is a **type-level** convenience: the
 * runtime output only contains `string` or `string[]` values (no `undefined` keys are produced).
 *
 * @example
 *   ```ts
 *   const sp = new URLSearchParams("q=chatgpt&tag=a&tag=b");
 *   const obj = searchParamsToObject(sp);
 *   // => { q: "chatgpt", tag: ["a", "b"] }
 *   ```;
 *
 * @example
 *   ```ts
 *   type Params = { q?: string; tag?: string[] };
 *   const sp = new URLSearchParams("q=hello&tag=a&tag=b");
 *   const obj = searchParamsToObject<Params>(sp);
 *   // obj.q is typed as string | undefined
 *   // obj.tag is typed as string[] | undefined
 *   ```;
 *
 * @typeParam T - The desired return shape. Must be a record of `string` keys with values `string |
 *   string[] | undefined`. Note: `undefined` is allowed in the type to support downstream optional
 *   fields, but is not produced at runtime.
 * @param searchParams - The `URLSearchParams` to convert.
 * @returns A plain object containing the query parameters.
 */
export const searchParamsToObject = <T extends Record<string, string | string[] | undefined>>(
  searchParams: URLSearchParams,
): T => {
  const params: Record<string, string | string[]> = Object.create(null);

  searchParams.forEach((value, key) => {
    const existing = params[key];

    if (existing === undefined) {
      params[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      params[key] = [existing, value];
    }
  });

  return params as T;
};

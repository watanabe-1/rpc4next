/**
 * Creates a proxy for URLSearchParams to enable dynamic property access.
 * This proxy allows you to access URL query parameters as if they were properties of an object.
 *
 * @typeParam T - A generic type representing an object where keys are strings, and values are optional strings.
 * @param {URLSearchParams} searchParams - The URLSearchParams instance used to retrieve query parameters.
 * @returns {T} A proxy object that provides dynamic access to query parameters by property names.
 *
 * @example
 * const searchParams = new URLSearchParams("param1=value1&param2=value2");
 * const params = createQueryParamsProxy<{ param1?: string, param2?: string }>(searchParams);
 * console.log(params.param1); // Outputs: "value1"
 * console.log(params.param3); // Outputs: undefined
 */
export const createQueryParamsProxy = <
  T extends Record<string, string | string[] | undefined>,
>(
  searchParams: URLSearchParams,
): T => {
  return new Proxy({} as T, {
    get: (_, prop: string) => {
      // Returns the decoded value for the given prop, or undefined if not present
      const value = searchParams.get(prop);

      return value !== null ? decodeURIComponent(value) : undefined;
    },
  });
};

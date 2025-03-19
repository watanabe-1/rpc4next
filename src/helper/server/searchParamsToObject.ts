export function searchParamsToObject<
  T extends Record<string, string | string[] | undefined>,
>(searchParams: URLSearchParams): T {
  const params: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    if (key in params) {
      params[key] = Array.isArray(params[key])
        ? [...(params[key] as string[]), value]
        : [params[key] as string, value];
    } else {
      params[key] = value;
    }
  });

  return params as T;
}

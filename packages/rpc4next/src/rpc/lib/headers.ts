export const normalizeHeaders = (
  headers?: HeadersInit
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

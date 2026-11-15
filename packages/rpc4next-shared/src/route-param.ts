/** Escape parameter names so their underscores cannot extend a segment kind prefix. */
export const encodeRouteParamName = (name: string): string =>
  name.replace(/%/g, "%25").replace(/_/g, "%5F");

/** Decode only generated name escapes, in one pass, preserving literal percent sequences. */
export const decodeRouteParamName = (name: string): string =>
  name.replace(/%25|%5F/g, (escape) => (escape === "%25" ? "%" : "_"));

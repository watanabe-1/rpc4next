import type { UrlOptions, UrlResult, FuncParams } from "./types";

export const buildUrlSuffix = (url?: UrlOptions) => {
  if (!url) return "";
  const query = url.query
    ? "?" + new URLSearchParams(url.query as Record<string, string>).toString()
    : "";
  const hash = url.hash ? `#${url.hash}` : "";

  return query + hash;
};

export const replaceDynamicSegments = (
  basePath: string,
  replacements: {
    optionalCatchAll: string;
    catchAll: string;
    dynamic: string;
  }
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
  dynamicKeys: string[]
) => {
  const baseUrl = paths.shift();
  const basePath = paths.join("/");

  const dynamicPath = dynamicKeys.reduce((acc, key) => {
    const param = params[key];

    if (Array.isArray(param)) {
      return acc.replace(
        `/${key}`,
        `/${param.map(encodeURIComponent).join("/")}`
      );
    }

    if (param === undefined) {
      return acc.replace(`/${key}`, "");
    }

    return acc.replace(`/${key}`, `/${encodeURIComponent(param)}`);
  }, basePath);

  return (url?: UrlOptions) => {
    const relativePath = `/${dynamicPath}${buildUrlSuffix(url)}`;
    const pathname = replaceDynamicSegments(basePath, {
      optionalCatchAll: "/[[...$1]]",
      catchAll: "/[...$1]",
      dynamic: "/[$1]",
    });

    return {
      pathname,
      params,
      path: `${baseUrl}${relativePath}`,
      relativePath,
    } as UrlResult;
  };
};

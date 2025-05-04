import { isCatchAllOrOptional } from "./client-utils";
import { replaceDynamicSegments } from "./url";
import { searchParamsToObject } from "../lib/search-params";

export const matchPath = (paths: string[], dynamicKeys: string[]) => {
  return (input: string) => {
    const url = new URL(input, "http://dummy");
    const pathname = url.pathname;

    const basePath = `/${paths.slice(1).join("/")}`;
    const regexPattern = replaceDynamicSegments(basePath, {
      optionalCatchAll: "(?:/(.*))?",
      catchAll: "/([^/]+(?:/[^/]+)*)",
      dynamic: "/([^/]+)",
    });

    const match = new RegExp(`^${regexPattern}/?$`).exec(pathname);
    if (!match) return null;

    const params = dynamicKeys.reduce<
      Record<string, string | string[] | undefined>
    >((acc, key, index) => {
      const paramKey = key.replace(/^_+/, "");
      const matchValue = match[index + 1];

      const paramValue = isCatchAllOrOptional(key)
        ? matchValue === undefined || matchValue === ""
          ? undefined
          : matchValue.split("/").filter(Boolean).map(decodeURIComponent)
        : decodeURIComponent(matchValue);

      return { ...acc, [paramKey]: paramValue };
    }, {});

    const query = searchParamsToObject(url.searchParams);

    return {
      params,
      query,
      hash: url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined,
    };
  };
};

import { isCatchAllOrOptional } from "./client-utils";
import { replaceDynamicSegments } from "./url";

export const matchPath = (paths: string[], dynamicKeys: string[]) => {
  return (path: string) => {
    const basePath = `/${paths.slice(1).join("/")}`;

    const regexPattern = replaceDynamicSegments(basePath, {
      optionalCatchAll: "(?:/(.*))?",
      catchAll: "/([^/]+(?:/[^/]+)*)",
      dynamic: "/([^/]+)",
    });

    // Add optional trailing slash
    const match = new RegExp(`^${regexPattern}/?$`).exec(path);
    if (!match) return null;

    return dynamicKeys.reduce<Record<string, string | string[] | undefined>>(
      (acc, key, index) => {
        const paramKey = key.replace(/^_+/, "");
        const matchValue = match[index + 1];

        const paramValue = isCatchAllOrOptional(key)
          ? matchValue === undefined || matchValue === ""
            ? undefined
            : matchValue.split("/").filter(Boolean).map(decodeURIComponent)
          : decodeURIComponent(matchValue);

        return { ...acc, [paramKey]: paramValue };
      },
      {}
    );
  };
};

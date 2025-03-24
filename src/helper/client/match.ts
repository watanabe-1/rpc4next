import { replaceDynamicSegments } from "./url";
import { isCatchAllOrOptional } from "./utils";

export const matchPath = (paths: string[], dynamicKeys: string[]) => {
  return (path: string) => {
    const basePath = `/${paths.slice(1).join("/")}`;
    const regexPattern = replaceDynamicSegments(basePath, {
      optionalCatchAll: "(?:/(.*))?",
      catchAll: "/([^/]+(?:/[^/]+)*)",
      dynamic: "/([^/]+)",
    });
    // Append /? to match with or without a trailing slash.
    const match = new RegExp(`^${regexPattern}/?$`).exec(path);
    if (!match) return null;

    return dynamicKeys.reduce((acc, key, index) => {
      const paramKey = key.replace(/^_+/, "");
      const matchValue = match[index + 1];
      const paramValue = isCatchAllOrOptional(key)
        ? matchValue === undefined || matchValue === ""
          ? undefined
          : matchValue.split("/").filter((segment) => segment.length > 0)
        : matchValue;

      return { ...acc, [paramKey]: paramValue };
    }, {});
  };
};

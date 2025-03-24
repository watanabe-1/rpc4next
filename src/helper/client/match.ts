import { replaceDynamicSegments } from "./url";
import { isCatchAllOrOptional } from "./utils";

export const matchPath = (
  paths: string[],
  dynamicKeys: string[],
  path: string
) => {
  const basePath = `/${paths.slice(1).join("/")}`;
  const regexPattern = replaceDynamicSegments(basePath, {
    optionalCatchAll: "/(.*)?",
    catchAll: "/([^/]+(?:/[^/]+)*)",
    dynamic: "/([^/]+)",
  });
  const match = new RegExp(`^${regexPattern}$`).exec(path);
  if (!match) return null;

  return dynamicKeys.reduce((acc, key, index) => {
    const paramKey = key.replace(/^_+/, "");
    const matchValue = match[index + 1];
    const paramValue = isCatchAllOrOptional(key)
      ? matchValue?.split("/")
      : matchValue;

    return {
      ...acc,
      [paramKey]: paramValue,
    };
  }, {});
};

export const END_POINT_FILE_NAMES = ["page.tsx", "route.ts"] as const;
export const QUERY_TYPES = ["Query", "OptionalQuery"] as const;

export const INDENT = "  ";
export const NEWLINE = "\n";
export const STATEMENT_TERMINATOR = ";";
export const TYPE_SEPARATOR = ";";

export const PATH_PATH_STRUCTURE_BASE =
  "./scripts/generateRpcClient/pathStructureBase.ts";
export const TYPE_END_POINT = "Endpoint";
export const TYPE_KEY_QUERY = "QueryKey";
export const TYPE_KEY_OPTIONAL_QUERY = "OptionalQueryKey";
export const TYPE_KEY_PARAMS = "ParamsKey";

export const TYPE_KEYS = [
  TYPE_END_POINT,
  TYPE_KEY_OPTIONAL_QUERY,
  TYPE_KEY_PARAMS,
  TYPE_KEY_QUERY,
];

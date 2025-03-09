import type { HTTP_METHODS, END_POINT_FILE_NAMES } from "./constants";

export type HttpMethods = (typeof HTTP_METHODS)[number];
export type EndPointFileNames = (typeof END_POINT_FILE_NAMES)[number];

export type ROUTE_TYPE = {
  isDynamic: boolean;
  isCatchAll: boolean;
  isOptionalCatchAll: boolean;
  isGroup: boolean;
  isParallel: boolean;
};

import {
  DYNAMIC_PREFIX,
  CATCH_ALL_PREFIX,
  OPTIONAL_CATCH_ALL_PREFIX,
  HTTP_METHOD_FUNC_KEYS,
} from "../../lib/constants";
import type { HttpMethodFuncKey } from "./types";

export const isDynamic = (key: string) => key.startsWith(DYNAMIC_PREFIX);

export const isCatchAllOrOptional = (key: string) =>
  key.startsWith(CATCH_ALL_PREFIX) || key.startsWith(OPTIONAL_CATCH_ALL_PREFIX);

const httpMethods: Set<HttpMethodFuncKey> = new Set(HTTP_METHOD_FUNC_KEYS);

export const isHttpMethod = (value: string): value is HttpMethodFuncKey =>
  httpMethods.has(value as HttpMethodFuncKey);

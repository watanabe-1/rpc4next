import crypto from "node:crypto";
import type { HttpMethod } from "rpc4next-shared";
import type { QUERY_TYPES } from "./constants.js";

export type ImportAliasName = (typeof QUERY_TYPES)[number] | HttpMethod;

export const createImportAlias = (path: string, name: ImportAliasName) => {
  const hash = crypto
    .createHash("md5")
    .update(`${path}::${name}`)
    .digest("hex")
    .slice(0, 16);

  return `${name}_${hash}`;
};

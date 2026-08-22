export const QUERY_TYPES = ["Query"] as const;

export const INDENT = "  ";
export const NEWLINE = "\n";
export const STATEMENT_TERMINATOR = ";";
export const TYPE_SEPARATOR = ";";

export const TYPE_RPC_ENDPOINT = "RpcEndpoint";
export const TYPE_RPC_GENERATED_PATH_STRUCTURE = "RpcGeneratedPathStructure";
export const RPC4NEXT_GENERATED_SCHEMA_VERSION = 1;
export const TYPE_KEY_QUERY = "QueryKey";
export const TYPE_KEY_PARAMS = "ParamsKey";
export const TYPE_PROCEDURE_QUERY_INPUT = "ProcedureQueryInput";

export const TYPE_KEYS = [
  TYPE_RPC_ENDPOINT,
  TYPE_KEY_PARAMS,
  TYPE_KEY_QUERY,
  TYPE_PROCEDURE_QUERY_INPUT,
];

export const RPC4NEXT_CLIENT_IMPORT_PATH = "rpc4next/client";

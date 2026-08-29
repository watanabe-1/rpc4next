import type { NextRequest, NextResponse } from "next/server";

import type { DefaultRpcErrorCatalog, RpcErrorCatalog } from "./error";
import type { ProcedureResult } from "./procedure";
import type { Params, ResponseHelpers, RouteContext } from "./types";

export type ProcedureOnErrorResponse<
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> = Pick<ResponseHelpers<unknown, TErrorCatalog>, "body" | "error" | "json" | "redirect" | "text">;

export interface ProcedureOnErrorContext<
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> {
  request: NextRequest;
  params: Params;
  response: ProcedureOnErrorResponse<TErrorCatalog>;
  routeContext: RouteContext;
}

export type ProcedureOnErrorResult =
  | Response
  | NextResponse
  | ProcedureResult
  | Promise<Response | NextResponse | ProcedureResult>;

export type ProcedureOnError<
  TResult extends ProcedureOnErrorResult = ProcedureOnErrorResult,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> = (error: unknown, context: ProcedureOnErrorContext<TErrorCatalog>) => TResult;

export const defaultProcedureOnError = ((error, context) => {
  if (error instanceof Response) {
    return error;
  }

  return context.response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies ProcedureOnError;

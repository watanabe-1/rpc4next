import type { NextRequest, NextResponse } from "next/server";

import type { DefaultRpcErrorCatalog, RpcErrorCatalog } from "./error";
import type { ProcedureResult } from "./procedure";
import type { Params, ResponseHelpers, RouteContext } from "./types";

/** Response helpers available inside a route procedure `onError` callback. */
export type ProcedureOnErrorResponse<
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> = Pick<ResponseHelpers<unknown, TErrorCatalog>, "body" | "error" | "json" | "redirect" | "text">;

/** Context passed to route procedure `onError` callbacks for unexpected throws. */
export interface ProcedureOnErrorContext<
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> {
  request: NextRequest;
  params: Params;
  response: ProcedureOnErrorResponse<TErrorCatalog>;
  routeContext: RouteContext;
}

/** Values a route procedure `onError` callback may return. */
export type ProcedureOnErrorResult =
  | Response
  | NextResponse
  | ProcedureResult
  | Promise<Response | NextResponse | ProcedureResult>;

/**
 * Handles unexpected exceptions thrown by route procedure middleware or handlers.
 *
 * Known client-visible application errors should normally be returned with `response.error(...)`
 * from the handler instead of thrown.
 */
export type ProcedureOnError<
  TResult extends ProcedureOnErrorResult = ProcedureOnErrorResult,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> = (error: unknown, context: ProcedureOnErrorContext<TErrorCatalog>) => TResult;

/** Default route error handler used by low-level adapters. */
export const defaultProcedureOnError = ((error, context) => {
  if (error instanceof Response) {
    return error;
  }

  return context.response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies ProcedureOnError;

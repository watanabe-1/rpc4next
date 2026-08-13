import type { NextRequest, NextResponse } from "next/server";

import type { ProcedureResult } from "./procedure";
import type { Params, ResponseHelpers, RouteContext } from "./types";

export type ProcedureOnErrorResponse = Pick<
  ResponseHelpers<unknown>,
  "body" | "error" | "json" | "redirect" | "text"
>;

export interface ProcedureOnErrorContext {
  request: NextRequest;
  params: Params;
  response: ProcedureOnErrorResponse;
  routeContext: RouteContext;
}

export type ProcedureOnErrorResult =
  | Response
  | NextResponse
  | ProcedureResult
  | Promise<Response | NextResponse | ProcedureResult>;

export type ProcedureOnError<TResult extends ProcedureOnErrorResult = ProcedureOnErrorResult> = (
  error: unknown,
  context: ProcedureOnErrorContext,
) => TResult;

export const defaultProcedureOnError = ((error, context) => {
  if (error instanceof Response) {
    return error;
  }

  return context.response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies ProcedureOnError;

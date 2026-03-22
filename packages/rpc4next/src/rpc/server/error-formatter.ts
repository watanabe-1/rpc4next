import type { NextResponse } from "next/server";
import { createRpcErrorEnvelope, isRpcError } from "./error";
import type { ResponseHelpers } from "./types";

export type ProcedureErrorFormatterResponse = Pick<
  ResponseHelpers,
  "body" | "json" | "redirect" | "text"
>;

export type ProcedureErrorFormatter = (
  error: unknown,
  response: ProcedureErrorFormatterResponse,
) =>
  | Response
  | NextResponse
  | undefined
  | Promise<Response | NextResponse | undefined>;

export const defaultRpcErrorFormatter: ProcedureErrorFormatter = (
  error,
  response,
) => {
  if (!isRpcError(error)) {
    return undefined;
  }

  return response.json(createRpcErrorEnvelope(error), {
    status: error.status,
  });
};

import type { NextResponse } from "next/server";
import { createRpcErrorEnvelope, isRpcError } from "./error";
import type { createRouteContext } from "./route-context";

export type ProcedureErrorFormatterRouteContext = Pick<
  ReturnType<typeof createRouteContext>,
  "json"
> &
  Partial<
    Pick<ReturnType<typeof createRouteContext>, "body" | "redirect" | "text">
  >;

export type ProcedureErrorFormatter = (
  error: unknown,
  routeContext: ProcedureErrorFormatterRouteContext,
) =>
  | Response
  | NextResponse
  | undefined
  | Promise<Response | NextResponse | undefined>;

export const defaultRpcErrorFormatter: ProcedureErrorFormatter = (
  error,
  routeContext,
) => {
  if (!isRpcError(error)) {
    return undefined;
  }

  return routeContext.json(createRpcErrorEnvelope(error), {
    status: error.status,
  });
};

import type { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import type { ContentType } from "../lib/content-type-types";
import type { HttpStatusCode } from "../lib/http-status-code-types";
import { searchParamsToObject } from "../lib/search-params";
import type { RpcErrorCode, RpcErrorEnvelope, RpcErrorStatus } from "./error";
import { isRpcError, rpcError } from "./error";
import type { ProcedureMiddleware, ProcedureResult } from "./procedure";
import type { ProcedureInputTarget } from "./procedure-types";
import {
  attachProcedureDefinition,
  type MergeProcedureDefinition,
  type ProcedureDefinition,
  type ProcedureErrorContract,
  type WithProcedureDefinition,
} from "./procedure-types";
import { createRouteContext } from "./route-context";
import type { Params, TypedNextResponse } from "./types";
import {
  getCookiesObject,
  getHeadersObject,
} from "./validators/validator-utils";

const isProcedureResult = (value: unknown): value is ProcedureResult => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "status" in value ||
    "headers" in value ||
    "body" in value ||
    "redirect" in value
  );
};

const getValidationErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const parseWithSchema = async (schema: unknown, value: unknown) => {
  if (
    typeof schema === "object" &&
    schema !== null &&
    "safeParseAsync" in schema &&
    typeof schema.safeParseAsync === "function"
  ) {
    const result = await schema.safeParseAsync(value);

    if (result.success) {
      return result.data;
    }

    throw rpcError("BAD_REQUEST", {
      message: getValidationErrorMessage(result.error),
      details: result.error,
    });
  }

  if (
    typeof schema === "object" &&
    schema !== null &&
    "safeParse" in schema &&
    typeof schema.safeParse === "function"
  ) {
    const result = schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw rpcError("BAD_REQUEST", {
      message: getValidationErrorMessage(result.error),
      details: result.error,
    });
  }

  return value;
};

const getContractValue = async (
  request: NextRequest,
  segmentData: { params: Promise<Params> },
  target: ProcedureInputTarget,
) => {
  if (target === "params") {
    return await segmentData.params;
  }

  if (target === "query") {
    return searchParamsToObject(request.nextUrl.searchParams);
  }

  if (target === "json") {
    return await request.json();
  }

  if (target === "headers") {
    return await getHeadersObject();
  }

  return await getCookiesObject();
};

const normalizeProcedureResult = (
  routeContext: Pick<
    ReturnType<typeof createRouteContext>,
    "redirect" | "body" | "text" | "json"
  >,
  result: Response | NextResponse | ProcedureResult,
) => {
  if (result instanceof Response) {
    return result;
  }

  if (result.redirect) {
    return routeContext.redirect(result.redirect, {
      headersInit: result.headers,
      status: (result.status ?? 307) as 307,
    });
  }

  if (result.body === undefined) {
    return routeContext.body(null, {
      headersInit: result.headers,
      status: result.status,
    });
  }

  if (typeof result.body === "string") {
    return routeContext.text(result.body, {
      headersInit: result.headers,
      status: result.status,
    });
  }

  return routeContext.json(result.body, {
    headersInit: result.headers,
    status: result.status,
  });
};

type ProcedureTypeCarrier<
  TDefinition extends ProcedureDefinition = ProcedureDefinition,
> = {
  definition: TDefinition;
  middlewares: readonly ProcedureMiddleware[];
  handler: (...args: never[]) => unknown;
};

type InferProcedureDefinition<TProcedure extends ProcedureTypeCarrier> =
  TProcedure["definition"];

type ProcedureErrorResponse<
  TCode extends RpcErrorCode = RpcErrorCode,
  TDetails = unknown,
> = TCode extends RpcErrorCode
  ? TypedNextResponse<
      RpcErrorEnvelope<TCode, TDetails>,
      RpcErrorStatus<TCode>,
      "application/json"
    >
  : never;

type InferProcedureErrorResponse<TProcedure extends ProcedureTypeCarrier> =
  "error" extends keyof InferProcedureDefinition<TProcedure>
    ? InferProcedureDefinition<TProcedure>["error"] extends ProcedureErrorContract<
        infer TCode,
        infer TDetails
      >
      ? ProcedureErrorResponse<TCode, TDetails>
      : never
    : never;

type InferProcedureHandlerResult<TProcedure extends ProcedureTypeCarrier> =
  TProcedure extends {
    handler: (...args: never[]) => infer TResult;
  }
    ? Awaited<TResult>
    : never;

type InferProcedureHandler<TProcedure extends ProcedureTypeCarrier> =
  TProcedure extends {
    handler: infer THandler;
  }
    ? THandler
    : never;

type InferProcedureHandlerContext<TProcedure extends ProcedureTypeCarrier> =
  InferProcedureHandler<TProcedure> extends (context: infer TContext) => unknown
    ? TContext
    : never;

type IsNever<T> = [T] extends [never] ? true : false;

type ResolveStatus<
  TStatus,
  TDefault extends HttpStatusCode,
> = TStatus extends HttpStatusCode ? TStatus : TDefault;

type NormalizeProcedureBodyResponse<
  TBody,
  TStatus extends HttpStatusCode,
> = TBody extends string
  ? TypedNextResponse<TBody, TStatus, "text/plain">
  : TypedNextResponse<TBody, TStatus, "application/json">;

type NormalizeProcedureHandlerResult<TResult> = TResult extends
  | Response
  | NextResponse
  ? TResult
  : TResult extends {
        redirect: string;
        status?: infer TStatus;
      }
    ? TypedNextResponse<undefined, ResolveStatus<TStatus, 307>, "">
    : TResult extends {
          body: infer TBody;
          status?: infer TStatus;
        }
      ? NormalizeProcedureBodyResponse<TBody, ResolveStatus<TStatus, 200>>
      : TResult extends {
            status?: infer TStatus;
          }
        ? TypedNextResponse<undefined, ResolveStatus<TStatus, 200>, ContentType>
        : TypedNextResponse<unknown, HttpStatusCode, ContentType>;

type NextRouteResponse<TProcedure extends ProcedureTypeCarrier> =
  IsNever<InferProcedureHandlerResult<TProcedure>> extends true
    ?
        | TypedNextResponse<unknown, HttpStatusCode, ContentType>
        | InferProcedureErrorResponse<TProcedure>
    :
        | NormalizeProcedureHandlerResult<
            InferProcedureHandlerResult<TProcedure>
          >
        | InferProcedureErrorResponse<TProcedure>;

export type NextRouteHandler<
  TProcedure extends ProcedureTypeCarrier = ProcedureTypeCarrier,
  TMethod extends HttpMethod | undefined = undefined,
> = WithProcedureDefinition<
  (
    request: NextRequest,
    segmentData: { params: Promise<Params> },
  ) => Promise<NextRouteResponse<TProcedure>>,
  TMethod extends HttpMethod
    ? MergeProcedureDefinition<
        InferProcedureDefinition<TProcedure>,
        { method: TMethod }
      >
    : InferProcedureDefinition<TProcedure>
>;

export interface NextRouteOptions<TMethod extends HttpMethod = HttpMethod> {
  method?: TMethod;
}

export const nextRoute = <
  TProcedure extends ProcedureTypeCarrier,
  TMethod extends HttpMethod | undefined = undefined,
>(
  procedure: TProcedure,
  options: NextRouteOptions<Exclude<TMethod, undefined>> = {},
): NextRouteHandler<TProcedure, TMethod> => {
  const handler = procedure.handler as (
    context: InferProcedureHandlerContext<TProcedure>,
  ) =>
    | InferProcedureHandlerResult<TProcedure>
    | Promise<InferProcedureHandlerResult<TProcedure>>;
  const routeHandler = async (
    request: NextRequest,
    segmentData: { params: Promise<Params> },
  ): Promise<NextRouteResponse<TProcedure>> => {
    const routeContext = createRouteContext(request, segmentData);
    const contracts = procedure.definition.input?.contracts ?? {};

    try {
      const params = contracts.params
        ? await parseWithSchema(
            contracts.params,
            await getContractValue(request, segmentData, "params"),
          )
        : await segmentData.params;
      const query = contracts.query
        ? await parseWithSchema(
            contracts.query,
            await getContractValue(request, segmentData, "query"),
          )
        : searchParamsToObject(request.nextUrl.searchParams);
      const json =
        request.method === "GET" || request.method === "HEAD"
          ? contracts.json
            ? (() => {
                throw rpcError("BAD_REQUEST", {
                  message:
                    "JSON input contracts are not supported for GET or HEAD requests.",
                });
              })()
            : undefined
          : contracts.json
            ? await parseWithSchema(
                contracts.json,
                await getContractValue(request, segmentData, "json"),
              )
            : undefined;
      const headers = contracts.headers
        ? await parseWithSchema(
            contracts.headers,
            await getContractValue(request, segmentData, "headers"),
          )
        : undefined;
      const cookies = contracts.cookies
        ? await parseWithSchema(
            contracts.cookies,
            await getContractValue(request, segmentData, "cookies"),
          )
        : undefined;

      let ctx: Record<string, unknown> = {};

      for (const middleware of procedure.middlewares) {
        const result = await middleware({
          request,
          params,
          query,
          json,
          headers,
          cookies,
          ctx,
        });

        if (result instanceof Response || isProcedureResult(result)) {
          return normalizeProcedureResult(
            routeContext,
            result,
          ) as NextRouteResponse<TProcedure>;
        }

        if (result && typeof result === "object" && "ctx" in result) {
          ctx = {
            ...ctx,
            ...(result.ctx as Record<string, unknown>),
          };
        }
      }

      const result = await handler({
        request,
        params,
        query,
        json,
        headers,
        cookies,
        ctx,
      } as InferProcedureHandlerContext<TProcedure>);

      return normalizeProcedureResult(
        routeContext,
        result as Response | NextResponse | ProcedureResult,
      ) as NextRouteResponse<TProcedure>;
    } catch (error) {
      if (error instanceof Response) {
        return error as NextRouteResponse<TProcedure>;
      }

      if (isRpcError(error)) {
        return routeContext.json(error.toJSON(), {
          status: error.status,
        }) as NextRouteResponse<TProcedure>;
      }

      throw error;
    }
  };

  return attachProcedureDefinition(
    routeHandler,
    options.method
      ? {
          ...procedure.definition,
          method: options.method,
        }
      : procedure.definition,
  ) as NextRouteHandler<TProcedure, TMethod>;
};

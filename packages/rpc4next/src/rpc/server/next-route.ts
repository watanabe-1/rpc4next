import type { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import type { ContentType } from "../lib/content-type-types";
import type { HttpStatusCode } from "../lib/http-status-code-types";
import { searchParamsToObject } from "../lib/search-params";
import type { RpcErrorCode, RpcErrorEnvelope, RpcErrorStatus } from "./error";
import { rpcError } from "./error";
import type {
  ProcedureMiddleware,
  ProcedureMiddlewareResult,
  ProcedureResult,
} from "./procedure";
import {
  executePipeline,
  isProcedureResult,
  normalizeProcedureResult,
  normalizeRpcErrorResponse,
  withProcedureMethod,
} from "./procedure-internals";
import type { ProcedureInputTarget } from "./procedure-types";
import {
  attachProcedureDefinition,
  type MergeProcedureDefinition,
  type ProcedureDefinition,
  type ProcedureErrorContract,
  type ProcedureInputContract,
  type WithProcedureDefinition,
} from "./procedure-types";
import { createRouteContext } from "./route-context";
import type { Params, TypedNextResponse } from "./types";
import {
  getCookiesObject,
  getHeadersObject,
} from "./validators/validator-utils";

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
    try {
      return await request.json();
    } catch (error) {
      throw rpcError("BAD_REQUEST", {
        message: "Invalid JSON body.",
        cause: error,
      });
    }
  }

  if (target === "headers") {
    return await getHeadersObject();
  }

  return await getCookiesObject();
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

type InferProcedureValidationErrorResponse<
  TProcedure extends ProcedureTypeCarrier,
> =
  InferProcedureDefinition<TProcedure> extends {
    input: ProcedureInputContract<infer TValidationSchema>;
  }
    ? keyof TValidationSchema["input"] extends never
      ? never
      : ProcedureErrorResponse<"BAD_REQUEST">
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
        | InferProcedureValidationErrorResponse<TProcedure>
        | InferProcedureErrorResponse<TProcedure>
    :
        | NormalizeProcedureHandlerResult<
            InferProcedureHandlerResult<TProcedure>
          >
        | InferProcedureValidationErrorResponse<TProcedure>
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

      const executionContext = {
        request,
        params,
        query,
        json,
        headers,
        cookies,
        ctx: {} as Record<string, unknown>,
      };

      const result = await executePipeline<
        typeof executionContext,
        ProcedureMiddlewareResult | InferProcedureHandlerResult<TProcedure>,
        Response | NextResponse | ProcedureResult
      >(
        [
          ...procedure.middlewares,
          (context) =>
            handler(
              context as InferProcedureHandlerContext<TProcedure>,
            ) as InferProcedureHandlerResult<TProcedure>,
        ],
        executionContext,
        {
          isTerminal: (
            value,
          ): value is Response | NextResponse | ProcedureResult =>
            value instanceof Response || isProcedureResult(value),
          applyResult: (context, value) => {
            if (value && typeof value === "object" && "ctx" in value) {
              context.ctx = {
                ...context.ctx,
                ...(value.ctx as Record<string, unknown>),
              };
            }
          },
        },
      );

      return normalizeProcedureResult(
        routeContext,
        result as Response | NextResponse | ProcedureResult,
      ) as NextRouteResponse<TProcedure>;
    } catch (error) {
      if (error instanceof Response) {
        return error as NextRouteResponse<TProcedure>;
      }

      const rpcErrorResponse = normalizeRpcErrorResponse(error, routeContext);
      if (rpcErrorResponse) {
        return rpcErrorResponse as NextRouteResponse<TProcedure>;
      }

      throw error;
    }
  };

  return attachProcedureDefinition(
    routeHandler,
    options.method
      ? withProcedureMethod(procedure.definition, options.method)
      : procedure.definition,
  ) as NextRouteHandler<TProcedure, TMethod>;
};

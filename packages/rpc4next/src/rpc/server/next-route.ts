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
import {
  isStandardSchemaV1,
  type StandardSchemaV1,
  type StandardSchemaV1Issue,
} from "./standard-schema";
import type { Params, TypedNextResponse } from "./types";

const getStandardSchemaMessage = (issues: readonly StandardSchemaV1Issue[]) => {
  return issues[0]?.message ?? "Validation failed.";
};

const parseWithSchema = async (schema: StandardSchemaV1, value: unknown) => {
  const result = await schema["~standard"].validate(value);

  if (result.issues) {
    throw rpcError("BAD_REQUEST", {
      message: getStandardSchemaMessage(result.issues),
      details: result.issues,
    });
  }

  return result.value;
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
    return Object.fromEntries(request.headers.entries());
  }

  return Object.fromEntries(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  );
};

type ProcedureTypeCarrier = {
  definition: ProcedureDefinition;
  middlewares: readonly ProcedureMiddleware[];
  handler: (...args: never[]) => unknown;
};

type InferProcedureDefinition<TProcedure extends ProcedureTypeCarrier> =
  TProcedure extends {
    definition: infer TDefinition extends ProcedureDefinition;
  }
    ? TDefinition
    : ProcedureDefinition;

type ProcedureIsRouteBound<TProcedure extends ProcedureTypeCarrier> =
  InferProcedureDefinition<TProcedure> extends {
    route: infer TRoute;
  }
    ? Exclude<TRoute, undefined> extends never
      ? false
      : true
    : false;

type ProcedureHasJsonContract<TProcedure extends ProcedureTypeCarrier> =
  InferProcedureDefinition<TProcedure> extends {
    input: ProcedureInputContract<infer TValidationSchema>;
  }
    ? "json" extends keyof TValidationSchema["input"]
      ? true
      : false
    : false;

type NextRouteMethodConstraint<
  TProcedure extends ProcedureTypeCarrier,
  TMethod extends HttpMethod | undefined,
> =
  ProcedureIsRouteBound<TProcedure> extends false
    ? {
        __error__: "nextRoute() only accepts procedures that were bound with forRoute(routeContract).";
      }
    : TMethod extends "GET" | "HEAD"
      ? ProcedureHasJsonContract<TProcedure> extends true
        ? {
            __error__: "JSON input contracts are not supported for GET or HEAD procedures.";
          }
        : unknown
      : unknown;

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

type InferProcedureErrorContractResponse<TError> =
  TError extends ProcedureErrorContract<infer TCode, infer TDetails>
    ? ProcedureErrorResponse<TCode, TDetails>
    : never;

type InferProcedureErrorResponse<TProcedure extends ProcedureTypeCarrier> =
  "error" extends keyof InferProcedureDefinition<TProcedure>
    ? InferProcedureErrorContractResponse<
        InferProcedureDefinition<TProcedure>["error"]
      >
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

type InferProcedureOutputValidationErrorResponse<
  TProcedure extends ProcedureTypeCarrier,
  TValidateOutput extends boolean,
> = TValidateOutput extends true
  ? InferProcedureDefinition<TProcedure> extends {
      output: ProcedureDefinition["output"];
    }
    ? ProcedureErrorResponse<"INTERNAL_SERVER_ERROR">
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

type NextRouteResponse<
  TProcedure extends ProcedureTypeCarrier,
  TValidateOutput extends boolean = false,
> =
  IsNever<InferProcedureHandlerResult<TProcedure>> extends true
    ?
        | TypedNextResponse<unknown, HttpStatusCode, ContentType>
        | InferProcedureValidationErrorResponse<TProcedure>
        | InferProcedureOutputValidationErrorResponse<
            TProcedure,
            TValidateOutput
          >
        | InferProcedureErrorResponse<TProcedure>
    :
        | NormalizeProcedureHandlerResult<
            InferProcedureHandlerResult<TProcedure>
          >
        | InferProcedureValidationErrorResponse<TProcedure>
        | InferProcedureOutputValidationErrorResponse<
            TProcedure,
            TValidateOutput
          >
        | InferProcedureErrorResponse<TProcedure>;

export type NextRouteHandler<
  TProcedure extends ProcedureTypeCarrier = ProcedureTypeCarrier,
  TMethod extends HttpMethod | undefined = undefined,
  TValidateOutput extends boolean = false,
> = WithProcedureDefinition<
  (
    request: NextRequest,
    segmentData: { params: Promise<Params> },
  ) => Promise<NextRouteResponse<TProcedure, TValidateOutput>>,
  TMethod extends HttpMethod
    ? MergeProcedureDefinition<
        InferProcedureDefinition<TProcedure>,
        { method: TMethod }
      >
    : InferProcedureDefinition<TProcedure>
>;

export interface NextRouteOptions<TMethod extends HttpMethod = HttpMethod> {
  method?: TMethod;
  validateOutput?: boolean;
}

const parseOutputWithSchema = async (
  schema: StandardSchemaV1,
  value: unknown,
) => {
  const result = await schema["~standard"].validate(value);

  if (result.issues) {
    throw rpcError("INTERNAL_SERVER_ERROR", {
      message: "Procedure output validation failed.",
      details: result.issues,
    });
  }

  return result.value;
};

const isSuccessfulStatus = (status: HttpStatusCode | undefined) => {
  return status === undefined || (status >= 200 && status < 300);
};

const shouldValidateProcedureOutput = (
  result: Response | NextResponse | ProcedureResult | undefined,
): result is ProcedureResult => {
  if (!result || result instanceof Response || !isProcedureResult(result)) {
    return false;
  }

  if (result.redirect || result.body === undefined) {
    return false;
  }

  return isSuccessfulStatus(result.status);
};

export const nextRoute = <
  TProcedure extends ProcedureTypeCarrier,
  TMethod extends HttpMethod | undefined = undefined,
  TValidateOutput extends boolean = false,
>(
  procedure: TProcedure,
  options: NextRouteOptions<Exclude<TMethod, undefined>> &
    NextRouteMethodConstraint<TProcedure, TMethod> & {
      validateOutput?: TValidateOutput;
    } = {} as NextRouteOptions<Exclude<TMethod, undefined>> &
    NextRouteMethodConstraint<TProcedure, TMethod> & {
      validateOutput?: TValidateOutput;
    },
): NextRouteHandler<TProcedure, TMethod, TValidateOutput> => {
  const handler = procedure.handler as (
    context: InferProcedureHandlerContext<TProcedure>,
  ) =>
    | InferProcedureHandlerResult<TProcedure>
    | Promise<InferProcedureHandlerResult<TProcedure>>;
  const outputSchema = procedure.definition.output?.schema;

  if (
    options.validateOutput &&
    outputSchema !== undefined &&
    !isStandardSchemaV1(outputSchema)
  ) {
    throw new Error(
      "Procedure output contracts must implement Standard Schema V1 when validateOutput is enabled.",
    );
  }

  const routeHandler = async (
    request: NextRequest,
    segmentData: { params: Promise<Params> },
  ): Promise<NextRouteResponse<TProcedure, TValidateOutput>> => {
    const routeContext = createRouteContext(request, segmentData);
    const contracts = procedure.definition.input?.contracts ?? {};

    if (
      Object.values(contracts).some((contract) => !isStandardSchemaV1(contract))
    ) {
      throw new Error(
        "Procedure input contracts must implement Standard Schema V1.",
      );
    }

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
          ...(procedure.middlewares as readonly ((
            context: typeof executionContext,
          ) =>
            | ProcedureMiddlewareResult
            | Promise<ProcedureMiddlewareResult>)[]),
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

      const normalizedResult =
        options.validateOutput &&
        outputSchema !== undefined &&
        shouldValidateProcedureOutput(
          result as Response | NextResponse | ProcedureResult,
        )
          ? {
              ...(result as ProcedureResult),
              body: await parseOutputWithSchema(
                outputSchema as StandardSchemaV1,
                (result as ProcedureResult).body,
              ),
            }
          : (result as Response | NextResponse | ProcedureResult);

      return normalizeProcedureResult(
        routeContext,
        normalizedResult,
      ) as NextRouteResponse<TProcedure, TValidateOutput>;
    } catch (error) {
      if (error instanceof Response) {
        return error as NextRouteResponse<TProcedure, TValidateOutput>;
      }

      const rpcErrorResponse = normalizeRpcErrorResponse(error, routeContext);
      if (rpcErrorResponse) {
        return rpcErrorResponse as NextRouteResponse<
          TProcedure,
          TValidateOutput
        >;
      }

      throw error;
    }
  };

  return attachProcedureDefinition(routeHandler, {
    ...(options.method
      ? withProcedureMethod(procedure.definition, options.method)
      : procedure.definition),
    ...(options.validateOutput &&
    procedure.definition.output !== undefined &&
    outputSchema !== undefined
      ? {
          output: {
            ...procedure.definition.output,
            runtime: true,
          },
        }
      : {}),
  }) as NextRouteHandler<TProcedure, TMethod, TValidateOutput>;
};

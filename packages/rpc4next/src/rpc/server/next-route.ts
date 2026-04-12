import type { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import type { ContentType } from "../lib/content-type-types";
import type { HttpStatusCode } from "../lib/http-status-code-types";
import { searchParamsToObject } from "../lib/search-params";
import { rpcError } from "./error";
import type { ProcedureOnError } from "./on-error";
import type {
  ProcedureMiddleware,
  ProcedureMiddlewareResult,
  ProcedureResult,
} from "./procedure";
import {
  executePipeline,
  isProcedureResult,
  normalizeProcedureResult,
  withProcedureMethod,
} from "./procedure-internals";
import type { ProcedureInputTarget } from "./procedure-types";
import {
  attachProcedureDefinition,
  type MergeProcedureDefinition,
  type ProcedureDefinition,
  type ProcedureInputContract,
  type ProcedureValidationErrorHandlerResult,
  type ProcedureValidationErrorResponseMap,
  type WithProcedureDefinition,
} from "./procedure-types";
import {
  createResponseHelpers,
  createRouteContext,
  getResponseHelperMetadata,
} from "./route-context";
import {
  isStandardSchemaV1,
  type StandardSchemaV1,
  type StandardSchemaV1Issue,
} from "./standard-schema";
import type { Params, TypedNextResponse } from "./types";

const getStandardSchemaMessage = (issues: readonly StandardSchemaV1Issue[]) => {
  return issues[0]?.message ?? "Validation failed.";
};

const isValidationTerminalResult = (
  value: ProcedureValidationErrorHandlerResult,
): value is Response | NextResponse | ProcedureResult => {
  return value instanceof Response || isProcedureResult(value);
};

const formDataToObject = (formData: FormData) => {
  const normalized: Record<string, FormDataEntryValue | FormDataEntryValue[]> =
    {};

  for (const [key, value] of formData.entries()) {
    const existing = normalized[key];

    if (existing === undefined) {
      normalized[key] = value;
      continue;
    }

    normalized[key] = Array.isArray(existing)
      ? [...existing, value]
      : [existing, value];
  }

  return normalized;
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

  if (target === "formData") {
    try {
      return formDataToObject(await request.formData());
    } catch (error) {
      throw rpcError("BAD_REQUEST", {
        message: "Invalid form-data body.",
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

type ProcedureHasFormDataContract<TProcedure extends ProcedureTypeCarrier> =
  InferProcedureDefinition<TProcedure> extends {
    input: ProcedureInputContract<infer TValidationSchema>;
  }
    ? "formData" extends keyof TValidationSchema["input"]
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
        : ProcedureHasFormDataContract<TProcedure> extends true
          ? {
              __error__: "FormData input contracts are not supported for GET or HEAD procedures.";
            }
          : unknown
      : unknown;

type ProcedureErrorResponse<
  TCode extends "BAD_REQUEST" | "INTERNAL_SERVER_ERROR",
> = TCode extends "BAD_REQUEST"
  ? TypedNextResponse<
      {
        error: {
          code: "BAD_REQUEST";
          message: string;
          details?: unknown;
        };
      },
      400,
      "application/json"
    >
  : TypedNextResponse<
      {
        error: {
          code: "INTERNAL_SERVER_ERROR";
          message: string;
          details?: unknown;
        };
      },
      500,
      "application/json"
    >;

type InferProcedureValidationErrorResponse<
  TProcedure extends ProcedureTypeCarrier,
> =
  InferProcedureDefinition<TProcedure> extends {
    input: ProcedureInputContract<
      infer TValidationSchema,
      infer TValidationErrorResponses
    >;
  }
    ? keyof TValidationSchema["input"] extends never
      ? never
      :
          | ProcedureErrorResponse<"BAD_REQUEST">
          | InferProcedureCustomValidationErrorResponse<TValidationErrorResponses>
    : never;

type InferProcedureCustomValidationErrorResponse<TValidationErrorResponses> =
  TValidationErrorResponses extends ProcedureValidationErrorResponseMap
    ? NormalizeProcedureHandlerResult<
        Exclude<
          TValidationErrorResponses[keyof TValidationErrorResponses],
          undefined
        >
      >
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

type InferProcedureDeclaredOutput<TProcedure extends ProcedureTypeCarrier> =
  InferProcedureDefinition<TProcedure>["output"] extends {
    response?: infer TResponse;
  }
    ? TResponse
    : unknown;

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

type InferProcedureOnErrorResponse<TOnError extends ProcedureOnError> =
  NormalizeProcedureHandlerResult<Awaited<ReturnType<TOnError>>>;

type NextRouteResponse<
  TProcedure extends ProcedureTypeCarrier,
  TValidateOutput extends boolean = false,
  TOnError extends ProcedureOnError = ProcedureOnError,
> =
  IsNever<InferProcedureHandlerResult<TProcedure>> extends true
    ?
        | TypedNextResponse<unknown, HttpStatusCode, ContentType>
        | InferProcedureOnErrorResponse<TOnError>
        | InferProcedureValidationErrorResponse<TProcedure>
        | InferProcedureOutputValidationErrorResponse<
            TProcedure,
            TValidateOutput
          >
    :
        | NormalizeProcedureHandlerResult<
            InferProcedureHandlerResult<TProcedure>
          >
        | InferProcedureOnErrorResponse<TOnError>
        | InferProcedureValidationErrorResponse<TProcedure>
        | InferProcedureOutputValidationErrorResponse<
            TProcedure,
            TValidateOutput
          >;

export type NextRouteHandler<
  TProcedure extends ProcedureTypeCarrier = ProcedureTypeCarrier,
  TMethod extends HttpMethod | undefined = undefined,
  TValidateOutput extends boolean = false,
  TOnError extends ProcedureOnError = ProcedureOnError,
> = WithProcedureDefinition<
  (
    request: NextRequest,
    segmentData: { params: Promise<Params> },
  ) => Promise<NextRouteResponse<TProcedure, TValidateOutput, TOnError>>,
  TMethod extends HttpMethod
    ? MergeProcedureDefinition<
        InferProcedureDefinition<TProcedure>,
        { method: TMethod }
      >
    : InferProcedureDefinition<TProcedure>
>;

export interface NextRouteOptions<
  TMethod extends HttpMethod = HttpMethod,
  TOnError extends ProcedureOnError = ProcedureOnError,
> {
  method?: TMethod;
  validateOutput?: boolean;
  onError: TOnError;
}

export type NextRouteProcedureOptions<
  TProcedure extends {
    definition: ProcedureDefinition;
    middlewares: readonly ProcedureMiddleware[];
    handler: (...args: never[]) => unknown;
  },
  TMethod extends HttpMethod | undefined = undefined,
  TValidateOutput extends boolean = false,
  TOnError extends ProcedureOnError = ProcedureOnError,
> = NextRouteOptions<Exclude<TMethod, undefined>, TOnError> &
  NextRouteMethodConstraint<TProcedure, TMethod> & {
    validateOutput?: TValidateOutput;
  };

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

const getHttpStatusCode = (status: number): HttpStatusCode | undefined => {
  return Number.isInteger(status) && status >= 100 && status <= 599
    ? (status as HttpStatusCode)
    : undefined;
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

const getProcedureOutputValidationValue = (
  result: Response | NextResponse | ProcedureResult | undefined,
) => {
  if (shouldValidateProcedureOutput(result)) {
    return result.body;
  }

  if (!(result instanceof Response)) {
    return undefined;
  }

  const helperMetadata = getResponseHelperMetadata(result);

  if (!helperMetadata || helperMetadata.kind === "redirect") {
    return undefined;
  }

  return isSuccessfulStatus(getHttpStatusCode(result.status))
    ? helperMetadata.payload
    : undefined;
};

const isBodyInitLike = (value: unknown): value is BodyInit | null => {
  return (
    value === null ||
    typeof value === "string" ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ReadableStream ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  );
};

const getParsedOutputReflectionError = (helper: "body" | "text") => {
  return rpcError("INTERNAL_SERVER_ERROR", {
    message: `Procedure output validation produced a value that cannot be reflected by response.${helper}(...).`,
  });
};

const applyParsedProcedureOutput = (
  routeContext: ReturnType<typeof createRouteContext>,
  result: Response | NextResponse | ProcedureResult | undefined,
  parsedValue: unknown,
) => {
  if (shouldValidateProcedureOutput(result)) {
    return {
      ...result,
      body: parsedValue,
    } satisfies ProcedureResult;
  }

  if (!(result instanceof Response)) {
    return result;
  }

  const helperMetadata = getResponseHelperMetadata(result);
  const status = getHttpStatusCode(result.status);

  if (
    !helperMetadata ||
    helperMetadata.kind === "redirect" ||
    !isSuccessfulStatus(status)
  ) {
    return result;
  }

  const init = {
    headersInit: result.headers,
    status,
    statusText: result.statusText,
  };

  if (helperMetadata.kind === "json") {
    return routeContext.json(parsedValue, init);
  }

  if (helperMetadata.kind === "text") {
    if (typeof parsedValue !== "string") {
      throw getParsedOutputReflectionError("text");
    }

    return routeContext.text(parsedValue, init);
  }

  if (!isBodyInitLike(parsedValue)) {
    throw getParsedOutputReflectionError("body");
  }

  return routeContext.body(parsedValue, init);
};

const validateProcedureInputs = async (
  request: NextRequest,
  segmentData: { params: Promise<Params> },
  response: ReturnType<typeof createRouteContext>,
  procedureDefinition: ProcedureDefinition,
) => {
  const contracts = procedureDefinition.input?.contracts ?? {};
  const inputOptions = procedureDefinition.input?.options ?? {};

  if (contracts.json && contracts.formData) {
    throw new Error(
      "Procedure body contracts are mutually exclusive; use either .json(schema) or .formData(schema), not both.",
    );
  }

  if (
    Object.values(contracts).some((contract) => !isStandardSchemaV1(contract))
  ) {
    throw new Error(
      "Procedure input contracts must implement Standard Schema V1.",
    );
  }

  const parseContract = async <TTarget extends ProcedureInputTarget>(
    target: TTarget,
    schema: StandardSchemaV1 | undefined,
    fallback: () => Promise<unknown>,
  ) => {
    if (!schema) {
      return {
        ok: true as const,
        value: await fallback(),
      };
    }

    const rawValue = await getContractValue(request, segmentData, target);
    const result = await schema["~standard"].validate(rawValue);

    if (!result.issues) {
      return {
        ok: true as const,
        value: result.value,
      };
    }

    const hookResult = await inputOptions[target]?.onValidationError?.({
      target,
      value: rawValue,
      issues: result.issues,
      request,
      response,
    });

    if (isValidationTerminalResult(hookResult)) {
      return {
        ok: false as const,
        response: hookResult,
      };
    }

    throw rpcError("BAD_REQUEST", {
      message: getStandardSchemaMessage(result.issues),
      details: result.issues,
    });
  };

  const paramsResult = await parseContract(
    "params",
    contracts.params,
    async () => segmentData.params,
  );
  if (!paramsResult.ok) {
    return paramsResult;
  }

  const queryResult = await parseContract("query", contracts.query, async () =>
    searchParamsToObject(request.nextUrl.searchParams),
  );
  if (!queryResult.ok) {
    return queryResult;
  }

  const jsonResult =
    request.method === "GET" || request.method === "HEAD"
      ? contracts.json
        ? (() => {
            throw rpcError("BAD_REQUEST", {
              message:
                "JSON input contracts are not supported for GET or HEAD requests.",
            });
          })()
        : {
            ok: true as const,
            value: undefined,
          }
      : await parseContract("json", contracts.json, async () => undefined);
  if (!jsonResult.ok) {
    return jsonResult;
  }

  const formDataResult =
    request.method === "GET" || request.method === "HEAD"
      ? contracts.formData
        ? (() => {
            throw rpcError("BAD_REQUEST", {
              message:
                "FormData input contracts are not supported for GET or HEAD requests.",
            });
          })()
        : {
            ok: true as const,
            value: undefined,
          }
      : await parseContract(
          "formData",
          contracts.formData,
          async () => undefined,
        );
  if (!formDataResult.ok) {
    return formDataResult;
  }

  const headersResult = await parseContract(
    "headers",
    contracts.headers,
    async () => undefined,
  );
  if (!headersResult.ok) {
    return headersResult;
  }

  const cookiesResult = await parseContract(
    "cookies",
    contracts.cookies,
    async () => undefined,
  );
  if (!cookiesResult.ok) {
    return cookiesResult;
  }

  return {
    ok: true as const,
    values: {
      params: paramsResult.value,
      query: queryResult.value,
      json: jsonResult.value,
      formData: formDataResult.value,
      headers: headersResult.value,
      cookies: cookiesResult.value,
    },
  };
};

export const nextRoute = <
  TProcedure extends ProcedureTypeCarrier,
  TMethod extends HttpMethod | undefined = undefined,
  TValidateOutput extends boolean = false,
  TOnError extends ProcedureOnError = ProcedureOnError,
>(
  procedure: TProcedure,
  options: NextRouteProcedureOptions<
    TProcedure,
    TMethod,
    TValidateOutput,
    TOnError
  >,
): NextRouteHandler<TProcedure, TMethod, TValidateOutput, TOnError> => {
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
  ): Promise<NextRouteResponse<TProcedure, TValidateOutput, TOnError>> => {
    const routeContext = createRouteContext(request, segmentData);
    const errorResponse = createResponseHelpers();
    const response =
      createResponseHelpers<InferProcedureDeclaredOutput<TProcedure>>();

    try {
      const inputResult = await validateProcedureInputs(
        request,
        segmentData,
        routeContext,
        procedure.definition,
      );
      if (!inputResult.ok) {
        return normalizeProcedureResult(
          routeContext,
          inputResult.response,
        ) as NextRouteResponse<TProcedure, TValidateOutput, TOnError>;
      }

      const { params, query, json, formData, headers, cookies } =
        inputResult.values;

      const executionContext = {
        request,
        params,
        query,
        json,
        formData,
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
            handler({
              ...context,
              response,
            } as InferProcedureHandlerContext<TProcedure>) as InferProcedureHandlerResult<TProcedure>,
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

      const outputValidationValue =
        options.validateOutput && outputSchema !== undefined
          ? getProcedureOutputValidationValue(
              result as Response | NextResponse | ProcedureResult,
            )
          : undefined;

      let normalizedResult = result as
        | Response
        | NextResponse
        | ProcedureResult;

      if (outputValidationValue !== undefined) {
        const parsedOutput = await parseOutputWithSchema(
          outputSchema as StandardSchemaV1,
          outputValidationValue,
        );

        normalizedResult =
          applyParsedProcedureOutput(
            routeContext,
            normalizedResult,
            parsedOutput,
          ) ?? normalizedResult;
      }

      return normalizeProcedureResult(
        routeContext,
        normalizedResult,
      ) as NextRouteResponse<TProcedure, TValidateOutput, TOnError>;
    } catch (error) {
      const handled = await options.onError(error, {
        request,
        params: await segmentData.params,
        response: errorResponse,
        routeContext,
      });

      return normalizeProcedureResult(
        routeContext,
        handled,
      ) as NextRouteResponse<TProcedure, TValidateOutput, TOnError>;
    }
  };

  const definitionWithMethod = options.method
    ? withProcedureMethod(procedure.definition, options.method)
    : procedure.definition;

  const shouldEnableRuntimeOutputValidation =
    options.validateOutput &&
    definitionWithMethod.output !== undefined &&
    outputSchema !== undefined;

  const routeDefinition = shouldEnableRuntimeOutputValidation
    ? {
        ...definitionWithMethod,
        output: {
          ...definitionWithMethod.output,
          runtime: true,
        },
      }
    : definitionWithMethod;

  return attachProcedureDefinition(
    routeHandler,
    routeDefinition,
  ) as NextRouteHandler<TProcedure, TMethod, TValidateOutput, TOnError>;
};

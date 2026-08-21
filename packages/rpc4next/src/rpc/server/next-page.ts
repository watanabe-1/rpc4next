import { cookies as getCookies, headers as getHeaders } from "next/headers";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { NextRequest } from "next/server";

import { searchParamsToObject } from "../lib/search-params";
import type { ProcedureMiddleware, ProcedureMiddlewareResult, ProcedureResult } from "./procedure";
import { attachProcedureDefinition } from "./procedure-definition";
import { executePipeline, isProcedureResult } from "./procedure-internals";
import type {
  MergeProcedureDefinition,
  ProcedureDefinition,
  ProcedureInputContract,
  ProcedureRouteBinding,
  WithProcedureDefinition,
} from "./procedure-types";
import type { ProcedureInputTarget } from "./procedure-types";
import { createResponseHelpers } from "./route-context";
import type { ValidationSchema } from "./route-types";
import {
  isStandardSchemaV1,
  type StandardSchemaV1,
  type StandardSchemaV1Issue,
} from "./standard-schema";
import type { Params, Query } from "./types";

type PageSearchParams = Record<string, string | string[] | undefined>;

export type NextPageProps<TParams extends Params = Params> = {
  params: Promise<TParams>;
  searchParams?: Promise<PageSearchParams>;
};

type NextPageValidatedRenderContext<TValidationSchema extends ValidationSchema> =
  ("params" extends keyof TValidationSchema["output"]
    ? {
        params: TValidationSchema["output"]["params"];
      }
    : Record<never, never>) &
    ("query" extends keyof TValidationSchema["output"]
      ? {
          query: TValidationSchema["output"]["query"];
        }
      : Record<never, never>);

type NextPageDataRenderContext<TProcedure extends NextPageProcedureCarrier, TData> =
  ProcedureHasHandler<TProcedure> extends true
    ? {
        data: TData;
      }
    : Record<never, never>;

export type NextPageRenderContext<
  TProcedure extends NextPageProcedureCarrier = HandledNextPageProcedureCarrier,
  TData = unknown,
  TContext extends object = object,
> = NextPageValidatedRenderContext<InferProcedureValidationSchema<TProcedure>> &
  NextPageDataRenderContext<TProcedure, TData> & {
    ctx: TContext;
  };

export type NextPageRender<
  TProcedure extends NextPageProcedureCarrier = HandledNextPageProcedureCarrier,
  TData = unknown,
  TContext extends object = object,
  TResult = unknown,
> = (context: NextPageRenderContext<TProcedure, TData, TContext>) => TResult | Promise<TResult>;

export type ProcedurePageOnError<TResult = unknown> = (
  error: unknown,
  context: {
    params: Params;
    searchParams: Query;
  },
) => TResult | Promise<TResult>;

export const defaultProcedurePageOnError = ((error) => {
  throw error;
}) satisfies ProcedurePageOnError<never>;

export type DefaultProcedurePageOnError = typeof defaultProcedurePageOnError;

export type ProcedurePageOnValidationErrorContext<
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
> = {
  target: TTarget;
  value: unknown;
  issues: readonly StandardSchemaV1Issue[];
  params: Params;
  searchParams: Query;
};

export type ProcedurePageOnValidationError<TResult = unknown> = (
  context: ProcedurePageOnValidationErrorContext,
) => TResult | Promise<TResult>;

export type NextPageProcedureCarrier = {
  definition: ProcedureDefinition;
  middlewares: readonly ProcedureMiddleware[];
  handler?: (...args: never[]) => unknown;
  middlewareTerminalResult: unknown;
};

type HandledNextPageProcedureCarrier = NextPageProcedureCarrier & {
  handler: (...args: never[]) => unknown;
};

type InferProcedureDefinition<TProcedure extends NextPageProcedureCarrier> = TProcedure extends {
  definition: infer TDefinition extends ProcedureDefinition;
}
  ? TDefinition
  : ProcedureDefinition;

type InferProcedureHandler<TProcedure extends NextPageProcedureCarrier> = TProcedure extends {
  handler: infer THandler;
}
  ? THandler
  : never;

type ProcedureHasHandler<TProcedure extends NextPageProcedureCarrier> = TProcedure extends {
  handler: (...args: never[]) => unknown;
}
  ? true
  : false;

type InferProcedureHandlerContext<TProcedure extends NextPageProcedureCarrier> =
  InferProcedureHandler<TProcedure> extends (context: infer TContext) => unknown ? TContext : never;

type InferProcedureHandlerResult<TProcedure extends NextPageProcedureCarrier> = TProcedure extends {
  handler: (...args: never[]) => infer TResult;
}
  ? Awaited<TResult>
  : never;

type InferProcedureValidationSchema<TProcedure extends NextPageProcedureCarrier> =
  InferProcedureDefinition<TProcedure> extends ProcedureDefinition<
    infer _THttpMethod,
    infer TValidationSchema
  >
    ? TValidationSchema
    : ValidationSchema;

type InferProcedureMiddlewareTerminalResult<TProcedure extends NextPageProcedureCarrier> =
  TProcedure extends {
    middlewareTerminalResult: infer TResult;
  }
    ? Awaited<TResult>
    : never;

type InferProcedureData<TProcedure extends NextPageProcedureCarrier> =
  InferProcedureHandlerResult<TProcedure> extends ProcedureResult<infer TBody> ? TBody : unknown;

type ProcedureIsRouteBound<TProcedure extends NextPageProcedureCarrier> =
  InferProcedureDefinition<TProcedure> extends {
    route: infer TRoute;
  }
    ? Exclude<TRoute, undefined> extends never
      ? false
      : true
    : false;

type ExtractBoundRouteParams<TProcedure extends NextPageProcedureCarrier> =
  InferProcedureDefinition<TProcedure> extends {
    route: ProcedureRouteBinding<string, infer TParams>;
  }
    ? TParams
    : never;

type ProcedureHasBoundRouteParams<TProcedure extends NextPageProcedureCarrier> = [
  ExtractBoundRouteParams<TProcedure>,
] extends [never]
  ? false
  : keyof ExtractBoundRouteParams<TProcedure> extends never
    ? false
    : true;

type ProcedureHasValidatedParams<TProcedure extends NextPageProcedureCarrier> =
  InferProcedureValidationSchema<TProcedure>["output"] extends {
    params: unknown;
  }
    ? true
    : false;

type ProcedureHasBodyContract<
  TProcedure extends NextPageProcedureCarrier,
  TTarget extends "json" | "formData",
> =
  InferProcedureDefinition<TProcedure> extends {
    input: ProcedureInputContract<infer TValidationSchema>;
  }
    ? TTarget extends keyof TValidationSchema["input"]
      ? true
      : false
    : false;

type ResponseLike = {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly headers: Headers;
  readonly ok: boolean;
  readonly status: number;
  json: (...args: never[]) => Promise<unknown>;
  text: (...args: never[]) => Promise<string>;
};

type PageIncompatibleTerminalResult<TResult> =
  | Extract<Awaited<TResult>, ResponseLike>
  | Extract<Awaited<TResult>, { redirect: string }>;

type ProcedureHasPageIncompatibleTerminalResult<TProcedure extends NextPageProcedureCarrier> = [
  PageIncompatibleTerminalResult<
    InferProcedureHandlerResult<TProcedure> | InferProcedureMiddlewareTerminalResult<TProcedure>
  >,
] extends [never]
  ? false
  : true;

type NextPageProcedureConstraint<TProcedure extends NextPageProcedureCarrier> =
  ProcedureIsRouteBound<TProcedure> extends false
    ? {
        __error__: "nextPage() only accepts procedures that were bound with forRoute(routeContract).";
      }
    : ProcedureHasBoundRouteParams<TProcedure> extends true
      ? ProcedureHasValidatedParams<TProcedure> extends true
        ? ProcedureNextPageInputConstraint<TProcedure>
        : {
            __error__: "Bound page procedures with generated params must call .params(schema) before .nextPage().";
          }
      : ProcedureNextPageInputConstraint<TProcedure>;

type ProcedureNextPageInputConstraint<TProcedure extends NextPageProcedureCarrier> =
  ProcedureHasBodyContract<TProcedure, "json"> extends true
    ? {
        __error__: "JSON input contracts are not supported for page procedures.";
      }
    : ProcedureHasBodyContract<TProcedure, "formData"> extends true
      ? {
          __error__: "FormData input contracts are not supported for page procedures.";
        }
      : ProcedureHasPageIncompatibleTerminalResult<TProcedure> extends true
        ? {
            __error__: "Page procedures cannot return Response values or ProcedureResult redirects. Return a ProcedureResult body, or throw redirect()/notFound().";
          }
        : unknown;

export type NextPageHandler<
  TProcedure extends NextPageProcedureCarrier = NextPageProcedureCarrier,
  TResult = unknown,
> = WithProcedureDefinition<
  (props: NextPageProps) => Promise<TResult>,
  MergeProcedureDefinition<InferProcedureDefinition<TProcedure>, { method: never }>
>;

export type NextPageOptions<
  TOnError extends ProcedurePageOnError = ProcedurePageOnError,
  TOnValidationError extends ProcedurePageOnValidationError | undefined = undefined,
> = {
  onError?: TOnError;
  onValidationError?: TOnValidationError;
  validateOutput?: boolean;
};

export type NextPageProcedureOptions<
  TProcedure extends NextPageProcedureCarrier,
  TOnError extends ProcedurePageOnError = ProcedurePageOnError,
  TOnValidationError extends ProcedurePageOnValidationError | undefined = undefined,
> = NextPageOptions<TOnError, TOnValidationError> & NextPageProcedureConstraint<TProcedure>;

type NextPageArgs<
  TProcedure extends NextPageProcedureCarrier,
  TResult,
  TOnError extends ProcedurePageOnError,
  TOnValidationError extends ProcedurePageOnValidationError | undefined,
> =
  NextPageProcedureConstraint<TProcedure> extends infer TConstraint
    ? TConstraint extends { __error__: string }
      ? [render: TConstraint, options?: never]
      : [
          render: NextPageRender<TProcedure, InferProcedureData<TProcedure>, object, TResult>,
          options?: NextPageProcedureOptions<TProcedure, TOnError, TOnValidationError>,
        ]
    : never;

const getStandardSchemaMessage = (issues: readonly StandardSchemaV1Issue[]) => {
  return issues[0]?.message ?? "Validation failed.";
};

const parseOutputWithSchema = async (schema: StandardSchemaV1, value: unknown) => {
  const result = await schema["~standard"].validate(value);

  if (result.issues) {
    throw new Error("Procedure output validation failed.");
  }

  return result.value;
};

const normalizeSearchParams = (searchParams: PageSearchParams | undefined): Query => {
  const urlSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined) {
      continue;
    }

    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      urlSearchParams.append(key, item);
    }
  }

  return searchParamsToObject(urlSearchParams);
};

const encodePathValue = (value: string | string[] | undefined) => {
  if (value === undefined) {
    return "";
  }

  const values = Array.isArray(value) ? value : [value];

  return values.map((item) => encodeURIComponent(item)).join("/");
};

const createPageRequest = (
  pathname: string | undefined,
  params: Params,
  searchParams: Query,
): NextRequest => {
  const path = (pathname ?? "/").replace(
    /\[\[\.\.\.([^\]]+)\]\]|\[\.\.\.([^\]]+)\]|\[([^\]]+)\]/g,
    (
      _match,
      optionalCatchAll: string | undefined,
      catchAll: string | undefined,
      dynamic: string | undefined,
    ) => encodePathValue(params[optionalCatchAll ?? catchAll ?? dynamic ?? ""]),
  );
  const url = new URL(path, "http://localhost");

  for (const [key, value] of Object.entries(searchParams)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      url.searchParams.append(key, item);
    }
  }

  return new NextRequest(url);
};

const createPageHelpers = () => ({
  redirect,
  notFound,
});

const entriesToNullPrototypeObject = <TValue>(
  entries: Iterable<readonly [string, TValue]>,
): Record<string, TValue> => {
  const result: Record<string, TValue> = Object.create(null);

  for (const [key, value] of entries) {
    result[key] = value;
  }

  return result;
};

const readHeaders = async () => entriesToNullPrototypeObject((await getHeaders()).entries());

const readCookies = async () => {
  const cookieStore = await getCookies();

  return entriesToNullPrototypeObject(
    cookieStore.getAll().map((cookie) => [cookie.name, cookie.value] as const),
  );
};

const parseContract = async <TTarget extends ProcedureInputTarget>(
  target: TTarget,
  schema: StandardSchemaV1 | undefined,
  rawValue: unknown,
  context: {
    onValidationError: ProcedurePageOnValidationError | undefined;
    params: Params;
    searchParams: Query;
  },
) => {
  if (!schema) {
    return {
      ok: true as const,
      value: rawValue,
    };
  }

  const result = await schema["~standard"].validate(rawValue);

  if (!result.issues) {
    return {
      ok: true as const,
      value: result.value,
    };
  }

  const handled = await context.onValidationError?.({
    target,
    value: rawValue,
    issues: result.issues,
    params: context.params,
    searchParams: context.searchParams,
  });

  if (handled !== undefined) {
    return {
      ok: false as const,
      result: handled,
    };
  }

  throw new Error(getStandardSchemaMessage(result.issues));
};

const validateProcedureInputs = async (
  params: Params,
  query: Query,
  procedureDefinition: ProcedureDefinition,
  onValidationError: ProcedurePageOnValidationError | undefined,
) => {
  const contracts = procedureDefinition.input?.contracts ?? {};

  if (contracts.json || contracts.formData) {
    throw new Error("Page procedures do not support json or formData input contracts.");
  }

  const headers = contracts.headers ? await readHeaders() : undefined;
  const cookies = contracts.cookies ? await readCookies() : undefined;

  const validationContext = {
    onValidationError,
    params,
    searchParams: query,
  };

  const paramsResult = await parseContract("params", contracts.params, params, validationContext);
  if (!paramsResult.ok) return paramsResult;

  const queryResult = await parseContract("query", contracts.query, query, validationContext);
  if (!queryResult.ok) return queryResult;

  const headersResult = await parseContract(
    "headers",
    contracts.headers,
    headers,
    validationContext,
  );
  if (!headersResult.ok) return headersResult;

  const cookiesResult = await parseContract(
    "cookies",
    contracts.cookies,
    cookies,
    validationContext,
  );
  if (!cookiesResult.ok) return cookiesResult;

  return {
    ok: true as const,
    params: paramsResult.value,
    query: queryResult.value,
    headers: headersResult.value,
    cookies: cookiesResult.value,
  };
};

const assertPageTerminalResult = (result: Response | ProcedureResult | undefined) => {
  if (result === undefined) {
    return {
      data: undefined,
    };
  }

  if (result instanceof Response) {
    throw new Error(
      "Page procedures cannot render Response values. Throw redirect()/notFound() or return a ProcedureResult body instead.",
    );
  }

  if (result.redirect) {
    throw new Error(
      "Page procedures cannot render ProcedureResult redirects. Use next/navigation redirect() instead.",
    );
  }

  return {
    data: result.body,
  };
};

export const nextPage = <
  TProcedure extends NextPageProcedureCarrier,
  TResult = unknown,
  TOnError extends ProcedurePageOnError = DefaultProcedurePageOnError,
  TOnValidationError extends ProcedurePageOnValidationError | undefined = undefined,
>(
  procedure: TProcedure,
  ...[render, options]: NextPageArgs<TProcedure, TResult, TOnError, TOnValidationError>
): NextPageHandler<
  TProcedure,
  | TResult
  | Awaited<ReturnType<TOnError>>
  | (TOnValidationError extends ProcedurePageOnValidationError
      ? Awaited<ReturnType<TOnValidationError>>
      : never)
> => {
  const handler = procedure.handler as
    | ((
        context: InferProcedureHandlerContext<TProcedure>,
      ) =>
        | InferProcedureHandlerResult<TProcedure>
        | Promise<InferProcedureHandlerResult<TProcedure>>)
    | undefined;
  const onError = options?.onError ?? defaultProcedurePageOnError;
  const onValidationError = options?.onValidationError;
  const outputSchema = procedure.definition.output?.schema;

  if (options?.validateOutput && outputSchema !== undefined && !isStandardSchemaV1(outputSchema)) {
    throw new Error(
      "Procedure output contracts must implement Standard Schema V1 when validateOutput is enabled.",
    );
  }

  const inputContracts = procedure.definition.input?.contracts ?? {};
  if (Object.values(inputContracts).some((schema) => !isStandardSchemaV1(schema))) {
    throw new Error("Procedure input contracts must implement Standard Schema V1.");
  }

  const pageHandler = async (
    props: NextPageProps,
  ): Promise<
    | TResult
    | Awaited<ReturnType<TOnError>>
    | (TOnValidationError extends ProcedurePageOnValidationError
        ? Awaited<ReturnType<TOnValidationError>>
        : never)
  > => {
    const params = await props.params;
    const searchParams = normalizeSearchParams(await props.searchParams);

    try {
      const inputResult = await validateProcedureInputs(
        params,
        searchParams,
        procedure.definition,
        onValidationError,
      );
      if (!inputResult.ok) {
        return inputResult.result as TOnValidationError extends ProcedurePageOnValidationError
          ? Awaited<ReturnType<TOnValidationError>>
          : never;
      }
      const request = createPageRequest(
        procedure.definition.route?.pathname,
        inputResult.params as Params,
        searchParams,
      );

      const executionContext = {
        request,
        ...inputResult,
        json: undefined,
        formData: undefined,
        response: createResponseHelpers(),
        page: createPageHelpers(),
        ctx: {} as Record<string, unknown>,
      };

      const result = await executePipeline<
        typeof executionContext,
        ProcedureMiddlewareResult | InferProcedureHandlerResult<TProcedure>,
        Response | ProcedureResult
      >(
        [
          ...(procedure.middlewares as unknown as readonly ((
            context: typeof executionContext,
          ) => ProcedureMiddlewareResult | Promise<ProcedureMiddlewareResult>)[]),
          ...(handler
            ? [
                (context: typeof executionContext) =>
                  handler(
                    context as InferProcedureHandlerContext<TProcedure>,
                  ) as InferProcedureHandlerResult<TProcedure>,
              ]
            : []),
        ],
        executionContext,
        {
          isTerminal: (value): value is Response | ProcedureResult =>
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

      const { data } = assertPageTerminalResult(result);
      const renderedData =
        options?.validateOutput && outputSchema !== undefined
          ? await parseOutputWithSchema(outputSchema as StandardSchemaV1, data)
          : data;

      return render({
        ...(handler ? { data: renderedData as InferProcedureData<TProcedure> } : {}),
        params: inputResult.params,
        query: inputResult.query,
        ctx: executionContext.ctx,
      } as NextPageRenderContext<TProcedure, InferProcedureData<TProcedure>>);
    } catch (error) {
      unstable_rethrow(error);

      return onError(error, {
        params,
        searchParams,
      }) as Awaited<ReturnType<TOnError>>;
    }
  };

  return attachProcedureDefinition(pageHandler, procedure.definition) as NextPageHandler<
    TProcedure,
    | TResult
    | Awaited<ReturnType<TOnError>>
    | (TOnValidationError extends ProcedurePageOnValidationError
        ? Awaited<ReturnType<TOnValidationError>>
        : never)
  >;
};

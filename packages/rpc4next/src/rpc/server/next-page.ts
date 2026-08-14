import { cookies as getCookies, headers as getHeaders } from "next/headers";
import { NextRequest } from "next/server";

import { searchParamsToObject } from "../lib/search-params";
import type { ProcedureMiddleware, ProcedureMiddlewareResult, ProcedureResult } from "./procedure";
import { attachProcedureDefinition } from "./procedure-definition";
import { executePipeline, isProcedureResult } from "./procedure-internals";
import type {
  MergeProcedureDefinition,
  ProcedureDefinition,
  ProcedureInputContract,
  WithProcedureDefinition,
} from "./procedure-types";
import type { ProcedureInputTarget } from "./procedure-types";
import { createResponseHelpers } from "./route-context";
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

export type NextPageRenderContext<TData = unknown, TContext extends object = object> = {
  data: TData;
  ctx: TContext;
};

export type NextPageRender<TData = unknown, TContext extends object = object, TResult = unknown> = (
  context: NextPageRenderContext<TData, TContext>,
) => TResult | Promise<TResult>;

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

type ProcedureTypeCarrier = {
  definition: ProcedureDefinition;
  middlewares: readonly ProcedureMiddleware[];
  handler: (...args: never[]) => unknown;
  middlewareTerminalResult: unknown;
};

type InferProcedureDefinition<TProcedure extends ProcedureTypeCarrier> = TProcedure extends {
  definition: infer TDefinition extends ProcedureDefinition;
}
  ? TDefinition
  : ProcedureDefinition;

type InferProcedureHandler<TProcedure extends ProcedureTypeCarrier> = TProcedure extends {
  handler: infer THandler;
}
  ? THandler
  : never;

type InferProcedureHandlerContext<TProcedure extends ProcedureTypeCarrier> =
  InferProcedureHandler<TProcedure> extends (context: infer TContext) => unknown ? TContext : never;

type InferProcedureHandlerResult<TProcedure extends ProcedureTypeCarrier> = TProcedure extends {
  handler: (...args: never[]) => infer TResult;
}
  ? Awaited<TResult>
  : never;

type InferProcedureMiddlewareTerminalResult<TProcedure extends ProcedureTypeCarrier> =
  TProcedure extends {
    middlewareTerminalResult: infer TResult;
  }
    ? Awaited<TResult>
    : never;

type InferProcedureData<TProcedure extends ProcedureTypeCarrier> =
  InferProcedureHandlerResult<TProcedure> extends ProcedureResult<infer TBody> ? TBody : unknown;

type ProcedureIsRouteBound<TProcedure extends ProcedureTypeCarrier> =
  InferProcedureDefinition<TProcedure> extends {
    route: infer TRoute;
  }
    ? Exclude<TRoute, undefined> extends never
      ? false
      : true
    : false;

type ProcedureHasBodyContract<
  TProcedure extends ProcedureTypeCarrier,
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

type ProcedureHasPageIncompatibleTerminalResult<TProcedure extends ProcedureTypeCarrier> = [
  PageIncompatibleTerminalResult<
    InferProcedureHandlerResult<TProcedure> | InferProcedureMiddlewareTerminalResult<TProcedure>
  >,
] extends [never]
  ? false
  : true;

type NextPageProcedureConstraint<TProcedure extends ProcedureTypeCarrier> =
  ProcedureIsRouteBound<TProcedure> extends false
    ? {
        __error__: "nextPage() only accepts procedures that were bound with forRoute(routeContract).";
      }
    : ProcedureHasBodyContract<TProcedure, "json"> extends true
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
  TProcedure extends ProcedureTypeCarrier = ProcedureTypeCarrier,
  TResult = unknown,
> = WithProcedureDefinition<
  (props: NextPageProps) => Promise<TResult>,
  MergeProcedureDefinition<InferProcedureDefinition<TProcedure>, { method: never }>
>;

export type NextPageOptions<TOnError extends ProcedurePageOnError = ProcedurePageOnError> = {
  onError?: TOnError;
  validateOutput?: boolean;
};

export type NextPageProcedureOptions<
  TProcedure extends ProcedureTypeCarrier,
  TOnError extends ProcedurePageOnError = ProcedurePageOnError,
> = NextPageOptions<TOnError> & NextPageProcedureConstraint<TProcedure>;

type NextPageArgs<
  TProcedure extends ProcedureTypeCarrier,
  TResult,
  TOnError extends ProcedurePageOnError,
> =
  NextPageProcedureConstraint<TProcedure> extends infer TConstraint
    ? TConstraint extends { __error__: string }
      ? [render: TConstraint, options?: never]
      : [
          render: NextPageRender<InferProcedureData<TProcedure>, object, TResult>,
          options?: NextPageProcedureOptions<TProcedure, TOnError>,
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

const readHeaders = async () => Object.fromEntries((await getHeaders()).entries());

const readCookies = async () => {
  const cookieStore = await getCookies();

  return Object.fromEntries(cookieStore.getAll().map((cookie) => [cookie.name, cookie.value]));
};

const parseContract = async <TTarget extends ProcedureInputTarget>(
  target: TTarget,
  schema: StandardSchemaV1 | undefined,
  rawValue: unknown,
) => {
  if (!schema) {
    return {
      ok: true as const,
      value: rawValue,
    };
  }

  if (!isStandardSchemaV1(schema)) {
    throw new Error("Procedure input contracts must implement Standard Schema V1.");
  }

  const result = await schema["~standard"].validate(rawValue);

  if (!result.issues) {
    return {
      ok: true as const,
      value: result.value,
    };
  }

  throw new Error(getStandardSchemaMessage(result.issues));
};

const validateProcedureInputs = async (
  props: NextPageProps,
  procedureDefinition: ProcedureDefinition,
) => {
  const contracts = procedureDefinition.input?.contracts ?? {};

  if (contracts.json || contracts.formData) {
    throw new Error("Page procedures do not support json or formData input contracts.");
  }

  const params = await props.params;
  const query = normalizeSearchParams(await props.searchParams);
  const headers = contracts.headers ? await readHeaders() : undefined;
  const cookies = contracts.cookies ? await readCookies() : undefined;

  const paramsResult = await parseContract("params", contracts.params, params);
  const queryResult = await parseContract("query", contracts.query, query);
  const headersResult = await parseContract("headers", contracts.headers, headers);
  const cookiesResult = await parseContract("cookies", contracts.cookies, cookies);

  return {
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
  TProcedure extends ProcedureTypeCarrier,
  TResult = unknown,
  TOnError extends ProcedurePageOnError = DefaultProcedurePageOnError,
>(
  procedure: TProcedure,
  ...[render, options]: NextPageArgs<TProcedure, TResult, TOnError>
): NextPageHandler<TProcedure, TResult | Awaited<ReturnType<TOnError>>> => {
  const handler = procedure.handler as (
    context: InferProcedureHandlerContext<TProcedure>,
  ) => InferProcedureHandlerResult<TProcedure> | Promise<InferProcedureHandlerResult<TProcedure>>;
  const onError = options?.onError ?? defaultProcedurePageOnError;
  const outputSchema = procedure.definition.output?.schema;

  if (options?.validateOutput && outputSchema !== undefined && !isStandardSchemaV1(outputSchema)) {
    throw new Error(
      "Procedure output contracts must implement Standard Schema V1 when validateOutput is enabled.",
    );
  }

  const pageHandler = async (
    props: NextPageProps,
  ): Promise<TResult | Awaited<ReturnType<TOnError>>> => {
    const params = await props.params;
    const searchParams = normalizeSearchParams(await props.searchParams);

    try {
      const inputResult = await validateProcedureInputs(
        {
          ...props,
          params: Promise.resolve(params),
          searchParams: Promise.resolve(searchParams),
        },
        procedure.definition,
      );
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
          (context) =>
            handler(
              context as InferProcedureHandlerContext<TProcedure>,
            ) as InferProcedureHandlerResult<TProcedure>,
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
        data: renderedData as InferProcedureData<TProcedure>,
        ctx: executionContext.ctx,
      });
    } catch (error) {
      return onError(error, {
        params,
        searchParams,
      }) as Awaited<ReturnType<TOnError>>;
    }
  };

  return attachProcedureDefinition(pageHandler, procedure.definition) as NextPageHandler<
    TProcedure,
    TResult | Awaited<ReturnType<TOnError>>
  >;
};

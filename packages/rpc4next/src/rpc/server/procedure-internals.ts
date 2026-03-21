import type { NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import type { RpcErrorCode } from "./error";
import { defaultRpcErrorFormatter } from "./error-formatter";
import type { RpcMeta } from "./meta";
import type { ProcedureResult } from "./procedure";
import type {
  AppendProcedureErrorDefinition,
  MergeProcedureDefinition,
  ProcedureDefinition,
  ProcedureErrorContract,
  ProcedureInputContract,
  ProcedureInputTarget,
  ProcedureOutputContract,
  ProcedureRouteBinding,
  ProcedureRouteContract,
} from "./procedure-types";
import type { createRouteContext } from "./route-context";
import type { ValidationSchema } from "./route-types";
import type { StandardSchemaV1 } from "./standard-schema";

type RouteContextResponseHelpers = Pick<
  ReturnType<typeof createRouteContext>,
  "body" | "json" | "redirect" | "text"
>;

export const withProcedureMethod = <
  TDefinition extends ProcedureDefinition,
  TMethod extends HttpMethod,
>(
  definition: TDefinition,
  method: TMethod,
): MergeProcedureDefinition<TDefinition, { method: TMethod }> => {
  return {
    ...definition,
    method,
  } as MergeProcedureDefinition<TDefinition, { method: TMethod }>;
};

export const withProcedureMeta = <
  TDefinition extends ProcedureDefinition,
  TMeta extends RpcMeta,
>(
  definition: TDefinition,
  meta: TMeta,
): MergeProcedureDefinition<TDefinition, { meta: TMeta }> => {
  return {
    ...definition,
    meta,
  } as MergeProcedureDefinition<TDefinition, { meta: TMeta }>;
};

export const withProcedureRouteBinding = <
  TDefinition extends ProcedureDefinition,
  TRouteContract extends ProcedureRouteContract,
>(
  definition: TDefinition,
  routeContract: TRouteContract,
): MergeProcedureDefinition<
  TDefinition,
  {
    route: ProcedureRouteBinding<
      TRouteContract["pathname"],
      TRouteContract["params"]
    >;
  }
> => {
  return {
    ...definition,
    route: {
      pathname: routeContract.pathname,
      params: routeContract.params,
    },
  } as MergeProcedureDefinition<
    TDefinition,
    {
      route: ProcedureRouteBinding<
        TRouteContract["pathname"],
        TRouteContract["params"]
      >;
    }
  >;
};

export const withProcedureOutput = <
  TDefinition extends ProcedureDefinition,
  TOutput,
  TSchema,
>(
  definition: TDefinition,
  schema: TSchema,
): MergeProcedureDefinition<
  TDefinition,
  {
    output: ProcedureOutputContract<TOutput>;
  }
> => {
  return {
    ...definition,
    output: {
      schema,
    },
  } as MergeProcedureDefinition<
    TDefinition,
    {
      output: ProcedureOutputContract<TOutput>;
    }
  >;
};

export const withProcedureError = <
  TDefinition extends ProcedureDefinition,
  TCode extends RpcErrorCode,
  TDetails = unknown,
>(
  definition: TDefinition,
  code: TCode,
): AppendProcedureErrorDefinition<
  TDefinition,
  ProcedureErrorContract<TCode, TDetails>
> => {
  const existingError = definition.error as ProcedureErrorContract | undefined;
  const variants =
    existingError?.variants ??
    (existingError?.code
      ? [
          {
            code: existingError.code,
          },
        ]
      : []);

  return {
    ...definition,
    error: {
      code,
      variants: [
        ...variants,
        {
          code,
        },
      ],
    },
  } as AppendProcedureErrorDefinition<
    TDefinition,
    ProcedureErrorContract<TCode, TDetails>
  >;
};

export const withProcedureInputContract = <
  TDefinition extends ProcedureDefinition,
  TValidationSchema extends ValidationSchema,
  TTarget extends ProcedureInputTarget,
  TSchema extends StandardSchemaV1,
>(
  definition: TDefinition,
  target: TTarget,
  schema: TSchema,
): MergeProcedureDefinition<
  TDefinition,
  {
    input: ProcedureInputContract<TValidationSchema> & {
      contracts: NonNullable<TDefinition["input"]>["contracts"] &
        Record<TTarget, TSchema>;
    };
  }
> => {
  return {
    ...definition,
    input: {
      contracts: {
        ...(definition.input?.contracts ?? {}),
        [target]: schema,
      },
      validationSchema: {
        ...(definition.input?.validationSchema ?? {
          input: {},
          output: {},
        }),
      } as TValidationSchema,
    },
  } as unknown as MergeProcedureDefinition<
    TDefinition,
    {
      input: ProcedureInputContract<TValidationSchema> & {
        contracts: NonNullable<TDefinition["input"]>["contracts"] &
          Record<TTarget, TSchema>;
      };
    }
  >;
};

export const isProcedureResult = (value: unknown): value is ProcedureResult => {
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

export const normalizeProcedureResult = (
  routeContext: RouteContextResponseHelpers,
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

export const normalizeRpcErrorResponse = (
  error: unknown,
  routeContext: Pick<RouteContextResponseHelpers, "json">,
) => {
  return defaultRpcErrorFormatter(error, routeContext);
};

export const executePipeline = async <
  TContext,
  TResult,
  TTerminal extends TResult,
>(
  steps: readonly ((context: TContext) => TResult | Promise<TResult>)[],
  context: TContext,
  options: {
    isTerminal: (result: TResult) => result is TTerminal;
    applyResult?: (
      context: TContext,
      result: Exclude<TResult, TTerminal>,
    ) => void;
  },
): Promise<TTerminal | undefined> => {
  for (const step of steps) {
    const result = await step(context);

    if (options.isTerminal(result)) {
      return result;
    }

    options.applyResult?.(context, result as Exclude<TResult, TTerminal>);
  }

  return undefined;
};

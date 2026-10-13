import "server-only";
import type { DefaultRpcErrorCatalog, RpcErrorCatalog } from "./error";
import type {
  NextPageRender,
  NextPageProcedureCarrier,
  ProcedurePageOnError,
  ProcedurePageOnValidationError,
  ProcedurePageOnValidationErrorContext,
} from "./next-page";
import type { ProcedureOnError, ProcedureOnErrorContext, ProcedureOnErrorResult } from "./on-error";
import type { ProcedureHandler, ProcedureMiddleware } from "./procedure";
import type {
  ProcedureInputTarget,
  ProcedureValidationErrorContext,
  ProcedureValidationErrorHandler,
  ProcedureValidationErrorHandlerResult,
} from "./procedure-types";

export type { ContentType } from "../lib/content-type-types";
export type { HttpStatusCode } from "../lib/http-status-code-types";
export { defineRpcErrors } from "./error";
export type {
  DefaultRpcErrorCatalog,
  DefineRpcErrors,
  RpcErrorCatalog,
  RpcErrorCatalogEntry,
  RpcErrorCode,
  RpcErrorEnvelope,
  RpcErrorResponseInit,
  RpcErrorStatus,
  RpcErrorStatusCode,
} from "./error";
export type { InferRouteMeta, RpcMeta, RpcMetaBase } from "./meta";
export type { NextPageProps } from "./next-page";
export { output, withOutput } from "./output";
export { createPageProcedure, createRouteProcedure, procedure } from "./procedure";
export type { StandardSchemaV1, StandardSchemaV1Issue } from "./standard-schema";
export type { TypedNextResponse } from "./types";
export { createRpcValidationErrorHandler } from "./validation-error";
export type {
  RpcValidationErrorDetails,
  RpcValidationErrorIssue,
  RpcValidationErrorResponse,
} from "./validation-error";

export type InputTarget = ProcedureInputTarget;

export type RouteOnError<TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog> =
  ProcedureOnError<ProcedureOnErrorResult, TErrorCatalog>;

export type RouteOnErrorContext<TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog> =
  ProcedureOnErrorContext<TErrorCatalog>;

export type RouteValidationErrorHandler<
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TTarget extends InputTarget = InputTarget,
> = ProcedureValidationErrorHandler<
  TTarget,
  unknown,
  ProcedureValidationErrorHandlerResult,
  TErrorCatalog
>;

export type RouteValidationErrorContext<
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TTarget extends InputTarget = InputTarget,
> = ProcedureValidationErrorContext<TTarget, unknown, TErrorCatalog>;

export type RouteHandler = ProcedureHandler;

export type RouteMiddleware = ProcedureMiddleware;

export type PageOnError<TResult = unknown> = ProcedurePageOnError<TResult>;

export type PageValidationErrorHandler<TResult = unknown> = ProcedurePageOnValidationError<TResult>;

export type PageValidationErrorContext<TTarget extends InputTarget = InputTarget> =
  ProcedurePageOnValidationErrorContext<TTarget>;

export type PageRender<
  TProcedure extends NextPageProcedureCarrier = NextPageProcedureCarrier,
  TData = unknown,
  TContext extends object = object,
  TResult = unknown,
> = NextPageRender<TProcedure, TData, TContext, TResult>;

import type { NextResponse, NextRequest } from "next/server";

type KnownContentType =
  | "application/json"
  | "text/html"
  | "text/plain"
  | "application/javascript"
  | "text/css"
  | "image/png"
  | "image/jpeg"
  | "image/svg+xml"
  | "application/pdf"
  | "application/octet-stream"
  | "multipart/form-data"
  | "application/x-www-form-urlencoded";

export type ContentType = KnownContentType | (string & {});

/**
 * Informational responses (100–199)
 */
type InformationalHttpStatusCode = 100 | 101 | 102 | 103;

/**
 * Successful responses (200–299)
 */
type SuccessfulHttpStatusCode =
  | 200
  | 201
  | 202
  | 203
  | 204
  | 205
  | 206
  | 207
  | 208
  | 226;

/**
 * Redirection messages (300–399)
 */
type RedirectionHttpStatusCode =
  | 300
  | 301
  | 302
  | 303
  | 304
  | 305
  | 306
  | 307
  | 308;

/**
 * Client error responses (400–499)
 */
type ClientErrorHttpStatusCode =
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 421
  | 422
  | 423
  | 424
  | 425
  | 426
  | 428
  | 429
  | 431
  | 451;

/**
 * Server error responses (500–599)
 */
type ServerErrorHttpStatusCode =
  | 500
  | 501
  | 502
  | 503
  | 504
  | 505
  | 506
  | 507
  | 508
  | 510
  | 511;

/**
 * Http status code (100～599)
 */
export type HttpStatusCode =
  | InformationalHttpStatusCode
  | SuccessfulHttpStatusCode
  | RedirectionHttpStatusCode
  | ClientErrorHttpStatusCode
  | ServerErrorHttpStatusCode;

type HttpStatus<T extends HttpStatusCode> = T extends SuccessfulHttpStatusCode
  ? { ok: true; status: T }
  : {
      ok: false;
      status: Exclude<T, SuccessfulHttpStatusCode>;
    };

export interface TypedNextResponse<
  T = unknown,
  TStatus extends HttpStatusCode = HttpStatusCode,
  TContentType extends ContentType = ContentType,
> extends NextResponse {
  json: TContentType extends "application/json"
    ? () => Promise<T>
    : () => Promise<never>;
  text: TContentType extends "text/plain"
    ? T extends string
      ? () => Promise<T>
      : () => Promise<never>
    : () => Promise<string>;
  readonly ok: HttpStatus<TStatus>["ok"];
  readonly status: HttpStatus<TStatus>["status"];
}

export type Params = Record<string, string | string[]>;
export type Query = Record<string, string | string[]>;

export interface Context<TParams = Params, TQuery = Query> {
  req: NextRequest & {
    query: () => TQuery;
    params: () => Promise<TParams>;
  };
  res: NextResponse;

  body: <
    TData extends BodyInit | null,
    TStatus extends HttpStatusCode,
    TContentType extends ContentType,
  >(
    data: TData,
    init?: ResponseInit & { status?: TStatus; contentType?: TContentType }
  ) => TypedNextResponse<TData, TStatus, TContentType>;

  json: <TData, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: ResponseInit & { status?: TStatus }
  ) => TypedNextResponse<TData, TStatus, "application/json">;

  text: <TData extends string, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: ResponseInit & { status?: TStatus }
  ) => TypedNextResponse<TData, TStatus, "text/plain">;

  notFound: () => TypedNextResponse<null, 404, "text/html">;

  redirect: <TStatus extends HttpStatusCode = 302>(
    url: string,
    status?: TStatus
  ) => TypedNextResponse<null, TStatus, "text/html">;
}

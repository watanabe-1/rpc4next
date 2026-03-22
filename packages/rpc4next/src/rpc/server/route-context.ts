import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ContentType } from "../lib/content-type-types";
import { normalizeHeaders } from "../lib/headers";
import type {
  HttpStatusCode,
  RedirectionHttpStatusCode,
} from "../lib/http-status-code-types";
import { searchParamsToObject } from "../lib/search-params";
import type { ValidationSchema } from "./route-types";
import type {
  Params,
  Query,
  ResponseHelpers,
  RouteContext,
  TypedNextResponse,
  TypedResponseInit,
  ValidatedData,
  ValidationTarget,
} from "./types";

type ResponseHelperKind = "body" | "json" | "text" | "redirect";

type ResponseHelperMetadata = {
  kind: ResponseHelperKind;
  payload?: unknown;
};

export const responseHelperMetadataSymbol = Symbol.for(
  "rpc4next.response.helper.metadata",
);

const attachResponseHelperMetadata = <
  TResponse extends TypedNextResponse,
  TPayload = unknown,
>(
  response: TResponse,
  metadata: ResponseHelperMetadata & { payload?: TPayload },
) => {
  Object.defineProperty(response, responseHelperMetadataSymbol, {
    configurable: true,
    enumerable: false,
    value: metadata,
    writable: true,
  });

  return response;
};

export const getResponseHelperMetadata = (
  value: unknown,
): ResponseHelperMetadata | undefined => {
  if (!(value instanceof Response)) {
    return undefined;
  }

  return (
    value as Response & {
      [responseHelperMetadataSymbol]?: ResponseHelperMetadata;
    }
  )[responseHelperMetadataSymbol];
};

const isHttpStatusCode = (value: unknown): value is HttpStatusCode => {
  return typeof value === "number" && !Number.isNaN(value);
};

const resolvedHeaders = (
  init?: HttpStatusCode | TypedResponseInit<HttpStatusCode, ContentType>,
) => {
  if (!init) return init;

  if (isHttpStatusCode(init)) {
    return { status: init };
  }

  const headers = init.headers ?? normalizeHeaders(init.headersInit);

  const {
    headers: _headers,
    headersInit: _headersInit,
    ...initWithoutHeaders
  } = init;

  const resolvedInit = {
    ...initWithoutHeaders,
    headers,
  };

  return resolvedInit as TypedResponseInit<HttpStatusCode, ContentType>;
};

export const createResponseHelpers = <
  TJson = unknown,
>(): ResponseHelpers<TJson> => ({
  body: <
    TData extends BodyInit | null,
    TContentType extends ContentType,
    TStatus extends HttpStatusCode = 200,
  >(
    data: TData,
    init?: TStatus | TypedResponseInit<TStatus, TContentType>,
  ) =>
    attachResponseHelperMetadata(
      new NextResponse<TData>(data, resolvedHeaders(init)) as TypedNextResponse<
        TData,
        TStatus,
        TContentType
      >,
      {
        kind: "body",
        payload: data,
      },
    ),

  json: (<TData, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: TStatus | TypedResponseInit<TStatus, "application/json">,
  ) =>
    attachResponseHelperMetadata(
      NextResponse.json<TData>(
        data,
        resolvedHeaders(init),
      ) as TypedNextResponse<TData, TStatus, "application/json">,
      {
        kind: "json",
        payload: data,
      },
    )) as ResponseHelpers<TJson>["json"],

  text: <TData extends string, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: TStatus | TypedResponseInit<TStatus, "text/plain">,
  ) => {
    const resolvedInit = resolvedHeaders(init);

    return attachResponseHelperMetadata(
      new NextResponse<TData>(data, {
        ...resolvedInit,
        headers: { ...resolvedInit?.headers, "Content-Type": "text/plain" },
      }) as TypedNextResponse<TData, TStatus, "text/plain">,
      {
        kind: "text",
        payload: data,
      },
    );
  },

  redirect: <TStatus extends RedirectionHttpStatusCode = 307>(
    url: string,
    init?: TStatus | TypedResponseInit<TStatus, "">,
  ) => {
    const resolvedInit = isHttpStatusCode(init) ? init : resolvedHeaders(init);

    return attachResponseHelperMetadata(
      NextResponse.redirect(url, resolvedInit) as TypedNextResponse<
        undefined,
        TStatus,
        ""
      >,
      {
        kind: "redirect",
      },
    );
  },
});

export const createRouteContext = <
  TParams extends Params,
  TQuery extends Query,
  TValidationSchema extends ValidationSchema,
>(
  req: NextRequest,
  segmentData: { params: Promise<TParams> },
): RouteContext<TParams, TQuery, TValidationSchema> => {
  const validationResults = {} as Record<ValidationTarget, unknown>;
  const responseHelpers = createResponseHelpers();

  return {
    req: Object.assign(req, {
      query: () => searchParamsToObject<TQuery>(req.nextUrl.searchParams),
      params: () => segmentData.params,
      valid: (target: ValidationTarget) => {
        return validationResults[target] as never;
      },
      addValidatedData: (target: ValidationTarget, value: ValidatedData) => {
        validationResults[target] = value;
      },
    }),
    ...responseHelpers,
  };
};

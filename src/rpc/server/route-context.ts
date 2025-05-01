import { NextResponse } from "next/server";
import { searchParamsToObject } from "./server-utils";
import { normalizeHeaders } from "../lib/headers";
import type { ValidationSchema } from "./route-types";
import type {
  RouteContext,
  Query,
  Params,
  TypedNextResponse,
  TypedResponseInit,
  ValidationTarget,
  ValidatedData,
} from "./types";
import type { ContentType } from "../lib/content-type-types";
import type {
  HttpStatusCode,
  RedirectionHttpStatusCode,
} from "../lib/http-status-code-types";
import type { NextRequest } from "next/server";

const isHttpStatusCode = (value: unknown): value is HttpStatusCode => {
  return typeof value === "number" && !Number.isNaN(value);
};

const resolvedHeaders = (
  init?: TypedResponseInit<HttpStatusCode, ContentType>
) => {
  if (!init) return init;

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

export const createRouteContext = <
  TParams extends Params,
  TQuery extends Query,
  TValidationSchema extends ValidationSchema,
>(
  req: NextRequest,
  segmentData: { params: Promise<TParams> }
): RouteContext<TParams, TQuery, TValidationSchema> => {
  const validationResults = {} as Record<ValidationTarget, unknown>;

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

    body: <
      TData extends BodyInit | null,
      TContentType extends ContentType,
      TStatus extends HttpStatusCode = 200,
    >(
      data: TData,
      init?: TypedResponseInit<TStatus, TContentType>
    ) =>
      new NextResponse<TData>(data, resolvedHeaders(init)) as TypedNextResponse<
        TData,
        TStatus,
        TContentType
      >,

    json: <TData, TStatus extends HttpStatusCode = 200>(
      data: TData,
      init?: TypedResponseInit<TStatus, "application/json">
    ) =>
      NextResponse.json<TData>(
        data,
        resolvedHeaders(init)
      ) as TypedNextResponse<TData, TStatus, "application/json">,

    text: <TData extends string, TStatus extends HttpStatusCode = 200>(
      data: TData,
      init?: TypedResponseInit<TStatus, "text/plain">
    ) => {
      const resolvedInit = resolvedHeaders(init);

      return new NextResponse<TData>(data, {
        ...resolvedInit,
        headers: { ...resolvedInit?.headers, "Content-Type": "text/plain" },
      }) as TypedNextResponse<TData, TStatus, "text/plain">;
    },

    redirect: <TStatus extends RedirectionHttpStatusCode = 307>(
      url: string,
      init?: TStatus | TypedResponseInit<TStatus, "">
    ) => {
      const resolvedInit = isHttpStatusCode(init)
        ? init
        : resolvedHeaders(init);

      return NextResponse.redirect(url, resolvedInit) as TypedNextResponse<
        undefined,
        TStatus,
        ""
      >;
    },
  };
};

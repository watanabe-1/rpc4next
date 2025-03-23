import { NextResponse } from "next/server";
import { searchParamsToObject } from "./search-params-to-object";
import type {
  RouteContext,
  Query,
  ValidationSchema,
  Params,
  ValidationTarget,
  TypedNextResponse,
  HttpStatusCode,
  ContentType,
} from "./types";
import type { NextRequest } from "next/server";

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
      params: async () => await segmentData.params,
      valid: (target: ValidationTarget) => {
        return validationResults[target] as never;
      },
      addValidatedData: (target: ValidationTarget, value: object) => {
        validationResults[target] = value;
      },
    }),

    body: <
      TData extends BodyInit | null,
      TContentType extends ContentType,
      TStatus extends HttpStatusCode = 200,
    >(
      data: TData,
      init?: ResponseInit & { status?: TStatus; contentType?: TContentType }
    ) =>
      new NextResponse<TData>(data, init) as TypedNextResponse<
        TData,
        TStatus,
        TContentType
      >,

    json: <TData, TStatus extends HttpStatusCode = 200>(
      data: TData,
      init?: ResponseInit & { status?: TStatus }
    ) =>
      NextResponse.json<TData>(data, init) as TypedNextResponse<
        TData,
        TStatus,
        "application/json"
      >,

    text: <TData extends string, TStatus extends HttpStatusCode = 200>(
      data: TData,
      init?: ResponseInit & { status?: TStatus }
    ) =>
      new NextResponse<TData>(data, {
        ...init,
        headers: { "Content-Type": "text/plain", ...init?.headers },
      }) as TypedNextResponse<TData, TStatus, "text/plain">,

    redirect: <TStatus extends HttpStatusCode = 302>(
      url: string,
      init?: TStatus | (ResponseInit & { status?: TStatus })
    ) =>
      NextResponse.redirect(url, init) as TypedNextResponse<
        null,
        TStatus,
        "text/html"
      >,
  };
};

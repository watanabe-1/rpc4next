import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { searchParamsToObject } from "./searchParamsToObject";
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
    res: new NextResponse(),
    body: <
      TData extends BodyInit | null,
      TStatus extends HttpStatusCode,
      TContentType extends ContentType,
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
    notFound: () => notFound() as TypedNextResponse<null, 404, "text/html">,
    redirect: <TStatus extends HttpStatusCode = 302>(
      url: string,
      status?: TStatus
    ) =>
      NextResponse.redirect(url, status) as TypedNextResponse<
        null,
        TStatus,
        "text/html"
      >,
  };
};

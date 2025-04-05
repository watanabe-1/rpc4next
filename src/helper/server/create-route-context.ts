import { NextResponse } from "next/server";
import { searchParamsToObject } from "./search-params-to-object";
import type { ValidationSchema } from "./route-types";
import type {
  RouteContext,
  Query,
  Params,
  TypedNextResponse,
  HttpStatusCode,
  ContentType,
  RedirectionHttpStatusCode,
  TypedResponseInit,
  ValidationTarget,
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
      params: () => segmentData.params,
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
      init?: TypedResponseInit<TStatus, TContentType>
    ) =>
      new NextResponse<TData>(data, init) as TypedNextResponse<
        TData,
        TStatus,
        TContentType
      >,

    json: <TData, TStatus extends HttpStatusCode = 200>(
      data: TData,
      init?: TypedResponseInit<TStatus, "application/json">
    ) =>
      NextResponse.json<TData>(data, init) as TypedNextResponse<
        TData,
        TStatus,
        "application/json"
      >,

    text: <TData extends string, TStatus extends HttpStatusCode = 200>(
      data: TData,
      init?: TypedResponseInit<TStatus, "text/plain">
    ) =>
      new NextResponse<TData>(data, {
        ...init,
        headers: { "Content-Type": "text/plain", ...init?.headers },
      }) as TypedNextResponse<TData, TStatus, "text/plain">,

    redirect: <TStatus extends RedirectionHttpStatusCode = 302>(
      url: string,
      init?: TStatus | TypedResponseInit<TStatus, "">
    ) =>
      NextResponse.redirect(url, init) as TypedNextResponse<
        undefined,
        TStatus,
        ""
      >,
  };
};

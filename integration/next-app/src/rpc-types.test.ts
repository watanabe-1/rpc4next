import {
  createRpcClient,
  parseResponse,
  RpcResponseError,
  type SuccessfulResponsePayload,
} from "rpc4next/client";
import type { ContentType, HttpStatusCode, TypedNextResponse } from "rpc4next/server";
import { describe, expectTypeOf, it } from "vitest";

import type { PathStructure } from "./generated/rpc";

const baseUrl = "http://127.0.0.1:3000";

const client = createRpcClient<PathStructure>(baseUrl, {
  fetch: async () =>
    new Response(null, {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
});

type SearchPageQuery = {
  q?: string | string[] | undefined;
};
type NativePageQuery = {
  term?: string | string[] | undefined;
  page?: string | undefined;
};
type NativeRouteQuery = {
  filter?: string | undefined;
};
type ExpectTrue<T extends true> = T;
type ResponseJson<TResponse> = TResponse extends { json: () => Promise<infer TJson> }
  ? TJson
  : never;
type ResponseStatus<TResponse> = TResponse extends { readonly status: infer TStatus }
  ? TStatus
  : never;
type HasJsonVariant<TResponse, TJson> = [Extract<ResponseJson<TResponse>, TJson>] extends [never]
  ? false
  : true;
type HasStatus<TResponse, TStatus extends HttpStatusCode> =
  TStatus extends ResponseStatus<TResponse> ? true : false;
type HasVariant<TUnion, TVariant> = [Extract<TUnion, TVariant>] extends [never] ? false : true;
type HasResponseVariant<
  TResponse,
  TJson,
  TStatus extends HttpStatusCode,
  TContentType extends ContentType = "application/json",
> = HasVariant<TResponse, TypedNextResponse<TJson, TStatus, TContentType>>;
type IncludePostsQuery = {
  includePosts?: "true" | "false" | undefined;
};
type IncludeDraftsQuery = {
  includeDrafts?: "true" | "false" | undefined;
};
type SharedProcedureOnErrorResponse = TypedNextResponse<
  {
    error: {
      code: "INTERNAL_SERVER_ERROR";
      message: string;
      details?: unknown;
    };
  },
  500,
  "application/json"
>;
type SharedProcedureValidationErrorResponse = TypedNextResponse<unknown, 400, "application/json">;

describe("integration next-app generated RPC type coverage", () => {
  it("infers the generated client signatures for query, body, and headers", () => {
    type NativeDynamicBuilder = (typeof client.api)["next-native"]["_itemId"];
    type NativeDynamicUrl = ReturnType<NativeDynamicBuilder>["$url"];
    type ExpectedNativeDynamicUrl = (url?: { query?: NativeRouteQuery; hash?: string }) => {
      pathname: string;
      path: string;
      relativePath: string;
      params: {
        itemId: string;
      };
    };
    expectTypeOf<NativeDynamicUrl>().toEqualTypeOf<ExpectedNativeDynamicUrl>();

    type UsersUrl = ReturnType<typeof client.api.users._userId>["$url"];
    type ExpectedUsersUrl = (url?: { query?: IncludePostsQuery; hash?: string }) => {
      pathname: string;
      path: string;
      relativePath: string;
      params: {
        userId: string;
      };
    };

    expectTypeOf<UsersUrl>().toEqualTypeOf<ExpectedUsersUrl>();

    type ProcedureContractNode = (typeof client.api)["procedure-contract"];
    type ProcedureContractUrl = ReturnType<ProcedureContractNode["_userId"]>["$url"];
    type ExpectedProcedureContractUrl = (url?: { query?: IncludePostsQuery; hash?: string }) => {
      pathname: string;
      path: string;
      relativePath: string;
      params: {
        userId: string;
      };
    };
    expectTypeOf<ProcedureContractUrl>().toEqualTypeOf<ExpectedProcedureContractUrl>();

    type ProcedureGuardedNode = (typeof client.api)["procedure-guarded"];
    type ProcedureGuardedUrl = ReturnType<ProcedureGuardedNode["_userId"]>["$url"];
    type ExpectedProcedureGuardedUrl = (url?: { query?: IncludeDraftsQuery; hash?: string }) => {
      pathname: string;
      path: string;
      relativePath: string;
      params: {
        userId: string;
      };
    };
    expectTypeOf<ProcedureGuardedUrl>().toEqualTypeOf<ExpectedProcedureGuardedUrl>();

    type SearchPageUrl = (typeof client.patterns.search)["$url"];
    type ExpectedSearchPageUrl = (url?: { query?: SearchPageQuery; hash?: string }) => {
      pathname: string;
      path: string;
      relativePath: string;
      params: Record<string, string>;
    };
    expectTypeOf<SearchPageUrl>().toEqualTypeOf<ExpectedSearchPageUrl>();

    type NativeQueryPageUrl = (typeof client.patterns)["native-query"]["$url"];
    type ExpectedNativeQueryPageUrl = (url?: { query?: NativePageQuery; hash?: string }) => {
      pathname: string;
      path: string;
      relativePath: string;
      params: Record<string, string>;
    };
    expectTypeOf<NativeQueryPageUrl>().toEqualTypeOf<ExpectedNativeQueryPageUrl>();

    type PostsArg = Parameters<typeof client.api.posts.$post>[0];
    type ExpectedPostsArg = {
      url?: {
        hash?: string;
      };
      body: {
        json: {
          title: string;
        };
      };
    };
    const _postsArgFromActual: ExpectedPostsArg = {} as PostsArg;
    const _postsArgFromExpected: PostsArg = {} as ExpectedPostsArg;

    type RequestMetaGet = (typeof client.api)["request-meta"]["$get"];
    type RequestMetaArg = Parameters<RequestMetaGet>[0];
    type ExpectedRequestMetaArg = {
      url?: {
        hash?: string;
      };
      requestHeaders: {
        headers: {
          "x-integration-test": string;
        };
        cookies: {
          session: string;
        };
      };
    };
    const _requestMetaArgFromActual: ExpectedRequestMetaArg = {} as RequestMetaArg;
    const _requestMetaArgFromExpected: RequestMetaArg = {} as ExpectedRequestMetaArg;

    type ProcedureSubmitPost = (typeof client.api)["procedure-submit"]["$post"];
    type ProcedureSubmitArg = Parameters<ProcedureSubmitPost>[0];
    type ExpectedProcedureSubmitArg = {
      url?: {
        hash?: string;
      };
      body: {
        json: {
          title: string;
        };
      };
      requestHeaders: {
        headers: {
          "x-procedure-test": string;
        };
        cookies: {
          session: string;
        };
      };
    };
    const _procedureSubmitArgFromActual: ExpectedProcedureSubmitArg = {} as ProcedureSubmitArg;
    const _procedureSubmitArgFromExpected: ProcedureSubmitArg = {} as ExpectedProcedureSubmitArg;

    type ProcedureFormDataPost = (typeof client.api)["procedure-form-data"]["$post"];
    type ProcedureFormDataArg = Parameters<ProcedureFormDataPost>[0];
    type ExpectedProcedureFormDataArg = {
      url?: {
        hash?: string;
      };
      body: {
        formData: FormData;
      };
    };
    const _procedureFormDataArgFromActual: ExpectedProcedureFormDataArg =
      {} as ProcedureFormDataArg;
    const _procedureFormDataArgFromExpected: ProcedureFormDataArg =
      {} as ExpectedProcedureFormDataArg;

    void _postsArgFromActual;
    void _postsArgFromExpected;
    void _requestMetaArgFromActual;
    void _requestMetaArgFromExpected;
    void _procedureSubmitArgFromActual;
    void _procedureSubmitArgFromExpected;
    void _procedureFormDataArgFromActual;
    void _procedureFormDataArgFromExpected;
  });

  it("infers the generated response types for integration routes", async () => {
    const _nativeNextResponse = await client.api["next-native"].$get();
    type ExpectedNativeNextResponse =
      | TypedNextResponse<unknown, HttpStatusCode, ContentType>
      | TypedNextResponse<
          {
            ok: boolean;
            mode: string;
          },
          HttpStatusCode,
          ContentType
        >
      | TypedNextResponse<
          {
            error: {
              code: string;
              message: string;
              details?: unknown;
            };
          },
          400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
          "application/json"
        >;
    expectTypeOf<typeof _nativeNextResponse>().toExtend<ExpectedNativeNextResponse>();

    const _explicitOutputResponse = await client.api["explicit-output"].$get();
    type ExpectedExplicitOutputResponse =
      | TypedNextResponse<
          {
            ok: true;
            source: "explicit-output";
          },
          HttpStatusCode,
          ContentType
        >
      | TypedNextResponse<
          {
            error: {
              code: string;
              message: string;
              details?: unknown;
            };
          },
          400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
          "application/json"
        >;
    expectTypeOf<typeof _explicitOutputResponse>().toExtend<ExpectedExplicitOutputResponse>();

    const _contractRouteResponse = await client.api["contract-route"].$get();
    type ExpectedContractRouteResponse =
      | TypedNextResponse<
          {
            ok: true;
            source: "contract-route";
          },
          200,
          "application/json"
        >
      | SharedProcedureValidationErrorResponse
      | SharedProcedureOnErrorResponse;
    expectTypeOf<typeof _contractRouteResponse>().toExtend<ExpectedContractRouteResponse>();
    type _contractRouteKeepsSuccess = ExpectTrue<
      HasResponseVariant<
        typeof _contractRouteResponse,
        {
          ok: true;
          source: "contract-route";
        },
        200
      >
    >;
    type _contractRouteKeepsValidationError = ExpectTrue<
      HasVariant<typeof _contractRouteResponse, SharedProcedureValidationErrorResponse>
    >;
    type _contractRouteKeepsDefaultError = ExpectTrue<
      HasVariant<typeof _contractRouteResponse, SharedProcedureOnErrorResponse>
    >;

    const _procedureContractResponse = await client.api["procedure-contract"]
      ._userId("procedure-user")
      .$get({
        url: { query: { includePosts: "true" } },
      });
    type ExpectedProcedureContractResponse =
      | TypedNextResponse<
          {
            ok: true;
            userId: string;
            includePosts: boolean;
            source: "procedure-contract";
            requestId: string;
          },
          200,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "BAD_REQUEST";
              message: string;
              details?: unknown;
            };
          },
          400,
          "application/json"
        >
      | SharedProcedureOnErrorResponse;
    expectTypeOf<typeof _procedureContractResponse>().toExtend<ExpectedProcedureContractResponse>();
    type ProcedureContractPayload = SuccessfulResponsePayload<typeof _procedureContractResponse>;
    expectTypeOf<ProcedureContractPayload>().toEqualTypeOf<{
      ok: true;
      userId: string;
      includePosts: boolean;
      source: "procedure-contract";
      requestId: string;
    }>();
    const _procedureContractPayload = await parseResponse(_procedureContractResponse);
    expectTypeOf<typeof _procedureContractPayload>().toEqualTypeOf<ProcedureContractPayload>();
    type _procedureContractKeepsSuccess = ExpectTrue<
      HasResponseVariant<
        typeof _procedureContractResponse,
        {
          ok: true;
          userId: string;
          includePosts: boolean;
          source: "procedure-contract";
          requestId: string;
        },
        200
      >
    >;
    type _procedureContractKeepsValidationError = ExpectTrue<
      HasVariant<typeof _procedureContractResponse, SharedProcedureValidationErrorResponse>
    >;
    type _procedureContractKeepsDefaultError = ExpectTrue<
      HasVariant<typeof _procedureContractResponse, SharedProcedureOnErrorResponse>
    >;

    const _nativeDynamicResponse = await client.api["next-native"]._itemId("native-item").$get();
    type ExpectedNativeDynamicResponse =
      | TypedNextResponse<unknown, HttpStatusCode, ContentType>
      | TypedNextResponse<
          {
            ok: boolean;
            itemId: string;
            filter: string;
          },
          HttpStatusCode,
          ContentType
        >
      | TypedNextResponse<
          {
            error: {
              code: string;
              message: string;
              details?: unknown;
            };
          },
          400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
          "application/json"
        >;
    expectTypeOf<typeof _nativeDynamicResponse>().toExtend<ExpectedNativeDynamicResponse>();

    const nativeResponseJson = await client.api["next-native-response"].$get();
    const _nativeResponseJson: TypedNextResponse<unknown, HttpStatusCode, ContentType> =
      nativeResponseJson;

    const usersResponse = await client.api.users._userId("demo-user").$get({
      url: { query: { includePosts: "true" } },
    });
    type UsersResponse = typeof usersResponse;
    type UsersSuccessResponse = Extract<UsersResponse, { ok: true }>;
    expectTypeOf<typeof usersResponse>().toExtend<
      | TypedNextResponse<
          {
            ok: boolean;
            userId: string;
            includePosts: boolean;
          },
          200,
          "application/json"
        >
      | TypedNextResponse<unknown, 400, "application/json">
      | SharedProcedureOnErrorResponse
    >();
    type _usersResponseKeepsValidationError = ExpectTrue<
      HasVariant<typeof usersResponse, SharedProcedureValidationErrorResponse>
    >;
    type _usersResponseKeepsDefaultError = ExpectTrue<
      HasVariant<typeof usersResponse, SharedProcedureOnErrorResponse>
    >;

    if (usersResponse.ok) {
      const _usersOkResponse: UsersSuccessResponse = usersResponse;
    }

    const postsResponse = await client.api.posts.$post({
      body: { json: { title: "integration type test" } },
    });
    type PostsResponse = typeof postsResponse;
    type PostsSuccessResponse = Extract<PostsResponse, { ok: true }>;
    expectTypeOf<typeof postsResponse>().toExtend<
      | TypedNextResponse<
          {
            ok: boolean;
            title: string;
          },
          201,
          "application/json"
        >
      | TypedNextResponse<unknown, 400, "application/json">
      | SharedProcedureOnErrorResponse
    >();
    type _postsResponseKeepsValidationError = ExpectTrue<
      HasVariant<typeof postsResponse, SharedProcedureValidationErrorResponse>
    >;
    type _postsResponseKeepsDefaultError = ExpectTrue<
      HasVariant<typeof postsResponse, SharedProcedureOnErrorResponse>
    >;

    if (postsResponse.ok) {
      const _postsOkResponse: PostsSuccessResponse = postsResponse;
    }

    const requestMetaResponse = await client.api["request-meta"].$get({
      requestHeaders: {
        headers: { "x-integration-test": "header-ok" },
        cookies: { session: "cookie-ok" },
      },
    });
    type RequestMetaResponse = typeof requestMetaResponse;
    type RequestMetaSuccessResponse = Extract<RequestMetaResponse, { ok: true }>;
    expectTypeOf<typeof requestMetaResponse>().toExtend<
      | TypedNextResponse<
          {
            header: string;
            session: string;
          },
          200,
          "application/json"
        >
      | TypedNextResponse<unknown, 400, "application/json">
      | SharedProcedureOnErrorResponse
    >();
    type _requestMetaResponseKeepsValidationError = ExpectTrue<
      HasVariant<typeof requestMetaResponse, SharedProcedureValidationErrorResponse>
    >;
    type _requestMetaResponseKeepsDefaultError = ExpectTrue<
      HasVariant<typeof requestMetaResponse, SharedProcedureOnErrorResponse>
    >;

    if (requestMetaResponse.ok) {
      const _requestMetaOkResponse: RequestMetaSuccessResponse = requestMetaResponse;
    }

    const procedureSubmitResponse = await client.api["procedure-submit"].$post({
      body: { json: { title: "procedure-submit" } },
      requestHeaders: {
        headers: { "x-procedure-test": "header-ok" },
        cookies: { session: "cookie-ok" },
      },
    });
    type ExpectedProcedureSubmitResponse =
      | TypedNextResponse<
          {
            ok: true;
            title: string;
            header: string;
            session: string;
            source: "procedure-submit";
          },
          201,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "BAD_REQUEST";
              message: string;
              details?: unknown;
            };
          },
          400,
          "application/json"
        >
      | SharedProcedureOnErrorResponse;
    expectTypeOf<typeof procedureSubmitResponse>().toExtend<ExpectedProcedureSubmitResponse>();
    type _procedureSubmitKeepsSuccess = ExpectTrue<
      HasResponseVariant<
        typeof procedureSubmitResponse,
        {
          ok: true;
          title: string;
          header: string;
          session: string;
          source: "procedure-submit";
        },
        201
      >
    >;
    type _procedureSubmitKeepsValidationError = ExpectTrue<
      HasVariant<typeof procedureSubmitResponse, SharedProcedureValidationErrorResponse>
    >;
    type _procedureSubmitKeepsDefaultError = ExpectTrue<
      HasVariant<typeof procedureSubmitResponse, SharedProcedureOnErrorResponse>
    >;

    const procedureGuardedResponse = await client.api["procedure-guarded"]
      ._userId("procedure-user")
      .$get({
        url: { query: { includeDrafts: "true" } },
        requestHeaders: {
          headers: {
            "x-demo-user": "procedure-user",
            "x-demo-role": "editor",
          },
        },
      });
    type ExpectedProcedureGuardedResponse =
      | TypedNextResponse<
          {
            ok: true;
            userId: string;
            includeDrafts: boolean;
            role: "reader" | "editor";
            organizationId: string;
            plan: "pro" | "enterprise";
            source: "procedure-guarded";
            requestId: string;
            traceId: string;
          },
          200,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "BAD_REQUEST";
              message: string;
              details?: unknown;
            };
          },
          400,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "INTERNAL_SERVER_ERROR";
              message: string;
              details?: unknown;
            };
          },
          500,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "UNAUTHORIZED";
              message: string;
              details?: { reason: "missing_demo_user" };
            };
          },
          401,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "FORBIDDEN";
              message: string;
              details?: { reason: "suspended_account" };
            };
          },
          403,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "FORBIDDEN";
              message: string;
              details?: { reason: "editor_only" };
            };
          },
          403,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "FORBIDDEN";
              message: string;
              details?: { reason: "plan_upgrade_required" };
            };
          },
          403,
          "application/json"
        >;
    expectTypeOf<typeof procedureGuardedResponse>().toExtend<ExpectedProcedureGuardedResponse>();
    type _procedureGuardedKeepsSuccess = ExpectTrue<
      HasResponseVariant<
        typeof procedureGuardedResponse,
        {
          ok: true;
          userId: string;
          includeDrafts: boolean;
          role: "reader" | "editor";
          organizationId: string;
          plan: "pro" | "enterprise";
          source: "procedure-guarded";
          requestId: string;
          traceId: string;
        },
        200
      >
    >;
    type _procedureGuardedKeepsValidationError = ExpectTrue<
      HasStatus<typeof procedureGuardedResponse, 400>
    >;
    type _procedureGuardedKeepsUnauthorized = ExpectTrue<
      HasResponseVariant<
        typeof procedureGuardedResponse,
        {
          error: {
            code: "UNAUTHORIZED";
            message: string;
            details?: { reason: "missing_demo_user" };
          };
        },
        401
      >
    >;
    type _procedureGuardedKeepsSuspendedForbidden = ExpectTrue<
      HasResponseVariant<
        typeof procedureGuardedResponse,
        {
          error: {
            code: "FORBIDDEN";
            message: string;
            details?: { reason: "suspended_account" };
          };
        },
        403
      >
    >;
    type _procedureGuardedKeepsEditorForbidden = ExpectTrue<
      HasResponseVariant<
        typeof procedureGuardedResponse,
        {
          error: {
            code: "FORBIDDEN";
            message: string;
            details?: { reason: "editor_only" };
          };
        },
        403
      >
    >;
    type _procedureGuardedKeepsPlanForbidden = ExpectTrue<
      HasResponseVariant<
        typeof procedureGuardedResponse,
        {
          error: {
            code: "FORBIDDEN";
            message: string;
            details?: { reason: "plan_upgrade_required" };
          };
        },
        403
      >
    >;

    const procedureInvalidOutputResponse = await client.api["procedure-invalid-output"].$get();
    type ExpectedProcedureInvalidOutputResponse =
      | TypedNextResponse<
          {
            ok: true;
            source: "procedure-invalid-output";
            result: string;
          },
          200,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "INTERNAL_SERVER_ERROR";
              message: string;
              details?: unknown;
            };
          },
          500,
          "application/json"
        >
      | SharedProcedureValidationErrorResponse;
    expectTypeOf<
      typeof procedureInvalidOutputResponse
    >().toExtend<ExpectedProcedureInvalidOutputResponse>();
    type _procedureInvalidOutputKeepsSuccess = ExpectTrue<
      HasResponseVariant<
        typeof procedureInvalidOutputResponse,
        {
          ok: true;
          source: "procedure-invalid-output";
          result: string;
        },
        200
      >
    >;
    type _procedureInvalidOutputKeepsValidationError = ExpectTrue<
      HasVariant<typeof procedureInvalidOutputResponse, SharedProcedureValidationErrorResponse>
    >;
    type _procedureInvalidOutputKeepsOutputValidationError = ExpectTrue<
      HasVariant<typeof procedureInvalidOutputResponse, SharedProcedureOnErrorResponse>
    >;

    const procedureFormDataResponse = await client.api["procedure-form-data"].$post({
      body: { formData: new FormData() },
    });
    type ExpectedProcedureFormDataResponse =
      | TypedNextResponse<
          {
            ok: true;
            displayName: string;
            filename: string;
            tags: string[];
            source: "procedure-form-data";
          },
          200,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "BAD_REQUEST";
              message: string;
              details?: unknown;
            };
          },
          400,
          "application/json"
        >
      | SharedProcedureOnErrorResponse;
    expectTypeOf<typeof procedureFormDataResponse>().toExtend<ExpectedProcedureFormDataResponse>();
    type _procedureFormDataKeepsSuccess = ExpectTrue<
      HasResponseVariant<
        typeof procedureFormDataResponse,
        {
          ok: true;
          displayName: string;
          filename: string;
          tags: string[];
          source: "procedure-form-data";
        },
        200
      >
    >;
    type _procedureFormDataKeepsValidationError = ExpectTrue<
      HasVariant<typeof procedureFormDataResponse, SharedProcedureValidationErrorResponse>
    >;
    type _procedureFormDataKeepsDefaultError = ExpectTrue<
      HasVariant<typeof procedureFormDataResponse, SharedProcedureOnErrorResponse>
    >;

    const procedureValidationBranchResponse = await client.api["procedure-validation-branch"].$get({
      url: { query: { page: "1" } },
    });
    type ExpectedProcedureValidationBranchResponse =
      | TypedNextResponse<
          {
            ok: true;
            source: "procedure-validation-branch";
            page: number;
          },
          200,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "BAD_REQUEST";
              message: string;
              details?: unknown;
            };
          },
          400,
          "application/json"
        >
      | TypedNextResponse<
          {
            ok: false;
            source: "procedure-validation-branch";
            target: "query";
            issueCount: number;
            receivedPage?: string;
          },
          HttpStatusCode,
          ContentType
        >
      | SharedProcedureOnErrorResponse;
    expectTypeOf<
      typeof procedureValidationBranchResponse
    >().toExtend<ExpectedProcedureValidationBranchResponse>();
    type _procedureValidationBranchKeepsSuccess = ExpectTrue<
      HasStatus<typeof procedureValidationBranchResponse, 200>
    >;
    type _procedureValidationBranchKeepsValidationError = ExpectTrue<
      HasStatus<typeof procedureValidationBranchResponse, 400>
    >;
    type _procedureValidationBranchKeepsCustomValidationBranch = ExpectTrue<
      HasJsonVariant<
        typeof procedureValidationBranchResponse,
        {
          ok: false;
          source: "procedure-validation-branch";
          target: "query";
          issueCount: number;
          receivedPage?: string;
        }
      >
    >;

    type RedirectGet = (typeof client.api)["redirect-me"]["$get"];
    type RedirectResponse = Awaited<ReturnType<RedirectGet>>;
    type _redirectResponseKeepsRedirect = ExpectTrue<
      HasResponseVariant<RedirectResponse, undefined, 307, "">
    >;
    type _redirectResponseKeepsDefaultError = ExpectTrue<
      HasVariant<RedirectResponse, SharedProcedureOnErrorResponse>
    >;

    const _responseError = new RpcResponseError(
      new Response("error", { status: 500, statusText: "Internal Server Error" }),
      "error",
    );
    expectTypeOf<typeof _responseError.payload>().toEqualTypeOf<string>();
  });

  it("rejects invalid generated RPC inputs at compile time", () => {
    type NativeDynamicArg = Parameters<(typeof client.api)["next-native"]["_itemId"]>[0];
    expectTypeOf<NativeDynamicArg>().toEqualTypeOf<string | number>();

    client.api.users._userId("demo-user").$url({
      query: { includePosts: "false" },
    });

    client.api["next-native"]._itemId("native-item").$url({
      query: { filter: "recent" },
    });

    client.api["next-native"]._itemId("native-item").$url({
      // @ts-expect-error native route query should follow its exported Query type
      query: { filter: 123 },
    });

    client.api.users
      ._userId("demo-user")
      // @ts-expect-error invalid users query literal should be rejected
      .$url({ query: { includePosts: "maybe" } });

    void client.api.posts.$post({
      body: { json: { title: "ok" } },
    });

    // @ts-expect-error post body is required for the generated POST route
    void client.api.posts.$post();

    // @ts-expect-error post body title must be a string
    void client.api.posts.$post({ body: { json: { title: 123 } } });

    void client.api["request-meta"].$get({
      requestHeaders: {
        headers: { "x-integration-test": "header-ok" },
        cookies: { session: "cookie-ok" },
      },
    });

    void client.api["request-meta"].$get({
      // @ts-expect-error request-meta requires both validated headers and cookies
      requestHeaders: { headers: { "x-integration-test": "header-ok" } },
    });

    void client.api["procedure-submit"].$post({
      body: { json: { title: "ok" } },
      requestHeaders: {
        headers: { "x-procedure-test": "header-ok" },
        cookies: { session: "cookie-ok" },
      },
    });

    client.api["procedure-contract"]._userId("procedure-user").$url({
      query: { includePosts: "false" },
    });

    void client.api["procedure-contract"]._userId("procedure-user").$get();

    void client.api["procedure-contract"]
      ._userId("procedure-user")
      // @ts-expect-error GET procedure routes must not accept request bodies
      .$get({ body: { json: { title: "invalid" } } });

    void client.api["procedure-form-data"].$post({
      body: { formData: new FormData() },
    });

    void client.api["procedure-form-data"].$post({
      // @ts-expect-error procedure-form-data expects multipart formData, not json
      body: { json: { displayName: "invalid" } },
    });

    client.api["procedure-contract"]
      ._userId("procedure-user")
      // @ts-expect-error invalid procedure query literal should be rejected
      .$url({ query: { includePosts: "maybe" } });

    client.api["procedure-validation-branch"].$url({
      query: { page: "1" },
    });

    void client.api["procedure-guarded"]._userId("procedure-user").$get({
      requestHeaders: {
        headers: {
          "x-demo-user": "procedure-user",
          "x-demo-role": "reader",
        },
      },
    });

    client.api["procedure-guarded"]._userId("procedure-user").$url({
      query: { includeDrafts: "false" },
    });

    void client.api["procedure-guarded"]._userId("procedure-user").$get({
      requestHeaders: {
        headers: {
          "x-demo-user": "procedure-user",
          // @ts-expect-error invalid guarded procedure header literal should be rejected
          "x-demo-role": "owner",
        },
      },
    });

    client.patterns["catch-all"].___parts(["alpha"]);

    // @ts-expect-error catch-all segments must be non-empty
    client.patterns["catch-all"].___parts([]);

    client.patterns.search.$url({
      query: { q: "typed-page-query" },
    });

    client.patterns.search.$url({
      query: { q: ["typed-page-query"] },
    });

    client.patterns.search.$url({
      // @ts-expect-error page query values should follow the inferred page query schema input
      query: { q: 123 },
    });

    client.patterns["native-query"].$url({
      query: { term: "typed-native-page-query", page: "2" },
    });

    client.patterns["native-query"].$url({
      query: { term: ["typed-native-page-query"] },
    });

    client.patterns["native-query"].$url({
      // @ts-expect-error native page query should follow its exported Query type
      query: { page: 2 },
    });
  });
});

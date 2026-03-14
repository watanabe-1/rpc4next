import { createRpcClient } from "rpc4next/client";
import type {
  ContentType,
  HttpStatusCode,
  TypedNextResponse,
} from "rpc4next/server";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Query as UsersQuery } from "../app/api/users/[userId]/route";
import type { PathStructure } from "./generated/rpc";

const baseUrl = "http://127.0.0.1:3000";

const client = createRpcClient<PathStructure>(baseUrl, {
  fetch: async () =>
    new Response(null, {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
});

describe("integration next-app generated RPC type coverage", () => {
  it("infers the generated client signatures for query, body, and headers", () => {
    type NativeDynamicBuilder = (typeof client.api)["next-native"]["_itemId"];
    type NativeDynamicUrl = ReturnType<NativeDynamicBuilder>["$url"];
    type ExpectedNativeDynamicUrl = (url?: { hash?: string }) => {
      pathname: string;
      path: string;
      relativePath: string;
      params: {
        itemId: string;
      };
    };
    expectTypeOf<NativeDynamicUrl>().toEqualTypeOf<ExpectedNativeDynamicUrl>();

    type UsersUrl = ReturnType<typeof client.api.users._userId>["$url"];
    type ExpectedUsersUrl = (url?: { query?: UsersQuery; hash?: string }) => {
      pathname: string;
      path: string;
      relativePath: string;
      params: {
        userId: string;
      };
    };

    expectTypeOf<UsersUrl>().toEqualTypeOf<ExpectedUsersUrl>();

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
    const _requestMetaArgFromActual: ExpectedRequestMetaArg =
      {} as RequestMetaArg;
    const _requestMetaArgFromExpected: RequestMetaArg =
      {} as ExpectedRequestMetaArg;
  });

  it("infers the generated response types for integration routes", async () => {
    const _nativeNextResponse = await client.api["next-native"].$get();
    expectTypeOf<typeof _nativeNextResponse>().toEqualTypeOf<
      TypedNextResponse<
        {
          ok: boolean;
          mode: string;
        },
        HttpStatusCode,
        ContentType
      >
    >();

    const _nativeDynamicResponse = await client.api["next-native"]
      ._itemId("native-item")
      .$get();
    expectTypeOf<typeof _nativeDynamicResponse>().toEqualTypeOf<
      TypedNextResponse<
        {
          ok: boolean;
          itemId: string;
          filter: string;
        },
        HttpStatusCode,
        ContentType
      >
    >();

    const nativeResponseJson = await client.api["next-native-response"].$get();
    const _nativeResponseJson: TypedNextResponse<
      unknown,
      HttpStatusCode,
      ContentType
    > = nativeResponseJson;

    const usersResponse = await client.api.users._userId("demo-user").$get({
      url: { query: { includePosts: "true" } },
    });
    type UsersResponse = typeof usersResponse;
    type UsersSuccessResponse = Extract<UsersResponse, { ok: true }>;
    expectTypeOf<typeof usersResponse>().toMatchTypeOf<
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
    >();

    if (usersResponse.ok) {
      const _usersOkResponse: UsersSuccessResponse = usersResponse;
    }

    const postsResponse = await client.api.posts.$post({
      body: { json: { title: "integration type test" } },
    });
    type PostsResponse = typeof postsResponse;
    type PostsSuccessResponse = Extract<PostsResponse, { ok: true }>;
    expectTypeOf<typeof postsResponse>().toMatchTypeOf<
      | TypedNextResponse<
          {
            ok: boolean;
            title: string;
          },
          201,
          "application/json"
        >
      | TypedNextResponse<unknown, 400, "application/json">
    >();

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
    type RequestMetaSuccessResponse = Extract<
      RequestMetaResponse,
      { ok: true }
    >;
    expectTypeOf<typeof requestMetaResponse>().toMatchTypeOf<
      | TypedNextResponse<
          {
            header: string;
            session: string;
          },
          200,
          "application/json"
        >
      | TypedNextResponse<unknown, 400, "application/json">
    >();

    if (requestMetaResponse.ok) {
      const _requestMetaOkResponse: RequestMetaSuccessResponse =
        requestMetaResponse;
    }

    type RedirectGet = (typeof client.api)["redirect-me"]["$get"];
    type RedirectResponse = Awaited<ReturnType<RedirectGet>>;
    expectTypeOf<RedirectResponse>().toEqualTypeOf<
      TypedNextResponse<undefined, 307, "">
    >();
  });

  it("rejects invalid generated RPC inputs at compile time", () => {
    type NativeDynamicArg = Parameters<
      (typeof client.api)["next-native"]["_itemId"]
    >[0];
    expectTypeOf<NativeDynamicArg>().toEqualTypeOf<string | number>();

    client.api.users._userId("demo-user").$url({
      query: { includePosts: "false" },
    });

    client.api.users
      ._userId("demo-user")
      // @ts-expect-error invalid users query literal should be rejected
      .$url({ query: { includePosts: "maybe" } });

    client.api.posts.$post({
      body: { json: { title: "ok" } },
    });

    // @ts-expect-error post body is required for the generated POST route
    client.api.posts.$post();

    // @ts-expect-error post body title must be a string
    client.api.posts.$post({ body: { json: { title: 123 } } });

    client.api["request-meta"].$get({
      requestHeaders: {
        headers: { "x-integration-test": "header-ok" },
        cookies: { session: "cookie-ok" },
      },
    });

    client.api["request-meta"].$get({
      // @ts-expect-error request-meta requires both validated headers and cookies
      requestHeaders: { headers: { "x-integration-test": "header-ok" } },
    });

    client.patterns["catch-all"].___parts(["alpha"]);

    // @ts-expect-error catch-all segments must be non-empty
    client.patterns["catch-all"].___parts([]);

    expect(true).toBe(true);
  });
});

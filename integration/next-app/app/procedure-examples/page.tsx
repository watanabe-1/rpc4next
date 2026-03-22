import { headers } from "next/headers";
import { createRpcClient } from "rpc4next/client";
import type {
  ContentType,
  HttpStatusCode,
  TypedNextResponse,
} from "rpc4next/server";
import type { PathStructure } from "@/generated/rpc";
import type { rpcClient } from "@/lib/rpc-client";

export const dynamic = "force-dynamic";

const createServerRpcClient = async () => {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) {
    throw new Error("Expected host header for procedure-examples page.");
  }

  return createRpcClient<PathStructure>(`${protocol}://${host}`);
};

type ProcedureContractGet = ReturnType<
  (typeof rpcClient.api)["procedure-contract"]["_userId"]
>["$get"];
type ProcedureContractResponse = Awaited<ReturnType<ProcedureContractGet>>;
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
    >;
const _procedureContractFromActual: ExpectedProcedureContractResponse =
  {} as ProcedureContractResponse;
const _procedureContractFromExpected: ProcedureContractResponse =
  {} as ExpectedProcedureContractResponse;

type ProcedureSubmitPost = (typeof rpcClient.api)["procedure-submit"]["$post"];
type ProcedureSubmitResponse = Awaited<ReturnType<ProcedureSubmitPost>>;
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
    >;
const _procedureSubmitFromActual: ExpectedProcedureSubmitResponse =
  {} as ProcedureSubmitResponse;
const _procedureSubmitFromExpected: ProcedureSubmitResponse =
  {} as ExpectedProcedureSubmitResponse;

type ProcedureGuardedGet = ReturnType<
  (typeof rpcClient.api)["procedure-guarded"]["_userId"]
>["$get"];
type ProcedureGuardedResponse = Awaited<ReturnType<ProcedureGuardedGet>>;
type ExpectedProcedureGuardedResponse =
  | TypedNextResponse<
      {
        ok: true;
        userId: string;
        includeDrafts: boolean;
        role: "reader" | "editor";
        source: "procedure-guarded";
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
    >;
const _procedureGuardedFromActual: ExpectedProcedureGuardedResponse =
  {} as ProcedureGuardedResponse;
const _procedureGuardedFromExpected: ProcedureGuardedResponse =
  {} as ExpectedProcedureGuardedResponse;

type ProcedureValidationBranchGet =
  (typeof rpcClient.api)["procedure-validation-branch"]["$get"];
type ProcedureValidationBranchResponse = Awaited<
  ReturnType<ProcedureValidationBranchGet>
>;
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
    >;
const _procedureValidationBranchFromActual: ExpectedProcedureValidationBranchResponse =
  {} as ProcedureValidationBranchResponse;

type NativeResponseGet = (typeof rpcClient.api)["next-native-response"]["$get"];
type NativeResponse = Awaited<ReturnType<NativeResponseGet>>;
type ExpectedNativeResponse = TypedNextResponse<
  unknown,
  HttpStatusCode,
  ContentType
>;
const _nativeResponseFromActual: ExpectedNativeResponse = {} as NativeResponse;
const _nativeResponseFromExpected: NativeResponse =
  {} as ExpectedNativeResponse;

type RedirectGet = (typeof rpcClient.api)["redirect-me"]["$get"];
type RedirectResponse = Awaited<ReturnType<RedirectGet>>;
type ExpectedRedirectResponse = TypedNextResponse<undefined, 307, "">;
const _redirectFromActual: ExpectedRedirectResponse = {} as RedirectResponse;
const _redirectFromExpected: RedirectResponse = {} as ExpectedRedirectResponse;

void _procedureContractFromActual;
void _procedureContractFromExpected;
void _procedureSubmitFromActual;
void _procedureSubmitFromExpected;
void _procedureGuardedFromActual;
void _procedureGuardedFromExpected;
void _procedureValidationBranchFromActual;
void _nativeResponseFromActual;
void _nativeResponseFromExpected;
void _redirectFromActual;
void _redirectFromExpected;

type ResponsePreview = {
  status: number;
  ok: boolean;
  contentType: string;
  location?: string;
  body: string;
};

type ExampleCard = {
  title: string;
  route: string;
  request: string;
  inferredType: string;
  whyItLooksLikeThat: string;
  runtime: ResponsePreview;
};

const readResponsePreview = async (
  response: Response,
): Promise<ResponsePreview> => {
  const contentType = response.headers.get("content-type") ?? "";
  const location = response.headers.get("location") ?? undefined;

  if (contentType.includes("application/json")) {
    return {
      status: response.status,
      ok: response.ok,
      contentType,
      location,
      body: JSON.stringify(await response.json(), null, 2),
    };
  }

  return {
    status: response.status,
    ok: response.ok,
    contentType,
    location,
    body: await response.text(),
  };
};

export default async function ProcedureExamplesPage() {
  const serverRpcClient = await createServerRpcClient();
  const [
    procedureContractResponse,
    procedureSubmitResponse,
    procedureGuardedResponse,
    procedureValidationBranchResponse,
    nativeResponse,
    redirectResponse,
  ] = await Promise.all([
    serverRpcClient.api["procedure-contract"]._userId("demo-user").$get({
      url: { query: { includePosts: "true" } },
    }),
    serverRpcClient.api["procedure-submit"].$post({
      body: { json: { title: "hello from procedure-examples" } },
      requestHeaders: {
        headers: { "x-procedure-test": "page-demo" },
        cookies: { session: "cookie-demo" },
      },
    }),
    serverRpcClient.api["procedure-guarded"]._userId("demo-user").$get({
      url: { query: { includeDrafts: "true" } },
      requestHeaders: {
        headers: { "x-demo-role": "editor" },
      },
    }),
    serverRpcClient.api["procedure-validation-branch"].$get({
      url: { query: { page: "0" } },
    }),
    serverRpcClient.api["next-native-response"].$get(),
    serverRpcClient.api["redirect-me"].$get(undefined, {
      init: { redirect: "manual" },
    }),
  ]);

  const examples: ExampleCard[] = [
    {
      title: "Narrow procedure GET",
      route: "/api/procedure-contract/[userId]",
      request: `const response = await rpcClient.api["procedure-contract"]
  ._userId("demo-user")
  .$get({ url: { query: { includePosts: "true" } } });`,
      inferredType: `type Response =
  | TypedNextResponse<{
      ok: true;
      userId: string;
      includePosts: boolean;
      source: "procedure-contract";
      requestId: string;
    }, 200, "application/json">
  | TypedNextResponse<{
      error: {
        code: "BAD_REQUEST";
        message: string;
        details?: unknown;
      };
    }, 400, "application/json">;`,
      whyItLooksLikeThat:
        "params/query/output are all declared on one procedure, so the client gets a tight success shape plus the implicit BAD_REQUEST branch.",
      runtime: await readResponsePreview(procedureContractResponse),
    },
    {
      title: "POST with typed body, headers, and cookies",
      route: "/api/procedure-submit",
      request: `const response = await rpcClient.api["procedure-submit"].$post({
  body: { json: { title: "hello from procedure-examples" } },
  requestHeaders: {
    headers: { "x-procedure-test": "page-demo" },
    cookies: { session: "cookie-demo" },
  },
});`,
      inferredType: `type Response =
  | TypedNextResponse<{
      ok: true;
      title: string;
      header: string;
      session: string;
      source: "procedure-submit";
    }, 201, "application/json">
  | TypedNextResponse<{
      error: {
        code: "BAD_REQUEST";
        message: string;
        details?: unknown;
      };
    }, 400, "application/json">;`,
      whyItLooksLikeThat:
        "json/header/cookie contracts become required client inputs, and the declared output keeps the success branch precise at status 201.",
      runtime: await readResponsePreview(procedureSubmitResponse),
    },
    {
      title: "Shared baseProcedure adds richer error unions",
      route: "/api/procedure-guarded/[userId]",
      request: `const response = await rpcClient.api["procedure-guarded"]
  ._userId("demo-user")
  .$get({
    url: { query: { includeDrafts: "true" } },
    requestHeaders: { headers: { "x-demo-role": "editor" } },
  });`,
      inferredType: `type Response =
  | TypedNextResponse<SuccessBody, 200, "application/json">
  | TypedNextResponse<BadRequestBody, 400, "application/json">
  | TypedNextResponse<InternalServerErrorBody, 500, "application/json">
  | TypedNextResponse<UnauthorizedBody, 401, "application/json">
  | TypedNextResponse<ForbiddenSuspendedBody, 403, "application/json">
  | TypedNextResponse<ForbiddenEditorOnlyBody, 403, "application/json">;`,
      whyItLooksLikeThat:
        "The route extends a shared baseProcedure, so shared auth/context/error contracts and route-local FORBIDDEN variants all survive into the generated client type.",
      runtime: await readResponsePreview(procedureGuardedResponse),
    },
    {
      title: "Custom validation branch via raw NextResponse.json(...)",
      route: "/api/procedure-validation-branch",
      request: `const response = await rpcClient.api["procedure-validation-branch"].$get({
  url: { query: { page: "0" } },
});`,
      inferredType: `type Response =
  | TypedNextResponse<{
      ok: true;
      source: "procedure-validation-branch";
      page: number;
    }, 200, "application/json">
  | TypedNextResponse<BadRequestBody, 400, "application/json">
  | TypedNextResponse<{
      ok: false;
      source: "procedure-validation-branch";
      target: "query";
      issueCount: number;
      receivedPage?: string;
    }, HttpStatusCode, ContentType>;`,
      whyItLooksLikeThat:
        "This route returns the custom validation branch through raw NextResponse.json(...), so the body shape survives but status/content-type stay broad compared with response.json(...).",
      runtime: await readResponsePreview(procedureValidationBranchResponse),
    },
    {
      title: "Plain Response.json route stays broad",
      route: "/api/next-native-response",
      request: `const response = await rpcClient.api["next-native-response"].$get();`,
      inferredType: `type Response = TypedNextResponse<
  unknown,
  HttpStatusCode,
  ContentType
>;`,
      whyItLooksLikeThat:
        "This route is a plain App Router handler that returns Response.json(...) without procedure metadata, so the generated client only knows it is some HTTP response.",
      runtime: await readResponsePreview(nativeResponse),
    },
    {
      title: "Redirect helper keeps an exact redirect type",
      route: "/api/redirect-me",
      request: `const response = await rpcClient.api["redirect-me"].$get(undefined, {
  init: { redirect: "manual" },
});`,
      inferredType: `type Response = TypedNextResponse<undefined, 307, "">;`,
      whyItLooksLikeThat:
        "response.redirect(...) is a typed helper, so both the route and the generated client keep the exact redirect status instead of widening to a generic response.",
      runtime: await readResponsePreview(redirectResponse),
    },
  ];

  return (
    <main>
      <h1>Procedure examples</h1>
      <p>
        This page calls the live integration routes through{" "}
        <code>rpcClient</code> and compares how their response types are
        inferred.
      </p>
      <p>
        The comparison is easiest to read as a pattern table: the more route
        metadata rpc4next has, the narrower the generated client response type
        becomes.
      </p>
      {examples.map((example) => (
        <section key={example.title}>
          <h2>{example.title}</h2>
          <p>
            Route: <code>{example.route}</code>
          </p>
          <p>{example.whyItLooksLikeThat}</p>
          <h3>Request</h3>
          <pre>{example.request}</pre>
          <h3>Inferred response type</h3>
          <pre>{example.inferredType}</pre>
          <h3>Runtime result from this page render</h3>
          <ul>
            <li>
              status: <code>{example.runtime.status}</code>
            </li>
            <li>
              ok: <code>{String(example.runtime.ok)}</code>
            </li>
            <li>
              content-type:{" "}
              <code>{example.runtime.contentType || "(none)"}</code>
            </li>
            <li>
              location: <code>{example.runtime.location ?? "(none)"}</code>
            </li>
          </ul>
          <pre>{example.runtime.body || "(empty body)"}</pre>
        </section>
      ))}
    </main>
  );
}

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as validatorUtils from "../../../packages/rpc4next/src/rpc/server/validators/validator-utils";
import { POST } from "../app/api/posts/route";
import { GET } from "../app/api/users/[userId]/route";

type ValidationErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const expectValidationErrorPayload = (
  payload: unknown,
): ValidationErrorPayload => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("error" in payload) ||
    typeof payload.error !== "object" ||
    payload.error === null ||
    !("code" in payload.error) ||
    typeof payload.error.code !== "string" ||
    !("message" in payload.error) ||
    typeof payload.error.message !== "string"
  ) {
    throw new Error("Expected a validation error payload");
  }
  return payload as ValidationErrorPayload;
};

describe("integration next-app server route handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serves the users route through the real GET handler", async () => {
    const request = new NextRequest(
      "http://127.0.0.1:3000/api/users/smoke-user?includePosts=true",
    );

    const response = await GET(request, {
      params: Promise.resolve({ userId: "smoke-user" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      userId: "smoke-user",
      includePosts: true,
    });
  });

  it("serves a plain Next.js route handler through the generated RPC shape", async () => {
    const { GET: nativeNextGet } = await import("../app/api/next-native/route");
    const response = await nativeNextGet();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      mode: "native-next",
    });
  });

  it("serves a plain Next.js route handler with an explicit output contract", async () => {
    const { GET: explicitOutputGet } = await import(
      "../app/api/explicit-output/route"
    );
    const response = await explicitOutputGet();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      source: "explicit-output",
    });
  });

  it("serves a routeHandlerFactory route with explicit contract metadata/output", async () => {
    const { GET: contractRouteGet } = await import(
      "../app/api/contract-route/route"
    );
    const response = await contractRouteGet(
      new NextRequest("http://127.0.0.1:3000/api/contract-route"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      source: "contract-route",
    });
  });

  it("serves a procedure-based dynamic route with params and query", async () => {
    const { GET: procedureContractGet } = await import(
      "../app/api/procedure-contract/[userId]/route"
    );
    const response = await procedureContractGet(
      new NextRequest(
        "http://127.0.0.1:3000/api/procedure-contract/procedure-user?includePosts=true",
      ),
      { params: Promise.resolve({ userId: "procedure-user" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      userId: "procedure-user",
      includePosts: true,
      source: "procedure-contract",
      requestId: "procedure-ctx",
    });
  });

  it("runs validator-stage customization in the integration fixture", async () => {
    const { GET: procedureValidationBranchGet } = await import(
      "../app/api/procedure-validation-branch/route"
    );
    const response = await procedureValidationBranchGet(
      new NextRequest(
        "http://127.0.0.1:3000/api/procedure-validation-branch?page=0",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      source: "procedure-validation-branch",
      target: "query",
      issueCount: 1,
      receivedPage: "0",
    });
  });

  it("serves a procedure-based route using response.text(...)", async () => {
    const { GET: procedureResponseTextGet } = await import(
      "../app/api/procedure-response-text/route"
    );
    const response = await procedureResponseTextGet(
      new NextRequest(
        "http://127.0.0.1:3000/api/procedure-response-text?name=server-test",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe(
      "procedure-response-text:server-test",
    );
  });

  it("serves a procedure-based route using response.redirect(...)", async () => {
    const { GET: procedureResponseRedirectGet } = await import(
      "../app/api/procedure-response-redirect/route"
    );
    const response = await procedureResponseRedirectGet(
      new NextRequest("http://127.0.0.1:3000/api/procedure-response-redirect"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/feed");
  });

  it("serves a plain Next.js dynamic route handler with params and query", async () => {
    const { GET: nativeDynamicGet } = await import(
      "../app/api/next-native/[itemId]/route"
    );
    const response = await nativeDynamicGet(
      new NextRequest(
        "http://127.0.0.1:3000/api/next-native/native-item?filter=recent",
      ),
      { params: Promise.resolve({ itemId: "native-item" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      itemId: "native-item",
      filter: "recent",
    });
  });

  it("serves a plain Response.json route handler", async () => {
    const { GET: nativeResponseGet } = await import(
      "../app/api/next-native-response/route"
    );
    const response = await nativeResponseGet();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      source: "response-json",
    });
  });

  it("returns a validation error for unsupported users query values", async () => {
    const request = new NextRequest(
      "http://127.0.0.1:3000/api/users/smoke-user?includePosts=maybe",
    );

    const response = await GET(request, {
      params: Promise.resolve({ userId: "smoke-user" }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");

    const payload = await response.json();
    const errorPayload = expectValidationErrorPayload(payload);
    expect(errorPayload.error.code).toBe("BAD_REQUEST");
    expect(errorPayload.error.message).toContain('"path": [');
    expect(errorPayload.error.message).toContain('"includePosts"');
  });

  it("serves the posts route through the real POST handler", async () => {
    const request = new NextRequest("http://127.0.0.1:3000/api/posts", {
      method: "POST",
      body: JSON.stringify({ title: "server integration" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      title: "server integration",
    });
  });

  it("returns a validation error for invalid post bodies", async () => {
    const request = new NextRequest("http://127.0.0.1:3000/api/posts", {
      method: "POST",
      body: JSON.stringify({ title: "" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");

    const payload = await response.json();
    const errorPayload = expectValidationErrorPayload(payload);
    expect(errorPayload.error.code).toBe("BAD_REQUEST");
    expect(errorPayload.error.message).toContain('"path": [');
    expect(errorPayload.error.message).toContain('"title"');
  });

  it("reads validated headers and cookies through the real GET handler chain", async () => {
    vi.spyOn(validatorUtils, "getHeadersObject").mockResolvedValueOnce({
      "x-integration-test": "header-ok",
    });
    vi.spyOn(validatorUtils, "getCookiesObject").mockResolvedValueOnce({
      session: "cookie-ok",
    });

    const { GET: requestMetaGet } = await import(
      "../app/api/request-meta/route"
    );
    const response = await requestMetaGet(
      new NextRequest("http://127.0.0.1:3000/api/request-meta"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      header: "header-ok",
      session: "cookie-ok",
    });
  });

  it("serves a procedure-based POST route with json, headers, and cookies", async () => {
    const { POST: procedureSubmitPost } = await import(
      "../app/api/procedure-submit/route"
    );
    const response = await procedureSubmitPost(
      new NextRequest("http://127.0.0.1:3000/api/procedure-submit", {
        method: "POST",
        body: JSON.stringify({ title: "procedure-submit" }),
        headers: {
          "content-type": "application/json",
          "x-procedure-test": "header-ok",
          cookie: "session=cookie-ok",
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      title: "procedure-submit",
      header: "header-ok",
      session: "cookie-ok",
      source: "procedure-submit",
    });
  });

  it("serves a procedure-based POST route with multipart form-data", async () => {
    const { POST: procedureFormDataPost } = await import(
      "../app/api/procedure-form-data/route"
    );
    const formData = new FormData();
    formData.set("displayName", "demo-user");
    formData.set(
      "avatar",
      new File(["avatar-bytes"], "avatar.png", { type: "image/png" }),
    );
    formData.append("tags", "alpha");
    formData.append("tags", "beta");

    const response = await procedureFormDataPost(
      new NextRequest("http://127.0.0.1:3000/api/procedure-form-data", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      displayName: "demo-user",
      filename: "avatar.png",
      tags: ["alpha", "beta"],
      source: "procedure-form-data",
    });
  });

  it("serves a guarded procedure route when the required role is present", async () => {
    const { GET: procedureGuardedGet } = await import(
      "../app/api/procedure-guarded/[userId]/route"
    );
    const response = await procedureGuardedGet(
      new NextRequest(
        "http://127.0.0.1:3000/api/procedure-guarded/procedure-user?includeDrafts=true",
        {
          headers: {
            "x-demo-user": "procedure-user",
            "x-demo-role": "editor",
          },
        },
      ),
      { params: Promise.resolve({ userId: "procedure-user" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      userId: "procedure-user",
      includeDrafts: true,
      role: "editor",
      source: "procedure-guarded",
      requestId: "guarded:procedure-user",
    });
  });

  it("returns a typed FORBIDDEN envelope from the guarded procedure route", async () => {
    const { GET: procedureGuardedGet } = await import(
      "../app/api/procedure-guarded/[userId]/route"
    );
    const response = await procedureGuardedGet(
      new NextRequest(
        "http://127.0.0.1:3000/api/procedure-guarded/procedure-user?includeDrafts=true",
        {
          headers: {
            "x-demo-user": "procedure-user",
          },
        },
      ),
      { params: Promise.resolve({ userId: "procedure-user" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Editor role required to include drafts.",
        details: {
          reason: "editor_only",
        },
      },
    });
  });

  it("returns a typed UNAUTHORIZED envelope from the shared guarded baseProcedure", async () => {
    const { GET: procedureGuardedGet } = await import(
      "../app/api/procedure-guarded/[userId]/route"
    );
    const response = await procedureGuardedGet(
      new NextRequest(
        "http://127.0.0.1:3000/api/procedure-guarded/procedure-user?includeDrafts=true",
      ),
      { params: Promise.resolve({ userId: "procedure-user" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Demo user header required.",
        details: {
          reason: "missing_demo_user",
        },
      },
    });
  });

  it("returns a typed shared FORBIDDEN envelope from the guarded baseProcedure", async () => {
    const { GET: procedureGuardedGet } = await import(
      "../app/api/procedure-guarded/[userId]/route"
    );
    const response = await procedureGuardedGet(
      new NextRequest(
        "http://127.0.0.1:3000/api/procedure-guarded/procedure-user",
        {
          headers: {
            "x-demo-user": "procedure-user",
            "x-demo-role": "suspended",
          },
        },
      ),
      { params: Promise.resolve({ userId: "procedure-user" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Suspended demo users cannot access guarded procedures.",
        details: {
          reason: "suspended_account",
        },
      },
    });
  });

  it("normalizes invalid procedure output as an INTERNAL_SERVER_ERROR envelope", async () => {
    const { GET: procedureInvalidOutputGet } = await import(
      "../app/api/procedure-invalid-output/route"
    );
    const response = await procedureInvalidOutputGet(
      new NextRequest("http://127.0.0.1:3000/api/procedure-invalid-output"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Procedure output validation failed.",
      },
    });
  });

  it("applies the shared procedure kit error formatter to procedure routes", async () => {
    const { GET: procedureKitErrorGet } = await import(
      "../app/api/procedure-kit-error/route"
    );
    const response = await procedureKitErrorGet(
      new NextRequest(
        "http://127.0.0.1:3000/api/procedure-kit-error?mode=deny",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Procedure kit formatter denied the request.",
        details: {
          reason: "kit_formatter",
        },
      },
    });
  });

  it("returns a validation error when required request metadata is missing", async () => {
    vi.spyOn(validatorUtils, "getHeadersObject").mockResolvedValueOnce({});
    vi.spyOn(validatorUtils, "getCookiesObject").mockResolvedValueOnce({});

    const { GET: requestMetaGet } = await import(
      "../app/api/request-meta/route"
    );
    const response = await requestMetaGet(
      new NextRequest("http://127.0.0.1:3000/api/request-meta"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);

    const payload = await response.json();
    const errorPayload = expectValidationErrorPayload(payload);
    expect(errorPayload.error.code).toBe("BAD_REQUEST");
  });

  it("returns redirect responses from integration routes", async () => {
    const { GET: redirectGet } = await import("../app/api/redirect-me/route");
    const response = await redirectGet(
      new NextRequest("http://127.0.0.1:3000/api/redirect-me"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/feed");
  });

  it("uses the route-level onError handler when the handler throws", async () => {
    const { GET: errorDemoGet } = await import("../app/api/error-demo/route");
    const response = await errorDemoGet(
      new NextRequest("http://127.0.0.1:3000/api/error-demo"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe(
      "handled:expected integration failure",
    );
  });
});

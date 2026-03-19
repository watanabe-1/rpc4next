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

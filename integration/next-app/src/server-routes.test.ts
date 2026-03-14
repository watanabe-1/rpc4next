import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/posts/route";
import { GET } from "../app/api/users/[userId]/route";

describe("integration next-app server route handlers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("next/headers");
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
    expect(payload.success).toBe(false);
    expect(payload.error.name).toBe("ZodError");
    expect(payload.error.message).toContain('"path": [');
    expect(payload.error.message).toContain('"includePosts"');
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
    expect(payload.success).toBe(false);
    expect(payload.error.name).toBe("ZodError");
    expect(payload.error.message).toContain('"path": [');
    expect(payload.error.message).toContain('"title"');
  });

  it("reads validated headers and cookies through the real GET handler chain", async () => {
    vi.doMock("next/headers", () => ({
      headers: async () =>
        new Headers({
          "x-integration-test": "header-ok",
        }),
      cookies: async () => ({
        getAll: () => [{ name: "session", value: "cookie-ok" }],
      }),
    }));

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
    vi.doMock("next/headers", () => ({
      headers: async () => new Headers(),
      cookies: async () => ({
        getAll: () => [],
      }),
    }));

    const { GET: requestMetaGet } = await import(
      "../app/api/request-meta/route"
    );
    const response = await requestMetaGet(
      new NextRequest("http://127.0.0.1:3000/api/request-meta"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);

    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error.name).toBe("ZodError");
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

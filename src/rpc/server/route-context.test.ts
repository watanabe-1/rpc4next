import { NextResponse, NextRequest } from "next/server";
import { describe, it, expect, expectTypeOf } from "vitest";
import { createRouteContext } from "./route-context";
import type { ValidationSchema } from "./route-types";
import type {
  TypedNextResponse,
  ValidatedData,
  ValidationTarget,
} from "./types";

const createRealNextRequest = (url: string): NextRequest => {
  return new NextRequest(url);
};

describe("createRouteContext", () => {
  const mockParams = { id: "123" };
  const mockSearchParamsObject = { q: "test" };

  it("should return a route context with query and params", async () => {
    const req = createRealNextRequest("http://localhost/?q=test");
    const context = createRouteContext(req, {
      params: Promise.resolve(mockParams),
    });

    const query = context.req.query();
    expect(query).toEqual(mockSearchParamsObject);

    const params = await context.req.params();
    expect(params).toEqual(mockParams);
  });

  it("should store and retrieve validated data", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    context.req.addValidatedData(
      "body" as ValidationTarget,
      { name: "John" } as unknown as ValidatedData
    );
    expect(context.req.valid("body" as never)).toEqual({
      name: "John",
    });
  });

  it("should return a json response", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.json({ message: "ok" }, { status: 200 });
    expect(response instanceof NextResponse).toBe(true);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("should return a text response", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.text("hello", { status: 200 });
    expect(response instanceof NextResponse).toBe(true);
    expect(response.headers.get("content-type")).toBe("text/plain");
  });

  it("should return a body response with custom headers", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.body("raw-body", {
      status: 201,
      headers: {
        "X-Custom-Header": "test-header",
        "Content-Type": "application/custom",
      },
    });

    expect(response instanceof NextResponse).toBe(true);
    expect(response.status).toBe(201);
    expect(response.headers.get("X-Custom-Header")).toBe("test-header");
    expect(response.headers.get("Content-Type")).toBe("application/custom");
  });

  it("should return a redirect response", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.redirect("http://localhost/next-page", 307);
    expect(response instanceof NextResponse).toBe(true);
    expect(response.headers.get("location")).toBe("http://localhost/next-page");
    expect(response.status).toBe(307);
  });

  it("should return a body response with headers", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.body("headers-body", {
      status: 201,
      headers: {
        "X-Custom-Header": "header-value",
        "Content-Type": "application/custom",
      },
    });

    expect(response instanceof NextResponse).toBe(true);
    expect(response.status).toBe(201);
    expect(response.headers.get("X-Custom-Header")).toBe("header-value");
    expect(response.headers.get("Content-Type")).toBe("application/custom");
  });

  it("should return a json response with headers", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.json(
      { ok: true },
      {
        status: 200,
        headers: {
          "X-Json-Header": "yes",
        },
      }
    );

    expect(response instanceof NextResponse).toBe(true);
    expect(response.headers.get("X-Json-Header")).toBe("yes");
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("should return a text response with headers", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.text("hello", {
      status: 200,
      headers: {
        "X-Text-Header": "true",
      },
    });

    expect(response instanceof NextResponse).toBe(true);
    expect(response.headers.get("X-Text-Header")).toBe("true");
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  it("should return a redirect response with headers", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.redirect("http://localhost/next-page", {
      status: 301,
      headers: {
        "X-Redirect-Header": "true",
      },
    });

    expect(response instanceof NextResponse).toBe(true);
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("http://localhost/next-page");
    expect(response.headers.get("X-Redirect-Header")).toBe("true");
  });

  it("should return a body response with headersInit", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const headers = new Headers();
    headers.append("X-From-HeadersInit", "true");

    const response = context.body("init-body", {
      status: 202,
      headersInit: headers,
    });

    expect(response instanceof NextResponse).toBe(true);
    expect(response.status).toBe(202);
    expect(response.headers.get("X-From-HeadersInit")).toBe("true");
  });

  it("should return a json response with headersInit", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const headers = new Headers();
    headers.append("X-Json-HeadersInit", "yes");

    const response = context.json(
      { ok: true },
      {
        status: 200,
        headersInit: headers,
      }
    );

    expect(response instanceof NextResponse).toBe(true);
    expect(response.headers.get("X-Json-HeadersInit")).toBe("yes");
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("should return a text response with headersInit", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const headers = new Headers();
    headers.append("X-Text-HeadersInit", "true");

    const response = context.text("hello", {
      status: 200,
      headersInit: headers,
    });

    expect(response instanceof NextResponse).toBe(true);
    expect(response.headers.get("X-Text-HeadersInit")).toBe("true");
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  it("should return a redirect response with headersInit", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const headers = new Headers();
    headers.append("X-Redirect-HeadersInit", "yes");

    const response = context.redirect("http://localhost/next-page", {
      status: 307,
      headersInit: headers,
    });

    expect(response instanceof NextResponse).toBe(true);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/next-page");
    expect(response.headers.get("X-Redirect-HeadersInit")).toBe("yes");
  });

  it("should return a body response with no headers or headersInit", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.body("no-header-body");

    expect(response instanceof NextResponse).toBe(true);
    expect(response.status).toBe(200); // default
  });

  it("should return a json response with no headers or headersInit", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.json({ message: "no-header" });

    expect(response instanceof NextResponse).toBe(true);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("should return a text response with no headers or headersInit", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.text("no-header-text");

    expect(response instanceof NextResponse).toBe(true);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  it("should return a redirect response with no headers or headersInit", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const response = context.redirect("http://localhost/next-page");

    expect(response instanceof NextResponse).toBe(true);
    expect(response.status).toBe(307); // default redirect status
    expect(response.headers.get("Location")).toBe("http://localhost/next-page");
  });
});

describe("createRouteContext type definitions", () => {
  type MockParams = { id: string };
  type MockQuery = { q: string };

  it("should infer params and query types correctly", async () => {
    const req = new NextRequest("http://localhost/?q=test");

    // Ensure that type inference works correctly by explicitly specifying generics
    const _context = createRouteContext<
      MockParams,
      MockQuery,
      ValidationSchema
    >(req, {
      params: Promise.resolve({ id: "123" }),
    });

    // Validate that the return type of params() is Promise<MockParams>
    type InferredParams = Awaited<ReturnType<typeof _context.req.params>>;
    type ExpectedParams = MockParams;
    expectTypeOf<InferredParams>().toEqualTypeOf<ExpectedParams>();

    // Validate that the return type of query() is MockQuery
    type InferredQuery = ReturnType<typeof _context.req.query>;
    type ExpectedQuery = MockQuery;
    expectTypeOf<InferredQuery>().toEqualTypeOf<ExpectedQuery>();
  });

  it("should infer response types correctly", () => {
    const req = new NextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    // json response
    const _jsonResponse = context.json({ message: "ok" }, { status: 200 });
    type InferredJson = typeof _jsonResponse;
    type ExpectedJson = TypedNextResponse<
      { message: string },
      200,
      "application/json"
    >;
    expectTypeOf<InferredJson>().toEqualTypeOf<ExpectedJson>();

    // text response
    const _textResponse = context.text("hello", { status: 200 });
    type InferredText = typeof _textResponse;
    type ExpectedText = TypedNextResponse<"hello", 200, "text/plain">;
    expectTypeOf<InferredText>().toEqualTypeOf<ExpectedText>();

    // body response
    const _bodyResponse = context.body("raw-body", {
      status: 201,
      headers: {
        "X-Custom-Header": "test-header",
        "Content-Type": "application/custom",
      },
    });
    type InferredBody = typeof _bodyResponse;
    type ExpectedBody = TypedNextResponse<
      "raw-body",
      201,
      "application/custom"
    >;
    expectTypeOf<InferredBody>().toEqualTypeOf<ExpectedBody>();

    // redirect response
    const _redirectResponse = context.redirect(
      "http://localhost/next-page",
      307
    );
    type InferredRedirect = typeof _redirectResponse;
    type ExpectedRedirect = TypedNextResponse<undefined, 307, "">;
    expectTypeOf<InferredRedirect>().toEqualTypeOf<ExpectedRedirect>();
  });

  // eslint-disable-next-line vitest/expect-expect
  it("should cause a type error when both headers and headersInit are provided", () => {
    const req = createRealNextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    const headers = new Headers();
    headers.append("X-Conflict", "true");

    context.body("conflict-body", {
      status: 200,
      headers: {
        "Content-Type": "text/custom",
      },
      // @ts-expect-error both headers and headersInit should not be allowed
      headersInit: headers,
    });

    context.json(
      { a: 1 },
      {
        status: 200,
        headers: {
          "X-Test": "true",
        }, // @ts-expect-error both headers and headersInit should not be allowed
        headersInit: headers,
      }
    );

    context.text("conflict-text", {
      status: 200,
      headers: {
        "X-Test": "true",
      },
      // @ts-expect-error both headers and headersInit should not be allowed
      headersInit: headers,
    });

    context.redirect("http://localhost/", {
      status: 302,
      headers: {
        "X-Test": "true",
      },
      // @ts-expect-error both headers and headersInit should not be allowed
      headersInit: headers,
    });
  });
});

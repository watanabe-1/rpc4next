import { NextResponse, NextRequest } from "next/server";
import { describe, it, expect } from "vitest";
import { createRouteContext } from "./create-route-context";
import { Expect, Equal } from "../../__tests__/types";
import type {
  TypedNextResponse,
  ValidationSchema,
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

    context.req.addValidatedData("body" as ValidationTarget, { name: "John" });
    expect(context.req.valid("body" as ValidationTarget)).toEqual({
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

    const response = context.redirect("http://localhost/next-page", 302);
    expect(response instanceof NextResponse).toBe(true);
    expect(response.headers.get("location")).toBe("http://localhost/next-page");
    expect(response.status).toBe(302);
  });
});

describe("createRouteContext type definitions", () => {
  type MockParams = { id: string };
  type MockQuery = { q: string };

  // eslint-disable-next-line vitest/expect-expect
  it("should infer params and query types correctly", async () => {
    const req = new NextRequest("http://localhost/?q=test");
    // 明示的にジェネリクスを指定することで、型推論が正しく行われることを確認
    const _context = createRouteContext<
      MockParams,
      MockQuery,
      ValidationSchema
    >(req, {
      params: Promise.resolve({ id: "123" }),
    });

    // params(): Promise<MockParams> の戻り値を検証
    type InferredParams = Awaited<ReturnType<typeof _context.req.params>>;
    type ExpectedParams = MockParams;
    type _TestParams = Expect<Equal<InferredParams, ExpectedParams>>;

    // query(): MockQuery の戻り値を検証
    type InferredQuery = ReturnType<typeof _context.req.query>;
    type ExpectedQuery = MockQuery;
    type _TestQuery = Expect<Equal<InferredQuery, ExpectedQuery>>;
  });

  // eslint-disable-next-line vitest/expect-expect
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
    type _TestJson = Expect<Equal<InferredJson, ExpectedJson>>;

    // text response
    const _textResponse = context.text("hello", { status: 200 });
    type InferredText = typeof _textResponse;
    type ExpectedText = TypedNextResponse<"hello", 200, "text/plain">;
    type _TestText = Expect<Equal<InferredText, ExpectedText>>;

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
    type _TestBody = Expect<Equal<InferredBody, ExpectedBody>>;

    // redirect response
    const _redirectResponse = context.redirect(
      "http://localhost/next-page",
      302
    );
    type InferredRedirect = typeof _redirectResponse;
    type ExpectedRedirect = TypedNextResponse<undefined, 302, undefined>;
    type _TestRedirect = Expect<Equal<InferredRedirect, ExpectedRedirect>>;
  });
});

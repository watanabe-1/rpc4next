import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRouteContext } from "./create-route-context";
import { NextResponse, NextRequest } from "next/server";
import type {
  TypedNextResponse,
  ValidationSchema,
  ValidationTarget,
} from "./types";
import { Expect, Equal } from "../../__tests__/types";

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

  it("should infer params and query types correctly", async () => {
    const req = new NextRequest("http://localhost/?q=test");
    // 明示的にジェネリクスを指定することで、型推論が正しく行われることを確認
    const context = createRouteContext<MockParams, MockQuery, ValidationSchema>(
      req,
      {
        params: Promise.resolve({ id: "123" }),
      }
    );

    // params(): Promise<MockParams> の戻り値を検証
    type InferredParams = Awaited<ReturnType<typeof context.req.params>>;
    type ExpectedParams = MockParams;
    type TestParams = Expect<Equal<InferredParams, ExpectedParams>>;

    // query(): MockQuery の戻り値を検証
    type InferredQuery = ReturnType<typeof context.req.query>;
    type ExpectedQuery = MockQuery;
    type TestQuery = Expect<Equal<InferredQuery, ExpectedQuery>>;
  });

  it("should infer response types correctly", () => {
    const req = new NextRequest("http://localhost/");
    const context = createRouteContext(req, { params: Promise.resolve({}) });

    // json response
    const jsonResponse = context.json({ message: "ok" }, { status: 200 });
    type InferredJson = typeof jsonResponse;
    type ExpectedJson = TypedNextResponse<
      { message: string },
      200,
      "application/json"
    >;
    type TestJson = Expect<Equal<InferredJson, ExpectedJson>>;

    // text response
    const textResponse = context.text("hello", { status: 200 });
    type InferredText = typeof textResponse;
    type ExpectedText = TypedNextResponse<"hello", 200, "text/plain">;
    type TestText = Expect<Equal<InferredText, ExpectedText>>;

    // body response
    const bodyResponse = context.body("raw-body", {
      status: 201,
      headers: {
        "X-Custom-Header": "test-header",
        "Content-Type": "application/custom",
      },
    });
    type InferredBody = typeof bodyResponse;
    type ExpectedBody = TypedNextResponse<
      "raw-body",
      201,
      "application/custom"
    >;
    type TestBody = Expect<Equal<InferredBody, ExpectedBody>>;

    // redirect response
    const redirectResponse = context.redirect(
      "http://localhost/next-page",
      302
    );
    type InferredRedirect = typeof redirectResponse;
    type ExpectedRedirect = TypedNextResponse<undefined, 302, undefined>;
    type TestRedirect = Expect<Equal<InferredRedirect, ExpectedRedirect>>;
  });
});

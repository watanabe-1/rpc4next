import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createRpcErrorEnvelope,
  createRpcErrorEnvelopeFromCatalog,
  defineRpcErrors,
  type RpcErrorEnvelope,
  getDefaultRpcErrorStatus,
  getRpcErrorStatus,
} from "./error";

describe("RPC error envelopes", () => {
  it("creates a typed error envelope with a default status", () => {
    const envelope = createRpcErrorEnvelope("UNAUTHORIZED", {
      message: "Sign-in required",
      details: { reason: "missing-session" },
    });

    expect(getDefaultRpcErrorStatus("UNAUTHORIZED")).toBe(401);
    expect(envelope).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Sign-in required",
        details: { reason: "missing-session" },
      },
    });
    expectTypeOf(getDefaultRpcErrorStatus("UNAUTHORIZED")).toEqualTypeOf<401>();
  });

  it("uses default messages when no message is provided", () => {
    expect(createRpcErrorEnvelope("NOT_FOUND")).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Not found",
      },
    });
  });

  it.each([
    ["BAD_REQUEST", 400, "Bad request"],
    ["UNAUTHORIZED", 401, "Unauthorized"],
    ["FORBIDDEN", 403, "Forbidden"],
    ["NOT_FOUND", 404, "Not found"],
    ["CONFLICT", 409, "Conflict"],
    ["UNPROCESSABLE_CONTENT", 422, "Unprocessable content"],
    ["TOO_MANY_REQUESTS", 429, "Too many requests"],
    ["INTERNAL_SERVER_ERROR", 500, "Internal server error"],
  ] as const)("uses the default status and message for %s", (code, status, message) => {
    expect(getDefaultRpcErrorStatus(code)).toBe(status);
    expect(createRpcErrorEnvelope(code).error).toStrictEqual({ code, message });
  });

  it("omits details from default and custom catalog envelopes when unspecified", () => {
    const errors = defineRpcErrors({ CUSTOM: { status: 400, message: "Custom" } });

    expect(Object.hasOwn(createRpcErrorEnvelope("BAD_REQUEST").error, "details")).toBe(false);
    expect(
      Object.hasOwn(createRpcErrorEnvelopeFromCatalog(errors, "CUSTOM").error, "details"),
    ).toBe(false);
  });

  it("preserves envelope type information", () => {
    const envelope = createRpcErrorEnvelope("CONFLICT", {
      details: { resource: "post" },
    });

    type ExpectedEnvelope = RpcErrorEnvelope<
      "CONFLICT",
      {
        resource: string;
      }
    >;

    expectTypeOf(envelope).toEqualTypeOf<ExpectedEnvelope>();
  });

  it("defines project-level error catalogs with custom codes and statuses", () => {
    const errors = defineRpcErrors({
      PLAN_REQUIRED: { status: 402, message: "Plan required" },
    });

    const envelope = createRpcErrorEnvelopeFromCatalog(errors, "PLAN_REQUIRED", {
      details: { plan: "pro" as const },
    });

    expect(getRpcErrorStatus(errors, "PLAN_REQUIRED")).toBe(402);
    expect(envelope).toEqual({
      error: {
        code: "PLAN_REQUIRED",
        message: "Plan required",
        details: { plan: "pro" },
      },
    });
    expectTypeOf(getRpcErrorStatus(errors, "PLAN_REQUIRED")).toEqualTypeOf<402>();
    expectTypeOf(envelope).toEqualTypeOf<RpcErrorEnvelope<"PLAN_REQUIRED", { plan: "pro" }>>();
  });

  it("lets project-level error catalogs override default codes", () => {
    const errors = defineRpcErrors({
      FORBIDDEN: { status: 451, message: "Unavailable for legal reasons" },
    });

    const envelope = createRpcErrorEnvelopeFromCatalog(errors, "FORBIDDEN");

    expect(getRpcErrorStatus(errors, "FORBIDDEN")).toBe(451);
    expect(envelope).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Unavailable for legal reasons",
      },
    });
    expectTypeOf(getRpcErrorStatus(errors, "FORBIDDEN")).toEqualTypeOf<451>();
    expectTypeOf(envelope).toEqualTypeOf<RpcErrorEnvelope<"FORBIDDEN", unknown>>();
  });

  it("rejects non-error HTTP statuses in project-level error catalogs", () => {
    defineRpcErrors({
      // @ts-expect-error RPC error catalogs only accept 4xx and 5xx statuses
      NOT_AN_ERROR: { status: 200, message: "OK" },
    });

    defineRpcErrors({
      // @ts-expect-error RPC error catalogs only accept 4xx and 5xx statuses
      REDIRECT: { status: 302, message: "Found" },
    });

    expect(true).toBe(true);
  });
});

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
});

import { describe, expect, expectTypeOf, it } from "vitest";

import { createRpcErrorEnvelope, type RpcErrorEnvelope, getDefaultRpcErrorStatus } from "./error";

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
});

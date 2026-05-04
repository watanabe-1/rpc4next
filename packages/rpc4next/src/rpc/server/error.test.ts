import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createRpcErrorEnvelope,
  isRpcError,
  RpcError,
  type RpcErrorEnvelope,
  rpcError,
} from "./error";

describe("rpcError", () => {
  it("creates a typed RpcError with default status and envelope", () => {
    const error = rpcError("UNAUTHORIZED", {
      message: "Sign-in required",
      details: { reason: "missing-session" },
    });

    expect(error).toBeInstanceOf(RpcError);
    expect(error.status).toBe(401);
    expect(error.toJSON()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Sign-in required",
        details: { reason: "missing-session" },
      },
    });
    expect(isRpcError(error)).toBe(true);
    expectTypeOf(error.status).toEqualTypeOf<401>();
  });

  it("creates envelopes from RpcError-like input", () => {
    expect(
      createRpcErrorEnvelope({
        code: "NOT_FOUND",
        message: "Missing route",
      }),
    ).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Missing route",
      },
    });
  });

  it("preserves the helper's type information", () => {
    const error = rpcError("CONFLICT", {
      details: { resource: "post" },
    });

    type ExpectedEnvelope = RpcErrorEnvelope<
      "CONFLICT",
      {
        resource: string;
      }
    >;

    expectTypeOf(error.toJSON()).toEqualTypeOf<ExpectedEnvelope>();
  });

  it("rejects status overrides that do not match the error code", () => {
    // @ts-expect-error FORBIDDEN must remain aligned with HTTP 403
    rpcError("FORBIDDEN", { status: 418 });

    expect(true).toBe(true);
  });
});

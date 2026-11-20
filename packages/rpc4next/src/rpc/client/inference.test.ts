import { describe, expectTypeOf, it } from "vitest";

import type { TypedNextResponse } from "../server";
import type {
  ErrorResponseCode,
  ErrorResponsePayload,
  SuccessfulJsonPayload,
  SuccessfulResponsePayload,
} from "./inference";

describe("response payload types", () => {
  it("infers success and error payloads from response unions", () => {
    type Responses =
      | TypedNextResponse<{ ok: true; value: string }, 200, "application/json">
      | TypedNextResponse<
          { error: { code: "NOT_FOUND"; message: string } },
          404,
          "application/json"
        >;
    expectTypeOf<SuccessfulResponsePayload<Responses>>().toEqualTypeOf<{
      ok: true;
      value: string;
    }>();
    expectTypeOf<SuccessfulJsonPayload<Responses>>().toEqualTypeOf<{ ok: true; value: string }>();
    expectTypeOf<ErrorResponsePayload<Responses>>().toEqualTypeOf<{
      error: { code: "NOT_FOUND"; message: string };
    }>();
    expectTypeOf<ErrorResponseCode<Responses>>().toEqualTypeOf<"NOT_FOUND">();
  });

  it("infers payload types for non-JSON and bodyless responses", () => {
    expectTypeOf<
      SuccessfulResponsePayload<TypedNextResponse<"accepted", 200, "text/plain">>
    >().toEqualTypeOf<"accepted">();
    expectTypeOf<
      SuccessfulResponsePayload<TypedNextResponse<string, 200, "image/svg+xml">>
    >().toEqualTypeOf<Blob>();
    expectTypeOf<
      SuccessfulResponsePayload<TypedNextResponse<unknown, 204, "application/json">>
    >().toEqualTypeOf<undefined>();
  });
});

import { describe, expect, expectTypeOf, it } from "vitest";

import type { ProcedureValidationErrorContext } from "./procedure-types";
import { createResponseHelpers } from "./route-context";
import type { StandardSchemaV1Issue } from "./standard-schema";
import {
  createRpcValidationErrorHandler,
  type RpcValidationErrorResponse,
} from "./validation-error";

describe("RPC validation error handler", () => {
  it("creates the recommended BAD_REQUEST validation error shape", async () => {
    const handler = createRpcValidationErrorHandler<"query">();
    const response = await handler({
      kind: "validation",
      target: "query",
      value: { page: "invalid" },
      issues: [
        {
          message: "Expected number",
          path: [{ key: "page" }],
        },
      ],
      request: new Request("http://localhost") as never,
      response: createResponseHelpers(),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Expected number",
        details: {
          target: "query",
          issues: [
            {
              message: "Expected number",
              path: ["page"],
            },
          ],
        },
      },
    });
    expectTypeOf(response).toExtend<RpcValidationErrorResponse<"query">>();
  });

  it.each(["json", "formData"] as const)(
    "returns sanitized BAD_REQUEST details for a %s parse failure",
    async (target) => {
      const handler = createRpcValidationErrorHandler();
      const response = await handler({
        kind: "parse",
        target,
        request: new Request("http://localhost") as never,
        response: createResponseHelpers(),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "BAD_REQUEST",
          message: "Validation failed.",
          details: { target, issues: [] },
        },
      });
    },
  );

  it("narrows validation contexts by kind and excludes parse failures for query", () => {
    type Context = ProcedureValidationErrorContext<"query" | "json", { title: string }>;
    type QueryContext = ProcedureValidationErrorContext<"query">;
    expectTypeOf<Extract<QueryContext, { kind: "parse" }>>().toEqualTypeOf<never>();

    const checkContext = (context: Context) => {
      if (context.kind === "parse") {
        expectTypeOf(context.target).toEqualTypeOf<"json">();
        expectTypeOf(context.value).toEqualTypeOf<undefined>();
        expectTypeOf(context.issues).toEqualTypeOf<undefined>();
      } else {
        expectTypeOf(context.target).toEqualTypeOf<"query" | "json">();
        expectTypeOf(context.value).toEqualTypeOf<{ title: string }>();
        expectTypeOf(context.issues).toEqualTypeOf<readonly StandardSchemaV1Issue[]>();
      }
    };

    const common = {
      request: new Request("http://localhost") as never,
      response: createResponseHelpers(),
    };
    checkContext({ ...common, kind: "parse", target: "json" });
    checkContext({
      ...common,
      kind: "validation",
      target: "query",
      value: { title: "x" },
      issues: [],
    });
  });

  it.each([
    {
      issues: [{ message: "Invalid input" }],
      message: "Invalid input",
      expectedIssues: [{ message: "Invalid input", path: [] }],
    },
    { issues: [], message: "Validation failed.", expectedIssues: [] },
  ])(
    "handles missing issue paths and empty issue lists",
    async ({ issues, message, expectedIssues }) => {
      const handler = createRpcValidationErrorHandler<"query">();
      const response = await handler({
        kind: "validation",
        target: "query",
        value: {},
        issues,
        request: new Request("http://localhost") as never,
        response: createResponseHelpers(),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "BAD_REQUEST",
          message,
          details: { target: "query", issues: expectedIssues },
        },
      });
    },
  );
});

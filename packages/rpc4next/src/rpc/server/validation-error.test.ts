import { describe, expect, expectTypeOf, it } from "vitest";

import { createResponseHelpers } from "./route-context";
import {
  createRpcValidationErrorHandler,
  type RpcValidationErrorResponse,
} from "./validation-error";

describe("RPC validation error handler", () => {
  it("creates the recommended BAD_REQUEST validation error shape", async () => {
    const handler = createRpcValidationErrorHandler<"query">();
    const response = await handler({
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

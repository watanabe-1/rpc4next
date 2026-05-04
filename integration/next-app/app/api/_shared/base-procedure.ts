import { defineProcedureMiddleware, procedure, rpcError } from "rpc4next/server";
import type { ProcedureMiddleware, ProcedureMiddlewareContext } from "rpc4next/server";
import { z } from "zod";

export const guardedProcedureHeadersSchema = z.object({
  "x-demo-user": z.string().min(1).optional(),
  "x-demo-role": z.enum(["reader", "editor", "suspended"]).optional(),
});

const guardedProcedureMiddleware = defineProcedureMiddleware<
  ProcedureMiddleware<
    {
      input: {
        headers: z.input<typeof guardedProcedureHeadersSchema>;
      };
      output: {
        headers: z.output<typeof guardedProcedureHeadersSchema>;
      };
    },
    Record<string, string | string[] | undefined>,
    Record<never, never>,
    {
      viewer: {
        id: string;
        role: "reader" | "editor";
      };
      requestId: string;
    }
  >
>(
  async ({
    headers,
  }: ProcedureMiddlewareContext<{
    input: {
      headers: z.input<typeof guardedProcedureHeadersSchema>;
    };
    output: {
      headers: z.output<typeof guardedProcedureHeadersSchema>;
    };
  }>) => {
    const viewerId = headers["x-demo-user"];

    if (!viewerId) {
      throw rpcError("UNAUTHORIZED", {
        message: "Demo user header required.",
        details: { reason: "missing_demo_user" },
      });
    }

    const role = headers["x-demo-role"] ?? "reader";

    if (role === "suspended") {
      throw rpcError("FORBIDDEN", {
        message: "Suspended demo users cannot access guarded procedures.",
        details: { reason: "suspended_account" },
      });
    }

    return {
      ctx: {
        viewer: {
          id: viewerId,
          role,
        },
        requestId: `guarded:${viewerId}`,
      },
    };
  },
);

export const guardedBaseProcedure = procedure
  .headers(guardedProcedureHeadersSchema)
  .meta({
    summary:
      "Shared guardedProcedure preset with descriptive annotations for the integration fixture",
    tags: ["procedure-examples", "shared-base-procedure", "shared-errors"],
  })
  .use(guardedProcedureMiddleware);

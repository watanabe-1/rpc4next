import { procedure } from "rpc4next/server";
import { z } from "zod";

export const guardedProcedureHeadersSchema = z.object({
  "x-demo-role": z.enum(["reader", "editor"]).optional(),
});

export const guardedBaseProcedure = procedure
  .headers(guardedProcedureHeadersSchema)
  .meta({
    summary:
      "Shared baseProcedure preset for guarded procedure examples in the integration fixture",
    tags: ["procedure-examples", "shared-base-procedure"],
    auth: "optional",
    idempotent: true,
  })
  .use(async ({ headers }) => {
    const role = headers["x-demo-role"] ?? "reader";

    return {
      ctx: {
        viewer: {
          role,
        },
        requestId: `guarded:${headers["x-demo-role"] ?? "anonymous"}`,
      },
    };
  });

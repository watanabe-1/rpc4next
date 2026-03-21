import { nextRoute, procedure } from "rpc4next/server";
import { z } from "zod";
import { routeContract } from "./route-contract";

const getProcedureValidationBranch = procedure
  .forRoute(routeContract)
  .query(
    z.object({
      page: z.coerce.number().int().positive(),
    }),
    {
      onValidationError: ({ target, value, issues, routeContext }) =>
        routeContext.json(
          {
            ok: false as const,
            source: "procedure-validation-branch" as const,
            target,
            issueCount: issues.length,
            receivedPage:
              typeof value === "object" &&
              value !== null &&
              "page" in value &&
              typeof value.page === "string"
                ? value.page
                : undefined,
          },
          { status: 422 },
        ),
    },
  )
  .output(
    z.object({
      ok: true as const,
      source: "procedure-validation-branch" as const,
      page: z.number().int().positive(),
    }),
  )
  .handle(async ({ query, response }) =>
    response.json({
      ok: true as const,
      source: "procedure-validation-branch" as const,
      page: query.page,
    }),
  );

export const GET = nextRoute(getProcedureValidationBranch, {
  method: "GET",
});

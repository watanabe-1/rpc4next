import { NextResponse } from "next/server";
import { procedure } from "rpc4next/server";
import { z } from "zod";

import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

export const GET = procedure
  .forRoute(routeContract)
  .query(
    z.object({
      page: z.coerce.number().int().positive(),
    }),
    {
      onValidationError: ({ target, value, issues }) =>
        NextResponse.json(
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
      ok: z.literal(true),
      source: z.literal("procedure-validation-branch"),
      page: z.number().int().positive(),
    }),
  )
  .handle(async ({ query, response }) =>
    response.json({
      ok: true as const,
      source: "procedure-validation-branch" as const,
      page: query.page,
    }),
  )
  .nextRoute({
    method: "GET",
    onError,
  });

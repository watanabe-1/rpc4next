import { nextRoute, procedure } from "rpc4next/server";
import { z } from "zod";

const submitProcedure = procedure
  .headers(
    z.object({
      "x-procedure-test": z.string().min(1),
    }),
  )
  .cookies(
    z.object({
      session: z.string().min(1),
    }),
  )
  .json(
    z.object({
      title: z.string().min(1),
    }),
  )
  .output({
    _output: {
      ok: true as const,
      title: "" as string,
      header: "" as string,
      session: "" as string,
      source: "procedure-submit" as const,
    },
  })
  .handle(async ({ json, headers, cookies }) => ({
    status: 201,
    body: {
      ok: true,
      title: json.title,
      header: headers["x-procedure-test"],
      session: cookies.session,
      source: "procedure-submit",
    },
  }));

export const POST = nextRoute(submitProcedure, { method: "POST" });

import { notFound, permanentRedirect, redirect } from "next/navigation";

import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .use(async ({ request }) => {
    if (request.nextUrl.searchParams.get("mode") === "middleware-redirect") redirect("/login");
  })
  .handle(async ({ request }) => {
    switch (request.nextUrl.searchParams.get("mode")) {
      case "redirect":
        redirect("/login");
      case "permanent-redirect":
        permanentRedirect("/login");
      case "not-found":
        notFound();
    }
    throw new Error("expected integration failure");
  })
  .get({
    onError: (error) => {
      const message = error instanceof Error ? error.message : "unknown integration error";

      return new Response(`handled:${message}`, {
        status: 500,
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
      });
    },
  });

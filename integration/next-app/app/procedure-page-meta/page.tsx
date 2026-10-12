import { z } from "zod";

import { appPageProcedure } from "../_rpc/page-procedure";
import { routeContract } from "./route-contract";

const pageMetaHeadersSchema = z.object({
  "x-page-test-user": z.string().min(1),
});

const pageMetaCookiesSchema = z.object({
  session: z.string().min(1),
});

const pageMetaQuerySchema = z.object({
  tab: z.enum(["info", "comments"]),
});

const pageMetaOutputSchema = z.object({
  session: z.string(),
  tab: z.enum(["info", "comments"]),
  user: z.string(),
});

export default appPageProcedure
  .forRoute(routeContract)
  .query(pageMetaQuerySchema)
  .headers(pageMetaHeadersSchema)
  .cookies(pageMetaCookiesSchema)
  .output(pageMetaOutputSchema)
  .handle(({ cookies, headers, query }) => ({
    body: {
      session: cookies.session,
      tab: query.tab,
      user: headers["x-page-test-user"],
    },
  }))
  .page(({ data }) => <div>{`page-meta:${data.user}:${data.session}:${data.tab}`}</div>);

import { routeHandlerFactory } from "rpc4next/server";
import { zValidator } from "rpc4next/server/validators/zod";
import { z } from "zod";

const createRouteHandler = routeHandlerFactory();

const headersSchema = z.object({
  "x-integration-test": z.string().min(1),
});

const cookiesSchema = z.object({
  session: z.string().min(1),
});

export const { GET } = createRouteHandler().get(
  zValidator("headers", headersSchema),
  zValidator("cookies", cookiesSchema),
  async (rc) => {
    const headers = rc.req.valid("headers");
    const cookies = rc.req.valid("cookies");

    return rc.json({
      header: headers["x-integration-test"],
      session: cookies.session,
    });
  },
);

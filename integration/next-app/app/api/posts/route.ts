import { routeHandlerFactory } from "rpc4next/server";
import { zValidator } from "rpc4next/server/validators/zod";
import { z } from "zod";

const createRouteHandler = routeHandlerFactory();

const bodySchema = z.object({
  title: z.string().min(1),
});

export const { POST } = createRouteHandler().post(
  zValidator("json", bodySchema),
  async (rc) => {
    const body = rc.req.valid("json");

    return rc.json(
      {
        ok: true,
        title: body.title,
      },
      201,
    );
  },
);

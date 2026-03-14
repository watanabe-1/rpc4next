import { routeHandlerFactory } from "rpc4next/server";

const createRouteHandler = routeHandlerFactory();

export const { GET } = createRouteHandler().get(async (rc) => {
  return rc.redirect("http://127.0.0.1:3000/feed", 307);
});

import { routeHandlerFactory } from "rpc4next/server";

const createRouteHandler = routeHandlerFactory((error, rc) => {
  const message =
    error instanceof Error ? error.message : "unknown integration error";

  return rc.text(`handled:${message}`, { status: 500 });
});

export const { GET } = createRouteHandler().get(async () => {
  throw new Error("expected integration failure");
});

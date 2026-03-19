import { routeHandlerFactory, type TypedNextResponse } from "rpc4next/server";

const createRouteHandler = routeHandlerFactory();

export const { GET } = createRouteHandler()
  .meta({
    tags: ["contract-route"],
    auth: "optional",
  })
  .output({
    _output: {
      ok: true as const,
      source: "contract-route" as const,
    },
  })
  .get(
    async (
      rc,
    ): Promise<
      TypedNextResponse<
        {
          ok: boolean;
          source: string;
        },
        200,
        "application/json"
      >
    > =>
      rc.json({
        ok: true,
        source: "contract-route",
      }),
  );

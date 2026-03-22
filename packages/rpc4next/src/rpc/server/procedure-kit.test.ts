import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createProcedureKit } from "./procedure-kit";
import type { ProcedureRouteContract } from "./procedure-types";
import type { TypedNextResponse } from "./types";

describe("createProcedureKit", () => {
  type EmptyParams = Record<never, never>;

  const staticRouteContract = {
    pathname: "/api/test",
    params: {} as EmptyParams,
  } as ProcedureRouteContract<"/api/test", EmptyParams>;

  it("applies the project-level errorFormatter to nextRoute", async () => {
    const procedureKit = createProcedureKit({
      errorFormatter: (error, response) => {
        if (!(error instanceof Error)) {
          return undefined;
        }

        return response.json(
          {
            success: false,
            error: {
              message: error.message,
            },
          },
          { status: 500 },
        );
      },
    });
    const route = procedureKit.nextRoute(
      procedureKit.procedure.forRoute(staticRouteContract).handle(async () => {
        throw new Error("project formatter");
      }),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        message: "project formatter",
      },
    });
  });

  it("preserves explicit procedure error contracts in kit-backed route types", () => {
    const procedureKit = createProcedureKit();
    const route = procedureKit.nextRoute(
      procedureKit.procedure
        .forRoute(staticRouteContract)
        .error<"FORBIDDEN", { reason: string }>("FORBIDDEN")
        .handle(async () => ({
          status: 204 as const,
        })),
    );

    type ActualResponse = Awaited<ReturnType<typeof route>>;
    type ExpectedResponse =
      | TypedNextResponse<
          undefined,
          204,
          import("../lib/content-type-types").ContentType
        >
      | TypedNextResponse<
          {
            error: {
              code: "FORBIDDEN";
              message: string;
              details?: { reason: string };
            };
          },
          403,
          "application/json"
        >;
    const _fromActual: ExpectedResponse = {} as ActualResponse;
    const _fromExpected: ActualResponse = {} as ExpectedResponse;

    void _fromActual;
    void _fromExpected;
    expect(true).toBe(true);
  });

  it("uses the kit errorRegistry to resolve rpcError status before formatting", async () => {
    const procedureKit = createProcedureKit({
      errorRegistry: {
        FORBIDDEN: { status: 451 },
      },
      errorFormatter: (error, response) => {
        if (!(error instanceof Error)) {
          return undefined;
        }

        return response.json(
          {
            success: false,
            message: error.message,
          },
          {
            status:
              "status" in error && typeof error.status === "number"
                ? error.status
                : 500,
          },
        );
      },
    });
    const route = procedureKit.nextRoute(
      procedureKit.procedure.forRoute(staticRouteContract).handle(async () => {
        throw procedureKit.rpcError("FORBIDDEN", {
          message: "project registry override",
        });
      }),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(451);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "project registry override",
    });
  });
});

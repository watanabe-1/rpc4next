import { NextRequest } from "next/server";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defaultProcedureOnError } from "./on-error";
import { procedure } from "./procedure";
import { createProcedureKit } from "./procedure-kit";
import type { ProcedureRouteContract } from "./procedure-types";

describe("createProcedureKit", () => {
  type EmptyParams = Record<never, never>;

  const staticRouteContract = {
    pathname: "/api/test",
    params: {} as EmptyParams,
  } as ProcedureRouteContract<"/api/test", EmptyParams>;

  it("applies the project-level onError to nextRoute", async () => {
    const procedureKit = createProcedureKit({
      onError: (error, { response }) =>
        response.json(
          {
            success: false,
            error: {
              message: error instanceof Error ? error.message : "unknown error",
            },
          },
          { status: 500 },
        ),
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

  it("keeps kit-backed route types focused on handler results", () => {
    const procedureKit = createProcedureKit({
      onError: defaultProcedureOnError,
    });
    const route = procedureKit.nextRoute(
      procedureKit.procedure.forRoute(staticRouteContract).handle(async () => ({
        status: 204 as const,
      })),
    );

    type ActualResponse = Awaited<ReturnType<typeof route>>;
    expectTypeOf<ActualResponse>().toExtend<Response>();
  });

  it("keeps rpcError available while the kit onError decides serialization", async () => {
    const procedureKit = createProcedureKit({
      onError: (error, { response }) =>
        response.json(
          {
            success: false,
            message: error instanceof Error ? error.message : "unknown error",
          },
          {
            status:
              error instanceof Error &&
              "status" in error &&
              typeof error.status === "number"
                ? error.status
                : 500,
          },
        ),
    });
    const route = procedureKit.nextRoute(
      procedureKit.procedure.forRoute(staticRouteContract).handle(async () => {
        throw procedureKit.rpcError("FORBIDDEN", {
          message: "project onError override",
        });
      }),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "project onError override",
    });
  });

  it("lets procedureKit.procedure.handle(...).nextRoute(...) compose naturally", async () => {
    const procedureKit = createProcedureKit({
      onError: defaultProcedureOnError,
    });
    const route = procedureKit.procedure
      .forRoute(staticRouteContract)
      .handle(async ({ response }) => response.text("kit-sugar"))
      .nextRoute({
        method: "GET",
      });

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("kit-sugar");
  });

  it("applies the shared onError to procedure.nextRoute sugar", async () => {
    const procedureKit = createProcedureKit({
      onError: (error, { response }) =>
        response.json(
          {
            source: "kit-shared-onError",
            message: error instanceof Error ? error.message : "unknown error",
          },
          { status: 418 },
        ),
    });
    const route = procedureKit.procedure
      .forRoute(staticRouteContract)
      .handle(async () => {
        throw new Error("sugar formatter");
      })
      .nextRoute({
        method: "GET",
      });

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(418);
    await expect(response.json()).resolves.toEqual({
      source: "kit-shared-onError",
      message: "sugar formatter",
    });
  });

  it("shares the same defaults mechanism as procedure.defaults({ onError })", async () => {
    const route = procedure
      .defaults({
        onError: (error, { response }) =>
          response.json(
            {
              source: "procedure-defaults",
              message: error instanceof Error ? error.message : "unknown error",
            },
            { status: 409 },
          ),
      })
      .forRoute(staticRouteContract)
      .handle(async () => {
        throw new Error("preset formatter");
      })
      .nextRoute({
        method: "GET",
      });

    const response = await route(new NextRequest("http://127.0.0.1:3000/api"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      source: "procedure-defaults",
      message: "preset formatter",
    });
  });
});

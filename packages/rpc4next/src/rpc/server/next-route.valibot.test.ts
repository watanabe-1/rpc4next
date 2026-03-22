import { NextRequest } from "next/server";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { nextRoute } from "./next-route";
import { procedure } from "./procedure";
import type { ProcedureRouteContract } from "./procedure-types";

describe("nextRoute valibot integration", () => {
  type EmptyParams = Record<never, never>;

  const staticRouteContract = {
    pathname: "/api/test",
    params: {} as EmptyParams,
  } as ProcedureRouteContract<"/api/test", EmptyParams>;

  it("normalizes json, headers, and cookies for valibot contracts", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .json(
          v.object({
            title: v.string(),
          }),
        )
        .headers(
          v.object({
            "x-request-id": v.string(),
          }),
        )
        .cookies(
          v.object({
            session: v.string(),
          }),
        )
        .handle(async ({ json, headers, cookies }) => ({
          body: {
            title: json.title,
            requestId: headers["x-request-id"],
            session: cookies.session,
          },
        })),
      { method: "POST" },
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test", {
        method: "POST",
        body: JSON.stringify({ title: "valibot-json" }),
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-valibot",
          cookie: "session=cookie-valibot",
        },
      }),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      title: "valibot-json",
      requestId: "req-valibot",
      session: "cookie-valibot",
    });
  });

  it("normalizes multipart form-data for valibot contracts", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .formData(
          v.object({
            displayName: v.string(),
            avatar: v.file(),
            tags: v.optional(v.array(v.string())),
          }),
        )
        .handle(async ({ formData }) => ({
          body: {
            displayName: formData.displayName,
            avatarName: formData.avatar.name,
            tags: formData.tags ?? [],
          },
        })),
      { method: "POST" },
    );

    const payload = new FormData();
    payload.set("displayName", "valibot-user");
    payload.set(
      "avatar",
      new File(["avatar"], "avatar.png", { type: "image/png" }),
    );
    payload.append("tags", "alpha");
    payload.append("tags", "beta");

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test", {
        method: "POST",
        body: payload,
      }),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      displayName: "valibot-user",
      avatarName: "avatar.png",
      tags: ["alpha", "beta"],
    });
  });

  it("normalizes invalid valibot runtime output as INTERNAL_SERVER_ERROR", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(
          v.object({
            ok: v.literal(true),
            count: v.pipe(v.number(), v.minValue(0)),
          }),
        )
        .handle(async () => ({
          body: {
            ok: true,
            count: -1,
          },
        })),
      { method: "GET", validateOutput: true },
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Procedure output validation failed.",
        details: expect.any(Array),
      },
    });
  });

  it("supports validator-stage customization on shared valibot baseProcedure presets", async () => {
    const baseProcedure = procedure.forRoute(staticRouteContract).query(
      v.object({
        page: v.string(),
      }),
      {
        onValidationError: ({ response, target }) =>
          response.json(
            {
              source: "valibot-base",
              target,
            },
            { status: 409 },
          ),
      },
    );

    const route = nextRoute(
      baseProcedure.handle(async ({ query }) => ({
        body: {
          page: query.page,
        },
      })),
    );

    const response = await route(
      new NextRequest("http://127.0.0.1:3000/api/test"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      source: "valibot-base",
      target: "query",
    });
  });
});

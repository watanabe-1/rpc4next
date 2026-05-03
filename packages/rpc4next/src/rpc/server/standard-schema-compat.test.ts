import { NextRequest } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import { describe, expect, expectTypeOf, it } from "vitest";

import { nextRoute as baseNextRoute } from "./next-route";
import { defaultProcedureOnError } from "./on-error";
import { procedure } from "./procedure";
import type { ProcedureRouteContract } from "./procedure-types";
import type { StandardSchemaV1 } from "./standard-schema";
import type { TypedNextResponse } from "./types";

const nextRoute = <
  TProcedure,
  TMethod extends HttpMethod | undefined = undefined,
  TValidateOutput extends boolean = false,
>(
  procedureDefinition: TProcedure,
  options?: {
    method?: Exclude<TMethod, undefined>;
    validateOutput?: TValidateOutput;
    onError?: unknown;
  },
) => {
  const resolvedOptions =
    options && "onError" in options ? options : { ...options, onError: defaultProcedureOnError };

  return baseNextRoute<TProcedure & Parameters<typeof baseNextRoute>[0], TMethod, TValidateOutput>(
    procedureDefinition as never,
    resolvedOptions as never,
  );
};

describe("Standard Schema compatibility", () => {
  type EmptyParams = Record<never, never>;

  const staticRouteContract = {
    pathname: "/api/test",
    params: {} as EmptyParams,
  } as ProcedureRouteContract<"/api/test", EmptyParams>;

  const positivePageQuerySchema: StandardSchemaV1<{ page?: string | string[] }, { page: number }> =
    {
      "~standard": {
        version: 1,
        vendor: "rpc4next-test",
        types: {
          input: {} as { page?: string | string[] },
          output: {} as { page: number },
        },
        validate: (value) => {
          const input =
            typeof value === "object" && value !== null
              ? (value as { page?: string | string[] })
              : {};
          const page = "page" in input ? input.page : "";
          const first = Array.isArray(page) ? page[0] : page;
          const parsed = Number(first ?? "1");

          if (!Number.isInteger(parsed) || parsed < 1) {
            return {
              issues: [{ message: "page must be a positive integer" }],
            };
          }

          return {
            value: { page: parsed },
          };
        },
      },
    };

  const uploadFormDataSchema: StandardSchemaV1<
    {
      displayName?: FormDataEntryValue | FormDataEntryValue[];
      avatar?: FormDataEntryValue | FormDataEntryValue[];
      tags?: FormDataEntryValue | FormDataEntryValue[];
    },
    {
      displayName: string;
      avatar: File;
      tags?: string[] | undefined;
    }
  > = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as {
          displayName?: FormDataEntryValue | FormDataEntryValue[];
          avatar?: FormDataEntryValue | FormDataEntryValue[];
          tags?: FormDataEntryValue | FormDataEntryValue[];
        },
        output: {} as {
          displayName: string;
          avatar: File;
          tags?: string[] | undefined;
        },
      },
      validate: (value) => {
        const input =
          typeof value === "object" && value !== null
            ? (value as {
                displayName?: FormDataEntryValue | FormDataEntryValue[];
                avatar?: FormDataEntryValue | FormDataEntryValue[];
                tags?: FormDataEntryValue | FormDataEntryValue[];
              })
            : {};
        const displayName = input.displayName;
        const avatar = input.avatar;
        const tags = input.tags;

        const normalizedDisplayName = Array.isArray(displayName) ? displayName[0] : displayName;
        const normalizedAvatar = Array.isArray(avatar) ? avatar[0] : avatar;
        const normalizedTags = Array.isArray(tags) ? tags : tags === undefined ? undefined : [tags];

        if (typeof normalizedDisplayName !== "string" || normalizedDisplayName.length < 1) {
          return {
            issues: [{ message: "displayName is required" }],
          };
        }

        if (!(normalizedAvatar instanceof File)) {
          return {
            issues: [{ message: "avatar file is required" }],
          };
        }

        return {
          value: {
            displayName: normalizedDisplayName,
            avatar: normalizedAvatar,
            tags:
              normalizedTags?.map((tag) => (typeof tag === "string" ? tag : String(tag))) ??
              undefined,
          },
        };
      },
    },
  };

  const procedureOutputSchema: StandardSchemaV1<
    unknown,
    {
      ok: true;
      page: number;
      source: "standard-schema";
    }
  > = {
    "~standard": {
      version: 1,
      vendor: "rpc4next-test",
      types: {
        input: {} as unknown,
        output: {} as {
          ok: true;
          page: number;
          source: "standard-schema";
        },
      },
      validate: (value) => {
        if (
          typeof value !== "object" ||
          value === null ||
          !("ok" in value) ||
          !("page" in value) ||
          !("source" in value) ||
          value.ok !== true ||
          typeof value.page !== "number" ||
          !Number.isInteger(value.page) ||
          value.page < 1 ||
          value.source !== "standard-schema"
        ) {
          return {
            issues: [{ message: "invalid response payload" }],
          };
        }

        return {
          value: value as {
            ok: true;
            page: number;
            source: "standard-schema";
          },
        };
      },
    },
  };

  it("infers procedure input types from Standard Schema V1", () => {
    const pageProcedure = procedure.query(positivePageQuerySchema).handle(({ query }) => {
      const _query: { page: number } = query;

      void _query;

      return {
        status: 200 as const,
      };
    });

    expectTypeOf(pageProcedure.handler).parameters.toExtend<
      [
        {
          query: {
            page: number;
          };
        },
      ]
    >();
  });

  it("runs validator-stage customization with Standard Schema issues", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .query(positivePageQuerySchema, {
          onValidationError: ({ response, target, issues, value }) =>
            response.json(
              {
                source: "validator",
                target,
                issueCount: issues.length,
                receivedPage:
                  typeof value === "object" && value !== null && "page" in value
                    ? value.page
                    : undefined,
              },
              { status: 422 },
            ),
        })
        .handle(async ({ query }) => ({
          body: query,
        })),
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test?page=0"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      source: "validator",
      target: "query",
      issueCount: 1,
      receivedPage: "0",
    });
  });

  it("validates normalized form-data with Standard Schema V1", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .formData(uploadFormDataSchema)
        .handle(async ({ formData }) => ({
          body: {
            displayName: formData.displayName,
            filename: formData.avatar.name,
            tags: formData.tags ?? [],
          },
        })),
      { method: "POST" },
    );

    const payload = new FormData();
    payload.set("displayName", "demo-user");
    payload.set("avatar", new File(["avatar"], "avatar.png", { type: "image/png" }));
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
      displayName: "demo-user",
      filename: "avatar.png",
      tags: ["alpha", "beta"],
    });
  });

  it("types response helpers from Standard Schema output contracts", () => {
    procedure.output(procedureOutputSchema).handle(({ response }) => {
      const jsonResponse = response.json({
        ok: true,
        page: 1,
        source: "standard-schema",
      });

      expectTypeOf(jsonResponse).toEqualTypeOf<
        TypedNextResponse<
          {
            ok: true;
            page: number;
            source: "standard-schema";
          },
          200,
          "application/json"
        >
      >();

      response.json({
        ok: true,
        // @ts-expect-error response.json should follow the Standard Schema output contract
        page: "1",
        source: "standard-schema",
      });

      response.json({
        ok: true,
        page: 1,
        // @ts-expect-error source should remain the output literal from the Standard Schema contract
        source: "other",
      });

      return jsonResponse;
    });

    expect(true).toBe(true);
  });

  it("validates runtime output with Standard Schema V1", async () => {
    const route = nextRoute(
      procedure
        .forRoute(staticRouteContract)
        .output(procedureOutputSchema)
        .handle(async () => ({
          body: {
            ok: true,
            page: 2,
            source: "standard-schema",
          },
        })),
      { method: "GET", validateOutput: true },
    );

    const response = await route(new NextRequest("http://127.0.0.1:3000/api/test"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      page: 2,
      source: "standard-schema",
    });
  });
});

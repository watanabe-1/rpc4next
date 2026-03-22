import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { output, withOutput } from "./output";
import { getProcedureDefinition } from "./procedure-types";
import type { StandardSchemaV1 } from "./standard-schema";

describe("output contract helpers", () => {
  it("attaches explicit output contract metadata to a handler", async () => {
    const GET = withOutput(
      output({
        _output: {
          ok: true as const,
          mode: "explicit" as const,
        },
      }),
      async (_request: NextRequest) => {
        return NextResponse.json({
          ok: true,
          mode: "explicit",
        });
      },
    );

    const response = await GET(new NextRequest("http://localhost"));

    expect(await response.json()).toEqual({
      ok: true,
      mode: "explicit",
    });
    expect(getProcedureDefinition(GET)).toMatchObject({
      output: {
        schema: {
          _output: {
            ok: true,
            mode: "explicit",
          },
        },
      },
    });
  });

  it("infers output contract types from Standard Schema V1", async () => {
    const responseSchema: StandardSchemaV1<
      unknown,
      { ok: true; mode: "standard" }
    > = {
      "~standard": {
        version: 1,
        vendor: "rpc4next-test",
        validate: (value) => ({
          value: value as { ok: true; mode: "standard" },
        }),
      },
    };

    const GET = withOutput(
      output(responseSchema),
      async (_request: NextRequest) => {
        return NextResponse.json({
          ok: true,
          mode: "standard",
        });
      },
    );

    const response = await GET(new NextRequest("http://localhost"));

    expect(await response.json()).toEqual({
      ok: true,
      mode: "standard",
    });
    expect(getProcedureDefinition(GET)).toMatchObject({
      output: {
        schema: responseSchema,
      },
    });
  });
});

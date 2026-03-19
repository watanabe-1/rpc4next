import { NextResponse } from "next/server";
import { output, withOutput } from "rpc4next/server";
import { z } from "zod";

const explicitOutputSchema = z.object({
  ok: z.literal(true),
  source: z.literal("explicit-output"),
});

export const GET = withOutput(output(explicitOutputSchema), async () => {
  return NextResponse.json({
    ok: true,
    source: "explicit-output",
  });
});

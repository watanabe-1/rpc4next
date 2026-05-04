import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await context.params;
  const filter = request.nextUrl.searchParams.get("filter") ?? "all";

  return NextResponse.json({
    ok: true,
    itemId,
    filter,
  });
}

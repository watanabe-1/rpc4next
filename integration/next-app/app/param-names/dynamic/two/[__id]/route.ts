import { NextResponse } from "next/server";

import type { Params } from "./route-contract";

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  return NextResponse.json(await params);
}

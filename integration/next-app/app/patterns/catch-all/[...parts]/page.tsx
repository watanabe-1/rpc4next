import { z } from "zod";

import type { Params } from "./route-contract";

type CatchAllPatternPageProps = {
  params: Promise<Params>;
};

export default async function CatchAllPatternPage({ params }: CatchAllPatternPageProps) {
  const { parts } = z.object({ parts: z.array(z.string()) }).parse(await params);

  return <div>catch-all:{parts.join("/")}</div>;
}

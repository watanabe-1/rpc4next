import { z } from "zod";

import type { Params } from "./route-contract";

type OptionalCatchAllPatternPageProps = {
  params: Promise<Params>;
};

export default async function OptionalCatchAllPatternPage({
  params,
}: OptionalCatchAllPatternPageProps) {
  const { parts } = z.object({ parts: z.array(z.string()).optional() }).parse(await params);

  return <div>optional-catch-all:{parts?.join("/") ?? "root"}</div>;
}

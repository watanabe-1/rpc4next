import type { Params } from "./route-contract";

type CatchAllPatternPageProps = {
  params: Promise<Params>;
};

export default async function CatchAllPatternPage({
  params,
}: CatchAllPatternPageProps) {
  const { parts } = await params;

  return <div>catch-all:{parts.join("/")}</div>;
}

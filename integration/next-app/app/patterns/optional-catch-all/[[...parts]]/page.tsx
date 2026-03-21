import type { Params } from "./route-contract";

type OptionalCatchAllPatternPageProps = {
  params: Promise<Params>;
};

export default async function OptionalCatchAllPatternPage({
  params,
}: OptionalCatchAllPatternPageProps) {
  const { parts } = await params;

  return <div>optional-catch-all:{parts?.join("/") ?? "root"}</div>;
}

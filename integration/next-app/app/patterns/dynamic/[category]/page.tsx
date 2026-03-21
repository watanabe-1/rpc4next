import type { Params } from "./route-contract";

type DynamicPatternPageProps = {
  params: Promise<Params>;
};

export default async function DynamicPatternPage({
  params,
}: DynamicPatternPageProps) {
  const { category } = await params;

  return <div>dynamic:{category}</div>;
}

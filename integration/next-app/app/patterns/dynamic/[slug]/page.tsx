import type { Params } from "./params";

type DynamicPatternPageProps = {
  params: Promise<Params>;
};

export default async function DynamicPatternPage({
  params,
}: DynamicPatternPageProps) {
  const { slug } = await params;

  return <div>dynamic:{slug}</div>;
}

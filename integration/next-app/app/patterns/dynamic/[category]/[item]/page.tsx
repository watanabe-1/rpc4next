import type { Params } from "./params";

type NestedDynamicPatternPageProps = {
  params: Promise<Params>;
};

export default async function NestedDynamicPatternPage({
  params,
}: NestedDynamicPatternPageProps) {
  const { category, item } = await params;

  return (
    <div>
      nested-dynamic:{category}/{item}
    </div>
  );
}

type NestedDynamicPatternPageProps = {
  params: Promise<{
    category: string;
    item: string;
  }>;
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

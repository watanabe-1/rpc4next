type DynamicPatternPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function DynamicPatternPage({
  params,
}: DynamicPatternPageProps) {
  const { slug } = await params;

  return <div>dynamic:{slug}</div>;
}

type CatchAllPatternPageProps = {
  params: Promise<{
    parts: string[];
  }>;
};

export default async function CatchAllPatternPage({
  params,
}: CatchAllPatternPageProps) {
  const { parts } = await params;

  return <div>catch-all:{parts.join("/")}</div>;
}

type OptionalCatchAllPatternPageProps = {
  params: Promise<{
    parts?: string[];
  }>;
};

export default async function OptionalCatchAllPatternPage({
  params,
}: OptionalCatchAllPatternPageProps) {
  const { parts } = await params;

  return <div>optional-catch-all:{parts?.join("/") ?? "root"}</div>;
}

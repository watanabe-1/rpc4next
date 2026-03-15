type SearchPatternPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function SearchPatternPage({
  searchParams,
}: SearchPatternPageProps) {
  const { q = "none" } = await searchParams;

  return <div>search:{q}</div>;
}

type InferredQueryPageProps = {
  searchParams: Promise<{
    foo?: string;
  }>;
};

export default async function InferredQueryPage({ searchParams }: InferredQueryPageProps) {
  const { foo } = await searchParams;

  return <div>inferred-query:{foo ?? "none"}</div>;
}

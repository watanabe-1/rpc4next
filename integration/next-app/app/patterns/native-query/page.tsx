export type Query = {
  term?: string | string[];
  page?: string;
};

type NativeQueryPageProps = {
  searchParams: Promise<Query>;
};

export default async function NativeQueryPage({ searchParams }: NativeQueryPageProps) {
  const { page, term } = await searchParams;
  const normalizedTerm = Array.isArray(term) ? term[0] : term;

  return (
    <div>
      native-query:{normalizedTerm ?? "none"}:{page ?? "1"}
    </div>
  );
}

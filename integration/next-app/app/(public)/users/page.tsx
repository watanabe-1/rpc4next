export type Query = {
  filter?: string;
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<Query> }) {
  const { filter } = await searchParams;

  return <div>grouped-users:{filter ?? "all"}</div>;
}

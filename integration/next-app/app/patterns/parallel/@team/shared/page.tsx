export type Query = { team: string };

export default async function TeamPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <div>team:{(await searchParams).team}</div>;
}

export type Query = { period: string };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <div>analytics:{(await searchParams).period}</div>;
}

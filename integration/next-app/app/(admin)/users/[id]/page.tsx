import type { Params } from "./route-contract";

export default async function UserPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  return <div>grouped-user:{id}</div>;
}

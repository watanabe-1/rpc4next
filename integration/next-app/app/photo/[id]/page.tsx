import type { Params } from "./params";

type PhotoPageProps = {
  params: Promise<Params>;
};

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { id } = await params;

  return <div>photo:{id}</div>;
}

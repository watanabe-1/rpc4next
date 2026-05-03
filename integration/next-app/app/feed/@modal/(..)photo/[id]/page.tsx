import type { Params } from "./route-contract";

type InterceptedPhotoPageProps = {
  params: Promise<Params>;
};

export default async function InterceptedPhotoPage({ params }: InterceptedPhotoPageProps) {
  const { id } = await params;

  return <div>intercept-photo:{id}</div>;
}

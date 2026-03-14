import type { Params } from "./params";

type InterceptedPhotoPageProps = {
  params: Promise<Params>;
};

export default async function InterceptedPhotoPage({
  params,
}: InterceptedPhotoPageProps) {
  const { id } = await params;

  return <div>intercept-photo:{id}</div>;
}

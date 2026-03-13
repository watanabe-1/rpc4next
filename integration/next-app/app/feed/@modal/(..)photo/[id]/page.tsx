type InterceptedPhotoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function InterceptedPhotoPage({
  params,
}: InterceptedPhotoPageProps) {
  const { id } = await params;

  return <div>intercept-photo:{id}</div>;
}

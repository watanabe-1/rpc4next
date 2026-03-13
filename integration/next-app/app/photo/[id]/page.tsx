type PhotoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { id } = await params;

  return <div>photo:{id}</div>;
}

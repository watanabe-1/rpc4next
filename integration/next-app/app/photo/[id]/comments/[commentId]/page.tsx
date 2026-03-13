type PhotoCommentPageProps = {
  params: Promise<{
    commentId: string;
    id: string;
  }>;
};

export default async function PhotoCommentPage({
  params,
}: PhotoCommentPageProps) {
  const { commentId, id } = await params;

  return (
    <div>
      photo-comment:{id}/{commentId}
    </div>
  );
}

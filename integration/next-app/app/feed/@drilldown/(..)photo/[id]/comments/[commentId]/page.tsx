type InterceptedPhotoCommentPageProps = {
  params: Promise<{
    commentId: string;
    id: string;
  }>;
};

export default async function InterceptedPhotoCommentPage({
  params,
}: InterceptedPhotoCommentPageProps) {
  const { commentId, id } = await params;

  return (
    <div>
      intercept-photo-comment:{id}/{commentId}
    </div>
  );
}

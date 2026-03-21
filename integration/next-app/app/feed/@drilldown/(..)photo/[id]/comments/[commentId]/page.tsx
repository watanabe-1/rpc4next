import type { Params } from "./route-contract";

type InterceptedPhotoCommentPageProps = {
  params: Promise<Params>;
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

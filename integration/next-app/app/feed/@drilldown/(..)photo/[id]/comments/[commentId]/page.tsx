import type { Params } from "./params";

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

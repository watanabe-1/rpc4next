import type { Params } from "./route-contract";

type PhotoCommentPageProps = {
  params: Promise<Params>;
};

export default async function PhotoCommentPage({ params }: PhotoCommentPageProps) {
  const { commentId, id } = await params;

  return (
    <div>
      photo-comment:{id}/{commentId}
    </div>
  );
}

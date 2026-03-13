import type { Endpoint, ParamsKey, QueryKey } from "rpc4next/client";
import type { POST as POST_90625e305d8eaaef } from "../../app/api/posts/route";
import type {
  GET as GET_b6e4799d411d6efe,
  Query as Query_96533c19a2b0de99,
} from "../../app/api/users/[userId]/route";

export type PathStructure = Endpoint & {
  api: {
    posts: { $post: typeof POST_90625e305d8eaaef } & Endpoint;
    users: {
      _userId: Record<QueryKey, Query_96533c19a2b0de99> & {
        $get: typeof GET_b6e4799d411d6efe;
      } & Endpoint &
        Record<ParamsKey, { userId: string }>;
    };
  };
};

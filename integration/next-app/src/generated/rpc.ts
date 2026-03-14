import type { Endpoint ,ParamsKey ,QueryKey } from "rpc4next/client";
import type { POST as POST_90625e305d8eaaef } from "../../app/api/posts/route";
import type { Query as Query_96533c19a2b0de99 } from "../../app/api/users/[userId]/route";
import type { GET as GET_b6e4799d411d6efe } from "../../app/api/users/[userId]/route";

export type PathStructure = Endpoint & {
  "api": {
    "posts": { "$post": typeof POST_90625e305d8eaaef } & Endpoint,
    "users": {
      "_userId": Record<QueryKey, Query_96533c19a2b0de99> & { "$get": typeof GET_b6e4799d411d6efe } & Endpoint & Record<ParamsKey, { "userId": string }>
    }
  },
  "feed": Endpoint,
  "patterns": Endpoint & {
    "%5Fescaped": Endpoint,
    "%E3%81%ZZ": Endpoint,
    "reports": Endpoint,
    "catch-all": {
      "___parts": Endpoint & Record<ParamsKey, { "parts": string[] }>
    },
    "dynamic": {
      "_category": {
        "_item": Endpoint & Record<ParamsKey, { "category": string; "item": string; }>
      },
      "_slug": Endpoint & Record<ParamsKey, { "slug": string }>
    },
    "optional-catch-all": {
      "_____parts": Endpoint & Record<ParamsKey, { "parts": string[] | undefined }>
    },
    "parallel": Endpoint & {
      "views": Endpoint,
      "members": Endpoint
    }
  },
  "photo": {
    "_id": Endpoint & Record<ParamsKey, { "id": string }> & {
      "comments": {
        "_commentId": Endpoint & Record<ParamsKey, { "id": string; "commentId": string; }>
      }
    }
  }
};
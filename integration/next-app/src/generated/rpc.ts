import type { RpcEndpoint ,ParamsKey ,QueryKey } from "rpc4next/client";
import type { GET as GET_1cdff2d46851497f } from "../../app/api/contract-route/route";
import type { GET as GET_871f64658e86ddce } from "../../app/api/error-demo/route";
import type { GET as GET_9a772c8949962aeb } from "../../app/api/explicit-output/route";
import type { GET as GET_f6b301e60ff73f39 } from "../../app/api/next-native-response/route";
import type { GET as GET_de7c3f3aefa104c1 } from "../../app/api/next-native/[itemId]/route";
import type { GET as GET_ac9bcfb08eed44cd } from "../../app/api/next-native/route";
import type { POST as POST_90625e305d8eaaef } from "../../app/api/posts/route";
import type { Query as Query_328fe40401e7f48d } from "../../app/api/procedure-contract/[userId]/route";
import type { GET as GET_3919bdb64fa44631 } from "../../app/api/procedure-contract/[userId]/route";
import type { Query as Query_a31809be53fb5dc9 } from "../../app/api/procedure-guarded/[userId]/route";
import type { GET as GET_98a6cb8e2c497f98 } from "../../app/api/procedure-guarded/[userId]/route";
import type { GET as GET_deded1d327aade95 } from "../../app/api/procedure-invalid-output/route";
import type { POST as POST_ff7e41c09dae8fb9 } from "../../app/api/procedure-submit/route";
import type { GET as GET_61a9f4b9fd49ccf5 } from "../../app/api/redirect-me/route";
import type { GET as GET_fbb09db60ba2ae51 } from "../../app/api/request-meta/route";
import type { Query as Query_96533c19a2b0de99 } from "../../app/api/users/[userId]/route";
import type { GET as GET_b6e4799d411d6efe } from "../../app/api/users/[userId]/route";

export type PathStructure = RpcEndpoint & {
  "api": {
    "contract-route": { "$get": typeof GET_1cdff2d46851497f } & RpcEndpoint,
    "error-demo": { "$get": typeof GET_871f64658e86ddce } & RpcEndpoint,
    "explicit-output": { "$get": typeof GET_9a772c8949962aeb } & RpcEndpoint,
    "next-native": { "$get": typeof GET_ac9bcfb08eed44cd } & RpcEndpoint & {
      "_itemId": { "$get": typeof GET_de7c3f3aefa104c1 } & RpcEndpoint & Record<ParamsKey, { "itemId": string }>
    },
    "next-native-response": { "$get": typeof GET_f6b301e60ff73f39 } & RpcEndpoint,
    "posts": { "$post": typeof POST_90625e305d8eaaef } & RpcEndpoint,
    "procedure-contract": {
      "_userId": Record<QueryKey, Query_328fe40401e7f48d> & { "$get": typeof GET_3919bdb64fa44631 } & RpcEndpoint & Record<ParamsKey, { "userId": string }>
    },
    "procedure-guarded": {
      "_userId": Record<QueryKey, Query_a31809be53fb5dc9> & { "$get": typeof GET_98a6cb8e2c497f98 } & RpcEndpoint & Record<ParamsKey, { "userId": string }>
    },
    "procedure-invalid-output": { "$get": typeof GET_deded1d327aade95 } & RpcEndpoint,
    "procedure-submit": { "$post": typeof POST_ff7e41c09dae8fb9 } & RpcEndpoint,
    "redirect-me": { "$get": typeof GET_61a9f4b9fd49ccf5 } & RpcEndpoint,
    "request-meta": { "$get": typeof GET_fbb09db60ba2ae51 } & RpcEndpoint,
    "users": {
      "_userId": Record<QueryKey, Query_96533c19a2b0de99> & { "$get": typeof GET_b6e4799d411d6efe } & RpcEndpoint & Record<ParamsKey, { "userId": string }>
    }
  },
  "e2e-client": RpcEndpoint,
  "feed": RpcEndpoint,
  "patterns": RpcEndpoint & {
    "reports": RpcEndpoint,
    "%5Fescaped": RpcEndpoint,
    "%E3%81%ZZ": RpcEndpoint,
    "catch-all": {
      "___parts": RpcEndpoint & Record<ParamsKey, { "parts": string[] }>
    },
    "dynamic": {
      "_category": RpcEndpoint & Record<ParamsKey, { "category": string }> & {
        "_item": RpcEndpoint & Record<ParamsKey, { "category": string; "item": string; }>
      }
    },
    "optional-catch-all": {
      "_____parts": RpcEndpoint & Record<ParamsKey, { "parts": string[] | undefined }>
    },
    "parallel": RpcEndpoint & {
      "views": RpcEndpoint,
      "members": RpcEndpoint
    },
    "search": RpcEndpoint
  },
  "photo": {
    "_id": RpcEndpoint & Record<ParamsKey, { "id": string }> & {
      "comments": {
        "_commentId": RpcEndpoint & Record<ParamsKey, { "id": string; "commentId": string; }>
      }
    }
  },
  "procedure-examples": RpcEndpoint
};
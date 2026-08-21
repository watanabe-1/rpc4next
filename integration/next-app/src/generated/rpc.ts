import type { RpcEndpoint ,ParamsKey ,QueryKey ,ProcedureQueryInput } from "rpc4next/client";
import type { GET as GET_1505e5e59b9e28fa } from "../../app/api/client-bundle-leak-sentinel/route";
import type { GET as GET_1cdff2d46851497f } from "../../app/api/contract-route/route";
import type { GET as GET_871f64658e86ddce } from "../../app/api/error-demo/route";
import type { GET as GET_9a772c8949962aeb } from "../../app/api/explicit-output/route";
import type { GET as GET_f6b301e60ff73f39 } from "../../app/api/next-native-response/route";
import type { Query as Query_d938edf6d3390d15 } from "../../app/api/next-native/[itemId]/route";
import type { GET as GET_de7c3f3aefa104c1 } from "../../app/api/next-native/[itemId]/route";
import type { GET as GET_ac9bcfb08eed44cd } from "../../app/api/next-native/route";
import type { POST as POST_90625e305d8eaaef } from "../../app/api/posts/route";
import type { GET as GET_3919bdb64fa44631 } from "../../app/api/procedure-contract/[userId]/route";
import type { GET as GET_bcc78455031f398c } from "../../app/api/procedure-defaults-error/route";
import type { POST as POST_abb045cb5ac672e1 } from "../../app/api/procedure-form-data/route";
import type { GET as GET_98a6cb8e2c497f98 } from "../../app/api/procedure-guarded/[userId]/route";
import type { GET as GET_deded1d327aade95 } from "../../app/api/procedure-invalid-output/route";
import type { GET as GET_6f931f4b52452942 } from "../../app/api/procedure-response-redirect/route";
import type { GET as GET_606490d8c1f931f7 } from "../../app/api/procedure-response-text/route";
import type { POST as POST_ff7e41c09dae8fb9 } from "../../app/api/procedure-submit/route";
import type { GET as GET_9e56a535c83ceae0 } from "../../app/api/procedure-validation-branch/route";
import type { GET as GET_61a9f4b9fd49ccf5 } from "../../app/api/redirect-me/route";
import type { GET as GET_fbb09db60ba2ae51 } from "../../app/api/request-meta/route";
import type { GET as GET_b6e4799d411d6efe } from "../../app/api/users/[userId]/route";
import type Page_3284828b6f1a8f87 from "../../app/patterns/client-page/page";
import type { Query as Query_56a6df9ad49eb575 } from "../../app/patterns/native-query/page";
import type Page_79cdb44a777689a5 from "../../app/patterns/page-helpers/page";
import type Page_14a3d277b7c2ce94 from "../../app/patterns/search/page";

export type PathStructure = RpcEndpoint & {
  "api": {
    "client-bundle-leak-sentinel": { "$get": typeof GET_1505e5e59b9e28fa } & RpcEndpoint,
    "contract-route": { "$get": typeof GET_1cdff2d46851497f } & RpcEndpoint,
    "error-demo": { "$get": typeof GET_871f64658e86ddce } & RpcEndpoint,
    "explicit-output": { "$get": typeof GET_9a772c8949962aeb } & RpcEndpoint,
    "next-native": { "$get": typeof GET_ac9bcfb08eed44cd } & RpcEndpoint & {
      "_itemId": Record<QueryKey, Query_d938edf6d3390d15> & { "$get": typeof GET_de7c3f3aefa104c1 } & RpcEndpoint & Record<ParamsKey, { "itemId": string }>
    },
    "next-native-response": { "$get": typeof GET_f6b301e60ff73f39 } & RpcEndpoint,
    "posts": { "$post": typeof POST_90625e305d8eaaef } & RpcEndpoint,
    "procedure-contract": {
      "_userId": { "$get": typeof GET_3919bdb64fa44631 } & RpcEndpoint & Record<ParamsKey, { "userId": string }>
    },
    "procedure-defaults-error": { "$get": typeof GET_bcc78455031f398c } & RpcEndpoint,
    "procedure-form-data": { "$post": typeof POST_abb045cb5ac672e1 } & RpcEndpoint,
    "procedure-guarded": {
      "_userId": { "$get": typeof GET_98a6cb8e2c497f98 } & RpcEndpoint & Record<ParamsKey, { "userId": string }>
    },
    "procedure-invalid-output": { "$get": typeof GET_deded1d327aade95 } & RpcEndpoint,
    "procedure-response-redirect": { "$get": typeof GET_6f931f4b52452942 } & RpcEndpoint,
    "procedure-response-text": { "$get": typeof GET_606490d8c1f931f7 } & RpcEndpoint,
    "procedure-submit": { "$post": typeof POST_ff7e41c09dae8fb9 } & RpcEndpoint,
    "procedure-validation-branch": { "$get": typeof GET_9e56a535c83ceae0 } & RpcEndpoint,
    "redirect-me": { "$get": typeof GET_61a9f4b9fd49ccf5 } & RpcEndpoint,
    "request-meta": { "$get": typeof GET_fbb09db60ba2ae51 } & RpcEndpoint,
    "users": {
      "_userId": { "$get": typeof GET_b6e4799d411d6efe } & RpcEndpoint & Record<ParamsKey, { "userId": string }>
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
    "client-page": Record<QueryKey, ProcedureQueryInput<typeof Page_3284828b6f1a8f87>> & RpcEndpoint,
    "dynamic": {
      "_category": RpcEndpoint & Record<ParamsKey, { "category": string }> & {
        "_item": RpcEndpoint & Record<ParamsKey, { "category": string; "item": string; }>
      }
    },
    "native-query": Record<QueryKey, Query_56a6df9ad49eb575> & RpcEndpoint,
    "optional-catch-all": {
      "_____parts": RpcEndpoint & Record<ParamsKey, { "parts": string[] | undefined }>
    },
    "page-helpers": Record<QueryKey, ProcedureQueryInput<typeof Page_79cdb44a777689a5>> & RpcEndpoint,
    "parallel": RpcEndpoint & {
      "views": RpcEndpoint,
      "members": RpcEndpoint
    },
    "search": Record<QueryKey, ProcedureQueryInput<typeof Page_14a3d277b7c2ce94>> & RpcEndpoint
  },
  "photo": {
    "_id": RpcEndpoint & Record<ParamsKey, { "id": string }> & {
      "comments": {
        "_commentId": RpcEndpoint & Record<ParamsKey, { "id": string; "commentId": string; }>
      }
    }
  },
  "procedure-examples": RpcEndpoint,
  "response-unwrap": RpcEndpoint
};
import type { RpcGeneratedPathStructure ,RpcEndpoint ,ParamsKey ,QueryKey ,PageRouteMarker } from "rpc4next/client";
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
import type { GET as GET_87bbb1cbdcfc4091 } from "../../app/api/procedure-file-download/route";
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
import type Page_38c066c7ee3c5334 from "../../app/e2e-client/page";
import type Page_f20ba6bf73502dc1 from "../../app/feed/page";
import type Page_5f11bc234a1e0c67 from "../../app/page";
import type Page_ce69f0ecf7424845 from "../../app/patterns/(grouped)/reports/page";
import type Page_96ecf6fa8566fbe4 from "../../app/patterns/%5Fescaped/page";
import type Page_68eb0f7249e31d28 from "../../app/patterns/%E3%81%ZZ/page";
import type Page_0b1738dbbaa74a00 from "../../app/patterns/catch-all/[...parts]/page";
import type Page_3284828b6f1a8f87 from "../../app/patterns/client-page/page";
import type Page_0125c4bb93973531 from "../../app/patterns/dynamic/[category]/[item]/page";
import type Page_33255c6a6746256a from "../../app/patterns/dynamic/[category]/page";
import type Page_2c846c950cc20c49 from "../../app/patterns/inferred-query/page";
import type { Query as Query_56a6df9ad49eb575 } from "../../app/patterns/native-query/page";
import type Page_d38b38fed2ec9f91 from "../../app/patterns/optional-catch-all/[[...parts]]/page";
import type Page_8636af1013bbed4a from "../../app/patterns/page";
import type Page_79cdb44a777689a5 from "../../app/patterns/page-helpers/page";
import type Page_788e67e18069669b from "../../app/patterns/parallel/@analytics/views/page";
import type Page_cd2765a820488e3c from "../../app/patterns/parallel/@team/members/page";
import type Page_608a7d9f533a2285 from "../../app/patterns/parallel/page";
import type Page_14a3d277b7c2ce94 from "../../app/patterns/search/page";
import type Page_ec4d53d56d2cdbe0 from "../../app/photo/[id]/comments/[commentId]/page";
import type Page_17fbe6f0abbd0030 from "../../app/photo/[id]/page";
import type Page_6fe4147621bd043b from "../../app/procedure-examples/page";
import type Page_e14cc8f4edef5d4a from "../../app/response-unwrap/page";

export type PathStructure = RpcGeneratedPathStructure<PageRouteMarker<typeof Page_5f11bc234a1e0c67> & RpcEndpoint & {
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
    "procedure-file-download": { "$get": typeof GET_87bbb1cbdcfc4091 } & RpcEndpoint,
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
  "e2e-client": PageRouteMarker<typeof Page_38c066c7ee3c5334> & RpcEndpoint,
  "feed": PageRouteMarker<typeof Page_f20ba6bf73502dc1> & RpcEndpoint,
  "patterns": PageRouteMarker<typeof Page_8636af1013bbed4a> & RpcEndpoint & {
    "reports": PageRouteMarker<typeof Page_ce69f0ecf7424845> & RpcEndpoint,
    "%5Fescaped": PageRouteMarker<typeof Page_96ecf6fa8566fbe4> & RpcEndpoint,
    "%E3%81%ZZ": PageRouteMarker<typeof Page_68eb0f7249e31d28> & RpcEndpoint,
    "catch-all": {
      "___parts": PageRouteMarker<typeof Page_0b1738dbbaa74a00> & RpcEndpoint & Record<ParamsKey, { "parts": string[] }>
    },
    "client-page": PageRouteMarker<typeof Page_3284828b6f1a8f87> & RpcEndpoint,
    "dynamic": {
      "_category": PageRouteMarker<typeof Page_33255c6a6746256a> & RpcEndpoint & Record<ParamsKey, { "category": string }> & {
        "_item": PageRouteMarker<typeof Page_0125c4bb93973531> & RpcEndpoint & Record<ParamsKey, { "category": string; "item": string; }>
      }
    },
    "inferred-query": PageRouteMarker<typeof Page_2c846c950cc20c49> & RpcEndpoint,
    "native-query": Record<QueryKey, Query_56a6df9ad49eb575> & RpcEndpoint,
    "optional-catch-all": {
      "_____parts": PageRouteMarker<typeof Page_d38b38fed2ec9f91> & RpcEndpoint & Record<ParamsKey, { "parts": string[] | undefined }>
    },
    "page-helpers": PageRouteMarker<typeof Page_79cdb44a777689a5> & RpcEndpoint,
    "parallel": PageRouteMarker<typeof Page_608a7d9f533a2285> & RpcEndpoint & {
      "views": PageRouteMarker<typeof Page_788e67e18069669b> & RpcEndpoint,
      "members": PageRouteMarker<typeof Page_cd2765a820488e3c> & RpcEndpoint
    },
    "search": PageRouteMarker<typeof Page_14a3d277b7c2ce94> & RpcEndpoint
  },
  "photo": {
    "_id": PageRouteMarker<typeof Page_17fbe6f0abbd0030> & RpcEndpoint & Record<ParamsKey, { "id": string }> & {
      "comments": {
        "_commentId": PageRouteMarker<typeof Page_ec4d53d56d2cdbe0> & RpcEndpoint & Record<ParamsKey, { "id": string; "commentId": string; }>
      }
    }
  },
  "procedure-examples": PageRouteMarker<typeof Page_6fe4147621bd043b> & RpcEndpoint,
  "response-unwrap": PageRouteMarker<typeof Page_e14cc8f4edef5d4a> & RpcEndpoint
}, 1>;
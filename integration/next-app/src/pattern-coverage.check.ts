import type { PathStructure } from "./generated/rpc";

type ExpectFalse<T extends false> = T;
type ExpectTrue<T extends true> = T;

type HasPath<T, TKeys extends readonly PropertyKey[]> = TKeys extends readonly [
  infer THead extends PropertyKey,
  ...infer TTail extends readonly PropertyKey[],
]
  ? THead extends keyof T
    ? HasPath<T[THead], TTail>
    : false
  : true;

type HasDynamicSlug = HasPath<PathStructure, ["patterns", "dynamic", "_slug"]>;
type HasNestedDynamic = HasPath<
  PathStructure,
  ["patterns", "dynamic", "_category", "_item"]
>;
type HasCatchAll = HasPath<PathStructure, ["patterns", "catch-all", "___parts"]>;
type HasOptionalCatchAll = HasPath<
  PathStructure,
  ["patterns", "optional-catch-all", "_____parts"]
>;
type HasGroupedRoute = HasPath<PathStructure, ["patterns", "reports"]>;
type HasParallelAnalytics = HasPath<
  PathStructure,
  ["patterns", "parallel", "views"]
>;
type HasParallelTeam = HasPath<PathStructure, ["patterns", "parallel", "members"]>;
type HasPhotoCommentRoute = HasPath<
  PathStructure,
  ["photo", "_id", "comments", "_commentId"]
>;
type HasPrivateFolderRoute = HasPath<
  PathStructure,
  ["patterns", "_private", "ignored"]
>;
type HasEscapedUnderscoreUrlSegment = HasPath<
  PathStructure,
  ["patterns", "%5Fescaped"]
>;

type _dynamicSlug = ExpectTrue<HasDynamicSlug>;
type _nestedDynamic = ExpectTrue<HasNestedDynamic>;
type _catchAll = ExpectTrue<HasCatchAll>;
type _optionalCatchAll = ExpectTrue<HasOptionalCatchAll>;
type _groupedRoute = ExpectTrue<HasGroupedRoute>;
type _parallelAnalytics = ExpectTrue<HasParallelAnalytics>;
type _parallelTeam = ExpectTrue<HasParallelTeam>;
type _photoCommentRoute = ExpectTrue<HasPhotoCommentRoute>;

// Next.js private folders should be fully excluded from routing.
type _privateFolderExcluded = ExpectFalse<HasPrivateFolderRoute>;

// `%5Fsegment` is the encoded folder form for a literal `_segment` URL.
type _escapedUnderscorePreserved = ExpectTrue<HasEscapedUnderscoreUrlSegment>;

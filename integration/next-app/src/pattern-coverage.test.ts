import { describe, expect, it } from "vitest";
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

type HasDynamicCategory = HasPath<
  PathStructure,
  ["patterns", "dynamic", "_category"]
>;
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
type HasParallelAnalyticsSlot = HasPath<
  PathStructure,
  ["patterns", "parallel", "@analytics"]
>;
type HasParallelTeamSlot = HasPath<
  PathStructure,
  ["patterns", "parallel", "@team"]
>;
type HasParallelAnalyticsPage = HasPath<
  PathStructure,
  ["patterns", "parallel", "views"]
>;
type HasParallelTeamPage = HasPath<
  PathStructure,
  ["patterns", "parallel", "members"]
>;
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
type HasMalformedEncodedUrlSegment = HasPath<
  PathStructure,
  ["patterns", "%E3%81%ZZ"]
>;
type HasInterceptingModalBranch = HasPath<PathStructure, ["feed", "@modal"]>;
type HasInterceptingDrilldownBranch = HasPath<
  PathStructure,
  ["feed", "@drilldown"]
>;

type _dynamicCategory = ExpectTrue<HasDynamicCategory>;
type _nestedDynamic = ExpectTrue<HasNestedDynamic>;
type _catchAll = ExpectTrue<HasCatchAll>;
type _optionalCatchAll = ExpectTrue<HasOptionalCatchAll>;
type _groupedRoute = ExpectTrue<HasGroupedRoute>;
type _photoCommentRoute = ExpectTrue<HasPhotoCommentRoute>;
type _parallelAnalyticsSlotExcluded = ExpectFalse<HasParallelAnalyticsSlot>;
type _parallelTeamSlotExcluded = ExpectFalse<HasParallelTeamSlot>;
type _parallelAnalyticsPageExcluded = ExpectFalse<HasParallelAnalyticsPage>;
type _parallelTeamPageExcluded = ExpectFalse<HasParallelTeamPage>;
type _interceptingModalExcluded = ExpectFalse<HasInterceptingModalBranch>;
type _interceptingDrilldownExcluded = ExpectFalse<HasInterceptingDrilldownBranch>;

// Next.js private folders should be fully excluded from routing.
type _privateFolderExcluded = ExpectFalse<HasPrivateFolderRoute>;

// `%5Fsegment` is the encoded folder form for a literal `_segment` URL.
type _escapedUnderscorePreserved = ExpectTrue<HasEscapedUnderscoreUrlSegment>;
type _malformedEncodedSegmentPreserved =
  ExpectTrue<HasMalformedEncodedUrlSegment>;

describe("integration next-app generated PathStructure type coverage", () => {
  it("compiles the expected folder pattern assertions", () => {
    expect(true).toBe(true);
  });
});

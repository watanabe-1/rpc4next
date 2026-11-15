import { describe, expect, it } from "vitest";

import { encodeRouteParamName, decodeRouteParamName } from "./route-param";

describe("generated route parameter names", () => {
  it.each(["id", "_id", "__id", "____id", "a_b", "%5Fid", "_%25_日本語"])(
    "round-trips %s without extending the kind prefix",
    (name) => {
      const encoded = encodeRouteParamName(name);
      expect(encoded).not.toContain("_");
      expect(decodeRouteParamName(encoded)).toBe(name);
    },
  );

  it("keeps percent escapes distinct from underscores", () => {
    expect(encodeRouteParamName("_id")).toBe("%5Fid");
    expect(encodeRouteParamName("%5Fid")).toBe("%255Fid");
    expect(decodeRouteParamName("%255Fid")).toBe("%5Fid");
  });
});

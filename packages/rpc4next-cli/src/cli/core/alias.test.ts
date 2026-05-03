import { describe, expect, it } from "vitest";

import { createImportAlias } from "./alias.js";

const getHashPart = (alias: string) => alias.slice(alias.lastIndexOf("_") + 1);

describe("createImportAlias", () => {
  it("should generate a consistent alias for the same input", () => {
    const path = "src/utils";
    const name = "Query";
    const alias1 = createImportAlias(path, name);
    const alias2 = createImportAlias(path, name);
    expect(alias1).toBe(alias2);
  });

  it("should generate different aliases for different paths", () => {
    const name = "Query";
    const alias1 = createImportAlias("src/utils", name);
    const alias2 = createImportAlias("src/components", name);
    expect(alias1).not.toBe(alias2);
  });

  it("should generate different aliases for different names", () => {
    const path = "src/utils";
    const alias1 = createImportAlias(path, "GET");
    const alias2 = createImportAlias(path, "POST");
    expect(alias1).not.toBe(alias2);
  });

  it("should include the original name as prefix", () => {
    const path = "some/path";
    const name = "PATCH";
    const alias = createImportAlias(path, name);
    expect(alias.startsWith(`${name}_`)).toBe(true);
  });

  it("should generate a hash with 16 characters", () => {
    const alias = createImportAlias("any/path", "GET");
    const hashPart = getHashPart(alias);
    expect(hashPart.length).toBe(16);
    expect(hashPart).toMatch(/^[a-f0-9]{16}$/);
  });

  it("locks algorithm output for a known fixture (regression guard)", () => {
    expect(createImportAlias("src/utils", "Query")).toBe("Query_411618e4a7080c18");
  });

  it("treats whitespace in the input as significant for hashing", () => {
    const a = createImportAlias("src/utils", "GET");
    const b = createImportAlias("src/utils ", "GET");
    const c = createImportAlias(" src/utils", "GET");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("is case-sensitive for the path", () => {
    const a = createImportAlias("src/UTILS", "GET");
    const b = createImportAlias("src/utils", "GET");
    expect(a).not.toBe(b);
  });

  it("treats POSIX and Windows separators as different (no normalization)", () => {
    const posix = createImportAlias("src/utils", "GET");
    const win = createImportAlias("src\\utils", "GET");
    expect(posix).not.toBe(win);
  });

  it("keeps the production format for query aliases", () => {
    const alias = createImportAlias("any/path", "Query");
    expect(alias).toMatch(/^Query_[a-f0-9]{16}$/);
    expect(getHashPart(alias)).toMatch(/^[a-f0-9]{16}$/);
  });

  it("stays unique across a deterministic input set", () => {
    const set = new Set<string>();
    const names = ["Query", "GET", "HEAD", "POST", "PUT", "DELETE", "PATCH"] as const;
    for (let i = 0; i < 1000; i++) {
      const p = `p/${i}`;
      const n = names[i % names.length];
      set.add(createImportAlias(p, n));
    }
    expect(set.size).toBe(1000);
  });
});

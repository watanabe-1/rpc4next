import { describe, it, expect } from "vitest";
import { createImportAlias } from "./alias";

describe("createImportAlias", () => {
  it("should generate a consistent alias for the same input", () => {
    const path = "src/utils";
    const name = "myModule";
    const alias1 = createImportAlias(path, name);
    const alias2 = createImportAlias(path, name);
    expect(alias1).toBe(alias2);
  });

  it("should generate different aliases for different paths", () => {
    const name = "myModule";
    const alias1 = createImportAlias("src/utils", name);
    const alias2 = createImportAlias("src/components", name);
    expect(alias1).not.toBe(alias2);
  });

  it("should generate different aliases for different names", () => {
    const path = "src/utils";
    const alias1 = createImportAlias(path, "myModule");
    const alias2 = createImportAlias(path, "yourModule");
    expect(alias1).not.toBe(alias2);
  });

  it("should include the original name as prefix", () => {
    const path = "some/path";
    const name = "aliasName";
    const alias = createImportAlias(path, name);
    expect(alias.startsWith(`${name}_`)).toBe(true);
  });

  it("should generate a hash with 16 characters", () => {
    const alias = createImportAlias("any/path", "mod");
    const hashPart = alias.split("_")[1];
    expect(hashPart.length).toBe(16);
    // Optional: check that it's a hex string
    expect(hashPart).toMatch(/^[a-f0-9]{16}$/);
  });

  it("locks algorithm output for a known fixture (regression guard)", () => {
    // This ensures that for a known input, the output is fixed.
    // If the algorithm, concatenation rule, or hash changes, the test will fail.
    expect(createImportAlias("src/utils", "myModule")).toBe(
      "myModule_334f774bfd7c3a9c"
    );
  });

  it("handles empty strings gracefully", () => {
    // Even if path or name is empty, the result should still match the expected format.
    const a = createImportAlias("", "name");
    const b = createImportAlias("path", "");
    expect(a).toMatch(/^name_[a-f0-9]{16}$/);
    expect(b).toMatch(/^_[a-f0-9]{16}$/); // If name is empty, underscore is still present
  });

  it("treats whitespace as significant", () => {
    // Leading/trailing spaces should produce a different hash.
    const a = createImportAlias("src/utils", "mod");
    const b = createImportAlias("src/utils", "mod ");
    const c = createImportAlias(" src/utils", "mod");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("supports Unicode / emoji / Japanese inputs", () => {
    // UTF-8 input should hash consistently for the same values.
    const alias = createImportAlias("パス/😀", "モジュール");
    expect(alias).toMatch(/^モジュール_[a-f0-9]{16}$/);
    expect(alias).toBe(createImportAlias("パス/😀", "モジュール"));
  });

  it("is case-sensitive for both path and name", () => {
    // Changing case in path or name should change the hash.
    const a = createImportAlias("src/UTILS", "myModule");
    const b = createImportAlias("src/utils", "myModule");
    const c = createImportAlias("src/utils", "MyModule");
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });

  it("treats POSIX and Windows separators as different (no normalization)", () => {
    // Forward-slash vs backslash paths should produce different hashes.
    const posix = createImportAlias("src/utils", "m");
    const win = createImportAlias("src\\utils", "m");
    expect(posix).not.toBe(win);
  });

  it("keeps format: `<name>_<16 hex>` with lowercase hex only", () => {
    // The alias should always be the original name + underscore + 16 lowercase hex characters.
    const alias = createImportAlias("any/path", "aName");
    const [prefix, hash] = alias.split("_");
    expect(prefix).toBe("aName");
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
    expect(alias.split("_").length).toBe(2); // Only one underscore
  });

  it("low collision rate over many random inputs (statistical uniqueness)", () => {
    // Generating many aliases with random inputs should not produce duplicates.
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const p = `p/${i}-${Math.random()}`;
      const n = `n-${i}-${Math.random()}`;
      set.add(createImportAlias(p, n));
    }
    expect(set.size).toBe(1000);
  });
});

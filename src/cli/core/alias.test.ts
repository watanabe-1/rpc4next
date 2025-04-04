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
});

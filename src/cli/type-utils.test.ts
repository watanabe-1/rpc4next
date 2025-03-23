import { describe, it, expect } from "vitest";
import { TYPE_SEPARATOR, STATEMENT_TERMINATOR } from "./constants";
import { createRecodeType, createObjectType, createImport } from "./type-utils";

describe("createRecodeType", () => {
  it("should create a valid Record type", () => {
    expect(createRecodeType("string", "number")).toBe("Record<string, number>");
  });

  it("should return empty string if key or value is empty", () => {
    expect(createRecodeType("", "number")).toBe("");
    expect(createRecodeType("string", "")).toBe("");
    expect(createRecodeType("", "")).toBe("");
  });
});

describe("createObjectType", () => {
  it("should create a valid object type with one field", () => {
    expect(createObjectType([{ name: "id", type: "number" }])).toBe(
      `{ "id": number }`
    );
  });

  it("should create a valid object type with multiple fields", () => {
    expect(
      createObjectType([
        { name: "id", type: "number" },
        { name: "name", type: "string" },
      ])
    ).toBe(`{ "id": number${TYPE_SEPARATOR} "name": string${TYPE_SEPARATOR} }`);
  });

  it("should return empty string if any field has an empty name or type", () => {
    expect(createObjectType([{ name: "", type: "number" }])).toBe("");
    expect(createObjectType([{ name: "id", type: "" }])).toBe("");
    expect(
      createObjectType([
        { name: "id", type: "number" },
        { name: "", type: "string" },
      ])
    ).toBe("");
  });

  it("should handle empty fields", () => {
    expect(createObjectType([])).toBe("");
  });
});

describe("createImport", () => {
  it("should create a valid import statement with alias", () => {
    expect(createImport("User", "./types", "UserType")).toBe(
      `import type { User as UserType } from "./types"${STATEMENT_TERMINATOR}`
    );
  });

  it("should create a valid import statement without alias", () => {
    expect(createImport("User", "./types")).toBe(
      `import type { User } from "./types"${STATEMENT_TERMINATOR}`
    );
  });

  it("should return empty string if type or path is empty", () => {
    expect(createImport("", "./types", "UserType")).toBe("");
    expect(createImport("User", "", "UserType")).toBe("");
    expect(createImport("", "", "")).toBe("");
  });

  it("should handle different module paths", () => {
    expect(createImport("Data", "../models/data", "DataType")).toBe(
      `import type { Data as DataType } from "../models/data"${STATEMENT_TERMINATOR}`
    );

    expect(createImport("Data", "../models/data")).toBe(
      `import type { Data } from "../models/data"${STATEMENT_TERMINATOR}`
    );
  });
});

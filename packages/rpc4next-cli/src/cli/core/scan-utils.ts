import fs from "node:fs";
import { parseSync } from "oxc-parser";
import type { BindingPattern, BindingRestElement, Statement } from "oxc-parser";
import { HTTP_METHODS_EXCLUDE_OPTIONS } from "rpc4next-shared";
import type { HttpMethod } from "rpc4next-shared";

import { createImportAlias } from "./alias.js";
import type { ImportAliasName } from "./alias.js";
import { QUERY_TYPES, TYPE_KEY_QUERY, TYPE_PAGE_ROUTE_MARKER } from "./constants.js";
import { createRelativeImportPath } from "./path-utils.js";
import {
  createDefaultImport,
  createImport,
  createObjectType,
  createRecodeType,
} from "./type-utils.js";

type ScanDefinition<T extends ImportAliasName> = {
  importName: string;
  importPath: string;
  importStatement: string;
  type: string;
  exportName: T;
};

type QueryScanDefinition = ScanDefinition<(typeof QUERY_TYPES)[number] | "Page">;
type PageScanDefinition = ScanDefinition<"Page">;

const buildDefinition = <T extends ImportAliasName>(
  outputFile: string,
  inputFile: string,
  exportName: T,
  typeCallBack: (type: T, importAlias: string) => string,
) => {
  const relativeImportPath = createRelativeImportPath(outputFile, inputFile);
  const importAlias = createImportAlias(relativeImportPath, exportName);

  return {
    importName: importAlias,
    importPath: relativeImportPath,
    importStatement: createImport(exportName, relativeImportPath, importAlias),
    type: typeCallBack(exportName, importAlias),
    exportName,
  };
};

const findQueryExport = (statements: Statement[]) => {
  const localTypes = new Set<string>();
  const exports = new Set<string>();

  for (const statement of statements) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (
      declaration?.type === "TSTypeAliasDeclaration" ||
      declaration?.type === "TSInterfaceDeclaration"
    ) {
      localTypes.add(declaration.id.name);
      if (statement.type === "ExportNamedDeclaration") exports.add(declaration.id.name);
    } else if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers) localTypes.add(specifier.local.name);
    }
  }

  for (const statement of statements) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type !== "ExportSpecifier") continue;
      const localName =
        specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value;
      if (!statement.source && !localTypes.has(localName)) continue;
      exports.add(
        specifier.exported.type === "Identifier"
          ? specifier.exported.name
          : specifier.exported.value,
      );
    }
  }

  return QUERY_TYPES.find((type) => exports.has(type));
};

const isPageFile = (inputFile: string) => /[/\\]page\.tsx$/.test(inputFile);

const collectBindingNames = (binding: BindingPattern | BindingRestElement, names: Set<string>) => {
  switch (binding.type) {
    case "Identifier":
      names.add(binding.name);
      break;
    case "ObjectPattern":
      for (const property of binding.properties) {
        collectBindingNames(
          property.type === "RestElement" ? property.argument : property.value,
          names,
        );
      }
      break;
    case "ArrayPattern":
      for (const element of binding.elements) {
        if (element) collectBindingNames(element, names);
      }
      break;
    case "AssignmentPattern":
      collectBindingNames(binding.left, names);
      break;
    case "RestElement":
      collectBindingNames(binding.argument, names);
      break;
  }
};

const collectDeclarationNames = (declaration: Statement, names: Set<string>) => {
  if ("declare" in declaration && declaration.declare) return;

  if (declaration.type === "VariableDeclaration") {
    for (const { id } of declaration.declarations) collectBindingNames(id, names);
  } else if (
    declaration.type === "FunctionDeclaration" ||
    declaration.type === "ClassDeclaration" ||
    declaration.type === "TSEnumDeclaration"
  ) {
    if (declaration.id) names.add(declaration.id.name);
  }
};

const findRouteExports = (statements: Statement[]) => {
  const localValues = new Set<string>();
  const exports = new Set<string>();

  // Resolve local value bindings before export lists, which may precede declarations.
  for (const statement of statements) {
    if (
      statement.type === "ExportNamedDeclaration" ||
      statement.type === "ExportDefaultDeclaration"
    ) {
      const declaration = statement.declaration;
      if (
        declaration &&
        (declaration.type === "VariableDeclaration" ||
          declaration.type === "FunctionDeclaration" ||
          declaration.type === "ClassDeclaration" ||
          declaration.type === "TSEnumDeclaration")
      ) {
        collectDeclarationNames(declaration, localValues);
      }
    } else if (statement.type === "ImportDeclaration") {
      if (statement.importKind === "type") continue;
      for (const specifier of statement.specifiers) {
        if (specifier.type !== "ImportSpecifier" || specifier.importKind !== "type") {
          localValues.add(specifier.local.name);
        }
      }
    } else {
      collectDeclarationNames(statement, localValues);
    }
  }

  for (const statement of statements) {
    if (statement.type !== "ExportNamedDeclaration" || statement.exportKind === "type") continue;
    if (statement.declaration) collectDeclarationNames(statement.declaration, exports);
    for (const specifier of statement.specifiers) {
      if (specifier.type !== "ExportSpecifier" || specifier.exportKind === "type") continue;
      const localName =
        specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value;
      if (!statement.source && !localValues.has(localName)) continue;
      exports.add(
        specifier.exported.type === "Identifier"
          ? specifier.exported.name
          : specifier.exported.value,
      );
    }
  }

  return exports;
};

const hasRouteExport = (exports: ReadonlySet<string>, httpMethod: HttpMethod) =>
  exports.has(httpMethod);

export const scanEndpointFile = (
  outputFile: string,
  inputFile: string,
): {
  page?: PageScanDefinition;
  query?: QueryScanDefinition;
  routes: ScanDefinition<HttpMethod>[];
} => {
  const fileContents = fs.readFileSync(inputFile, "utf8");

  const result = parseSync(inputFile, fileContents, { sourceType: "module" });
  if (result.errors.length) {
    throw new SyntaxError(
      `Failed to parse ${inputFile}: ${result.errors.map((error) => error.message).join("; ")}`,
    );
  }
  const queryExport = findQueryExport(result.program.body);
  const page = isPageFile(inputFile)
    ? (() => {
        const relativeImportPath = createRelativeImportPath(outputFile, inputFile);
        const importAlias = createImportAlias(relativeImportPath, "Page");

        return {
          importName: importAlias,
          importPath: relativeImportPath,
          importStatement: createDefaultImport(relativeImportPath, importAlias),
          type: `${TYPE_PAGE_ROUTE_MARKER}<typeof ${importAlias}>`,
          exportName: "Page" as const,
        };
      })()
    : undefined;
  const query = queryExport
    ? buildDefinition(outputFile, inputFile, queryExport, (_, importAlias) =>
        createRecodeType(TYPE_KEY_QUERY, importAlias),
      )
    : page;

  const routeExports = findRouteExports(result.program.body);
  const routes = HTTP_METHODS_EXCLUDE_OPTIONS.filter((method) =>
    hasRouteExport(routeExports, method),
  ).map((method) =>
    buildDefinition(outputFile, inputFile, method, (type, importAlias) =>
      createObjectType([{ name: `$${type.toLowerCase()}`, type: `typeof ${importAlias}` }]),
    ),
  );

  return {
    ...(page ? { page } : {}),
    ...(query ? { query } : {}),
    routes,
  };
};

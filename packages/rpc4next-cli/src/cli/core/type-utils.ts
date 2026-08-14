import { STATEMENT_TERMINATOR, TYPE_SEPARATOR } from "./constants.js";

export const createStringLiteral = (value: string) => JSON.stringify(value);

export const createRecodeType = (key: string, value: string) => {
  if (!key || !value) return "";

  return `Record<${key}, ${value}>`;
};

export const createObjectType = (fields: { name: string; type: string }[]) => {
  if (fields.length === 0 || fields.some(({ name, type }) => !name || !type)) return "";

  return `{ ${fields
    .map(({ name, type }) => `${createStringLiteral(name)}: ${type}`)
    .join(`${TYPE_SEPARATOR} `)}${fields.length > 1 ? TYPE_SEPARATOR : ""} }`;
};

export const createImport = (type: string, path: string, importAlias?: string) => {
  if (!type || !path) return "";

  return importAlias
    ? `import type { ${type} as ${importAlias} } from ${createStringLiteral(path)}${STATEMENT_TERMINATOR}`
    : `import type { ${type} } from ${createStringLiteral(path)}${STATEMENT_TERMINATOR}`;
};

export const createDefaultImport = (path: string, importAlias: string) => {
  if (!path || !importAlias) return "";

  return `import type ${importAlias} from ${createStringLiteral(path)}${STATEMENT_TERMINATOR}`;
};

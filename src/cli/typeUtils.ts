import { TYPE_SEPARATOR, STATEMENT_TERMINATOR } from "./constants";

export const createRecodeType = (key: string, value: string) => {
  if (!key || !value) return "";

  return `Record<${key}, ${value}>`;
};

export const createObjectType = (fields: { name: string; type: string }[]) => {
  if (fields.length === 0 || fields.some(({ name, type }) => !name || !type))
    return "";

  return `{ ${fields
    .map(({ name, type }) => `"${name}": ${type}`)
    .join(`${TYPE_SEPARATOR} `)}${fields.length > 1 ? TYPE_SEPARATOR : ""} }`;
};

export const createImport = (
  type: string,
  path: string,
  importAlias?: string
) => {
  if (!type || !path) return "";

  return importAlias
    ? `import type { ${type} as ${importAlias} } from "${path}"${STATEMENT_TERMINATOR}`
    : `import type { ${type} } from "${path}"${STATEMENT_TERMINATOR}`;
};

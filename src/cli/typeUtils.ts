import { TYPE_SEPARATOR, STATEMENT_TERMINATOR } from "./constants";

export const createRecodeType = (key: string, value: string) =>
  `Record<${key}, ${value}>`;

export const createObjectType = (
  fields: {
    name: string;
    type: string;
  }[]
) =>
  `{ ${fields
    .map(({ name, type }) => `"${name}": ${type}`)
    .join(`${TYPE_SEPARATOR} `)}${fields.length > 1 ? TYPE_SEPARATOR : ""} }`;

export const createImport = (type: string, importAlias: string, path: string) =>
  `import type { ${type} as ${importAlias} } from '${path}'${STATEMENT_TERMINATOR}`;

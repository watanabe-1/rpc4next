// Generated output must not depend on the host locale or ICU collation rules.
export const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

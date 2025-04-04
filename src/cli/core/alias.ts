import crypto from "crypto";

export const createImportAlias = (path: string, name: string) => {
  const hash = crypto
    .createHash("md5")
    .update(`${path}::${name}`)
    .digest("hex")
    .slice(0, 16);

  return `${name}_${hash}`;
};

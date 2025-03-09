import path from "path";

export const createRelativeImportPath = (
  outputFile: string,
  inputFile: string
) =>
  path
    .relative(path.dirname(outputFile), inputFile)
    .replace(/\\/g, "/")
    .replace(/\.tsx?$/, "");

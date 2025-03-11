import path from "path";

export const createRelativeImportPath = (
  outputFile: string,
  inputFile: string
) => {
  let relativePath = path
    .relative(path.dirname(outputFile), inputFile)
    .replace(/\\/g, "/")
    .replace(/\.tsx?$/, "");

  // Add "./" if the file is in the same directory
  if (!relativePath.startsWith("../")) {
    relativePath = "./" + relativePath;
  }

  return relativePath;
};

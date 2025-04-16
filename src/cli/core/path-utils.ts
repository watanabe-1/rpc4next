import path from "path";

export const createRelativeImportPath = (
  outputFile: string,
  inputFile: string
) => {
  let relativePath = toPosixPath(
    path.relative(path.dirname(outputFile), inputFile)
  ).replace(/\.tsx?$/, "");

  // Add "./" if the file is in the same directory
  if (!relativePath.startsWith("../")) {
    relativePath = "./" + relativePath;
  }

  return relativePath;
};

export const toPosixPath = (p: string): string => {
  return p.replace(/\\/g, "/");
};

export const relativeFromRoot = (filePath: string): string => {
  return path.relative(process.cwd(), filePath);
};

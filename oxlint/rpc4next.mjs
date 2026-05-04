import commentSpacingPlugin from "./comment-spacing.mjs";
import noExportInTestPlugin from "./no-export-in-test.mjs";
import paddingLineBeforeReturnPlugin from "./padding-line-before-return.mjs";

export default {
  meta: {
    name: "rpc4next",
  },
  rules: {
    ...commentSpacingPlugin.rules,
    ...paddingLineBeforeReturnPlugin.rules,
    ...noExportInTestPlugin.rules,
  },
};

import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginImport from "eslint-plugin-import";
import eslintPluginUnusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    files: ["*.js", "*.jsx", "*.ts", "*.tsx"],
  },
  {
    ignores: ["**/dist/", "**/bin/"],
  },
  {
    name: "eslint/recommended",
    rules: js.configs.recommended.rules,
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: eslintPluginImport,
    },
    rules: {
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling"],
            "index",
            "object",
            "type",
          ],
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  {
    plugins: {
      "unused-imports": eslintPluginUnusedImports,
    },
  },
  {
    name: "prettier/config",
    ...eslintConfigPrettier,
  },
  {
    name: "project-custom",
    rules: {
      eqeqeq: "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "return" },
      ],
    },
  },
];

export default config;

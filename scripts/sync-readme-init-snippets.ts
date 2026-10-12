import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const snippetNames = ["RPC_ERRORS", "ROUTE_PROCEDURE", "PAGE_PROCEDURE"] as const;

type SnippetName = (typeof snippetNames)[number];
type SnippetSources = Record<SnippetName, string>;

const getTemplateSnippet = (templates: Partial<SnippetSources>, name: SnippetName) => {
  const snippet = templates[name];

  if (typeof snippet !== "string") {
    throw new Error(`Missing init template export: ${name}`);
  }

  return snippet;
};

const loadInitTemplateSnippets = async (cwd: string): Promise<SnippetSources> => {
  const templatesPath = path.join(
    cwd,
    "packages",
    "rpc4next-cli",
    "src",
    "cli",
    "init",
    "templates.ts",
  );
  const templates = (await import(pathToFileURL(templatesPath).href)) as Partial<SnippetSources>;

  return {
    PAGE_PROCEDURE: getTemplateSnippet(templates, "PAGE_PROCEDURE"),
    RPC_ERRORS: getTemplateSnippet(templates, "RPC_ERRORS"),
    ROUTE_PROCEDURE: getTemplateSnippet(templates, "ROUTE_PROCEDURE"),
  };
};

const formatSnippet = (name: SnippetName, snippetSources: SnippetSources) => {
  const fileHeader = {
    PAGE_PROCEDURE: "// app/_rpc/page-procedure.ts",
    ROUTE_PROCEDURE: "// app/_rpc/route-procedure.ts",
    RPC_ERRORS: "// app/_rpc/errors.ts",
  }[name];

  return ["```ts", fileHeader, snippetSources[name].trimEnd(), "```"].join("\n");
};

const formatMarkdown = (cwd: string, markdown: string) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-readme-"));
  const tempPath = path.join(tempDir, "snippet.md");

  try {
    fs.writeFileSync(tempPath, markdown);

    const result = spawnSync("oxfmt", [tempPath], {
      cwd,
      encoding: "utf8",
    });

    if (result.error) throw result.error;

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "oxfmt failed");
    }

    return fs.readFileSync(tempPath, "utf8").trimEnd();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

export const syncReadmeInitSnippets = (
  readme: string,
  snippetSources: SnippetSources,
  formatBlock: (markdown: string) => string = (markdown) => markdown,
) => {
  let nextReadme = readme;

  for (const name of snippetNames) {
    const start = `<!-- rpc4next-init-template:start ${name} -->`;
    const end = `<!-- rpc4next-init-template:end ${name} -->`;
    const pattern = new RegExp(`${escapeRegExp(start)}\\n[\\s\\S]*?\\n${escapeRegExp(end)}`);

    if (!pattern.test(nextReadme)) {
      throw new Error(`Missing README init template block: ${name}`);
    }

    const block = [start, "", formatSnippet(name, snippetSources), "", end].join("\n");
    nextReadme = nextReadme.replace(pattern, formatBlock(block));
  }

  return nextReadme;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const runCli = async (cwd = process.cwd(), args = process.argv.slice(2)) => {
  const readmePath = path.join(cwd, "README.md");
  const readme = fs.readFileSync(readmePath, "utf8");
  const snippetSources = await loadInitTemplateSnippets(cwd);
  const nextReadme = syncReadmeInitSnippets(readme, snippetSources, (block) =>
    formatMarkdown(cwd, block),
  );

  if (args.includes("--check")) {
    if (nextReadme !== readme) {
      console.error("README.md init snippets are out of sync. Run `bun run docs:sync:init`.");

      return 1;
    }

    return 0;
  }

  if (nextReadme !== readme) {
    fs.writeFileSync(readmePath, nextReadme);
  }

  return 0;
};

/* c8 ignore start */
if (import.meta.main) {
  process.exitCode = await runCli();
}
/* c8 ignore end */

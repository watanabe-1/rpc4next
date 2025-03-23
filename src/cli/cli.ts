#!/usr/bin/env node

import fs from "fs";
import { Command } from "commander";
import { generatePages } from "./generate-path-structure";

const program = new Command();

const start = performance.now();

program
  .description(
    "Generate an RPC client type based on the provided base directory and output path."
  )
  .argument("<baseDir>", "Base directory for the RPC client type")
  .argument("<outputPath>", "Output path for the generated client type")
  .action((baseDir: string, outputPath: string) => {
    console.log(`Base Directory: ${baseDir}`);
    console.log(`Output Path: ${outputPath}`);

    const outputContent = generatePages(outputPath, baseDir);

    fs.writeFileSync(outputPath, outputContent);

    console.log(`Generated RPC client at ${outputPath}`);
  });

program.parse(process.argv);

const end = performance.now();
console.log(`Execution time: ${(end - start).toFixed(2)} ms`);

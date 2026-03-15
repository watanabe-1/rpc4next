import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const [command = "dev", ...forwardedArgs] = process.argv.slice(2);
const shouldGenerateRpc = command === "dev";

let nextProcess = null;
let shuttingDown = false;

function exitWithCode(code) {
  process.exit(code ?? 0);
}

function quoteWindowsArg(value) {
  if (value.length === 0) {
    return '""';
  }

  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}

function run(commandName, args) {
  return new Promise((resolve, reject) => {
    const child =
      process.platform === "win32" && commandName === "bun"
        ? spawn(process.env.ComSpec ?? "cmd.exe", [
            "/d",
            "/s",
            "/c",
            ["bun", ...args].map(quoteWindowsArg).join(" "),
          ], {
            cwd: process.cwd(),
            stdio: "inherit",
          })
        : spawn(commandName, args, {
            cwd: process.cwd(),
            stdio: "inherit",
          });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 0);
    });
  });
}

async function stopNext(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (!nextProcess || nextProcess.exitCode !== null) {
    exitWithCode(exitCode);
    return;
  }

  if (process.platform === "win32") {
    const taskkillCode = await run("taskkill", [
      "/pid",
      String(nextProcess.pid),
      "/t",
      "/f",
    ]);
    exitWithCode(taskkillCode === 0 ? exitCode : taskkillCode);
    return;
  }

  nextProcess.kill("SIGTERM");
  setTimeout(() => {
    if (nextProcess && nextProcess.exitCode === null) {
      nextProcess.kill("SIGKILL");
    }
  }, 5_000).unref();
}

async function main() {
  if (shouldGenerateRpc) {
    const generateCode = await run("bun", ["run", "generate:rpc"]);
    if (generateCode !== 0) {
      exitWithCode(generateCode);
      return;
    }
  }

  nextProcess = spawn(process.execPath, [nextBin, command, ...forwardedArgs], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  nextProcess.once("error", (error) => {
    console.error(error);
    exitWithCode(1);
  });

  nextProcess.once("exit", (code, signal) => {
    if (shuttingDown) {
      exitWithCode(code ?? 0);
      return;
    }

    if (signal) {
      exitWithCode(1);
      return;
    }

    exitWithCode(code ?? 0);
  });
}

process.on("SIGINT", () => {
  void stopNext(0);
});

process.on("SIGTERM", () => {
  void stopNext(0);
});

await main();

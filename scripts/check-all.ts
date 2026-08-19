import { spawn } from "node:child_process";

const CHECKS = [
  "check-gestures",
  "check-touch-drag",
  "check-manual-order",
  "check-cross-group",
  "check-stage-group",
  "check-group-order",
  "check-inline-edit",
  "check-rename-parse",
  "check-info-blur",
  "check-subtask-add",
  "check-tags",
  "check-dot-and-archive",
  "check-comment-seen",
  "check-repeat",
  "check-schedule",
  "check-every-field",
  "check-sheet",
  "check-sheet-drag",
  "check-response",
  "check-polish",
];

function run(script: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", `scripts/${script}.ts`], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const failures: string[] = [];

for (const check of CHECKS) {
  console.log(`\n──── ${check} ────`);
  await run("seed");
  const code = await run(check);
  if (code !== 0) {
    failures.push(check);
  }
}

console.log("\n════ summary ════");
if (failures.length === 0) {
  console.log(`all ${CHECKS.length} checks passed`);
} else {
  console.log(`failed: ${failures.join(", ")}`);
  process.exitCode = 1;
}

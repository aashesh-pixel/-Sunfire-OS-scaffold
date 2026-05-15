import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const forbiddenPatterns = [
  "CAN write",
  "ignition disable",
  "door lock actuation",
  "steering command",
  "brake command",
  "throttle command",
  "firmware flashing",
  "production OTA"
];

const findings = [];
const files = await listFiles(".");

for (const file of files) {
  if (shouldSkip(file)) {
    continue;
  }

  const content = await readFile(file, "utf8");

  for (const pattern of forbiddenPatterns) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(content) && !isAllowedDocumentationFile(file)) {
      findings.push({ file, pattern });
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  policy: "Phase 1 read-only telemetry scaffold",
  forbiddenPatterns,
  findings,
  passed: findings.length === 0
};

await mkdir("evidence", { recursive: true });
await writeFile("evidence/security-scan.json", `${JSON.stringify(report, null, 2)}\n`);
console.log("wrote evidence/security-scan.json");

if (!report.passed) {
  process.exitCode = 1;
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path));
    } else {
      files.push(path);
    }
  }

  return files;
}

function shouldSkip(file) {
  const normalized = file.replaceAll("\\", "/");
  return normalized.includes("node_modules/")
    || normalized.includes(".git/")
    || normalized.includes("evidence/")
    || normalized === "scripts/security-scan.mjs";
}

function isAllowedDocumentationFile(file) {
  const normalized = file.replaceAll("\\", "/");
  return normalized === "AGENTS.md"
    || normalized === "README.md"
    || normalized.startsWith(".github/")
    || normalized.startsWith("docs/")
    || normalized.startsWith("deploy/agl/");
}

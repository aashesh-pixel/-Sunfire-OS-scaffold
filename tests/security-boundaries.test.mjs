import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const forbiddenImplementationTerms = [
  "sendCan",
  "writeCan",
  "disableIgnition",
  "lockDoor",
  "steerVehicle",
  "applyBrake",
  "setThrottle",
  "flashFirmware"
];

test("implementation does not expose prohibited vehicle-control surfaces", async () => {
  const files = await listFiles(".");
  const matches = [];

  for (const file of files) {
    if (shouldSkip(file)) {
      continue;
    }

    const content = await readFile(file, "utf8");
    for (const term of forbiddenImplementationTerms) {
      if (content.includes(term)) {
        matches.push({ file, term });
      }
    }
  }

  assert.deepEqual(matches, []);
});

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
  return file.includes("node_modules")
    || file.includes(".git")
    || file.includes("evidence")
    || file === join("tests", "security-boundaries.test.mjs");
}

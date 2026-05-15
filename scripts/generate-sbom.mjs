import { mkdir, readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const dependencies = Object.entries(packageJson.dependencies || {}).map(([name, version]) => ({
  type: "library",
  name,
  version,
  scope: "required"
}));

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: "urn:uuid:00000000-0000-4000-8000-sunfirephase1",
  version: 1,
  metadata: {
    component: {
      type: "application",
      name: packageJson.name,
      version: packageJson.version
    }
  },
  components: dependencies
};

await mkdir("evidence", { recursive: true });
await writeFile("evidence/sbom.json", `${JSON.stringify(sbom, null, 2)}\n`);
console.log("wrote evidence/sbom.json");

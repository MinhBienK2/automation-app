import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXCLUDED_FILES = new Set([
  "SHA256SUMS",
  "release-manifest.json",
  "builder-debug.yml",
  "builder-effective-config.yaml",
]);

async function listReleaseFiles(releaseDir) {
  const entries = await readdir(releaseDir);
  const files = [];

  for (const entry of entries.sort()) {
    if (entry.endsWith(".blockmap") || EXCLUDED_FILES.has(entry)) {
      continue;
    }

    const absolutePath = path.join(releaseDir, entry);
    const details = await stat(absolutePath);

    if (details.isFile()) {
      files.push({ absolutePath, name: entry, size: details.size });
    }
  }

  return files;
}

async function sha256File(filePath) {
  const contents = await readFile(filePath);

  return createHash("sha256").update(contents).digest("hex");
}

export async function generateReleaseManifest(releaseDir) {
  const absoluteReleaseDir = path.resolve(releaseDir);
  const files = await listReleaseFiles(absoluteReleaseDir);
  const artifacts = [];

  for (const file of files) {
    artifacts.push({
      name: file.name,
      size: file.size,
      sha256: await sha256File(file.absolutePath),
    });
  }

  const checksumLines = artifacts.map((artifact) => `${artifact.sha256}  ${artifact.name}`).join("\n");
  const manifest = {
    generated_at: new Date().toISOString(),
    reproducible_epoch: new Date(0).toISOString(),
    artifact_count: artifacts.length,
    artifacts,
  };

  await writeFile(path.join(absoluteReleaseDir, "SHA256SUMS"), `${checksumLines}\n`);
  await writeFile(path.join(absoluteReleaseDir, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  return manifest;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const releaseDir = process.argv[2] ?? "release";
  await generateReleaseManifest(releaseDir);
}

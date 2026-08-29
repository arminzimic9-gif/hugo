import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_ROOT = "https://api.meshy.ai/openapi/v1";
const POLL_INTERVAL_MS = 5000;
const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELED"]);

const args = process.argv.slice(2);
const batchName = args[args.indexOf("--batch") + 1];
const execute = args.includes("--execute");
const root = process.cwd();
const configPath = path.join(root, "config/meshy-assets.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const batch = config.batches[batchName];

if (!batchName || !batch) {
  throw new Error(`Unknown batch. Available: ${Object.keys(config.batches).join(", ")}`);
}

if (!execute) {
  console.log(JSON.stringify({ batch: batchName, creditLimit: batch.creditLimit, assets: batch.assets }, null, 2));
  console.log("Dry run only. Add --execute to create paid Meshy tasks.");
  process.exit(0);
}

const apiKey = process.env.MESHY_API_KEY;
if (!apiKey) throw new Error("MESHY_API_KEY is not set");

const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_ROOT}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`Meshy HTTP ${response.status}: ${body.message ?? body.detail ?? "request failed"}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function getBalance() {
  const result = await apiRequest("/balance", { method: "GET" });
  return result.balance;
}

async function imageDataUri(filePath) {
  const image = await readFile(filePath);
  return `data:image/png;base64,${image.toString("base64")}`;
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function pollTask(taskId) {
  while (true) {
    const task = await apiRequest(`/image-to-3d/${taskId}`, { method: "GET" });
    console.log(`${taskId} ${task.status} ${task.progress ?? 0}%`);
    if (TERMINAL_STATUSES.has(task.status)) return task;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

let consumed = 0;
for (const asset of batch.assets) {
  if (consumed + asset.expectedCredits > batch.creditLimit) {
    console.log(`STOP batch credit limit reached before ${asset.id}`);
    break;
  }

  const balanceBefore = await getBalance();
  if (balanceBefore < asset.expectedCredits) {
    console.log(`STOP insufficient balance before ${asset.id}: ${balanceBefore}`);
    break;
  }

  const referencePath = path.join(root, asset.reference);
  const taskRoot = path.join(root, config.sourceRoot, asset.id);
  await mkdir(taskRoot, { recursive: true });
  const payload = {
    ...config.imageTo3dDefaults,
    image_url: await imageDataUri(referencePath),
    texture_image_url: await imageDataUri(referencePath),
  };

  let created;
  try {
    created = await apiRequest("/image-to-3d", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (config.policy.haltHttpStatuses.includes(error.status)) {
      console.log(`STOP Meshy HTTP ${error.status} before ${asset.id}`);
      break;
    }
    throw error;
  }

  const task = await pollTask(created.result);
  const metadata = {
    id: task.id,
    label: asset.label,
    status: task.status,
    created_at: task.created_at,
    finished_at: task.finished_at,
    consumed_credits: task.consumed_credits ?? 0,
    source_reference: asset.reference,
    request: {
      ...config.imageTo3dDefaults,
      image_url: "[local reference omitted]",
      texture_image_url: "[local reference omitted]"
    }
  };
  await writeFile(path.join(taskRoot, "task.json"), `${JSON.stringify(metadata, null, 2)}\n`);

  if (task.status !== "SUCCEEDED" || !task.model_urls?.glb) {
    console.log(`STOP ${asset.id} finished as ${task.status}`);
    break;
  }

  const originalModel = path.join(taskRoot, `${asset.id}.glb`);
  await download(task.model_urls.glb, originalModel);
  if (task.thumbnail_url) await download(task.thumbnail_url, path.join(taskRoot, "preview-front.png"));
  for (const [view, url] of Object.entries(task.thumbnail_urls ?? {})) {
    await download(url, path.join(taskRoot, `preview-${view}.png`));
  }
  for (const [index, textureSet] of (task.texture_urls ?? []).entries()) {
    for (const [kind, url] of Object.entries(textureSet)) {
      await download(url, path.join(taskRoot, `texture-${index}-${kind}.png`));
    }
  }

  const runtimePath = path.join(root, asset.runtime);
  await mkdir(path.dirname(runtimePath), { recursive: true });
  await copyFile(originalModel, runtimePath);
  consumed += task.consumed_credits ?? asset.expectedCredits;
  console.log(`SAVED ${asset.id} credits=${task.consumed_credits ?? "unknown"} balance=${await getBalance()}`);
}

console.log(`BATCH COMPLETE consumed=${consumed} limit=${batch.creditLimit}`);

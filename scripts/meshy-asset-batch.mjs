import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_ROOTS = {
  v1: "https://api.meshy.ai/openapi/v1",
  v2: "https://api.meshy.ai/openapi/v2",
};
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

const batchMode = batch.mode ?? "image-to-3d";

if (!execute) {
  console.log(JSON.stringify({ batch: batchName, mode: batchMode, creditLimit: batch.creditLimit, assets: batch.assets }, null, 2));
  console.log("Dry run only. Add --execute to create paid Meshy tasks.");
  process.exit(0);
}

const apiKey = process.env.MESHY_API_KEY;
if (!apiKey) throw new Error("MESHY_API_KEY is not set");

const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

async function apiRequest(endpoint, options = {}, apiVersion = "v1") {
  const response = await fetch(`${API_ROOTS[apiVersion]}${endpoint}`, {
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

async function download(url, destination, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(destination, buffer);
      return;
    } catch (error) {
      // CDN zna imati timeoute; task je vec placen pa ne smijemo srusiti batch
      if (attempt === attempts) throw error;
      console.log(`RETRY download ${attempt}/${attempts} ${destination}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
    }
  }
}

async function pollTask(taskId, endpointBase = "/image-to-3d", apiVersion = "v1") {
  while (true) {
    const task = await apiRequest(`${endpointBase}/${taskId}`, { method: "GET" }, apiVersion);
    console.log(`${taskId} ${task.status} ${task.progress ?? 0}%`);
    if (TERMINAL_STATUSES.has(task.status)) return task;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function createTaskOrHalt(endpoint, payload, apiVersion, assetId) {
  try {
    return await apiRequest(endpoint, { method: "POST", body: JSON.stringify(payload) }, apiVersion);
  } catch (error) {
    if (config.policy.haltHttpStatuses.includes(error.status)) {
      console.log(`STOP Meshy HTTP ${error.status} before ${assetId}`);
      return null;
    }
    throw error;
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

  const taskRoot = path.join(root, config.sourceRoot, asset.id);
  await mkdir(taskRoot, { recursive: true });

  let task;
  let requestSummary;

  if (batchMode === "text-to-3d") {
    // Dvostepeno: preview (geometrija) pa refine (PBR teksture)
    const previewPayload = {
      mode: "preview",
      prompt: asset.prompt,
      ...(config.textTo3dDefaults ?? {}),
    };
    requestSummary = previewPayload;
    const previewCreated = await createTaskOrHalt("/text-to-3d", previewPayload, "v2", asset.id);
    if (!previewCreated) break;
    const previewTask = await pollTask(previewCreated.result, "/text-to-3d", "v2");
    if (previewTask.status !== "SUCCEEDED") {
      console.log(`STOP ${asset.id} preview finished as ${previewTask.status}`);
      break;
    }
    const refineCreated = await createTaskOrHalt(
      "/text-to-3d",
      { mode: "refine", preview_task_id: previewCreated.result, enable_pbr: true },
      "v2",
      asset.id
    );
    if (!refineCreated) break;
    task = await pollTask(refineCreated.result, "/text-to-3d", "v2");
    task.consumed_credits =
      (previewTask.consumed_credits ?? 5) + (task.consumed_credits ?? 10);
  } else {
    const referencePath = path.join(root, asset.reference);
    const payload = {
      ...config.imageTo3dDefaults,
      image_url: await imageDataUri(referencePath),
      texture_image_url: await imageDataUri(referencePath),
    };
    requestSummary = {
      ...config.imageTo3dDefaults,
      image_url: "[local reference omitted]",
      texture_image_url: "[local reference omitted]",
    };
    const created = await createTaskOrHalt("/image-to-3d", payload, "v1", asset.id);
    if (!created) break;
    task = await pollTask(created.result, "/image-to-3d", "v1");
  }

  const metadata = {
    id: task.id,
    label: asset.label,
    mode: batchMode,
    status: task.status,
    created_at: task.created_at,
    finished_at: task.finished_at,
    consumed_credits: task.consumed_credits ?? 0,
    source_reference: asset.reference ?? null,
    prompt: asset.prompt ?? null,
    request: requestSummary,
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

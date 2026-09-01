import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_ROOT = "https://api.meshy.ai/openapi/v1";
const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELED"]);
const POLL_INTERVAL_MS = 5000;

const args = process.argv.slice(2);
const batchName = args[args.indexOf("--batch") + 1];
const execute = args.includes("--execute");
const root = process.cwd();
const config = JSON.parse(await readFile(path.join(root, "config/meshy-assets.json"), "utf8"));
const batch = config.riggingBatches?.[batchName];

if (!batchName || !batch) {
  throw new Error(`Unknown rigging batch. Available: ${Object.keys(config.riggingBatches ?? {}).join(", ")}`);
}

const plannedCredits = batch.assets.reduce(
  (sum, asset) =>
    sum +
    asset.expectedRigCredits +
    asset.animations.reduce((animationSum, animation) => animationSum + animation.expectedCredits, 0),
  0
);

if (plannedCredits > batch.creditLimit) {
  throw new Error(`Rigging batch requests ${plannedCredits} credits but limit is ${batch.creditLimit}`);
}

if (!execute) {
  console.log(JSON.stringify({ batch: batchName, plannedCredits, creditLimit: batch.creditLimit, assets: batch.assets }, null, 2));
  console.log("Dry run only. Add --execute to create paid Meshy rigging and animation tasks.");
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
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  if (!response.ok) {
    const error = new Error(`Meshy HTTP ${response.status}: ${body.message ?? body.detail ?? "request failed"}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function createTaskOrHalt(endpoint, payload, label) {
  try {
    return await apiRequest(endpoint, { method: "POST", body: JSON.stringify(payload) });
  } catch (error) {
    if (config.policy.haltHttpStatuses.includes(error.status)) {
      console.log(`STOP Meshy HTTP ${error.status} before ${label}`);
      return null;
    }
    throw error;
  }
}

async function pollTask(endpoint, taskId) {
  while (true) {
    const task = await apiRequest(`${endpoint}/${taskId}`, { method: "GET" });
    console.log(`${taskId} ${task.status} ${task.progress ?? 0}%`);
    if (TERMINAL_STATUSES.has(task.status)) return task;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function getBalance() {
  return (await apiRequest("/balance", { method: "GET" })).balance;
}

async function download(url, destination, attempts = 3) {
  if (!url) return;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed ${response.status}`);
      await writeFile(destination, Buffer.from(await response.arrayBuffer()));
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.log(`RETRY download ${attempt}/${attempts} ${path.basename(destination)}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
    }
  }
}

async function ensureBudget(expectedCredits, label, consumed) {
  if (consumed + expectedCredits > batch.creditLimit) {
    console.log(`STOP batch credit limit reached before ${label}`);
    return false;
  }
  const balance = await getBalance();
  if (balance < expectedCredits) {
    console.log(`STOP insufficient balance before ${label}: ${balance}`);
    return false;
  }
  return true;
}

function publicTaskMetadata(task, extra = {}) {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    created_at: task.created_at,
    finished_at: task.finished_at,
    consumed_credits: task.consumed_credits ?? 0,
    task_error: task.task_error?.message || null,
    ...extra,
  };
}

let consumed = 0;

for (const asset of batch.assets) {
  const assetRoot = path.join(root, config.sourceRoot, asset.id, "rig-v1");
  await mkdir(assetRoot, { recursive: true });

  const reusingRig = Boolean(asset.existingRigTaskId);
  let rigTask;
  if (reusingRig) {
    rigTask = await apiRequest(`/rigging/${asset.existingRigTaskId}`, { method: "GET" });
    console.log(`REUSE ${asset.id} rig ${rigTask.id} status=${rigTask.status}`);
  } else {
    if (!(await ensureBudget(asset.expectedRigCredits, `${asset.id} rig`, consumed))) break;
    const rigCreated = await createTaskOrHalt(
      "/rigging",
      { input_task_id: asset.inputTaskId, height_meters: asset.heightMeters },
      `${asset.id} rig`
    );
    if (!rigCreated) break;
    rigTask = await pollTask("/rigging", rigCreated.result);
    await writeFile(
      path.join(assetRoot, "rig-task.json"),
      `${JSON.stringify(publicTaskMetadata(rigTask, { label: asset.label, input_task_id: asset.inputTaskId }), null, 2)}\n`
    );
  }
  if (rigTask.status !== "SUCCEEDED" || !rigTask.result?.rigged_character_glb_url) {
    console.log(`STOP ${asset.id} rig finished as ${rigTask.status}`);
    break;
  }
  if (!reusingRig) consumed += rigTask.consumed_credits ?? asset.expectedRigCredits;

  if (!reusingRig) {
    const basic = rigTask.result.basic_animations ?? {};
    await Promise.all([
      download(rigTask.result.rigged_character_glb_url, path.join(assetRoot, "rigged-character.glb")),
      download(rigTask.result.rigged_character_fbx_url, path.join(assetRoot, "rigged-character.fbx")),
      download(basic.walking_glb_url, path.join(assetRoot, "walk.glb")),
      download(basic.walking_fbx_url, path.join(assetRoot, "walk.fbx")),
      download(basic.walking_armature_glb_url, path.join(assetRoot, "walk-armature.glb")),
      download(basic.running_glb_url, path.join(assetRoot, "run.glb")),
      download(basic.running_fbx_url, path.join(assetRoot, "run.fbx")),
      download(basic.running_armature_glb_url, path.join(assetRoot, "run-armature.glb")),
    ]);
  }

  for (const animation of asset.animations) {
    const label = `${asset.id} ${animation.id}`;
    if (!(await ensureBudget(animation.expectedCredits, label, consumed))) break;
    const animationCreated = await createTaskOrHalt(
      "/animations",
      { rig_task_id: rigTask.id, action_id: animation.actionId },
      label
    );
    if (!animationCreated) break;
    const animationTask = await pollTask("/animations", animationCreated.result);
    await writeFile(
      path.join(assetRoot, `${animation.id}-task.json`),
      `${JSON.stringify(publicTaskMetadata(animationTask, { rig_task_id: rigTask.id, action_id: animation.actionId }), null, 2)}\n`
    );
    if (animationTask.status !== "SUCCEEDED" || !animationTask.result?.animation_glb_url) {
      console.log(`STOP ${label} finished as ${animationTask.status}`);
      break;
    }
    consumed += animationTask.consumed_credits ?? animation.expectedCredits;
    await Promise.all([
      download(animationTask.result.animation_glb_url, path.join(assetRoot, `${animation.id}.glb`)),
      download(animationTask.result.animation_fbx_url, path.join(assetRoot, `${animation.id}.fbx`)),
    ]);
  }

  console.log(`SAVED ${asset.id} combat rig balance=${await getBalance()}`);
}

console.log(`RIGGING BATCH COMPLETE consumed=${consumed} limit=${batch.creditLimit}`);

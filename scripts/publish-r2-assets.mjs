import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const API_BASE = "https://api.cloudflare.com/client/v4";
const MAX_TARBALL_BYTES = 256 * 1024 * 1024;
const PLUGIN_SLUG = "nano-kit";

const root = process.cwd();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const apiToken = process.env.CLOUDFLARE_API_TOKEN || "";
const bucketName = process.env.W3KITS_PLUGIN_BUCKET_NAME || `w3kits-plugin-${PLUGIN_SLUG}`;
const assetOrigin = process.env.W3KITS_PLUGIN_ASSET_ORIGIN || `https://plugin-${PLUGIN_SLUG}.w3kits.com`;

if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
if (!apiToken) throw new Error("CLOUDFLARE_API_TOKEN is required");

const packResult = JSON.parse(
  execFileSync("npm", ["pack", "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);

const tarballFile = packResult?.[0]?.filename;
if (!tarballFile) throw new Error("npm_pack_output_missing");

const tarballPath = path.join(root, tarballFile);
const tarballBytes = fs.readFileSync(tarballPath);
if (tarballBytes.byteLength > MAX_TARBALL_BYTES) throw new Error("package_tarball_too_large");

const integrity = `sha512-${crypto.createHash("sha512").update(tarballBytes).digest("base64")}`;
await uploadR2Object("__w3kits/package.tgz", tarballBytes, "application/gzip");

let uploadedObjects = 1;
let uploadedBytes = tarballBytes.byteLength;

for (const entry of extractTarEntries(tarballBytes).filter((item) => isMirrorPath(item.path))) {
  const objectKey = mirrorObjectKey(entry.path);
  await uploadR2Object(objectKey, entry.bytes, contentTypeForPath(objectKey));
  uploadedObjects += 1;
  uploadedBytes += entry.bytes.byteLength;
}

console.log(
  JSON.stringify({
    bucketName,
    tarball: `${assetOrigin}/__w3kits/package.tgz`,
    integrity,
    uploadedObjects,
    uploadedBytes,
  }),
);

async function uploadR2Object(objectKey, body, contentType) {
  const url = `${API_BASE}/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodeR2ObjectKey(objectKey)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": contentType || "application/octet-stream",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(`r2_upload_failed_${response.status}: ${JSON.stringify(payload.errors || payload)}`);
  }
  console.log(`uploaded ${objectKey}`);
}

function extractTarEntries(tarballBytes) {
  const tar = maybeGunzip(tarballBytes);
  const decoder = new TextDecoder();
  const entries = [];
  let offset = 0;
  while (offset + 512 <= tar.byteLength) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) return entries;
    const name = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, "");
    const prefix = decoder.decode(header.subarray(345, 500)).replace(/\0.*$/, "");
    const fullName = (prefix ? `${prefix}/${name}` : name).replace(/^\/+/, "");
    const size = Number.parseInt(decoder.decode(header.subarray(124, 136)).replace(/\0.*$/, "").trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 0) || "0";
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > tar.byteLength || !Number.isFinite(size) || size < 0) throw new Error("invalid_package_tarball");
    if (type === "0" || type === "\0") entries.push({ path: fullName, bytes: tar.subarray(bodyStart, bodyEnd) });
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function isMirrorPath(filePath) {
  return filePath.startsWith("package/dist/") || filePath.startsWith("package/shared/");
}

function mirrorObjectKey(filePath) {
  if (filePath.startsWith("package/dist/")) return filePath.replace(/^package\/dist\//, "");
  if (filePath.startsWith("package/shared/")) return filePath.replace(/^package\//, "");
  return filePath.replace(/^package\//, "");
}

function contentTypeForPath(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function maybeGunzip(bytes) {
  if (bytes.byteLength >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return new Uint8Array(gunzipSync(bytes));
  return bytes;
}

function encodeR2ObjectKey(key) {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

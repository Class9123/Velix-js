import fs from "fs";
import path from "path";
import transformPri from "../compiler/index.js";
import { throwVelixError } from "../compiler/helpers/error.js";
const cacheMap = new Map();

function normalizePath(filePath) {
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
}

function readMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch (err) {
    throwVelixError(err, {
      stage: "read",
      filePath,
      message: `Failed to read component file: ${filePath}`
    });
  }
}

export function invalidateCachedComponent(filePath) {
  cacheMap.delete(normalizePath(filePath));
}

export default function scanAndCache(filePath) {
  const normalizedPath = normalizePath(filePath);
  const mtime = readMtime(normalizedPath);
  const cached = cacheMap.get(normalizedPath);

  if (cached?.mtime === mtime) return cached.data;

  const data = scanComponent(normalizedPath);
  cacheMap.set(normalizedPath, { mtime, data });
  return data;
}

function scanComponent(filePath) {
  let code = "";
  try {
    code = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throwVelixError(err, {
      stage: "read",
      filePath,
      message: `Failed to read component file: ${filePath}`
    });
  }

  try {
    const out = transformPri(code, filePath);
    out.__filePath = filePath;
    return out;
  } catch (err) {
    throwVelixError(err, {
      stage: "compile",
      filePath,
      sourceCode: code
    });
  }
}

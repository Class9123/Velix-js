import fs from "fs";
import transformPri from "../compiler/index.js";
import { throwVelixError } from "../compiler/helpers/error.js";
const cacheMap = new Map();

export default function scanAndCache(absFile) {
  let data = cacheMap.get(absFile);
  if (!data) {
    data = scanComponent(absFile);
    cacheMap.set(absFile, data);
  }
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

import scanAndCache from "../../plugin/scanComponent.js"
import { throwVelixError } from "./error.js";

const MAX_RENDER_DEPTH = 120;
const MAX_EXPANSIONS = 20000;

function replaceFirst(str, search, replacement) {
  const idx = str.indexOf(search);
  if (idx < 0) return str;
  return str.slice(0, idx) + replacement + str.slice(idx + search.length);
}

function resolveComponentName(compiled, requested) {
  if (!compiled || !compiled.html) {
    throw new Error("Invalid compiled component payload");
  }
  if (compiled.html[requested]) return requested;

  const names = Object.keys(compiled.html);
  throw new Error(
    `Component "${requested}" was not found in file "${compiled.__filePath || "unknown"}". Available: ${names.join(", ") || "none"}`
  );
}

function expandComponent(compiled, cmpName, state, ownerFile) {
  if (state.depth > MAX_RENDER_DEPTH) {
    throw new Error(
      `Max component nesting depth (${MAX_RENDER_DEPTH}) exceeded while expanding "${cmpName}"`
    );
  }
  if (state.expansions > MAX_EXPANSIONS) {
    throw new Error(
      `Max component expansions (${MAX_EXPANSIONS}) exceeded. Possible cyclic reference.`
    );
  }

  const resolvedName = resolveComponentName(compiled, cmpName);
  const key = `${ownerFile}::${resolvedName}`;
  if (state.active.has(key)) {
    throw new Error(
      `Circular component reference detected at "${key}".`
    );
  }
  if (state.memo.has(key)) return state.memo.get(key);

  const entry = compiled.html[resolvedName];
  if (!entry) {
    throw new Error(`Component entry "${resolvedName}" does not exist.`);
  }

  state.active.add(key);
  state.depth++;
  let html = String(entry.html || "");
  const deps = Array.isArray(entry.deps) ? entry.deps : [];

  for (const dep of deps) {
    state.expansions++;
    const targetFile = dep.filePath === "self" ? ownerFile : dep.filePath;
    const targetCompiled =
      dep.filePath === "self" ? compiled : scanAndCache(targetFile);
    const replacement = expandComponent(
      targetCompiled,
      dep.name,
      state,
      targetFile
    );

    if (dep.placeholder) {
      html = replaceFirst(html, dep.placeholder, replacement);
    } else {
      // Backward-compatible path for old compile output.
      html = replaceFirst(html, `<${dep.name}/>`, replacement);
    }
  }

  state.depth--;
  state.active.delete(key);
  state.memo.set(key, html);
  return html;
}

export default function addHtml(obj, cmpName) {
  const ownerFile = obj.__filePath || "__root__";
  try {
    return expandComponent(
      obj,
      cmpName,
      {
        active: new Set(),
        memo: new Map(),
        depth: 0,
        expansions: 0
      },
      ownerFile
    );
  } catch (err) {
    throwVelixError(err, {
      stage: "expand",
      filePath: ownerFile,
      component: cmpName
    });
  }
}

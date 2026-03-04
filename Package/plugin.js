import scanAndCache from "./plugin/scanComponent.js";
import { formatHtml } from "./compiler/helpers/index.js";
import addComponentHtml from "./compiler/helpers/addhtml.js";
import { formatVelixError, toVelixError } from "./compiler/helpers/error.js";

function pickComponentName(data, fallbackName = "default") {
  if (data?.html?.[fallbackName]) return fallbackName;
  if (data?.html?.default) return "default";
  const names = Object.keys(data?.html || {});
  return names.length ? names[0] : null;
}

function reportVelixError(err, context = {}) {
  const normalized = toVelixError(err, context);
  console.error("\n" + formatVelixError(normalized, context) + "\n");
  throw normalized;
}

export default function Scan() {
  const rootFile = "src/App.jsx";

  return {
    name: "vite-scan-velixJs-plugin",
    configureServer(server) {
      try {
        scanAndCache(rootFile);
      } catch (err) {
        reportVelixError(err, { filePath: rootFile, stage: "startup" });
      }
      server.watcher.add(rootFile);
    },

    transformIndexHtml(indexHtml) {
      try {
        let html;
        const data = scanAndCache(rootFile);
        const rootCmp = pickComponentName(data, "App");
        if (!rootCmp) {
          throw new Error(`No components compiled from ${rootFile}`);
        }

        html = addComponentHtml(data, rootCmp);
        indexHtml = indexHtml.replace(
          /<div id="app">\s*<\/div>/,
          `<div id="app">${html}</div> 
        <script> 
        console.log(\`${formatHtml(html)}\`)
        </script>`
        );
        return indexHtml;
      } catch (err) {
        reportVelixError(err, { filePath: rootFile, stage: "html" });
      }
    },

    load(id) {
      if (!id.endsWith(".jsx")) return null;
      try {
        const absFile = id;
        const data = scanAndCache(absFile);
        const script =
          data?.script ||
          `
      export default function App(){
        console.log("Dev time ")
      }
      `;

        return script;
      } catch (err) {
        reportVelixError(err, { filePath: id, stage: "load" });
      }
    },
    handleHotUpdate({ file, server }) {
      if (!file.endsWith(".jsx")) return [];
      try {
        scanAndCache(file);
        server.restart();
      } catch (err) {
        reportVelixError(err, { filePath: file, stage: "hmr" });
      }
    }
  };
}

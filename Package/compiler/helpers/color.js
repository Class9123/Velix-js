import { printHighlight } from "@speed-highlight/core/terminal";

global.console.code = function (code = "", options = {}) {
  const source = String(code).trim();

  // hard fallback check (prevents silent failure)
  if (!source) {
    console.log("[console.code] empty input");
    return;
  }

  try {
    printHighlight(source, "js");
  } catch (err) {
    console.log(source);
  }
};

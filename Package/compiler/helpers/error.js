import chalk from "chalk";
import path from "path";

function asNumber(n) {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function indexToLoc(source, index) {
  if (typeof source !== "string" || source.length === 0) return null;
  if (typeof index !== "number" || index < 0) return null;
  let line = 1;
  let column = 1;
  for (let i = 0; i < source.length && i < index; i++) {
    if (source[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

export function toVelixError(err, context = {}) {
  const original = err instanceof Error ? err : new Error(String(err));
  const out = new Error(original.message);
  out.name = original.name || "VelixError";
  out.cause = original;

  out.velix = {
    filePath:
      context.filePath ||
      original.velix?.filePath ||
      original.filePath ||
      original.path ||
      null,
    sourceCode:
      context.sourceCode ?? original.velix?.sourceCode ?? context.code ?? null,
    stage: context.stage || original.velix?.stage || null,
    message: context.message || original.velix?.message || original.message,
    component: context.component || original.velix?.component || null,
    loc:
      context.loc ||
      original.velix?.loc ||
      (original.loc
        ? {
            line: asNumber(original.loc.line),
            column:
              asNumber(original.loc.column) !== null
                ? original.loc.column + 1
                : null
          }
        : null)
  };

  if (
    !out.velix.loc &&
    asNumber(original.pos) !== null &&
    out.velix.sourceCode
  ) {
    out.velix.loc = indexToLoc(out.velix.sourceCode, original.pos);
  }

  return out;
}

function codeFrame(sourceCode, line, column) {
  if (!sourceCode || !line) return "";
  const lines = String(sourceCode).split(/\r?\n/);
  const start = Math.max(1, line - 1);
  const end = Math.min(lines.length, line + 1);
  const width = String(end).length;
  let out = "";
  for (let n = start; n <= end; n++) {
    const marker = n === line ? chalk.red(">") : " ";
    out += `${marker} ${chalk.gray(String(n).padStart(width, " "))} | ${lines[n - 1] ?? ""}\n`;
    if (n === line) {
      const caretPad = " ".repeat(Math.max(0, (column || 1) - 1));
      out += `  ${" ".repeat(width)} | ${caretPad}${chalk.red("^")}\n`;
    }
  }
  return out.trimEnd();
}

export function formatVelixError(err, fallback = {}) {
  const normalized = err?.velix ? err : toVelixError(err, fallback);
  const p = normalized.velix || {};
  const loc = p.loc || {};
  const filePath = p.filePath || fallback.filePath || "unknown";
  const rel =
    filePath === "unknown" ? filePath : path.relative(process.cwd(), filePath);
  const relFile =
    rel === "unknown" || (!rel.startsWith("..") && !path.isAbsolute(rel))
      ? rel
      : filePath;
  const where =
    loc.line != null ? `${relFile}:${loc.line}:${loc.column || 1}` : relFile;
  const title = chalk.bgRed.white.bold(" PRIVO ERROR ");
  const stage = p.stage ? chalk.magenta(`[${p.stage}]`) : "";
  const head = `${title} ${stage} ${chalk.cyan(where)}`.trim();
  const message = chalk.white(
    p.message || normalized.message || "Unknown error"
  );
  const component = p.component
    ? `\n${chalk.yellow("Component:")} ${p.component}`
    : "";
  const frame =
    p.sourceCode && loc.line
      ? `\n\n${codeFrame(p.sourceCode, loc.line, loc.column || 1)}`
      : "";
  return `${head}\n${message}${component}${frame}`;
}

export function throwVelixError(err, context = {}) {
  throw toVelixError(err, context);
}

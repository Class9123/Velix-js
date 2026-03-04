import path from 'path';
import fs from "fs";
import pkg from "js-beautify";

const { js: beautifyJs, html: beautifyHtml } = pkg;
export function formatJs(js) {
  const prettyJs = beautifyJs(js, {
    indent_size: 2,
    space_in_empty_paren: true
  });
  return prettyJs;
}

export function formatHtml(html) {
  const prettyHtml = beautifyHtml(html, { indent_size: 2 });
  return prettyHtml;
}

function isComponentTag(tag) {
  return /^[A-Z]/.test(tag);
}

function getTagName(node) {
  if (isElement(node)) return node.type;
  else throw new Error("getTagName Error: Unknown type of node");
}

function isElement(node) {
  return !node.type.startsWith("#");
}

function getText(node) {
  if (isText(node) || isJsx(node)) return node.nodeValue;
  else throw new Error("getText Error: Unknown type of node");
}

function isText(node) {
  return node.type === "#text";
}

function isJsx(node) {
  return node.type === "#jsx";
}

function getType(node) {
  let type;
  if (isText(node) || isJsx(node)) type = "Text";
  else if (isElement(node)) type = "Node";
  return type;
}

export {
  getTagName,
  isElement,
  isText,
  isJsx,
  getType,
  getText,
  isComponentTag
};



/**
 * Resolve absolute path of imported file (ESM)
 * @param {string} importerAbsPath - Absolute path of the importer file
 * @param {string} importedRelPath - Relative path of the imported file
 * @returns {string} Absolute path of the imported file
 */
export function resolveImportedPath(importerAbsPath, importedRelPath) {
  const importerDir = path.dirname(importerAbsPath);
  const absBase = path.resolve(importerDir, importedRelPath);
  const candidates = [
    absBase,
    `${absBase}.jsx`,
    `${absBase}.js`,
    path.join(absBase, "index.jsx"),
    path.join(absBase, "index.js")
  ];

  for (const file of candidates) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return absBase;
}

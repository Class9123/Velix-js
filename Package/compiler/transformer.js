/* Ai generated */
import uidGenerator from "./helpers/uid.js";
import ConditionalPr from "./processor/conditional.js";
import LoopPr from "./processor/loopPr.js";
import ComponentPr from "./processor/componentPr.js";

import generate from "@babel/generator";
import * as t from "@babel/types";

import { isComponentTag, resolveImportedPath } from "./helpers/index.js";
import { throwVelixError } from "./helpers/error.js";
import { isValidHTMLNesting } from 'validate-html-nesting';


/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function isPrimitiveLiteral(node) {
  return (
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isBooleanLiteral(node) ||
    t.isNullLiteral(node)
  );
}

function isEventAttribute(name) {
  return /^on[A-Z]/.test(name) || /^on[a-z]/.test(name);
}

function getTagName(node) {
  if (t.isJSXIdentifier(node)) {
    return node.name;
  }

  if (t.isJSXMemberExpression(node)) {
    return `${getTagName(node.object)}.${getTagName(node.property)}`;
  }

  if (t.isJSXNamespacedName(node)) {
    return `${node.namespace.name}:${node.name.name}`;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*                          DIRECTIVE PLUGIN MANAGER                          */
/* -------------------------------------------------------------------------- */

class DirectivePluginManager {
  constructor(core) {
    this.core = core;
    this.byDirective = new Map();
  }

  register(plugin) {
    if (
      !plugin ||
      typeof plugin.directive !== "string" ||
      typeof plugin.transform !== "function"
    ) {
      throw new Error(
        "Invalid directive plugin. Expected { directive, transform() }"
      );
    }

    const list = this.byDirective.get(plugin.directive) || [];

    // prevent duplicates
    if (list.includes(plugin)) return;

    list.push(plugin);

    list.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    this.byDirective.set(plugin.directive, list);
  }

  run(path, directives) {
    for (const directive of directives) {
      const plugins = this.byDirective.get(directive.name);

      if (!plugins?.length) continue;

      for (const plugin of plugins) {
        const result = plugin.transform({
          core: this.core,
          path,
          directive,
          directives
        });

        if (result?.handled) {
          return result;
        }
      }
    }

    return { handled: false };
  }
}

/* -------------------------------------------------------------------------- */
/*                                TRANSFORMER                                 */
/* -------------------------------------------------------------------------- */

class Transformer {
  constructor(options = {}) {
    this.MAX_PATH_LENGTH = 15;

    this.resolveSelfComponentName =
      typeof options.resolveSelfComponentName === "function"
        ? options.resolveSelfComponentName
        : null;

    this.structuralDirectives = new Set(["$if", "$for"]);

    this.pluginManager = new DirectivePluginManager(this);

    this.componentProcessor = new ComponentPr(this);

    this.codegenCache = new WeakMap();

    this.registerDefaultPlugins();
  }

  /* ---------------------------------------------------------------------- */
  /*                             PLUGIN SYSTEM                              */
  /* ---------------------------------------------------------------------- */

  registerDefaultPlugins() {
    this.pluginManager.register(new ConditionalPr(this));
    this.pluginManager.register(new LoopPr(this));
  }

  /* ---------------------------------------------------------------------- */
  /*                                CONTEXT                                 */
  /* ---------------------------------------------------------------------- */

  reset(filePath) {
    this.filePath = filePath;

    this.obj = {
      html: "",
      script: "",
      deps: []
    };

    this.path = ["_$root"];

    this.uidGen = uidGenerator();

    this.codegenCache = new WeakMap();
  }

  /* ---------------------------------------------------------------------- */
  /*                             CODEGEN CACHE                              */
  /* ---------------------------------------------------------------------- */

  codeOf(node) {
    if (!node) return "";

    const cached = this.codegenCache.get(node);

    if (cached) return cached;

    const code = generate.default(node).code;

    this.codegenCache.set(node, code);

    return code;
  }

  /* ---------------------------------------------------------------------- */
  /*                               PATH HELPERS                             */
  /* ---------------------------------------------------------------------- */

  withPath(segment, fn) {
    this.path.push(segment);

    try {
      return fn();
    } finally {
      this.path.pop();
    }
  }

  withClonedPath(fn) {
    const prev = [...this.path];

    try {
      return fn();
    } finally {
      this.path = prev;
    }
  }

  compressPathIfNeeded() {
    if (this.path.length % this.MAX_PATH_LENGTH !== 0) {
      return;
    }

    const id = this.uidGen.nextRefrence();

    this.add(`const ${id} = ${this.joinPath()}`);

    this.path.push(id);
  }

  joinPath() {
    for (let i = this.path.length - 1; i >= 0; i--) {
      const item = this.path[i];

      if (item.startsWith("_$")) {
        return this.path.slice(i).join(".");
      }
    }

    return "";
  }

  /* ---------------------------------------------------------------------- */
  /*                               UTILITIES                                */
  /* ---------------------------------------------------------------------- */

  add(js) {
    this.obj.script += `${js}\n`;
  }

  escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  throwCompileError(message, node) {
    const loc = node?.loc?.start;

    throwVelixError(new Error(message), {
      stage: "compile",
      filePath: this.filePath,
      loc: loc
        ? {
          line: loc.line,
          column: loc.column + 1
        }
        : null
    });
  }

  /* ---------------------------------------------------------------------- */
  /*                          COMPONENT RESOLUTION                          */
  /* ---------------------------------------------------------------------- */

  resolveComponentDep(path, tag) {
    const binding = path.scope.getBinding(tag);

    if (!binding) {
      const selfResolved = this.resolveSelfComponentName?.(path, tag);

      if (selfResolved) {
        return {
          filePath: "self",
          name: selfResolved
        };
      }

      this.throwCompileError(
        `Component "${tag}" is not defined in this scope.`,
        path.node.openingElement?.name
      );
    }

    if (
      binding.path.isImportDefaultSpecifier() ||
      binding.path.isImportSpecifier()
    ) {
      const importDecl = binding.path.parent;

      const src = importDecl?.source?.value;

      if (!src || !this.filePath) {
        return {
          filePath: "self",
          name: tag
        };
      }

      const absFile = resolveImportedPath(this.filePath, src);

      const exportedName = binding.path.isImportDefaultSpecifier()
        ? "default"
        : binding.path.node.imported.name;

      return {
        filePath: absFile,
        name: exportedName
      };
    }

    const selfResolved = this.resolveSelfComponentName?.(path, tag);

    return {
      filePath: "self",
      name: selfResolved || tag
    };
  }

  /* ---------------------------------------------------------------------- */
  /*                              DIRECTIVES                                */
  /* ---------------------------------------------------------------------- */

  isDirectiveAttribute(attr) {
    return (
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name.startsWith("$")
    );
  }

  isStructuralDirective(name) {
    return this.structuralDirectives.has(name);
  }

  collectDirectives(path) {
    const attrs = path.node.openingElement.attributes || [];

    const directives = [];

    for (const attr of attrs) {
      if (!this.isDirectiveAttribute(attr)) continue;

      const name = attr.name.name;

      let expressionCode = "true";

      if (attr.value == null) {
        expressionCode = "true";
      } else if (t.isStringLiteral(attr.value)) {
        expressionCode = JSON.stringify(attr.value.value);
      } else if (t.isJSXExpressionContainer(attr.value)) {
        if (!attr.value.expression) {
          this.throwCompileError(
            `Empty directive expression for "${name}"`,
            attr
          );
        }

        expressionCode = this.codeOf(attr.value.expression);
      } else {
        this.throwCompileError(
          `Unsupported directive value for "${name}"`,
          attr
        );
      }

      directives.push({
        name,
        expressionCode,
        node: attr
      });
    }

    return directives;
  }

  /* ---------------------------------------------------------------------- */
  /*                             ATTRIBUTE HTML                             */
  /* ---------------------------------------------------------------------- */

  getStaticAttributeMarkup(path, options = {}) {
    const { includeDirectives = false } = options;

    const attrs = path.node.openingElement.attributes || [];

    let out = "";

    for (const attr of attrs) {
      if (t.isJSXSpreadAttribute(attr)) continue;

      if (!t.isJSXAttribute(attr)) continue;

      if (!t.isJSXIdentifier(attr.name)) continue;

      const key = attr.name.name;

      if (!includeDirectives && key.startsWith("$")) {
        continue;
      }

      if (attr.value == null) {
        out += ` ${key}`;
        continue;
      }

      if (t.isStringLiteral(attr.value)) {
        out += ` ${key}="${this.escapeAttr(attr.value.value)}"`;
        continue;
      }

      if (!t.isJSXExpressionContainer(attr.value)) {
        continue;
      }

      const expr = attr.value.expression;

      if (t.isNullLiteral(expr)) continue;

      if (t.isBooleanLiteral(expr)) {
        if (expr.value) {
          out += ` ${key}`;
        }

        continue;
      }

      if (
        t.isStringLiteral(expr) ||
        t.isNumericLiteral(expr)
      ) {
        out += ` ${key}="${this.escapeAttr(expr.value)}"`;
      }
    }

    return out;
  }

  /* ---------------------------------------------------------------------- */
  /*                           ATTRIBUTE RUNTIME                            */
  /* ---------------------------------------------------------------------- */

  emitSpreadAttribute(attr, targetExpr) {
    const expr = this.codeOf(attr.argument);

    const id = this.uidGen.nextElement();

    const spreadState = this.uidGen.nextMap();

    this.add(`
const ${id} = ${targetExpr}
const ${spreadState} = new Set()

_$.useEffect(() => {
  const _$spread = ${expr} || {}

  for (const key of Array.from(${spreadState})) {
    if (key in _$spread) continue

    if (key.startsWith("$")) {
      ${spreadState}.delete(key)
      continue
    }

    if (${isEventAttribute.toString()}(key)) {
      ${id}[key.toLowerCase()] = null
    } else {
      ${id}.removeAttribute(key)
    }

    ${spreadState}.delete(key)
  }

  for (const key of Object.keys(_$spread)) {
    if (key.startsWith("$")) continue

    const value = _$spread[key]

    if (${isEventAttribute.toString()}(key)) {
      ${id}[key.toLowerCase()] =
        typeof value === "function" ? value : null

      ${spreadState}.add(key)

      continue
    }

    if (value === false || value == null) {
      ${id}.removeAttribute(key)
    } else if (value === true) {
      ${id}.setAttribute(key, "")
    } else {
      ${id}.setAttribute(key, String(value))
    }

    ${spreadState}.add(key)
  }
})
`);
  }

  emitWhenDirective(attr, targetExpr) {
    const id = this.uidGen.nextElement();

    const storage = this.uidGen.nextComment();

    let expr = "true";

    if (attr.value && t.isJSXExpressionContainer(attr.value)) {
      expr = this.codeOf(attr.value.expression);
    } else if (attr.value && t.isStringLiteral(attr.value)) {
      expr = JSON.stringify(attr.value.value);
    }

    this.add(`
const ${id} = ${targetExpr}

let ${storage} = null

_$.useEffect(() => {
  const _$show = !!(${expr})

  if (_$show) {
    if (${storage} !== null) {
      ${id}.style.display = ${storage}
      ${storage} = null
    } else if (${id}.style.display === "none") {
      ${id}.style.removeProperty("display")
    }
  } else {
    if (${storage} === null) {
      ${storage} = ${id}.style.display || ""
    }

    ${id}.style.display = "none"
  }
})
`);
  }

  emitRefDirective(attr, targetExpr) {
    if (!attr.value || !t.isJSXExpressionContainer(attr.value)) {
      return;
    }

    const expr = this.codeOf(attr.value.expression);

    const id = this.uidGen.nextElement();

    this.add(`
const ${id} = ${targetExpr}

_$.useEffect(() => {
  const _$ref = ${expr}

  if (typeof _$ref === "function") {
    _$ref(${id})
  } else if (_$ref && typeof _$ref === "object") {
    _$ref.current = ${id}
  }
})
`);
  }

  emitDynamicAttribute(attr, targetExpr) {
    if (!t.isJSXAttribute(attr)) return;

    if (!t.isJSXIdentifier(attr.name)) return;

    const key = attr.name.name;

    if (key.startsWith("$")) return;

    if (this.isStructuralDirective(key)) return;

    if (!attr.value) return;

    if (t.isStringLiteral(attr.value)) return;

    if (!t.isJSXExpressionContainer(attr.value)) return;

    const exprNode = attr.value.expression;

    if (!exprNode || isPrimitiveLiteral(exprNode)) {
      return;
    }

    const expr = this.codeOf(exprNode);

    const id = this.uidGen.nextElement();

    if (isEventAttribute(key)) {
      const eventProp = key.toLowerCase();

      this.add(`
const ${id} = ${targetExpr}

_$.useEffect(() => {
  const _$handler = ${expr}

  ${id}.${eventProp} =
    typeof _$handler === "function"
      ? _$handler
      : null
})
`);

      return;
    }

    this.add(`
const ${id} = ${targetExpr}

_$.useEffect(() => {
  const _$value = ${expr}

  if (_$value === false || _$value == null) {
    ${id}.removeAttribute("${key}")
  } else if (_$value === true) {
    ${id}.setAttribute("${key}", "")
  } else {
    ${id}.setAttribute("${key}", String(_$value))
  }
})
`);
  }

  emitAttributeBindings(path, options = {}) {
    const {
      targetRef = null,
      includeDirectives = false
    } = options;

    const targetExpr = targetRef || this.joinPath();

    const attrs = path.node.openingElement.attributes || [];

    for (const attr of attrs) {
      if (t.isJSXSpreadAttribute(attr)) {
        this.emitSpreadAttribute(attr, targetExpr);
        continue;
      }

      if (!t.isJSXAttribute(attr)) continue;

      if (!t.isJSXIdentifier(attr.name)) continue;

      const key = attr.name.name;

      if (key === "$when") {
        this.emitWhenDirective(attr, targetExpr);
        continue;
      }

      if (key === "$ref") {
        this.emitRefDirective(attr, targetExpr);
        continue;
      }

      if (!includeDirectives && key.startsWith("$")) {
        continue;
      }

      this.emitDynamicAttribute(attr, targetExpr);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*                               HTML WRITE                               */
  /* ---------------------------------------------------------------------- */

  writeOpeningTag(path, options = {}) {
    const tag = getTagName(path.node.openingElement.name);

    const attrs = this.getStaticAttributeMarkup(path, options);

    const selfClosing = path.node.openingElement.selfClosing;

    this.obj.html += selfClosing
      ? `<${tag}${attrs}/>`
      : `<${tag}${attrs}>`;
  }

  writeClosingTag(path) {
    const selfClosing = path.node.openingElement.selfClosing;

    if (selfClosing) return;

    const tag = getTagName(path.node.openingElement.name);

    this.obj.html += `</${tag}>`;
  }

  /* ---------------------------------------------------------------------- */
  /*                              RENDERING                                 */
  /* ---------------------------------------------------------------------- */

  renderElement(path, options = {}) {
    const {
      includeDirectives = false,
      targetRef = null,
      processChildren = true
    } = options;

    this.withClonedPath(() => {
      if (targetRef) {
        this.path.push(targetRef);
      }

      this.writeOpeningTag(path, {
        includeDirectives
      });

      this.emitAttributeBindings(path, {
        targetRef,
        includeDirectives
      });

      if (
        !path.node.openingElement.selfClosing &&
        processChildren
      ) {
        this.processChildren(path);
      }

      this.writeClosingTag(path);
    });
  }

  /* ---------------------------------------------------------------------- */
  /*                               PROCESSING                               */
  /* ---------------------------------------------------------------------- */

  processTextGroup(paths) {
    const id = this.uidGen.nextTextNode();

    let hasExpression = false;

    const expr = paths
      .map(path => {
        if (path.isJSXText()) {
          this.obj.html += path.node.value;

          return JSON.stringify(path.node.value);
        }

        if (
          path.isJSXExpressionContainer() &&
          path.node.expression
        ) {
          hasExpression = true;

          return `String(${this.codeOf(path.node.expression)})`;
        }

        return '""';
      })
      .join(" + ");

    if (!hasExpression) {
      return;
    }

    this.obj.html += " ";

    this.add(`
const ${id} = ${this.joinPath()}

_$.useEffect(() => {
  ${id}.nodeValue = ${expr}
})
`);
  }

  process(path) {
    if (!path) return;

    /* ------------------------------------------------------------------ */
    /*                             GROUP NODES                            */
    /* ------------------------------------------------------------------ */

    if (Array.isArray(path)) {
      this.processTextGroup(path);
      return;
    }

    /* ------------------------------------------------------------------ */
    /*                             JSX FRAGMENT                           */
    /* ------------------------------------------------------------------ */

    if (path.isJSXFragment()) {
      this.processChildren(path);
      return;
    }

    /* ------------------------------------------------------------------ */
    /*                              JSX ELEMENT                           */
    /* ------------------------------------------------------------------ */
    if (path.isJSXElement()) {
      const opening = path.node.openingElement;

      const tag = getTagName(opening.name);

      if (!tag) {
        this.throwCompileError(
          "Unsupported JSX tag type.",
          opening.name
        );
      }

      const parent = path.parentPath;
      if (
        parent?.isJSXElement()
      ) {
        const parentTag = getTagName(
          parent.node.openingElement.name
        );

        const valid = isValidHTMLNesting(
          parentTag,
          tag
        );

        if (!valid) {
          this.throwCompileError(
            `Invalid HTML nesting: <${tag}> inside <${parentTag}>`,
            opening.name
          );
        }
      }

      if (isComponentTag(tag)) {
        this.componentProcessor.process(path);
        return;
      }

      const directives = this.collectDirectives(path);

      const structural = directives.filter(d =>
        this.isStructuralDirective(d.name)
      );

      if (structural.length > 1) {
        this.throwCompileError(
          `Only one structural directive is allowed per element. Found: ${structural
            .map(d => d.name)
            .join(", ")}`,
          opening.name
        );
      }

      if (directives.length) {
        const result = this.pluginManager.run(path, directives);

        if (result?.handled) {
          return;
        }
      }

      this.renderElement(path);

      return;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*                              CHILDREN                                  */
  /* ---------------------------------------------------------------------- */

  buildLogicalChildPaths(childPaths) {
    const logical = [];

    let buffer = [];

    const flush = () => {
      if (!buffer.length) return;

      logical.push(buffer);

      buffer = [];
    };

    for (const childPath of childPaths) {
      if (
        childPath.isJSXText() ||
        childPath.isJSXExpressionContainer()
      ) {
        buffer.push(childPath);
        continue;
      }

      flush();

      logical.push(childPath);
    }

    flush();

    return logical;
  }

  processChildren(input) {
    const childPaths = Array.isArray(input)
      ? input
      : input.get("children");

    const logicalChildren =
      this.buildLogicalChildPaths(childPaths);

    const originalPath = [...this.path];

    for (let i = 0; i < logicalChildren.length; i++) {
      this.path.push(i === 0 ? "f" : "n");

      this.compressPathIfNeeded();

      this.process(logicalChildren[i]);
    }

    this.path = originalPath;
  }

  /* ---------------------------------------------------------------------- */
  /*                               TRANSFORM                                */
  /* ---------------------------------------------------------------------- */

  transform(jsXpath, filePath) {
    this.reset(filePath);

    this.process(jsXpath);

    return this.obj;
  }
}

/* -------------------------------------------------------------------------- */
/*                                   BUILD                                    */
/* -------------------------------------------------------------------------- */

export default function build(jsXpath, absFilePath, options = {}) {
  const transformer = new Transformer(options);

  return transformer.transform(jsXpath, absFilePath);
}
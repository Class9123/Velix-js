import uidGenerator from "./helpers/uid.js";
import ConditionalPr from "./processor/conditional.js";
import LoopPr from "./processor/loopPr.js";
import ComponentPr from "./processor/componentPr.js";
import generate from "@babel/generator";
import * as t from "@babel/types";
import { isComponentTag, resolveImportedPath } from "./helpers/index.js";
import { throwVelixError } from "./helpers/error.js";

class DirectivePluginManager {
  constructor(core) {
    this.core = core;
    this.byDirective = new Map();
  }

  register(plugin) {
    if (
      !plugin ||
      !plugin.directive ||
      typeof plugin.transform !== "function"
    ) {
      throw new Error("Invalid plugin: expected { directive, transform() }");
    }
    const list = this.byDirective.get(plugin.directive) || [];
    list.push(plugin);
    list.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    this.byDirective.set(plugin.directive, list);
  }

  run(path, directives) {
    for (const directive of directives) {
      const plugins = this.byDirective.get(directive.name) || [];
      for (const plugin of plugins) {
        const result = plugin.transform({
          core: this.core,
          path,
          directive,
          directives
        });
        if (result?.handled) return result;
      }
    }
    return { handled: false };
  }
}

class Transformer {
  constructor(options = {}) {
    this.pluginManager = new DirectivePluginManager(this);
    this.structuralDirectives = new Set(["$if", "$for"]);
    this.resolveSelfComponentName =
      typeof options.resolveSelfComponentName === "function"
        ? options.resolveSelfComponentName
        : null;
    this.componentProcessor = new ComponentPr(this);
  }

  buildLogicalChildPaths(childPaths) {
    const logical = [];
    let buffer = [];

    const flush = () => {
      if (buffer.length) {
        logical.push(buffer);
        buffer = [];
      }
    };

    for (const childPath of childPaths) {
      if (childPath.isJSXText() || childPath.isJSXExpressionContainer()) {
        buffer.push(childPath);
      } else {
        flush();
        logical.push(childPath);
      }
    }

    flush();
    return logical;
  }

  joinPath() {
    for (let i = this.path.length - 1; i >= 0; i--) {
      const it = this.path[i];
      if (it.startsWith("_$")) return this.path.slice(i).join(".");
    }
    return "";
  }

  add(js) {
    this.obj.script += js + "\n";
  }

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
      const loc = path.node.openingElement?.name?.loc?.start;
      throwVelixError(
        new Error(`Component "${tag}" is not defined in this scope.`),
        {
          stage: "compile",
          filePath: this.filePath,
          loc: loc
            ? {
                line: loc.line,
                column: loc.column + 1
              }
            : null
        }
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

  isDirectiveAttribute(attr) {
    return (
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name.startsWith("$")
    );
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
        expressionCode = generate.default(attr.value.expression).code;
      } else {
        throw new Error(`Unsupported directive value for ${name}`);
      }

      directives.push({ name, expressionCode, node: attr });
    }
    return directives;
  }

  isStructuralDirective(name) {
    return this.structuralDirectives.has(name);
  }

  escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  getStaticAttributeMarkup(path, { includeDirectives = false } = {}) {
    const attrs = path.node.openingElement.attributes || [];
    let out = "";

    for (const attr of attrs) {
      if (t.isJSXSpreadAttribute(attr)) continue;
      if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;

      const key = attr.name.name;
      if (!includeDirectives && key.startsWith("$")) continue;

      if (attr.value == null) {
        out += ` ${key}`;
        continue;
      }

      if (t.isStringLiteral(attr.value)) {
        out += ` ${key}="${this.escapeAttr(attr.value.value)}"`;
        continue;
      }

      if (t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression;
        if (t.isStringLiteral(expr) || t.isNumericLiteral(expr)) {
          out += ` ${key}="${this.escapeAttr(expr.value)}"`;
        } else if (t.isBooleanLiteral(expr)) {
          if (expr.value) out += ` ${key}`;
        } else if (t.isNullLiteral(expr)) {
          // no-op
        }
      }
    }

    return out;
  }

  emitAttributeBindings(
    path,
    { targetRef = null, includeDirectives = false } = {}
  ) {
    const attrs = path.node.openingElement.attributes || [];
    const targetExpr = targetRef || this.joinPath();

    for (const attr of attrs) {
      if (t.isJSXSpreadAttribute(attr)) {
        const expr = generate.default(attr.argument).code;
        const id = this.uidGen.nextElement();
        const spreadState = this.uidGen.nextMap();
        this.add(`
          const ${id} = ${targetExpr}
          const ${spreadState} = new Set()
          _$.useEffect(() => {
            const _$spread = ${expr} || {};
            for (const key of Array.from(${spreadState})) {
              if (key in _$spread) continue;
              if (key.startsWith("$")) {
                ${spreadState}.delete(key);
                continue;
              }
              if (/^on[A-Z]/.test(key) || /^on[a-z]/.test(key)) {
                ${id}[key.toLowerCase()] = null;
              } else {
                ${id}.removeAttribute(key);
              }
              ${spreadState}.delete(key);
            }
            Object.keys(_$spread).forEach(key => {
              const value = _$spread[key];
              if (key.startsWith("$")) return;
              if (/^on[A-Z]/.test(key) || /^on[a-z]/.test(key)) {
                ${id}[key.toLowerCase()] = typeof value === "function" ? value : null;
                ${spreadState}.add(key);
                return;
              }
              if (value === false || value == null) ${id}.removeAttribute(key);
              else if (value === true) ${id}.setAttribute(key, "");
              else ${id}.setAttribute(key, String(value));
              ${spreadState}.add(key);
            });
          });
        `);
        continue;
      }

      if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
      const key = attr.name.name;
      if (key === "$when") {
        const id = this.uidGen.nextElement();
        const storage = this.uidGen.nextComment();
        let expr = "true";
        if (attr.value && t.isJSXExpressionContainer(attr.value)) {
          expr = generate.default(attr.value.expression).code;
        } else if (attr.value && t.isStringLiteral(attr.value)) {
          expr = JSON.stringify(attr.value.value);
        }
        this.add(`
          const ${id} = ${targetExpr}
          let ${storage} = null
          _$.useEffect(() => {
            const _$show = !!(${expr});
            if (_$show) {
              if (${storage} !== null) {
                ${id}.style.display = ${storage};
                ${storage} = null;
              } else if (${id}.style.display === "none") {
                ${id}.style.removeProperty("display");
              }
            } else {
              if (${storage} === null) ${storage} = ${id}.style.display || "";
              ${id}.style.display = "none";
            }
          });
        `);
        continue;
      }
      if (key === "$ref") {
        if (!attr.value || !t.isJSXExpressionContainer(attr.value)) {
          continue;
        }
        const expr = generate.default(attr.value.expression).code;
        const id = this.uidGen.nextElement();
        this.add(`
          const ${id} = ${targetExpr}
          _$.useEffect(() => {
            const _$ref = ${expr};
            if (typeof _$ref === "function") _$ref(${id});
            else if (_$ref && typeof _$ref === "object") _$ref.current = ${id};
          });
        `);
        continue;
      }
      if (!includeDirectives && key.startsWith("$")) continue;
      if (!includeDirectives && this.isStructuralDirective(key)) continue;
      if (attr.value == null || t.isStringLiteral(attr.value)) continue;
      if (!t.isJSXExpressionContainer(attr.value)) continue;

      const exprNode = attr.value.expression;
      if (
        t.isStringLiteral(exprNode) ||
        t.isNumericLiteral(exprNode) ||
        t.isBooleanLiteral(exprNode) ||
        t.isNullLiteral(exprNode)
      ) {
        continue;
      }

      const expr = generate.default(exprNode).code;
      const id = this.uidGen.nextElement();
      const isEvent = /^on[A-Z]/.test(key) || /^on[a-z]/.test(key);
      if (isEvent) {
        const eventProp = key.toLowerCase();
        this.add(`
          const ${id} = ${targetExpr}
          _$.useEffect(() => {
            const _$handler = ${expr};
            ${id}.${eventProp} = typeof _$handler === "function" ? _$handler : null;
          });
        `);
      } else {
        this.add(`
          const ${id} = ${targetExpr}
          _$.useEffect(() => {
            const _$value = ${expr};
            if (_$value === false || _$value == null) ${id}.removeAttribute("${key}");
            else if (_$value === true) ${id}.setAttribute("${key}", "");
            else ${id}.setAttribute("${key}", String(_$value));
          });
        `);
      }
    }
  }

  writeOpeningTag(path, options) {
    const tag = path.node.openingElement.name.name;
    const attrs = this.getStaticAttributeMarkup(path, options);
    const selfClosing = path.node.openingElement.selfClosing;
    this.obj.html += selfClosing ? `<${tag}${attrs}/>` : `<${tag}${attrs}>`;
  }

  writeClosingTag(path) {
    const selfClosing = path.node.openingElement.selfClosing;
    if (selfClosing) return;
    const tag = path.node.openingElement.name.name;
    this.obj.html += `</${tag}>`;
  }

  renderElement(path, options = {}) {
    const {
      includeDirectives = false,
      targetRef = null,
      processChildren = true
    } = options;
    const prevPath = [...this.path];
    if (targetRef) {
      this.path.push(targetRef);
    }
    this.writeOpeningTag(path, { includeDirectives });
    this.emitAttributeBindings(path, { targetRef, includeDirectives });
    if (!path.node.openingElement.selfClosing && processChildren) {
      this.processChildren(path);
    }
    this.writeClosingTag(path);
    this.path = prevPath;
  }

  process(path) {
    if (!path) return;

    // 🔹 GROUP (array of NodePaths)
    if (Array.isArray(path)) {
      const id = this.uidGen.nextTextNode();
      let hasExpr = false;

      const expr = path
        .map(p => {
          if (p.isJSXText()) {
            this.obj.html += p.node.value;
            return JSON.stringify(p.node.value);
          }

          hasExpr = true;
          return `String(${generate.default(p.node.expression).code})`;
        })
        .join(" + ");

      if (hasExpr) {
        this.obj.html += " ";
        this.add(`
          const ${id} = ${this.joinPath()}
          _$.useEffect(()=>{
          ${id}.nodeValue = ${expr};
          });
          `);
      }

      return;
    }

    // 🔹 JSX ELEMENT
    else if (path.isJSXElement()) {
      const node = path.node;
      const opening = node.openingElement;
      const tag = opening.name.name;

      if (isComponentTag(tag)) {
        this.componentProcessor.process(path);
        return;
      }

      const directives = this.collectDirectives(path);
      const structural = directives.filter(d =>
        this.isStructuralDirective(d.name)
      );
      if (structural.length > 1) {
        const loc = path.node.openingElement?.name?.loc?.start;
        throwVelixError(
          new Error(
            `Only one structural directive is allowed per element. Found: ${structural.map(d => d.name).join(", ")}`
          ),
          {
            stage: "compile",
            filePath: this.filePath,
            loc: loc
              ? {
                  line: loc.line,
                  column: loc.column + 1
                }
              : null
          }
        );
      }
      if (directives.length) {
        const result = this.pluginManager.run(path, directives);
        if (result?.handled) return;
      }

      this.renderElement(path);
    }
  }

  processChildren(input) {
    const childPaths = Array.isArray(input) ? input : input.get("children");
    const logicalChildren = this.buildLogicalChildPaths(childPaths);

    const pathCopy = [...this.path];

    for (let i = 0; i < logicalChildren.length; i++) {
      if (this.path.length % 6 === 0) {
        const id = this.uidGen.nextRefrence();
        this.add(`const ${id} = ${this.joinPath()}`);
        this.path.push(id);
      }

      this.path.push(i === 0 ? "f" : "n");
      this.process(logicalChildren[i]); // group OR NodePath
    }

    this.path = pathCopy;
  }

  transform(jsXpath, filePath) {
    this.pluginManager.register(new ConditionalPr(this));
    this.pluginManager.register(new LoopPr(this));
    this.filePath = filePath;
    this.obj = {
      html: "",
      script: "",
      deps: []
    };
    this.path = ["_$root"];
    this.uidGen = uidGenerator();

    this.process(jsXpath);

    return this.obj;
  }
}

export default function build(jsXpath, absFilePath, options = {}) {
  const transformer = new Transformer(options);
  return transformer.transform(jsXpath, absFilePath);
}

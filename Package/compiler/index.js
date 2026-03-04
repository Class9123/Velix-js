import parser from "@babel/parser";
import tr from "@babel/traverse";
const traverse = tr.default;
import * as t from "@babel/types";
import generate from "@babel/generator";
import build from "./transformer.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8")
);

const pkgName = pkg.name;

function hasJsxReturn(fnPath) {
  let found = false;

  if (
    fnPath.isArrowFunctionExpression() &&
    (t.isJSXElement(fnPath.node.body) || t.isJSXFragment(fnPath.node.body))
  ) {
    return true;
  }

  fnPath.traverse({
    Function(path) {
      if (path !== fnPath) path.skip();
    },
    ReturnStatement(path) {
      if (
        t.isJSXElement(path.node.argument) ||
        t.isJSXFragment(path.node.argument)
      ) {
        found = true;
        path.stop();
      }
    }
  });

  return found;
}

function ensurePriyInternalImport(ast) {
  const body = ast.program.body;
  let insertIndex = 0;
  const internalName = `${pkgName}/internal`;
  while (
    insertIndex < body.length &&
    t.isImportDeclaration(body[insertIndex])
  ) {
    insertIndex++;
  }

  for (const node of body) {
    if (t.isImportDeclaration(node) && node.source.value === internalName) {
      const def = node.specifiers.find(s => t.isImportDefaultSpecifier(s));
      if (!def) {
        node.specifiers.unshift(t.importDefaultSpecifier(t.identifier("_$")));
        return "_$";
      }
      if (def.local.name === "_$") return "_$";

      const aliasDecl = t.variableDeclaration("const", [
        t.variableDeclarator(t.identifier("_$"), t.identifier(def.local.name))
      ]);
      body.splice(insertIndex, 0, aliasDecl);
      return "_$";
    }
  }

  const importDecl = t.importDeclaration(
    [t.importDefaultSpecifier(t.identifier("_$"))],
    t.stringLiteral(internalName)
  );

  body.splice(insertIndex, 0, importDecl);
  return "_$";
}

function getPathKey(path) {
  const loc = path.node.loc?.start;
  const start = path.node.start ?? "na";
  const line = loc?.line ?? "na";
  const col = loc?.column ?? "na";
  return `${path.type}:${start}:${line}:${col}`;
}

function getBindingKey(bindingPath) {
  if (bindingPath.isVariableDeclarator()) {
    return getPathKey(bindingPath.get("init"));
  }
  return getPathKey(bindingPath);
}

function getRootJsxPaths(fnPath) {
  const roots = [];

  if (
    fnPath.isArrowFunctionExpression() &&
    (fnPath.get("body").isJSXElement() || fnPath.get("body").isJSXFragment())
  ) {
    roots.push(fnPath.get("body"));
  }

  fnPath.traverse({
    Function(path) {
      if (path !== fnPath) path.skip();
    },
    ReturnStatement(path) {
      const arg = path.get("argument");
      if (arg.isJSXElement() || arg.isJSXFragment()) roots.push(arg);
    }
  });

  return roots;
}

export default function compileVelix(code, filePath) {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx"]
  });

  ensurePriyInternalImport(ast);

  const output = {
    html: {},
    script: ""
  };

  const components = new Map(); // componentName -> fnPath
  const componentByFnPathKey = new Map(); // fnPathKey -> componentName
  const bindingToComponent = new Map(); // bindingPathKey -> componentName
  const exportAliases = new Map(); // exportName -> componentName
  let componentCounter = 0;

  const registerComponent = (
    fnPath,
    displayName = "Component",
    bindingPath = null
  ) => {
    if (!fnPath || !hasJsxReturn(fnPath)) return null;
    const fnPathKey = getPathKey(fnPath);
    const existing = componentByFnPathKey.get(fnPathKey);
    if (existing) {
      if (bindingPath)
        bindingToComponent.set(getBindingKey(bindingPath), existing);
      return existing;
    }

    componentCounter += 1;
    const safeName = String(displayName || "Component").replace(/[^\w$]/g, "_");
    const componentName = `__cmp_${componentCounter}_${safeName}`;
    componentByFnPathKey.set(fnPathKey, componentName);
    components.set(componentName, fnPath);
    if (bindingPath)
      bindingToComponent.set(getBindingKey(bindingPath), componentName);
    return componentName;
  };

  traverse(ast, {
    FunctionDeclaration(path) {
      const name = path.node.id?.name;
      if (!name) return;
      const binding = path.scope.getBinding(name);
      if (!binding) return;
      registerComponent(path, name, binding.path);
    },
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id)) return;
      const init = path.get("init");
      if (!(init.isFunctionExpression() || init.isArrowFunctionExpression()))
        return;
      const binding = path.scope.getBinding(path.node.id.name);
      if (!binding) return;
      registerComponent(init, path.node.id.name, binding.path);
    }
  });

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const decl = path.get("declaration");
      if (decl.isIdentifier()) {
        const binding = path.scope.getBinding(decl.node.name);
        if (!binding) return;
        const key = bindingToComponent.get(getBindingKey(binding.path));
        if (key) exportAliases.set("default", key);
        return;
      }

      if (decl.isFunctionDeclaration()) {
        const name = decl.node.id?.name || "default";
        let key = null;
        if (decl.node.id) {
          const binding = path.scope.getBinding(decl.node.id.name);
          if (binding)
            key = bindingToComponent.get(getBindingKey(binding.path));
        }
        if (!key) key = registerComponent(decl, name, null);
        if (key) exportAliases.set("default", key);
        return;
      }

      if (decl.isArrowFunctionExpression() || decl.isFunctionExpression()) {
        const key = registerComponent(decl, "default", null);
        if (key) exportAliases.set("default", key);
      }
    },

    ExportNamedDeclaration(path) {
      const decl = path.get("declaration");

      if (decl && decl.node) {
        if (decl.isFunctionDeclaration() && decl.node.id) {
          const name = decl.node.id.name;
          const binding = path.scope.getBinding(name);
          if (!binding) return;
          const key = bindingToComponent.get(getBindingKey(binding.path));
          if (key) exportAliases.set(name, key);
        } else if (decl.isVariableDeclaration()) {
          for (const declarator of decl.get("declarations")) {
            const id = declarator.node.id;
            if (!t.isIdentifier(id)) continue;
            const binding = path.scope.getBinding(id.name);
            if (!binding) continue;
            const key = bindingToComponent.get(getBindingKey(binding.path));
            if (key) exportAliases.set(id.name, key);
          }
        }
      }

      for (const spec of path.node.specifiers || []) {
        const localName = spec.local?.name;
        const exportedName = spec.exported?.name;
        if (!localName || !exportedName) continue;
        const binding = path.scope.getBinding(localName);
        if (!binding) continue;
        const key = bindingToComponent.get(getBindingKey(binding.path));
        if (key) exportAliases.set(exportedName, key);
      }
    }
  });

  const resolveSelfComponentName = (jsxPath, tag) => {
    const binding = jsxPath.scope.getBinding(tag);
    if (!binding) return null;
    return bindingToComponent.get(getBindingKey(binding.path)) || null;
  };

  for (const [componentName, fnPath] of components.entries()) {
    const roots = getRootJsxPaths(fnPath);
    let firstCompiled = null;

    for (const jsxPath of roots) {
      if (!jsxPath.isJSXElement()) continue;
      const compiled = build(jsxPath, filePath, { resolveSelfComponentName });
      if (!firstCompiled) firstCompiled = compiled;

      const wrapped = ` ( function (){
          const _$root = _$.getParent()
          ${compiled.script}
        } )() `;
      const newAst = parser.parseExpression(wrapped);
      jsxPath.replaceWith(newAst);
    }

    if (firstCompiled) {
      output.html[componentName] = {
        html: firstCompiled.html,
        deps: firstCompiled.deps
      };
    }
  }

  for (const [alias, key] of exportAliases.entries()) {
    if (output.html[key]) output.html[alias] = output.html[key];
  }

  output.script = generate.default(ast, {}, code).code;
  return output;
}

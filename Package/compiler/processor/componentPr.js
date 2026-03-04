import generate from "@babel/generator";
import * as t from "@babel/types";

class ComponentProcessor {
  constructor(core) {
    this.core = core;
  }

  buildPropsExpression(path) {
    const attrs = path.node.openingElement.attributes || [];
    const parts = [];

    for (const attr of attrs) {
      if (t.isJSXSpreadAttribute(attr)) {
        const spreadExpr = generate.default(attr.argument).code;
        parts.push(`...(${spreadExpr} || {})`);
        continue;
      }

      if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue;
      const key = attr.name.name;
      if (key.startsWith("$")) continue;

      if (attr.value == null) {
        parts.push(`${JSON.stringify(key)}: true`);
        continue;
      }

      if (t.isStringLiteral(attr.value)) {
        parts.push(`${JSON.stringify(key)}: ${JSON.stringify(attr.value.value)}`);
        continue;
      }

      if (t.isJSXExpressionContainer(attr.value)) {
        const expr = generate.default(attr.value.expression).code;
        parts.push(`${JSON.stringify(key)}: (${expr})`);
      }
    }

    if (!parts.length) return null;
    return `({ ${parts.join(", ")} })`;
  }

  process(path) {
    const opening = path.node.openingElement;
    const tag = opening.name.name;
    const core = this.core;
    const dep = core.resolveComponentDep(path, tag);
    const placeholder = `<!--__PRIVO_CMP_${core.uidGen.nextComment()}__-->`;
    core.obj.deps.push({
      ...dep,
      placeholder
    });

    const id = core.uidGen.nextElement();
    const propsExpr = this.buildPropsExpression(path);

    core.add(`
      const ${id} = ${core.joinPath()}
      _$.setParent(${id})
      ${propsExpr ? `${tag}(${propsExpr})` : `${tag}()`}
    `);

    core.obj.html += placeholder;
  }
}

export default ComponentProcessor;

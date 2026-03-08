class ForProcessor {
  constructor() {
    this.directive = "$for";
    this.priority = 90;
  }

  parseLoopExpression(expr) {
    const trimmed = String(expr || "").trim();
    const match = trimmed.match(
      /^(?:\(\s*([A-Za-z_$][\w$]*)\s*\)|([A-Za-z_$][\w$]*))\s+(?:in|of)\s+([\s\S]+)$/
    );
    if (!match) return null;
    return {
      itemName: (match[1] || match[2]).trim(),
      sourceExpr: match[3].trim()
    };
  }

  transform(ctx) {
    const { core, path, directive } = ctx;
    const expr = directive.expressionCode;

    const parsed = this.parseLoopExpression(expr);
    if (!parsed) {
      throw new Error(
        `Invalid $for expression: "${expr}". Use "item in items".`
      );
    }
    const { itemName, sourceExpr } = parsed;
    const createChildrenId = core.uidGen.nextCreateChildren();
    const mountId = core.uidGen.nextLoop();
    const clearId = core.uidGen.nextLoop();
    const readSourceId = core.uidGen.nextLoop();
    const tplId = core.uidGen.nextTemplate();
    const cloneId = core.uidGen.nextCloneId();
    const mapId = core.uidGen.nextMap();
    const anchorId = core.uidGen.nextComment();

    core.obj.html += "<template>";
    core.add(`
     function ${createChildrenId}(_$root,${itemName}) {
    `);
    core.path.push("_$root");
    core.renderElement(path, {
      includeDirectives: false,
      targetRef: "_$root.f",
      processChildren: true
    });
    core.path.pop();
    core.obj.html += "</template>";

    core.add(`
  return _$root }
function ${readSourceId}() {
  const _$src = (${sourceExpr}) ?? [];
  return Array.isArray(_$src) ? _$src : [];
}
_$._setUpLopp(${core.joinPath()}, ${createChildrenId}, ${readSourceId})

    `);

    return { handled: true };
  }
}

export default ForProcessor;

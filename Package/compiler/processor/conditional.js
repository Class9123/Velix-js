class Conditional {
  constructor() {
    this.directive = "$if";
    this.priority = 100;
  }

  transform(ctx) {
    const { core, path, directive } = ctx;
    const conditionExpr = directive.expressionCode;
    const selfClosing = path.node.openingElement.selfClosing;
    core.obj.html += "<template>";
    const tmpId = core.uidGen.nextTemplate();
    const cmId = core.uidGen.nextComment();
    const elmId = core.uidGen.nextElement();
    const prevConId = core.uidGen.nextPrevCondition();
    core.writeOpeningTag(path, { includeDirectives: false });
    core.add(`
    const ${tmpId} = ${core.joinPath()}
    const ${cmId} = document.createComment("con")
    const ${elmId} = ${tmpId}.content.cloneNode(true).f
    ${tmpId}.replaceWith(${elmId})
    
    let ${prevConId} = null;
          `);
    core.add(`
    _$.useEffect(()=>{
      const _$con = ${conditionExpr}
      if (${prevConId} !== _$con) {
        if (_$con) ${cmId}.replaceWith(${elmId})
        else ${elmId}.replaceWith(${cmId})
      }
      ${prevConId} = _$con
    })
    `);
    core.emitAttributeBindings(path, {
      targetRef: elmId,
      includeDirectives: false
    });
    if (!selfClosing) {
      const prevPath = [...core.path];
      core.path.push(elmId);
      core.processChildren(path);
      core.path = prevPath;
    }
    core.writeClosingTag(path);
    core.obj.html += "</template>";

    return { handled: true };
  }
}
export default Conditional;

class Conditional {
  constructor() {
    this.directive = "$if";
    this.priority = 100;
  }

  transform(ctx) {
    const { core, path, directive } = ctx;
    const conditionExpr = directive.expressionCode;
    const createChildrenId = core.uidGen.nextCreateChildren();
    core.obj.html += "<template>";
    core.add(`
     function ${createChildrenId}(_$root) {
    `);
    core.path.push("_$root")
    core.renderElement(path, {
      includeDirectives: false,
      processChildren: true
    });
    core.path.pop()

    core.obj.html += "</template>";
    core.add(`
    return _$root
  }
  _$._setUpConditional(${core.joinPath()}, () => { return ${conditionExpr} }, ${createChildrenId} )
  `);

    return { handled: true };
  }
}
export default Conditional;

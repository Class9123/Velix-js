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
      throw new Error(`Invalid $for expression: "${expr}". Use "item in items".`);
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
const ${tplId} = ${core.joinPath()}
const ${cloneId} = ${tplId}.cloneNode(true)
const ${mapId} = []
const ${anchorId} = document.createComment("for-end")
${tplId}.replaceWith(${anchorId})

function ${readSourceId}() {
  const _$src = (${sourceExpr}) ?? [];
  return Array.isArray(_$src) ? _$src : [];
}

function ${clearId}(_$record) {
  if (!_$record) return;
  let _$node = _$record.first;
  while (_$node) {
    const _$next = _$node.nextSibling;
    _$node.remove();
    if (_$node === _$record.last) break;
    _$node = _$next;
  }
}

function ${mountId}(${itemName}, _$before = ${anchorId}) {
  const _$root = ${cloneId}.cloneNode(true).content
  ${createChildrenId}(_$root, ${itemName})
  let _$first = _$root.firstChild
  let _$last = _$root.lastChild
  if (!_$first) {
    _$first = document.createComment("for-empty")
    _$last = _$first
    _$root.appendChild(_$first)
  }
  _$before.before(_$root)
  return { first: _$first, last: _$last }
}

${readSourceId}().forEach((_$local) => {
  ${mapId}.push(${mountId}(_$local, ${anchorId}))
})

_$.useEffect((config=null) => {

  const data = ${readSourceId}()
  if (!config || typeof config !== "object") {
    ${mapId}.forEach(${clearId})
    ${mapId}.length = 0
    data.forEach((_$local) => {
      ${mapId}.push(${mountId}(_$local, ${anchorId}))
    })
    return;
  }
  const index = config.index
  if (config.push){
    ${mapId}.push(${mountId}(data[index], ${anchorId}))
  } else if (config.setAt){
    const _$old = ${mapId}[index]
    if (!_$old) return;
    const _$nextNode = _$old.first
    ${mapId}[index] = ${mountId}(data[index], _$nextNode)
    ${clearId}(_$old)
  } else if (config.remove){
    const _$old = ${mapId}[index]
    if (!_$old) return;
    ${clearId}(_$old)
    ${mapId}.splice(index, 1)
  } else {
    ${mapId}.forEach(${clearId})
    ${mapId}.length = 0
    data.forEach((_$local) => {
      ${mapId}.push(${mountId}(_$local, ${anchorId}))
    })
  }

});
    `);

    return { handled: true };
  }
}

export default ForProcessor;

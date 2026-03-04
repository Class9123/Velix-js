export default function makeUidGenerator() {
  const counters = {
    textNode: 0,
    element: 0,
    refrence:0,
    comment:0,
    fragment:0,
    tmpl:0,
    prevcondition:0,
    loopParent:0,
    createchildren:0,
    clone:0,
    map:0
  };

  const seen = new Set();

  function getUnique(prefix) {
    let id;
    do {
      id = `_$${prefix}${counters[prefix]++}`;
    } while (seen.has(id));
    seen.add(id);
    return id;
  }

  return {
    nextTextNode() {
      return getUnique("textNode");
    },
    nextElement() {
      return getUnique("element");
    },
    nextRefrence(){
      return getUnique("refrence");
    },
    nextComment(){
      return getUnique("comment");
    },
    nextFragment(){
      return getUnique("fragment");
    },
    nextTemplate(){
      return getUnique("tmpl");
    },
    nextPrevCondition(){
      return getUnique("prevcondition");
    },
    nextLoop(){
      return getUnique("loopParent")
    },
    nextCreateChildren(){
      return getUnique("createchildren")
    },
    nextCloneId(){
      return getUnique("clone")
    },
    nextMap(){
      return getUnique("map")
    }
  };
}
import {
  useState,
  useEffect,
  useMemo
} from "./React/index.js";

let parent = null

function setParent(el) {
  parent = el
}
function getParent() {
  return parent
}

export default {
  useState,
  useEffect,
  useMemo,
  setParent,
  getParent
}
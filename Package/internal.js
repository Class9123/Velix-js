import { useState, useEffect, useMemo } from "./React/index.js";
import _setUpLopp from "./React/core/loop.js";

let parent = null;

function setParent(el) {
  parent = el;
}
function getParent() {
  return parent;
}

export default {
  useState,
  useEffect,
  useMemo,
  setParent,
  getParent,
  _setUpLopp
};

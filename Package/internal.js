import { useState, useEffect, useMemo } from "./React/index.js";
import _setUpLopp from "./React/core/loop.js";
import _setUpConditional from "./React/core/conditional.js";
import mountCmp from "./React/core/component.js";
import { getParent, setParent } from "./React/globals.js";

export default {
  useState,
  useEffect,
  useMemo,
  setParent,
  getParent,
  _setUpLopp,
  _setUpConditional,
  mountCmp
};

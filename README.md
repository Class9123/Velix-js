# Velix

Velix is an HTML-first reactive framework.

You write JSX like React.
Velix compiles it into mostly-static HTML + tiny DOM update code.
So the browser does less work and you still get reactive UI.

Short version: React-like reactivity, but your HTML goes to the gym first.

> Experimental project: APIs can still change.

## Why this exists

Most UI frameworks keep doing runtime work:

* render
* diff
* patch
* repeat

Velix tries to move that cost to compile time.

* HTML is generated ahead of time.
* DOM paths are precomputed.
* Runtime only updates exactly what changed.

No virtual DOM here. Just real DOM and targeted updates.

## Output model (IMPORTANT)

Velix does **not output only JavaScript**.

Instead, the compilation process produces a **hybrid output**:

* **Static HTML is generated first** (pre-rendered structure)
* **Minimal JavaScript is added only for interactivity and reactivity**
* The runtime does NOT rebuild the UI from JS every render

👉 This means:

* Your app is not a JS-only UI tree
* Most of the UI exists as real HTML from the start
* JavaScript only “activates” parts of the DOM where needed

In simple terms:

> Velix compiles JSX into real HTML + tiny reactive JS glue, not a fully JavaScript-rendered UI.

---

## Quick start

### 1. Install deps

```bash
yarn
```

### 2. Add Vite config

`vite.config.js`

```js
import { defineConfig } from "vite";
import Velix from "velix";

export default defineConfig({
  plugins: [tailwindcss(), Velix()]
});
```

### 3. Bootstrap entry

`src/index.js`

```js
import App from "./App.jsx";
import { mount } from "velix";

const root = document.getElementById("app");
mount(App, root);
```

### 4. Run

```bash
yarn dev
```

Current plugin default root is `src/App.jsx`. Keep that file name/path, or update it in `Package/plugin.js`.

## Core idea you must know

Velix state values are **getter functions**.

* Read with `count()` not `count`
* Effects track dependencies by calling getters

If you forget the `()`, your UI will politely do nothing.

## Reactivity API

Import from `velix`:

```js
import { useState, useEffect, useMemo, useArray } from "velix";
```

### `useState(initial)`

```js
const [count, setCount] = useState(0);

count(); // read
setCount(5); // write
setCount(p => p + 1);
```

### `useEffect(callback, deps)`

* Runs immediately once.
* Re-runs when tracked deps change.
* Automatically tracks accessed signals inside the effect.

```js
useEffect(() => {
  console.log("count changed:", count());
});
```

### `useMemo(fn)`

Returns a getter for computed value.

```js
const doubled = useMemo(() => count() * 2);
console.log(doubled());
```

### `useArray(initialArray)`

Array state helper with incremental updates.

```js
const items = useArray(["a", "b"]);

items(); // read array
items.push("c");
items.setAt(0, "A");
items.remove(1);
items.pop();
items.setNew(["x", "y"]);
items.setNew(prev => [...prev, "z"]);
```

## Built-in JSX attributes (directives)

### `$if`

```jsx
<div $if={count() > 10}>Now you see me</div>
```

### `$when`

```jsx
<div $when={isOpen()}>I stay mounted, just hidden</div>
```

### `$for`

```jsx
<ul>
  <li $for={item in items()}>{item}</li>
</ul>
```

### `$ref`

```jsx
<div $ref={el => console.log(el)} />
```

## Full example

```jsx
import { useState, useArray, useMemo, useEffect } from "velix";

function Badge() {
  return <strong>Badge</strong>;
}

export default function App() {
  const [count, setCount] = useState(0);
  const todos = useArray(["Ship", "Sleep"]);

  const status = useMemo(() => (count() > 3 ? "busy" : "chill"));

  useEffect(() => {
    console.log("status:", status());
  }, [status]);

  return (
    <main>
      <h1>Count: {count()}</h1>

      <button onClick={() => setCount(p => p + 1)}>+1</button>

      <ul>
        <li $for={todo in todos()}>
          <Badge /> {todo}
        </li>
      </ul>
    </main>
  );
}
```

## Final vibe check

Velix is:

* HTML-first
* compile-heavy
* runtime-light
* JSX-friendly

And importantly:

> It is not a JS-only rendering system — it generates real HTML first, then enhances it with minimal JavaScript for interactivity.

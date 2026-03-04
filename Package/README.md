# Velix

Velix is an HTML-first reactive framework.

You write JSX like React.
Velix compiles it into mostly-static HTML + tiny DOM update code.
So the browser does less work and you still get reactive UI.

Short version: React-like reactivity, but your HTML goes to the gym first.

> Experimental project: APIs can still change.

## Why this exists

Most UI frameworks keep doing runtime work:

- render
- diff
- patch
- repeat

Velix tries to move that cost to compile time.

- HTML is generated ahead of time.
- DOM paths are precomputed.
- Runtime only updates exactly what changed.

No virtual DOM here. Just real DOM and targeted updates.

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

- Read with `count()` not `count`
- Effects track dependencies by calling getters

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

- Runs immediately once.
- Re-runs when tracked deps change.
- Automatically tracks accesed signals inside the effect (Optional deps like in react)

```js
useEffect(() => {
  console.log("count changed:", count());
});
```

# with deps

```js
useEffect(() => {
  console.log("count changed:", count());
}, [count]);
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
items.setNew(["x", "y"]); // full replace
items.setNew(prev => [...prev, "z"]);
```

`setNew` triggers a full list refresh signal.

## Built-in JSX attributes (directives)

These are Velix-specific attributes.

## `$if`

Mount/unmount element by condition.

```jsx
<div $if={count() > 10}>Now you see me</div>
```

Use when element should not exist in DOM when false.

## `$when`

Toggle visibility using `display: none`.

```jsx
<div $when={isOpen()}>I stay mounted, just hidden</div>
```

Use when you want to preserve DOM state but hide it.

## `$for`

Loop rendering. Syntax:

- `$for={item in source}`
- `$for={item of source}`
- `$for={(item) in source}`

```jsx
<ul>
  <li $for={item in items()}>{item}</li>
</ul>
```

Notes:

- `source` must evaluate to an array.
- Nested loops are supported.
- Nested conditionals inside loops are supported.

## `$ref`

Access actual DOM node.

```jsx
<div $ref={el => console.log(el)} />
```

Or object ref style:

```jsx
const boxRef = { current: null };
<div $ref={boxRef} />;
```

## Regular attrs, events, spread

Velix also supports normal JSX attributes and spread:

```jsx
<button
  className={count() > 5 ? "hot" : "cold"}
  onClick={() => setCount(p => p + 1)}
  {...extraProps()}
>
  Click
</button>
```

## Component composition

Components inside components are supported, including cross-file imports.

```jsx
import Card from "./Card";

export default function App() {
  return <Card />;
}
```

Nested component HTML is expanded during compile/scan phase.

## Full example

```jsx
import { useState, useArray, useMemo, useEffect } from "velix";

function Badge() {
  return <strong>Badge</strong>;
}

export default function App() {
  const [count, setCount] = useState(0);
  const todos = useArray(["Ship", "Sleep"]);
  const titleRef = { current: null };

  const status = useMemo(() => (count() > 3 ? "busy" : "chill"));

  useEffect(() => {
    console.log("status:", status());
  }, [status]);

  return (
    <main>
      <h1 $ref={titleRef}>Count: {count()}</h1>

      <p $when={count() % 2 === 0}>Visible only on even counts</p>
      <p $if={count() > 2}>Appears only after 2</p>

      <button onClick={() => setCount(p => p + 1)}>+1</button>
      <button onClick={() => todos.push(`Todo ${count()}`)}>Add Todo</button>
      <button onClick={() => todos.setNew(["Reset"])}>Reset List</button>

      <ul>
        <li $for={todo in todos()}>
          <Badge /> {todo}
        </li>
      </ul>
    </main>
  );
}
```

## Practical rules

1. Always call state getters (`x()`).
2. Keep `useEffect` deps as getter functions (`[count, todos]`).
3. Use `$if` for mount/unmount, `$when` for visibility.
4. Use `$for` only with array-like sources (ideally arrays).
5. Use `$ref` only when you really need DOM access.

## Known limits (for now)

- Early-stage project, breaking changes can happen.
- Error messages are improving but still basic.
- API ergonomics are still evolving.

## Final vibe check

If you want:

- real HTML first
- tiny runtime updates
- React-like mental model without React-sized runtime work

Velix is your weird little friend.

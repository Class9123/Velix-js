import { useState, useArray } from "velix";

export default function App() {
  const t = useArray([1, 2, 3, 4]);
  return (
    <div>
      <p $for={i in t()}>
        Hi {i} times
        <p $for={i in t()}> Hi {i} times </p>
      </p>
      
        {"hi "}
    </div>
  );
}

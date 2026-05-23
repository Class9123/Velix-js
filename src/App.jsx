import { useState, useArray } from "velix";

export default function App() {
  const [count, setCount] = useState(0);
  const arr = useArray([6, 7, 88, 8, 6, 8, 6, 8])
  const str = useArray(["hi", "bye", "whi", "what"])

  return (
    <div>
      <div $for={num in arr()}>
        {num}
        <div class="bg-red-900" $for={item in str()}>
          {item}
          <p $if={num === 88 && item === "what"} class="p-4 bg-green-900">
            Fuck this up bro
          </p>
        </div>
      </div>
    </div>
  );
}
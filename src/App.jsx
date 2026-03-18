import { useState, useMemo } from "velix";

export default function App() {
  const [st, setSt] = useState(0);

  const isEven = useMemo(() => st() % 2 === 0);

  return (
    <div>
      <button onClick={() => setSt(p => p + 1)}>Increment +</button>
      <button onClick={() => setSt(p => p - 1)}>Decrement -</button>
      
      <p>{st()} is even ({isEven()})</p>
      
    </div>
  );
}

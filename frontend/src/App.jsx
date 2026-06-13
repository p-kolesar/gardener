import { useEffect, useState } from "react";
import { getHealth } from "./api.js";

export default function App() {
  const [status, setStatus] = useState("checking…");

  useEffect(() => {
    getHealth()
      .then(() => setStatus("ok"))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Hello World</h1>
      </header>
      <p className="health">Backend: <span className={status}>{status}</span></p>
    </div>
  );
}

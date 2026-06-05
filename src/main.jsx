import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import SecurityGate from "./components/SecurityGate.jsx";
import { trackVisitor } from "./utils/trackVisitor";

trackVisitor();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SecurityGate><App /></SecurityGate>
  </StrictMode>
);

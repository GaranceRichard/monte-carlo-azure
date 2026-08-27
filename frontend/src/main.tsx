import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { createBrowserComposition } from "./composition/browser";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root introuvable.");
}

const { clock } = createBrowserComposition();

createRoot(root).render(
  <StrictMode>
    <App clock={clock} />
  </StrictMode>,
);

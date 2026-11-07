import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./beauty-theme.css";
import "./theme-modes.css";
import App from "./App.jsx";

document.getElementById('public-shop-prerender')?.remove();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

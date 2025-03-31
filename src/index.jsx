// src/index.js (Example using createRoot - React 18+)
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css"; // Or your global CSS
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);


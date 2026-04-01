import { createRoot } from "react-dom/client";
import "@fontsource/opendyslexic/400.css";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/600.css";
import "@fontsource/eb-garamond/700.css";
import App from "./App.tsx";
import "./index.css";


createRoot(document.getElementById("root")!).render(<App />);

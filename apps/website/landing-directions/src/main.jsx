import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { isPreview, loadPreview } from "./content/preview.js";
import { loadPublishedContent } from "./content/published.js";
import { restoreSuiteSession } from "./reference/suite-session.js";
import "./reference/image-slot.js";
import "./reference/site.css";

const render = () =>
  createRoot(document.getElementById("root")).render(<App />);
// In a Website Manager preview frame the drafts load first; anywhere else, render right away.
if (isPreview()) loadPreview().then(render);
else {
  loadPublishedContent().then(() => {
    render();
    // Signed in to the suite through this site: the header shows who (suite-session.js).
    restoreSuiteSession();
  });
}

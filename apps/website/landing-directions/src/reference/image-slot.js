// Lightweight display-only replacement for the export's editable image slots.
// Original images stay local; no editor runtime, uploads, or remote resources.
import snapshot from "../content/snapshot.js";
class ReferenceImage extends HTMLElement {
  static observedAttributes = ["src", "data-src", "fit", "placeholder", "alt"];
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>:host{display:block;overflow:hidden}.frame{position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit}img{display:block;width:100%;height:100%;object-fit:cover}img:not([src]){display:none}.placeholder{height:100%;display:grid;place-items:center;color:inherit;font:12px Montserrat,Arial,sans-serif}</style><div class="frame" part="frame"><img part="image" loading="lazy" decoding="async"><span class="placeholder"></span></div>`;
  }
  connectedCallback() {
    this.sync();
  }
  attributeChangedCallback() {
    this.sync();
  }
  sync() {
    const img = this.shadowRoot.querySelector("img");
    const src = this.getAttribute("src") || this.getAttribute("data-src");
    if (src && !src.includes("{{")) {
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
      this.setAttribute("data-filled", "");
    }
    img.alt =
      this.getAttribute("alt") || this.getAttribute("placeholder") || "";
    img.style.objectFit = this.getAttribute("fit") || "cover";
    const reference = Object.values(snapshot.entries).flat().map(entry => entry.image).find(image => image?.src && (image.src === src || src?.endsWith(`/assets/${image.src}`)));
    img.style.objectPosition = `${reference?.focal?.x ?? 50}% ${reference?.focal?.y ?? 50}%`;
    this.shadowRoot.querySelector(".placeholder").textContent = src
      ? ""
      : this.getAttribute("placeholder") || "Image preview";
  }
}
if (!customElements.get("image-slot"))
  customElements.define("image-slot", ReferenceImage);

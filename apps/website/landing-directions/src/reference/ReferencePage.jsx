import React from "react";

// Shared keyboard and focus handling for the reference's mobile navigation.
export class ReferencePage extends React.Component {
  componentDidMount() {
    const hash = window.location.hash;
    if (hash.length > 1 && !hash.startsWith("#/")) {
      this.anchorFrame = requestAnimationFrame(() => {
        const target = document.getElementById(
          decodeURIComponent(hash.slice(1)),
        );
        target?.scrollIntoView({ behavior: "instant" });
      });
    }
  }
  setState(update, callback) {
    super.setState(update, () => {
      const open = Boolean(this.state.menuOpen);
      if (open !== Boolean(this.menuActive)) this.syncMenu(open);
      callback?.();
    });
  }
  syncMenu(open) {
    this.menuActive = open;
    if (open) {
      this.returnFocus = document.activeElement;
      this.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      this.menuPanel = [
        ...(this.rootRef.current?.querySelectorAll("div") || []),
      ].find((el) => el.style.position === "fixed" && el.style.zIndex === "80");
      if (!this.menuPanel) return;
      this.menuPanel.setAttribute("role", "dialog");
      this.menuPanel.setAttribute("aria-modal", "true");
      this.menuPanel.setAttribute("aria-label", "Navigation menu");
      const focusable = () => [
        ...this.menuPanel.querySelectorAll("a[href], button:not([disabled])"),
      ];
      focusable()[0]?.focus();
      this.menuKey = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.setState({ menuOpen: false });
        }
        if (event.key === "Tab") {
          const items = focusable(),
            first = items[0],
            last = items.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      };
      document.addEventListener("keydown", this.menuKey);
    } else {
      document.body.style.overflow = this.previousOverflow || "";
      document.removeEventListener("keydown", this.menuKey);
      this.returnFocus?.focus();
      this.menuPanel = null;
    }
  }
  componentWillUnmount() {
    cancelAnimationFrame(this.anchorFrame);
    if (this.menuActive) this.syncMenu(false);
  }
}

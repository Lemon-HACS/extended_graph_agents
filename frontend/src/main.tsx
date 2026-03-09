import { createRoot } from "react-dom/client";
import { App } from "./App";

declare global {
  interface Window {
    __EXTENDED_GRAPH_AGENTS_CSS__?: string;
  }
}

interface HassData {
  connection: import("./utils/haApi").HassConnection;
  auth: { data: { access_token: string } };
}

class ExtendedGraphAgentsPanel extends HTMLElement {
  private _hass: HassData | null = null;
  private _root: ReturnType<typeof createRoot> | null = null;
  private _container: HTMLDivElement | null = null;

  set hass(value: HassData) {
    this._hass = value;
    this._render();
  }

  connectedCallback() {
    if (!this._root) {
      this.style.cssText = "display: block; width: 100%; height: 100%; overflow: hidden;";

      // Inject CSS into the element itself so it works inside HA's shadow DOM
      const css = window.__EXTENDED_GRAPH_AGENTS_CSS__;
      if (css) {
        const style = document.createElement("style");
        style.textContent = css;
        this.appendChild(style);
      }

      this._container = document.createElement("div");
      this._container.style.cssText = "width: 100%; height: 100%;";
      this.appendChild(this._container);
      this._root = createRoot(this._container);
    }
    if (this._hass) {
      this._render();
    }
  }

  private _render() {
    if (!this._root || !this._hass) return;
    this._root.render(<App hass={this._hass} />);
  }
}

customElements.define("extended-graph-agents-panel", ExtendedGraphAgentsPanel);

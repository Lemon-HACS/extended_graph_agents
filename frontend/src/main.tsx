import { createRoot } from "react-dom/client";
import { App } from "./App";

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
    if (this._hass) {
      this._render();
    }
  }

  private _render() {
    if (!this._hass) return;

    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });

      const styleEl = document.createElement("style");
      styleEl.textContent = `
        :host { display: block; width: 100%; height: 100%; }
        *, *::before, *::after { box-sizing: border-box; }
      `;

      this._container = document.createElement("div");
      this._container.style.cssText =
        "width: 100%; height: 100%; overflow: hidden;";

      shadow.appendChild(styleEl);
      shadow.appendChild(this._container);
      this._root = createRoot(this._container);
    }

    if (this._root && this._hass) {
      this._root.render(<App hass={this._hass} />);
    }
  }
}

customElements.define("extended-graph-agents-panel", ExtendedGraphAgentsPanel);

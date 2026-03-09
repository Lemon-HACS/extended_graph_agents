import { createRoot } from "react-dom/client";
import { App } from "./App";

interface HassData {
  connection: import("./utils/haApi").HassConnection;
  auth: { data: { access_token: string } };
}

class ExtendedGraphAgentsPanel extends HTMLElement {
  private _hass: HassData | null = null;
  private _root: ReturnType<typeof createRoot> | null = null;

  set hass(value: HassData) {
    this._hass = value;
    this._render();
  }

  connectedCallback() {
    if (!this._root) {
      this.style.cssText = "display: block; width: 100%; height: 100%; overflow: hidden;";
      this._root = createRoot(this);
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

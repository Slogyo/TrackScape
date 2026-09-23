import { useEffect, useRef, useState } from "react";
import { LayoutCanvas } from "./components/LayoutCanvas";
import { WorkspaceDrawer } from "./components/WorkspaceDrawer";
import settingsIcon from "../SVG/Settings.svg";
import rightArrowIcon from "../SVG/right-arrow.svg";
import {
  getGridSpecification,
  inferMeasurementSystem,
  saveMeasurementSystem,
  type MeasurementSystem,
} from "./utils/measurement";

type AppearanceMode = "system" | "light" | "dark";
type ThemeId =
  | "default"
  | "tuscan"
  | "3801"
  | "4001"
  | "ad60"
  | "pacific-national"
  | "ssr"
  | "qube"
  | "qr"
  | "vr";

const THEME_IDS: readonly ThemeId[] = [
  "default",
  "tuscan",
  "3801",
  "4001",
  "ad60",
  "pacific-national",
  "ssr",
  "qube",
  "qr",
  "vr",
];

function readPreference<T extends string>(key: string, options: readonly T[], fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key) as T | null;
    return saved && options.includes(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>(
    inferMeasurementSystem,
  );
  const [canvasScale, setCanvasScale] = useState(0.32);
  const [openPanel, setOpenPanel] = useState<"settings" | "menu" | null>(null);
  const [isWorkspaceDrawerOpen, setIsWorkspaceDrawerOpen] = useState(false);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(() =>
    readPreference("trackscape.appearance", ["system", "light", "dark"], "system"),
  );
  const [theme, setTheme] = useState<ThemeId>(() =>
    readPreference("trackscape.theme", THEME_IDS, "default"),
  );
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const grid = getGridSpecification(measurementSystem, canvasScale);

  useEffect(() => {
    saveMeasurementSystem(measurementSystem);
  }, [measurementSystem]);

  useEffect(() => {
    document.documentElement.dataset.colorMode = appearanceMode;
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("trackscape.appearance", appearanceMode);
      window.localStorage.setItem("trackscape.theme", theme);
    } catch {
      // The selected appearance remains active for this session.
    }
  }, [appearanceMode, theme]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!headerActionsRef.current?.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
        setIsWorkspaceDrawerOpen(false);
      }
    };

    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="TrackScape">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span>TrackScape</span>
        </div>

        <div className="project-title">
          <span className="project-name">Untitled layout</span>
          <span className="project-state">Draft</span>
        </div>

        <div className="header-actions" ref={headerActionsRef}>
          <span className="scale-pill">Grid · {grid.description}</span>

          <button
            className="header-icon-button"
            type="button"
            aria-label="Open settings"
            aria-controls="settings-panel"
            aria-expanded={openPanel === "settings"}
            onClick={() => setOpenPanel((panel) => (panel === "settings" ? null : "settings"))}
          >
            <img src={settingsIcon} alt="" aria-hidden="true" />
          </button>

          <button
            className="header-icon-button menu-button"
            type="button"
            aria-label="Open menu"
            aria-controls="menu-panel"
            aria-expanded={openPanel === "menu"}
            onClick={() => setOpenPanel((panel) => (panel === "menu" ? null : "menu"))}
          >
            <span />
            <span />
            <span />
          </button>

          {openPanel === "settings" && (
            <section className="header-panel settings-panel" id="settings-panel">
              <div className="header-panel-title">
                <span>Settings</span>
                <small>Workspace preferences</small>
              </div>
              <div className="settings-field">
                <span className="settings-label">Measurement system</span>
                <div className="measurement-toggle" role="group" aria-label="Measurement system">
                  <button
                    type="button"
                    aria-pressed={measurementSystem === "metric"}
                    onClick={() => setMeasurementSystem("metric")}
                  >
                    Metric
                  </button>
                  <button
                    type="button"
                    aria-pressed={measurementSystem === "imperial"}
                    onClick={() => setMeasurementSystem("imperial")}
                  >
                    Imperial
                  </button>
                </div>
                <small className="settings-note">
                  Defaults to your regional standard and remembers your choice.
                </small>
              </div>
              <div className="settings-field">
                <span className="settings-label">Appearance</span>
                <div className="appearance-toggle" role="group" aria-label="Appearance mode">
                  {(["system", "light", "dark"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={appearanceMode === mode}
                      onClick={() => setAppearanceMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <small className="settings-note">
                  System follows the appearance setting on your device.
                </small>
              </div>
              <label className="settings-field" htmlFor="theme-selector">
                <span className="settings-label">Theme</span>
                <span className="theme-select-wrap">
                  <select
                    id="theme-selector"
                    value={theme}
                    onChange={(event) => setTheme(event.target.value as ThemeId)}
                  >
                    <option value="default">Default · Slogyo</option>
                    <optgroup label="NSW railway heritage">
                      <option value="tuscan">Tuscan &amp; Buff</option>
                      <option value="3801">3801 Green, Gold &amp; Red</option>
                      <option value="4001">4001 Royal Blue</option>
                      <option value="ad60">AD60 Black &amp; Red</option>
                    </optgroup>
                    <optgroup label="Australian rail operators">
                      <option value="pacific-national">Pacific National</option>
                      <option value="ssr">Southern Shorthaul Railroad</option>
                      <option value="qube">QUBE</option>
                      <option value="qr">Queensland Rail</option>
                      <option value="vr">Victorian Railways</option>
                    </optgroup>
                  </select>
                  <span aria-hidden="true">▾</span>
                </span>
                {/* TODO: Replace this note with account-synced custom theme controls when login is available. */}
                <small className="settings-note theme-custom-note">
                  Custom themes will be available with user accounts and login.
                </small>
              </label>
            </section>
          )}

          {openPanel === "menu" && (
            <section className="header-panel menu-panel" id="menu-panel">
              <div className="header-panel-title">
                <span>Menu</span>
                <small>TrackScape</small>
              </div>
              <div className="menu-section">
                <span className="menu-section-label">Project</span>
                <div className="menu-action-grid">
                  <button type="button" disabled>
                    <span className="menu-action-code">LD</span>
                    <span>Load</span>
                  </button>
                  <button type="button" disabled>
                    <span className="menu-action-code">SV</span>
                    <span>Save</span>
                  </button>
                  <button type="button" disabled>
                    <span className="menu-action-code">EX</span>
                    <span>Export</span>
                  </button>
                </div>
              </div>
              <div className="menu-section">
                <span className="menu-section-label">Account</span>
                <button className="menu-row" type="button" disabled>
                  <span>
                    <strong>Log in</strong>
                    <small>Sync your layouts and collection</small>
                  </span>
                  <span className="menu-status">Coming soon</span>
                </button>
              </div>
              <div className="menu-section">
                <span className="menu-section-label">Workspace</span>
                <button className="workspace-option is-current" type="button">
                  <span>
                    <strong>Layout designer</strong>
                    <small>Plan and build your railway</small>
                  </span>
                  <span className="menu-status">Current</span>
                </button>
                <button className="workspace-option" type="button" disabled>
                  <span>
                    <strong>Inventory management</strong>
                    <small>Catalogue locomotives and rolling stock</small>
                  </span>
                  <img src={rightArrowIcon} alt="" aria-hidden="true" />
                </button>
              </div>
            </section>
          )}
        </div>
      </header>

      <section
        className={`workspace${isWorkspaceDrawerOpen ? " is-drawer-open" : ""}`}
        aria-label="Layout workspace"
      >
        <div className="canvas-workspace">
          <LayoutCanvas
            measurementSystem={measurementSystem}
            onScaleChange={setCanvasScale}
            appearanceKey={`${appearanceMode}:${theme}`}
          />
        </div>

        <WorkspaceDrawer
          isOpen={isWorkspaceDrawerOpen}
          onToggle={() => setIsWorkspaceDrawerOpen((isOpen) => !isOpen)}
        />
      </section>
    </main>
  );
}

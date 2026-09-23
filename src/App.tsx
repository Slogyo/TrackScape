import { useEffect, useRef, useState } from "react";
import { LayoutCanvas } from "./components/LayoutCanvas";
import settingsIcon from "../SVG/Settings.svg";
import {
  getGridSpecification,
  inferMeasurementSystem,
  saveMeasurementSystem,
  type MeasurementSystem,
} from "./utils/measurement";

export default function App() {
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>(
    inferMeasurementSystem,
  );
  const [canvasScale, setCanvasScale] = useState(0.32);
  const [openPanel, setOpenPanel] = useState<"settings" | "menu" | null>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const grid = getGridSpecification(measurementSystem, canvasScale);

  useEffect(() => {
    saveMeasurementSystem(measurementSystem);
  }, [measurementSystem]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!headerActionsRef.current?.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPanel(null);
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
            </section>
          )}

          {openPanel === "menu" && (
            <section className="header-panel menu-panel" id="menu-panel">
              <div className="header-panel-title">
                <span>Menu</span>
                <small>TrackScape</small>
              </div>
              <div className="menu-placeholder">
                <span className="menu-placeholder-rule" />
                <p>Menu actions will be added here.</p>
              </div>
            </section>
          )}
        </div>
      </header>

      <section className="workspace" aria-label="Layout workspace">
        <LayoutCanvas
          measurementSystem={measurementSystem}
          onScaleChange={setCanvasScale}
        />
      </section>
    </main>
  );
}

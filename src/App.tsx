import { useEffect, useState } from "react";
import { LayoutCanvas } from "./components/LayoutCanvas";
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
  const grid = getGridSpecification(measurementSystem, canvasScale);

  useEffect(() => {
    saveMeasurementSystem(measurementSystem);
  }, [measurementSystem]);

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

        <div className="header-actions">
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
          <span className="scale-pill">Grid · {grid.description}</span>
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

import { LayoutCanvas } from "./components/LayoutCanvas";

export default function App() {
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
          <span className="scale-pill">Grid · 1 unit</span>
        </div>
      </header>

      <section className="workspace" aria-label="Layout workspace">
        <LayoutCanvas />
      </section>
    </main>
  );
}


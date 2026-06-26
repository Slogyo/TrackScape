import pecoCatalog from '../data/pecoCatalog.source.json'

type PecoProduct = {
  gauge?: string
  productCode?: string
  name?: string
}

type PecoCatalog = {
  generatedAt?: string
  products?: PecoProduct[]
}

const catalog = pecoCatalog as PecoCatalog
const products = catalog.products ?? []
const gauges = Array.from(
  new Set(products.map((product) => product.gauge).filter(Boolean)),
).sort()

function AppShell() {
  return (
    <main className="clean-slate">
      <section className="workspace-panel" aria-labelledby="workspace-title">
        <img
          className="track-icon"
          src="/SVG/Track.svg"
          alt=""
          aria-hidden="true"
        />
        <p className="eyebrow">TrackScape</p>
        <h1 id="workspace-title">Track tool clean slate</h1>
        <p className="intro">
          The previous track tool has been removed. The track icon and PECO
          library source data are still here for the rebuild.
        </p>

        <dl className="data-summary" aria-label="Preserved library data">
          <div>
            <dt>PECO products</dt>
            <dd>{products.length.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Gauges</dt>
            <dd>{gauges.length.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Source snapshot</dt>
            <dd>{catalog.generatedAt?.slice(0, 10) ?? 'Unknown'}</dd>
          </div>
        </dl>
      </section>
    </main>
  )
}

export default AppShell

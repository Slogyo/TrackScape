export type MeasurementSystem = "metric" | "imperial";

export const MILLIMETRES_PER_INCH = 25.4;

const IMPERIAL_REGIONS = new Set(["LR", "MM", "US"]);
const STORAGE_KEY = "trackscape.measurement-system";

export type GridSpecification = {
  minorMillimetres: number;
  majorEvery: number;
  description: string;
};

type GridStep = Omit<GridSpecification, "description">;

const MINOR_GRID_TARGET_PIXELS = 24;

const METRIC_GRID_STEPS: GridStep[] = [
  { minorMillimetres: 1, majorEvery: 5 },
  { minorMillimetres: 2, majorEvery: 5 },
  { minorMillimetres: 5, majorEvery: 2 },
  { minorMillimetres: 10, majorEvery: 5 },
  { minorMillimetres: 20, majorEvery: 5 },
  { minorMillimetres: 50, majorEvery: 2 },
  { minorMillimetres: 100, majorEvery: 5 },
  { minorMillimetres: 200, majorEvery: 5 },
  { minorMillimetres: 500, majorEvery: 2 },
  { minorMillimetres: 1000, majorEvery: 5 },
  { minorMillimetres: 2000, majorEvery: 5 },
  { minorMillimetres: 5000, majorEvery: 2 },
  { minorMillimetres: 10000, majorEvery: 5 },
  { minorMillimetres: 20000, majorEvery: 5 },
  { minorMillimetres: 50000, majorEvery: 2 },
];

const IMPERIAL_GRID_STEPS: GridStep[] = [
  { minorMillimetres: MILLIMETRES_PER_INCH / 8, majorEvery: 8 },
  { minorMillimetres: MILLIMETRES_PER_INCH / 4, majorEvery: 4 },
  { minorMillimetres: MILLIMETRES_PER_INCH / 2, majorEvery: 2 },
  { minorMillimetres: MILLIMETRES_PER_INCH, majorEvery: 6 },
  { minorMillimetres: 2 * MILLIMETRES_PER_INCH, majorEvery: 6 },
  { minorMillimetres: 3 * MILLIMETRES_PER_INCH, majorEvery: 4 },
  { minorMillimetres: 6 * MILLIMETRES_PER_INCH, majorEvery: 2 },
  { minorMillimetres: 12 * MILLIMETRES_PER_INCH, majorEvery: 5 },
  { minorMillimetres: 24 * MILLIMETRES_PER_INCH, majorEvery: 5 },
  { minorMillimetres: 60 * MILLIMETRES_PER_INCH, majorEvery: 2 },
  { minorMillimetres: 120 * MILLIMETRES_PER_INCH, majorEvery: 5 },
  { minorMillimetres: 240 * MILLIMETRES_PER_INCH, majorEvery: 5 },
];

export function inferMeasurementSystem(): MeasurementSystem {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "metric" || saved === "imperial") return saved;

    const locale = new Intl.Locale(navigator.language).maximize();
    return locale.region && IMPERIAL_REGIONS.has(locale.region) ? "imperial" : "metric";
  } catch {
    return "metric";
  }
}

export function saveMeasurementSystem(system: MeasurementSystem) {
  try {
    window.localStorage.setItem(STORAGE_KEY, system);
  } catch {
    // The preference remains active for this session when storage is unavailable.
  }
}

export function getGridSpecification(
  system: MeasurementSystem,
  pixelsPerMillimetre: number,
): GridSpecification {
  const steps = system === "imperial" ? IMPERIAL_GRID_STEPS : METRIC_GRID_STEPS;
  const selected =
    steps.find(
      ({ minorMillimetres }) =>
        minorMillimetres * pixelsPerMillimetre >= MINOR_GRID_TARGET_PIXELS,
    ) ?? steps[steps.length - 1];

  return {
    ...selected,
    description: formatMeasurement(selected.minorMillimetres, system, true),
  };
}

function trimFixed(value: number, fractionDigits: number) {
  return value
    .toFixed(fractionDigits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

export function formatMeasurement(
  millimetres: number,
  system: MeasurementSystem,
  compact = false,
) {
  const normalized = Math.abs(millimetres) < 0.05 ? 0 : millimetres;
  const absolute = Math.abs(normalized);

  if (system === "imperial") {
    const totalInches = normalized / MILLIMETRES_PER_INCH;
    const absoluteInches = Math.abs(totalInches);
    if (absoluteInches >= 11.995) {
      const sign = totalInches < 0 ? "−" : "";
      let feet = Math.floor((absoluteInches + 0.005) / 12);
      let inches = absoluteInches - feet * 12;
      if (inches < 0) inches = 0;
      if (inches >= 11.995) {
        feet += 1;
        inches = 0;
      }
      if (inches < 0.05) return compact ? `${sign}${feet} ft` : `${sign}${feet}′ 0″`;
      return `${sign}${feet}′ ${trimFixed(inches, 1)}″`;
    }
    return compact
      ? `${trimFixed(totalInches, 1)} in`
      : `${trimFixed(totalInches, 2)}″`;
  }

  if (absolute >= 1000) {
    return `${trimFixed(normalized / 1000, compact ? 1 : 2)} m`;
  }
  if (absolute >= 100) {
    return `${trimFixed(normalized / 10, compact ? 0 : 1)} cm`;
  }
  return `${trimFixed(normalized, compact ? 0 : 1)} mm`;
}

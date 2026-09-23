import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Viewport = { origin: Point; pixelsPerUnit: number };

const MIN_ZOOM = 12;
const MAX_ZOOM = 120;
const ZOOM_FACTOR = 1.12;
const MAJOR_INTERVAL = 5;

function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.origin.x) / viewport.pixelsPerUnit,
    y: (viewport.origin.y - point.y) / viewport.pixelsPerUnit,
  };
}

function formatCoordinate(value: number) {
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return normalized.toFixed(1);
}

function drawLine(
  context: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  width: number,
) {
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: Viewport,
  pixelRatio: number,
) {
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f7f8f5";
  context.fillRect(0, 0, width, height);

  const { origin, pixelsPerUnit } = viewport;
  const minX = Math.floor(-origin.x / pixelsPerUnit) - 1;
  const maxX = Math.ceil((width - origin.x) / pixelsPerUnit) + 1;
  const minY = Math.floor((origin.y - height) / pixelsPerUnit) - 1;
  const maxY = Math.ceil(origin.y / pixelsPerUnit) + 1;

  context.lineCap = "square";

  for (let x = minX; x <= maxX; x += 1) {
    if (x === 0) continue;
    const screenX = origin.x + x * pixelsPerUnit;
    const isMajor = x % MAJOR_INTERVAL === 0;
    drawLine(
      context,
      { x: Math.round(screenX) + 0.5, y: 0 },
      { x: Math.round(screenX) + 0.5, y: height },
      isMajor ? "#cfd7d1" : "#e5e9e5",
      isMajor ? 1.2 : 1,
    );
  }

  for (let y = minY; y <= maxY; y += 1) {
    if (y === 0) continue;
    const screenY = origin.y - y * pixelsPerUnit;
    const isMajor = y % MAJOR_INTERVAL === 0;
    drawLine(
      context,
      { x: 0, y: Math.round(screenY) + 0.5 },
      { x: width, y: Math.round(screenY) + 0.5 },
      isMajor ? "#cfd7d1" : "#e5e9e5",
      isMajor ? 1.2 : 1,
    );
  }

  const axisColor = "#53665d";
  if (origin.y >= 0 && origin.y <= height) {
    drawLine(context, { x: 0, y: origin.y }, { x: width, y: origin.y }, axisColor, 1.5);
  }
  if (origin.x >= 0 && origin.x <= width) {
    drawLine(context, { x: origin.x, y: 0 }, { x: origin.x, y: height }, axisColor, 1.5);
  }

  context.fillStyle = "#6b7871";
  context.font = "500 11px Inter, system-ui, sans-serif";

  if (origin.y >= 18 && origin.y <= height - 18) {
    context.textAlign = "center";
    context.textBaseline = "top";
    for (let x = minX; x <= maxX; x += 1) {
      if (x === 0 || x % MAJOR_INTERVAL !== 0) continue;
      const screenX = origin.x + x * pixelsPerUnit;
      if (screenX > 28 && screenX < width - 28) {
        context.fillText(String(x), screenX, origin.y + 7);
      }
    }
  }

  if (origin.x >= 32 && origin.x <= width - 32) {
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let y = minY; y <= maxY; y += 1) {
      if (y === 0 || y % MAJOR_INTERVAL !== 0) continue;
      const screenY = origin.y - y * pixelsPerUnit;
      if (screenY > 24 && screenY < height - 24) {
        context.fillText(String(y), origin.x - 8, screenY);
      }
    }
  }

  if (origin.x >= 0 && origin.x <= width && origin.y >= 0 && origin.y <= height) {
    context.beginPath();
    context.arc(origin.x, origin.y, 4.5, 0, Math.PI * 2);
    context.fillStyle = "#146e50";
    context.fill();
    context.strokeStyle = "#f7f8f5";
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = "#244c3e";
    context.font = "650 11px Inter, system-ui, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "bottom";
    context.fillText("0, 0", origin.x + 10, origin.y - 8);
  }

  context.fillStyle = axisColor;
  context.font = "700 11px Inter, system-ui, sans-serif";
  if (origin.y >= 0 && origin.y <= height) {
    context.textAlign = "right";
    context.textBaseline = "bottom";
    context.fillText("+X", width - 12, origin.y - 7);
    context.textAlign = "left";
    context.fillText("−X", 12, origin.y - 7);
  }
  if (origin.x >= 0 && origin.x <= width) {
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillText("+Y", origin.x + 8, 12);
    context.textBaseline = "bottom";
    context.fillText("−Y", origin.x + 8, height - 12);
  }
}

export function LayoutCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Viewport>({
    origin: { x: 0, y: 0 },
    pixelsPerUnit: 32,
  });
  const sizeRef = useRef({ width: 0, height: 0 });
  const hasCenteredRef = useRef(false);
  const panRef = useRef<{ pointerId: number; last: Point } | null>(null);
  const spacePressedRef = useRef(false);
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(100);
  const [isPanning, setIsPanning] = useState(false);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    drawGrid(
      context,
      sizeRef.current.width,
      sizeRef.current.height,
      viewportRef.current,
      ratio,
    );
  }, []);

  const resetView = useCallback(() => {
    const { width, height } = sizeRef.current;
    viewportRef.current = {
      origin: { x: width / 2, y: height / 2 },
      pixelsPerUnit: 32,
    };
    setZoom(100);
    setCursor({ x: 0, y: 0 });
    render();
  }, [render]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const previousSize = sizeRef.current;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      sizeRef.current = { width, height };

      if (!hasCenteredRef.current) {
        viewportRef.current.origin = { x: width / 2, y: height / 2 };
        hasCenteredRef.current = true;
      } else {
        viewportRef.current.origin = {
          x: viewportRef.current.origin.x + (width - previousSize.width) / 2,
          y: viewportRef.current.origin.y + (height - previousSize.height) / 2,
        };
      }
      render();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [render]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        spacePressedRef.current = true;
        containerRef.current?.classList.add("is-pan-ready");
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spacePressedRef.current = false;
        containerRef.current?.classList.remove("is-pan-ready");
      }
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const worldBeforeZoom = screenToWorld(pointer, viewportRef.current);
      const direction = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const nextScale = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, viewportRef.current.pixelsPerUnit * direction),
      );

      viewportRef.current = {
        pixelsPerUnit: nextScale,
        origin: {
          x: pointer.x - worldBeforeZoom.x * nextScale,
          y: pointer.y + worldBeforeZoom.y * nextScale,
        },
      };
      setZoom(Math.round((nextScale / 32) * 100));
      setCursor(worldBeforeZoom);
      render();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [render]);

  const updateCursor = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };

    if (panRef.current?.pointerId === event.pointerId) {
      const delta = {
        x: point.x - panRef.current.last.x,
        y: point.y - panRef.current.last.y,
      };
      viewportRef.current.origin.x += delta.x;
      viewportRef.current.origin.y += delta.y;
      panRef.current.last = point;
      render();
    }

    setCursor(screenToWorld(point, viewportRef.current));
  };

  const startPan = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canPan =
      event.pointerType === "touch" ||
      event.button === 1 ||
      event.button === 2 ||
      (event.button === 0 && spacePressedRef.current);
    if (!canPan) return;

    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    panRef.current = {
      pointerId: event.pointerId,
      last: { x: event.clientX - rect.left, y: event.clientY - rect.top },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };

  const stopPan = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    setIsPanning(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      className={`canvas-container${isPanning ? " is-panning" : ""}`}
      ref={containerRef}
    >
      <canvas
        ref={canvasRef}
        aria-label="Model railway layout coordinate grid"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={startPan}
        onPointerMove={updateCursor}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
      />

      <div className="canvas-heading">
        <span className="eyebrow">Layout space</span>
        <strong>Build from the centre out.</strong>
      </div>

      <div className="canvas-help" aria-hidden="true">
        <span className="mouse-icon" />
        Scroll to zoom · Space + drag to pan
      </div>

      <div className="canvas-controls">
        <button type="button" onClick={resetView} title="Return to the origin">
          Centre origin
        </button>
        <span className="zoom-readout">{zoom}%</span>
      </div>

      <output className="coordinate-readout" aria-live="polite">
        <span><small>X</small>{formatCoordinate(cursor.x)}</span>
        <span><small>Y</small>{formatCoordinate(cursor.y)}</span>
      </output>
    </div>
  );
}


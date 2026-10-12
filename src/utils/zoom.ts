export const MAX_ZOOM_PERCENT_OPTIONS = [100, 200, 400, 800, 1600] as const;

interface ViewportBox {
  containerWidth: number;
  containerHeight: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function resizeZoomViewport(
  previous: ViewportBox,
  next: ViewportBox,
  current: { scale: number; positionX: number; positionY: number },
  maxScale: number,
) {
  const focusX =
    ((previous.containerWidth / 2 - current.positionX) / current.scale - previous.offsetX) / previous.width;
  const focusY =
    ((previous.containerHeight / 2 - current.positionY) / current.scale - previous.offsetY) / previous.height;
  const scale = Math.min(Math.max((current.scale * previous.width) / next.width, 1), maxScale);
  return {
    scale,
    x: next.containerWidth / 2 - (next.offsetX + focusX * next.width) * scale,
    y: next.containerHeight / 2 - (next.offsetY + focusY * next.height) * scale,
  };
}

export function getZoomImageDimensions(
  original: { width: number; height: number },
  crop: { width: number; height: number; unit: string } | null | undefined,
  orientationSteps = 0,
) {
  const swapped = orientationSteps === 1 || orientationSteps === 3;
  const width = swapped ? original.height : original.width;
  const height = swapped ? original.width : original.height;
  if (!crop || crop.width <= 0 || crop.height <= 0) return { width, height };
  if (crop.unit === '%') {
    return { width: (width * crop.width) / 100, height: (height * crop.height) / 100 };
  }
  return { width: crop.width, height: crop.height };
}

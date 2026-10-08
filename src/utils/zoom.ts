export const MAX_ZOOM_PERCENT_OPTIONS = [100, 200, 400, 800, 1600] as const;

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

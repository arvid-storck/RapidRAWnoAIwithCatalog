import type { OverlayMode } from '../../right/CropPanel';

interface CompositionOverlaysProps {
  width: number;
  height: number;
  mode: OverlayMode;
}

export default function CompositionOverlays({ width, height, mode }: CompositionOverlaysProps) {
  if (width <= 0 || height <= 0 || mode !== 'thirds') return null;

  return (
    <svg
      width={width}
      height={height}
      aria-hidden="true"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 50 }}
    >
      <g stroke="rgba(255, 255, 255, 0.7)" strokeWidth="1.5" fill="none">
        {[1 / 3, 2 / 3].map((fraction) => (
          <g key={fraction}>
            <line x1={width * fraction} y1={0} x2={width * fraction} y2={height} vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={height * fraction} x2={width} y2={height * fraction} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </g>
    </svg>
  );
}

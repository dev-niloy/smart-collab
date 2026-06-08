const SPLINE_URL =
  'https://my.spline.design/liquidgradientabstractbackground-2MLLKMUNNElHMN2YpOPnNAzi/?v=2';

export function SplineBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <iframe
        src={SPLINE_URL}
        title="background"
        loading="lazy"
        className="absolute inset-0 h-full w-full border-0"
        // Spline scenes render full-bleed; size matches the wrapper.
      />
      {/* Dimmer keeps body text readable on top of the scene. */}
      <div className="absolute inset-0 bg-background/55" />
      {/* Hide the "Built with Spline" badge tucked bottom-right. */}
      <div className="absolute right-0 bottom-0 h-16 w-44 bg-background" />
    </div>
  );
}

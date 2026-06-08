const SPLINE_URL =
  'https://my.spline.design/liquidgradientabstractbackground-2MLLKMUNNElHMN2YpOPnNAzi/?v=2';

export function SplineBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* iframe is oversized + shifted so the "Built with Spline" badge
       * sits below the viewport. Scene still fills the screen. */}
      <iframe
        src={SPLINE_URL}
        title="background"
        loading="lazy"
        className="absolute left-0 top-0 w-full border-0"
        style={{ height: 'calc(100% + 80px)' }}
      />
      {/* Dimmer keeps body text readable on top of the scene. */}
      <div className="absolute inset-0 bg-background/55" />
    </div>
  );
}

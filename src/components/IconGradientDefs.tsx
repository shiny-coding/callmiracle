'use client';

/**
 * SVG gradient definitions for icon colors.
 * Include this component once in your layout to enable gradient fills on icons.
 *
 * Usage: Add className="icon-gradient" to any icon wrapper to apply the gradient (orange).
 * Usage: Add className="icon-gradient-blue" to any icon wrapper to apply the blue gradient (mic/camera/devices).
 * Example: <span className="icon-gradient"><HomeIcon /></span>
 */
export default function IconGradientDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--icon-color-primary, #f97316)" />
          <stop offset="100%" stopColor="var(--icon-color-secondary, #fbbf24)" />
        </linearGradient>
        <linearGradient id="iconGradientBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--icon-color-blue-primary, #1976d2)" />
          <stop offset="100%" stopColor="var(--icon-color-blue-secondary, #42a5f5)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

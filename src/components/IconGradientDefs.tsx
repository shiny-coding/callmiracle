'use client';

/**
 * SVG gradient definitions for icon colors.
 * Include this component once in your layout to enable gradient fills on icons.
 *
 * Usage: Add className="icon-gradient" to any icon wrapper to apply the gradient.
 * Example: <span className="icon-gradient"><HomeIcon /></span>
 */
export default function IconGradientDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--icon-color-primary, #8b5cf6)" />
          <stop offset="100%" stopColor="var(--icon-color-secondary, #a78bfa)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

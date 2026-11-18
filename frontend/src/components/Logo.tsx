/** The gym's mark (same as public/favicon.svg): a loaded barbell, side view, cut out of a
 * bone-white square. Reads on photos and at favicon size. */
export function Logo({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden>
      <rect width={64} height={64} fill="#efe9df" />
      <g fill="#0b0909">
        <rect x={6} y={30} width={52} height={4} />
        <rect x={12} y={16} width={7} height={32} />
        <rect x={20} y={21} width={5} height={22} />
        <rect x={45} y={16} width={7} height={32} />
        <rect x={39} y={21} width={5} height={22} />
      </g>
    </svg>
  );
}

/** The gym's mark (same as public/favicon.svg): the set glyph as a ladder, three columns of squares
 * growing 2, 3, 4, the past ones faded and the current one solid, on a blue tile. */
export function Logo({ size = 48, className = "" }: { size?: number; className?: string }) {
  const square = (x: number, y: number) => <rect key={`${x}-${y}`} x={x} y={y} width={36} height={36} rx={7} />;
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden>
      <rect width={256} height={256} rx={56} fill="#2563eb" />
      <g fill="#ffffff">
        <g opacity={0.55}>{[176, 132].map((y) => square(62, y))}</g>
        <g opacity={0.78}>{[176, 132, 88].map((y) => square(110, y))}</g>
        {[176, 132, 88, 44].map((y) => square(158, y))}
      </g>
    </svg>
  );
}

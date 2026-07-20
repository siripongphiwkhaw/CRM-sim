/**
 * Jenonutz Cloud brand mark — "JNT" on a red cloud, in the spirit of the
 * Salesforce cloud lockup. Pure inline SVG, scales to whatever box it's given.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Jenonutz Cloud"
      className={className}
    >
      <path
        d="M7 18.5a4.2 4.2 0 0 1-.7-8.35A5.7 5.7 0 0 1 17.3 8.2 4.7 4.7 0 0 1 16.7 18.5H7z"
        fill="#c8102e"
      />
      <text
        x="11.2"
        y="16"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="4.9"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="-0.2"
      >
        JNT
      </text>
    </svg>
  );
}

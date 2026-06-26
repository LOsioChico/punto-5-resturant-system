import type { SVGProps } from "react";

/**
 * Restaurant table icon — a round table with two chairs.
 * Lucide doesn't ship a dining table icon, so we use a custom SVG.
 */
export function RestaurantTable(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Table top — rounded rectangle */}
      <rect x="5" y="8" width="14" height="8" rx="3" />
      {/* Chair backs — top and bottom */}
      <path d="M8 8V5" />
      <path d="M12 8V4" />
      <path d="M16 8V5" />
      <path d="M8 16v3" />
      <path d="M12 16v4" />
      <path d="M16 16v3" />
    </svg>
  );
}

import type { ComponentType, ReactNode } from "react";

/** The props the editor's lucide icons receive, so these drop in where a lucide component is used. */
export interface EditorIconProps {
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}

/** Anything a toolbar slot can render as an icon: a lucide component or one of these. */
export type ToolIcon = ComponentType<EditorIconProps>;

/**
 * The owner's mock draws every icon as a 24x24 stroke icon with a 1.8 stroke and round caps and
 * joins. Like lucide, it is hidden from assistive tech unless the caller gives it a name.
 */
function MockIcon({
  size = 24,
  strokeWidth = 1.8,
  className,
  children,
}: EditorIconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** The Step tool: a circled "1". */
export function StepIcon(props: EditorIconProps) {
  return (
    <MockIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.5 9.5l2-1.5v8" />
    </MockIcon>
  );
}

/** The Redact tool: a box with two text lines struck through it. */
export function RedactIcon(props: EditorIconProps) {
  return (
    <MockIcon {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h7" />
      <path d="M7 14h10" />
    </MockIcon>
  );
}

/** The zoom pill's Fit button: four corner brackets around the content. */
export function FitIcon(props: EditorIconProps) {
  return (
    <MockIcon {...props}>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </MockIcon>
  );
}

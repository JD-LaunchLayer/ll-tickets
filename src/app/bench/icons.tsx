type IconProps = { className?: string };

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg className={className ?? "icon"} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {children}
    </svg>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ListIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path {...stroke} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
    </Svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path {...stroke} d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function AskIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path {...stroke} d="M6 16.5V8.2A2.2 2.2 0 0 1 8.2 6h7.6A2.2 2.2 0 0 1 18 8.2v5.1a2.2 2.2 0 0 1-2.2 2.2H9.2L6 18.5z" />
    </Svg>
  );
}

export function ChevronIcon({
  direction,
  className,
}: {
  direction: "left" | "right" | "up" | "down";
  className?: string;
}) {
  const d =
    direction === "left"
      ? "M14.5 6.5 9 12l5.5 5.5"
      : direction === "right"
        ? "M9.5 6.5 15 12l-5.5 5.5"
        : direction === "up"
          ? "M6.5 14.5 12 9l5.5 5.5"
          : "M6.5 9.5 12 15l5.5-5.5";
  return (
    <Svg className={className}>
      <path {...stroke} d={d} />
    </Svg>
  );
}

export function CloseIcon() {
  return (
    <Svg>
      <path {...stroke} d="M7 7l10 10M17 7 7 17" />
    </Svg>
  );
}

export function PhoneIcon() {
  return (
    <Svg className="icon icon-sm">
      <path
        {...stroke}
        d="M8.2 5.5h2l1 2.4-1.3 1a11 11 0 0 0 4.2 4.2l1-1.3 2.4 1v2A1.5 1.5 0 0 1 16 16.5 11.5 11.5 0 0 1 6.5 7a1.5 1.5 0 0 1 1.7-1.5z"
      />
    </Svg>
  );
}

export function SendIcon() {
  return (
    <Svg>
      <path {...stroke} d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

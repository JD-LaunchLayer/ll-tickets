import Link from "next/link";

export function BrandMark() {
  return (
    <Link href="/" className="brand-home" aria-label="LaunchLayer jobs">
      <span className="brand-logo">
        {/* Cropped in CSS against the black header. next/image would fight that box. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/image-0961fde4.png" alt="" width={640} height={307} />
      </span>
    </Link>
  );
}

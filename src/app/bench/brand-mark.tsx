import Link from "next/link";
import { LOGO_CROP } from "@/lib/brand";

export function BrandMark() {
  const { x, y, width, height, sourceWidth, sourceHeight } = LOGO_CROP;
  return (
    <Link href="/" className="brand-home" aria-label="LaunchLayer jobs">
      <span className="brand-logo">
        {/* Tight crop of the transparent lockup. next/image would fight that box. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/image-0961fde4.png"
          alt=""
          width={sourceWidth}
          height={sourceHeight}
          style={{
            width: `calc(100% * ${sourceWidth} / ${width})`,
            height: `calc(100% * ${sourceHeight} / ${height})`,
            left: `calc(100% * -${x} / ${width})`,
            top: `calc(100% * -${y} / ${height})`,
          }}
        />
      </span>
    </Link>
  );
}

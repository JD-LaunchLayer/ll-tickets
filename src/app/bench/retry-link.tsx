"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function RetryLink({ href }: { href: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className="mt-3 inline-flex min-h-12 items-center text-base font-semibold text-[#2563eb] underline"
      onClick={(event) => {
        event.preventDefault();
        router.refresh();
      }}
    >
      Retry
    </Link>
  );
}

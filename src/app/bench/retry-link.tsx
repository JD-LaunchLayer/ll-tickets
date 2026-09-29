"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function RetryLink({ href }: { href: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className="text-link"
      onClick={(event) => {
        event.preventDefault();
        router.refresh();
      }}
    >
      Retry
    </Link>
  );
}

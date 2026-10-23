"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Lock" },
  { href: "/locks", label: "Your locks" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 text-sm">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className="text-foreground/60 hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

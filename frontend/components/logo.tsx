import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center space-x-2">
      <span className="text-3xl font-normal tracking-tight font-sf-pro text-foreground/90 hover:text-foreground transition-colors">OpenCore</span>
    </Link>
  );
}


'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/ingredientes', label: 'Ingredientes' },
  { href: '/nota-fiscal', label: 'Nota fiscal' },
  { href: '/receitas', label: 'Receitas' },
  { href: '/precificacao', label: 'Precificação' },
  { href: '/assistente', label: 'Assistente' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-cream/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
        <span className="font-display text-lg text-caramel-dark whitespace-nowrap">
          Precificação
        </span>
        <nav className="flex gap-1 overflow-x-auto">
          {links.map((link) => {
            const isActive = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? 'bg-caramel text-white' : 'text-ink hover:bg-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

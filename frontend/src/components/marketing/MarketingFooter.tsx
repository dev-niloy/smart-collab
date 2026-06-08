import Link from 'next/link';

const COLS = [
  {
    title: 'Product',
    links: [
      { href: '/#features', label: 'Features' },
      { href: '/#workflow', label: 'Workflow' },
      { href: '/#pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/signup', label: 'Get started' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/#faq', label: 'FAQ' },
      { href: '/login', label: 'Sign in' },
      { href: 'mailto:solvemeet@gmail.com', label: 'Support' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-background/60 backdrop-blur">
      <div className="mx-auto max-w-[1080px] px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground text-[11px] font-semibold">
                S
              </span>
              <span className="text-sm font-semibold tracking-tight">Smart Collab</span>
            </div>
            <p className="mt-3 max-w-[18rem] text-[13px] leading-relaxed text-muted-foreground">
              The project and task system for teams that ship.
            </p>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <div className="text-eyebrow mb-3">{col.title}</div>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} Smart Collab. All rights reserved.</div>
          <div className="flex gap-5">
            <Link href="/about" className="hover:text-foreground">
              About
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

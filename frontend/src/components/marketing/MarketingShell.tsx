import type { ReactNode } from 'react';
import { MarketingNav } from './MarketingNav';
import { MarketingFooter } from './MarketingFooter';

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      <AmbientGlow />
      <div className="relative z-10 flex min-h-screen flex-col">
        <MarketingNav />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </div>
  );
}

function AmbientGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Top center wash */}
      <div
        className="absolute -top-40 left-1/2 h-[760px] w-[1400px] -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(94,106,210,0.28), rgba(94,106,210,0.08) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Left drift */}
      <div
        className="absolute top-[30%] -left-48 h-[640px] w-[640px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(94,106,210,0.18), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Right drift */}
      <div
        className="absolute top-[55%] -right-48 h-[640px] w-[640px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(130,143,255,0.14), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Bottom wash */}
      <div
        className="absolute -bottom-40 left-1/2 h-[620px] w-[1300px] -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(94,106,210,0.18), transparent 65%)',
          filter: 'blur(70px)',
        }}
      />
    </div>
  );
}

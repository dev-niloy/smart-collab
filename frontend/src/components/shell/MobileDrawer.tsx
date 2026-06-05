'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export interface MobileDrawerProps {
  children: ReactNode;
  triggerLabel?: string;
}

export function MobileDrawer({ children, triggerLabel = 'Open navigation' }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label={triggerLabel}
            data-testid="mobile-drawer-trigger"
            className="grid h-9 w-9 place-items-center rounded-md text-foreground hover:bg-accent"
          />
        }
      >
        <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[320px] flex-col gap-0 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Workspace navigation drawer.</SheetDescription>
        </SheetHeader>
        <div data-testid="mobile-drawer-content" className="flex flex-1 overflow-hidden">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

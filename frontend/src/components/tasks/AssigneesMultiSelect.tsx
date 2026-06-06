'use client';

import { useMemo, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export type AssigneeOption = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  options: AssigneeOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerAriaLabel?: string;
};

export function AssigneesMultiSelect({
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Pick assignees',
  emptyMessage = 'No members found.',
  className,
  triggerAriaLabel = 'Assignees',
}: Props) {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedOptions = useMemo(
    () => options.filter((o) => selectedSet.has(o.id)),
    [options, selectedSet],
  );

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const triggerLabel =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? selectedOptions[0].name
        : `${selectedOptions.length} selected`;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        aria-label={triggerAriaLabel}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors',
          'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:bg-input/30 dark:hover:bg-input/50',
          className,
        )}
      >
        <span
          className={cn(
            'truncate text-left',
            selectedOptions.length === 0 && 'text-muted-foreground',
          )}
        >
          {triggerLabel}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="start" className="z-50">
          <Popover.Popup className="w-[var(--anchor-width,18rem)] min-w-[18rem] rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none">
            <Command>
              <CommandInput placeholder="Search by name or email…" />
              <CommandList>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => {
                    const checked = selectedSet.has(opt.id);
                    return (
                      <CommandItem
                        key={opt.id}
                        // Combined value lets cmdk filter on name + email
                        value={`${opt.name} ${opt.email}`}
                        onSelect={() => toggle(opt.id)}
                        aria-label={opt.name}
                        className="flex items-center gap-2"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border',
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input',
                          )}
                        >
                          {checked ? <Check className="size-3" /> : null}
                        </span>
                        <span className="flex-1 truncate">
                          <span className="font-medium">{opt.name}</span>{' '}
                          <span className="text-muted-foreground">({opt.email})</span>
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
            {selectedOptions.length > 0 && (
              <div className="flex flex-wrap gap-1 border-t bg-muted/40 p-2">
                {selectedOptions.map((opt) => (
                  <span
                    key={opt.id}
                    className="inline-flex items-center gap-0.5 rounded-full bg-background py-0.5 pl-2 pr-0.5 text-xs ring-1 ring-foreground/15"
                  >
                    {opt.name}
                    <button
                      type="button"
                      aria-label={`Remove ${opt.name}`}
                      onClick={() => toggle(opt.id)}
                      className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

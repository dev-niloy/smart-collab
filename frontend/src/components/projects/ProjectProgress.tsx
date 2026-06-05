'use client';

import { Progress } from '@/components/ui/progress';
import type { ProjectProgress as ProjectProgressShape } from '@/lib/schemas/project';

export type ProjectProgressVariant = 'card' | 'detail' | 'inline';

export interface ProjectProgressProps {
  progress: ProjectProgressShape;
  variant?: ProjectProgressVariant;
  className?: string;
}

export const formatProgressLabel = (p: ProjectProgressShape): string => {
  if (p.total === 0) return '0 tasks';
  return `${p.done}/${p.total} · ${p.percent}%`;
};

export const formatProgressLabelLong = (p: ProjectProgressShape): string => {
  if (p.total === 0) return '0 tasks';
  return `${p.done} of ${p.total} tasks · ${p.percent}%`;
};

export function ProjectProgress({
  progress,
  variant = 'card',
  className,
}: ProjectProgressProps) {
  // inline variant: hide entirely for empty projects (sidebar UX)
  if (variant === 'inline' && progress.total === 0) return null;

  const aria = `Project progress ${progress.percent} percent`;

  if (variant === 'inline') {
    return (
      <Progress
        value={progress.percent}
        aria-label={aria}
        data-variant="inline"
        className={'flex-row [&_[data-slot=progress-track]]:h-0.5 ' + (className ?? '')}
      />
    );
  }

  if (variant === 'detail') {
    return (
      <div data-variant="detail" className={'flex w-full flex-col gap-1.5 ' + (className ?? '')}>
        <Progress
          value={progress.percent}
          aria-label={aria}
          className="flex-row [&_[data-slot=progress-track]]:h-2"
        />
        <p className="text-xs text-muted-foreground">{formatProgressLabelLong(progress)}</p>
      </div>
    );
  }

  return (
    <div data-variant="card" className={'flex w-full flex-col gap-1 ' + (className ?? '')}>
      <Progress
        value={progress.percent}
        aria-label={aria}
        className="flex-row [&_[data-slot=progress-track]]:h-1"
      />
      <p className="text-[11px] text-muted-foreground">{formatProgressLabel(progress)}</p>
    </div>
  );
}

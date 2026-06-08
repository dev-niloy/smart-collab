'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginSchema, type LoginInput, type Role } from '@/lib/schemas/auth';
import { useLogin, useDemoLogin } from '@/hooks/useUser';
import { useAcceptInvitation } from '@/hooks/useInvitations';
import { ApiError } from '@/lib/api';

type DemoRole = { role: Role; label: string };

const DEMO_ROLES: DemoRole[] = [
  { role: 'admin', label: 'Admin' },
  { role: 'project_manager', label: 'Project Manager' },
  { role: 'team_member', label: 'Team Member' },
];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const inviteToken = search.get('invite') ?? '';
  const inviteEmail = search.get('email') ?? '';
  const [submitting, setSubmitting] = useState(false);
  const [demoBusy, setDemoBusy] = useState<Role | null>(null);
  const loginMutation = useLogin();
  const demoLoginMutation = useDemoLogin();
  const acceptMutation = useAcceptInvitation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: inviteEmail, password: '' },
  });

  useEffect(() => {
    if (inviteEmail) reset({ email: inviteEmail, password: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteEmail]);

  const acceptAndRedirect = async () => {
    if (!inviteToken) {
      router.push('/dashboard');
      return;
    }
    try {
      const result = await acceptMutation.mutateAsync(inviteToken);
      toast.success('Joined the project.');
      router.push(`/projects/${result.projectId}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `Signed in. Invitation: ${err.message}`
          : 'Signed in. Could not accept invitation.',
      );
      router.push('/dashboard');
    }
  };

  const onSubmit = async (data: LoginInput) => {
    setSubmitting(true);
    try {
      await loginMutation.mutateAsync(data);
      await acceptAndRedirect();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onDemoLogin = async (role: Role) => {
    setDemoBusy(role);
    try {
      await demoLoginMutation.mutateAsync(role);
      await acceptAndRedirect();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Demo login failed';
      toast.error(msg);
    } finally {
      setDemoBusy(null);
    }
  };

  return (
    <main className="flex flex-1 min-h-screen w-full">
      <section className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-border bg-card px-10 py-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-md bg-primary surface-edge-highlight">
            <Image src="/logo.jpg" alt="" width={32} height={32} className="h-8 w-8 object-cover" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Smart Collab</span>
        </div>

        <div className="relative max-w-md space-y-6">
          <span className="text-eyebrow">Project workspace</span>
          <h1 className="text-display-lg">
            Ship work in lockstep. <span className="text-muted-foreground">Without the meetings.</span>
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            One canvas for projects, tasks, comments, mentions, and email. Built for teams that move fast and stay honest about status.
          </p>
        </div>

        <div className="relative flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[#27a644]" /> live ops
          </div>
          <div className="h-3 w-px bg-border" />
          <span>RBAC · SSE · email worker</span>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-md bg-primary">
              <Image src="/logo.jpg" alt="" width={32} height={32} className="h-8 w-8 object-cover" />
            </div>
            <span className="text-sm font-semibold">Smart Collab</span>
          </div>

          <div className="space-y-2">
            <span className="text-eyebrow">Welcome back</span>
            <h2 className="text-headline">Sign in to your workspace</h2>
            <p className="text-sm text-muted-foreground">
              Use your credentials, or jump in with a demo role.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@team.dev" {...register('email')} />
              {errors.email && (
                <p role="alert" className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register('password')} />
              {errors.password && (
                <p role="alert" className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">or demo as</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-2">
            {DEMO_ROLES.map((d) => (
              <Button
                key={d.role}
                type="button"
                variant="secondary"
                onClick={() => onDemoLogin(d.role)}
                disabled={demoBusy !== null}
                className="justify-between"
              >
                <span>{demoBusy === d.role ? 'Signing in…' : d.label}</span>
                <span className="text-xs text-muted-foreground">→</span>
              </Button>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            No account?{' '}
            <Link href="/signup" className="text-foreground underline underline-offset-4 hover:text-primary">
              Sign up
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

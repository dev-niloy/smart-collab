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
import { signupSchema, type SignupInput } from '@/lib/schemas/auth';
import { useSignup } from '@/hooks/useUser';
import { useAcceptInvitation } from '@/hooks/useInvitations';
import { ApiError } from '@/lib/api';

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const inviteToken = search.get('invite') ?? '';
  const inviteEmail = search.get('email') ?? '';
  const [submitting, setSubmitting] = useState(false);
  const signupMutation = useSignup();
  const acceptMutation = useAcceptInvitation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: inviteEmail, password: '', name: '' },
  });

  useEffect(() => {
    if (inviteEmail) {
      reset({ email: inviteEmail, password: '', name: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteEmail]);

  const onSubmit = async (data: SignupInput) => {
    setSubmitting(true);
    try {
      await signupMutation.mutateAsync(data);
      if (inviteToken) {
        try {
          const result = await acceptMutation.mutateAsync(inviteToken);
          toast.success('Joined the project.');
          router.push(`/projects/${result.projectId}`);
          return;
        } catch (err) {
          // Account created OK; invitation accept failed (mismatch / expired).
          // Fall through to dashboard with a soft warning so the user isn't stuck.
          toast.error(
            err instanceof ApiError
              ? `Account created. Invitation: ${err.message}`
              : 'Account created. Could not accept invitation.',
          );
        }
      }
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Signup failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex flex-1 min-h-screen w-full">
      <section className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-border bg-card px-10 py-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-md bg-primary surface-edge-highlight">
            <Image src="/logo.jpg" alt="" width={32} height={32} className="h-8 w-8 object-cover" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Smart Collab</span>
        </div>

        <div className="relative max-w-md space-y-6">
          <span className="text-eyebrow">Start in seconds</span>
          <h1 className="text-display-lg">
            Replace status meetings. <span className="text-muted-foreground">Keep your day.</span>
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Create an account, join a project, and let mentions, comments, and email do the standup for you.
          </p>
        </div>

        <ul className="relative space-y-2 text-xs text-muted-foreground">
          <li>· Realtime SSE inbox</li>
          <li>· Email digests w/ full project context</li>
          <li>· Role-based access — admin · PM · member</li>
        </ul>
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
            <span className="text-eyebrow">Create account</span>
            <h2 className="text-headline">Join the workspace</h2>
            <p className="text-sm text-muted-foreground">
              You will join as a Team Member by default.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Name</Label>
              <Input id="name" placeholder="Ada Lovelace" {...register('name')} />
              {errors.name && (
                <p role="alert" className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@team.dev" {...register('email')} />
              {errors.email && (
                <p role="alert" className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" placeholder="At least 8 chars" {...register('password')} />
              {errors.password && (
                <p role="alert" className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Have an account?{' '}
            <Link href="/login" className="text-foreground underline underline-offset-4 hover:text-primary">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

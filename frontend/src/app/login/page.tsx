'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { loginSchema, type LoginInput, type Role } from '@/lib/schemas/auth';
import { useLogin, useDemoLogin } from '@/hooks/useUser';
import { ApiError } from '@/lib/api';

type DemoRole = { role: Role; label: string };

const DEMO_ROLES: DemoRole[] = [
  { role: 'admin', label: 'Admin' },
  { role: 'project_manager', label: 'Project Manager' },
  { role: 'team_member', label: 'Team Member' },
];

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [demoBusy, setDemoBusy] = useState<Role | null>(null);
  const loginMutation = useLogin();
  const demoLoginMutation = useDemoLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginInput) => {
    setSubmitting(true);
    try {
      await loginMutation.mutateAsync(data);
      router.push('/dashboard');
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
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Demo login failed';
      toast.error(msg);
    } finally {
      setDemoBusy(null);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your email + password, or a demo account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or demo as</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-2">
            {DEMO_ROLES.map((d) => (
              <Button
                key={d.role}
                type="button"
                variant="outline"
                onClick={() => onDemoLogin(d.role)}
                disabled={demoBusy !== null}
              >
                {demoBusy === d.role ? 'Signing in…' : `Demo ${d.label}`}
              </Button>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link href="/signup" className="underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

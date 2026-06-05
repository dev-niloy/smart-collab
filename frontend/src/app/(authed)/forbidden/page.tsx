import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForbiddenPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>403 — Forbidden</CardTitle>
          <CardDescription>You don&apos;t have access to this page.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

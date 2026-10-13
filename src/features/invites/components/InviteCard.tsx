import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { APP_NAME } from '@/lib/constants';

/** The accept-invite page's card: one heading and its content. */
export function InviteCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <title>{`Invitation · ${APP_NAME}`}</title>
      <CardHeader>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

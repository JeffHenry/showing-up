const unused = 'this should fail CI';

import { Button } from '@/components/ui/button';

export function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">ShowingUp</h1>
      <Button type="button">Get started</Button>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';

export const metadata = {
  title: 'Dashboard',
  description: 'Manage your short links, view analytics, and customize settings.',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard');
  }

  return (
    <div className="container" style={{ padding: 'var(--space-8) var(--space-4)' }}>
      {children}
    </div>
  );
}

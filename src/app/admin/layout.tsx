import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { ADMIN_EMAIL } from '@/lib/config';

export const metadata = {
  title: 'Admin Console',
  description: 'Shorty System Administration & Abuse Moderation',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/login?callbackUrl=/admin');
  }

  const adminEmail = (process.env.ADMIN_EMAIL || ADMIN_EMAIL || '').trim().toLowerCase();
  const userEmail = session.user.email.trim().toLowerCase();
  const userRole = (session.user as { role?: string })?.role;

  const isAuthorized =
    (adminEmail && userEmail === adminEmail) || userRole === 'admin';

  if (!isAuthorized) {
    redirect('/dashboard');
  }

  return (
    <div className="container" style={{ padding: 'var(--space-8) var(--space-4)' }}>
      {children}
    </div>
  );
}

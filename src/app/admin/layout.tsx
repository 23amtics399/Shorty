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

  const isAdmin =
    ADMIN_EMAIL &&
    session.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="container" style={{ padding: 'var(--space-8) var(--space-4)' }}>
      {children}
    </div>
  );
}

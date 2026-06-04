import { createFileRoute, redirect } from '@tanstack/react-router';

/** Bare /admin → /admin/participants (reiner Routing-Redirect, kein Auth-Gate). */
export const Route = createFileRoute('/admin/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/participants' });
  },
});

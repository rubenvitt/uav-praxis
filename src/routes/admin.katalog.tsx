import { createFileRoute } from '@tanstack/react-router';
import { CatalogPage } from '../admin/CatalogPage';
import { AdminFehler } from '../admin/AdminFehler';
import { adminTasksQuery } from '../admin/queries';

export const Route = createFileRoute('/admin/katalog')({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminTasksQuery),
  component: CatalogPage,
  errorComponent: AdminFehler,
});

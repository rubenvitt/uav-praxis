import { createFileRoute } from '@tanstack/react-router';
import { CatalogPage } from '../admin/CatalogPage';

export const Route = createFileRoute('/admin/katalog')({
  component: CatalogPage,
});

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CatalogueImportResponse,
  CatalogueStatusResponse,
  type CatalogueImportInput,
} from '@bonvoyage/shared';
import { fetchJson } from '../../lib/api';

// S1-7: the administrator catalogue page.

export function useCatalogueStatus() {
  return useQuery({
    queryKey: ['admin', 'catalogue', 'status'],
    queryFn: () => fetchJson('/api/admin/catalogue/status', CatalogueStatusResponse),
  });
}

export function useCatalogueImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CatalogueImportInput) =>
      fetchJson('/api/admin/catalogue/import', CatalogueImportResponse, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (result) => {
      // A dry run wrote nothing, so only a real import changes the status.
      if (!result.dryRun) {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'catalogue', 'status'] });
        void queryClient.invalidateQueries({ queryKey: ['hubs'] });
        void queryClient.invalidateQueries({ queryKey: ['destinations'] });
      }
    },
  });
}

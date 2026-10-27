import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PackagesResponse,
  TripDetail,
  type ChangePackageInput,
  type PackageOpinionInput,
} from '@bonvoyage/shared';
import { fetchJson } from '../../lib/api';
import { refetchOnConflict } from '../trips/api';

// S3-4: the packages screen's queries and mutations. The packages list is
// not polled; every mutation writes its response back into the cache.

const send = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export function usePackages(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['trip', id, 'packages'],
    retry: false,
    enabled,
    refetchOnWindowFocus: false,
    queryFn: () => fetchJson(`/api/trips/${id}/packages`, PackagesResponse),
  });
}

export function useGiveOpinion(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, decision }: { packageId: string } & PackageOpinionInput) =>
      fetchJson(
        `/api/trips/${id}/packages/${packageId}/opinion`,
        PackagesResponse,
        send('PUT', { decision }),
      ),
    onSuccess: (response) => {
      queryClient.setQueryData(['trip', id, 'packages'], response);
      void queryClient.invalidateQueries({ queryKey: ['trip', id] });
    },
    onError: refetchOnConflict(queryClient, id),
  });
}

export function useChoosePackage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string) =>
      fetchJson(`/api/trips/${id}/packages/${packageId}/select`, TripDetail, send('POST', {})),
    onSuccess: (detail) => {
      queryClient.setQueryData(['trip', id], detail);
      void queryClient.invalidateQueries({ queryKey: ['trip', id] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: refetchOnConflict(queryClient, id),
  });
}

export function useRemovePackage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string) =>
      fetchJson(`/api/trips/${id}/packages/${packageId}/remove`, TripDetail, send('POST', {})),
    onSuccess: (detail) => {
      queryClient.setQueryData(['trip', id], detail);
      void queryClient.invalidateQueries({ queryKey: ['trip', id] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: refetchOnConflict(queryClient, id),
  });
}

export function useChangePackage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, ...input }: { packageId: string } & ChangePackageInput) =>
      fetchJson(`/api/trips/${id}/packages/${packageId}`, PackagesResponse, send('PATCH', input)),
    onSuccess: (response) => {
      queryClient.setQueryData(['trip', id, 'packages'], response);
      void queryClient.invalidateQueries({ queryKey: ['trip', id] });
    },
    onError: refetchOnConflict(queryClient, id),
  });
}

import { estimateRoadKm } from '@bonvoyage/engine';
import type { DistanceResult, RoutingProvider } from '../types';

export function estimateProvider(): RoutingProvider {
  return {
    name: 'estimate',
    dailyLimit: null,
    cacheable: false,
    getDistances(origin, destinations) {
      return Promise.resolve(
        new Map(
          destinations.map((destination): [string, DistanceResult] => {
            const estimate = estimateRoadKm(origin, destination);
            return [
              destination.id,
              {
                destinationId: destination.id,
                km: estimate.distanceKm,
                durationMin: null,
                provenance: 'estimated',
                provider: 'estimate',
                fromCache: false,
              },
            ];
          }),
        ),
      );
    },
  };
}

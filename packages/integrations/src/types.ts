import type { Provenance } from '@bonvoyage/shared';

export type { Provenance } from '@bonvoyage/shared';

export interface RoutingOrigin {
  key: string;
  lat: number;
  lng: number;
}

export interface RoutingDestination {
  id: string;
  lat: number;
  lng: number;
}

export interface DistanceResult {
  destinationId: string;
  km: number;
  durationMin: number | null;
  provenance: Provenance;
  provider: string;
  fromCache: boolean;
}

export interface RoutingProvider {
  readonly name: string;
  readonly dailyLimit: number | null;
  readonly cacheable: boolean;
  getDistances(
    origin: RoutingOrigin,
    destinations: readonly RoutingDestination[],
  ): Promise<Map<string, DistanceResult>>;
}

export interface Routing {
  getDistances(
    origin: RoutingOrigin,
    destinations: readonly RoutingDestination[],
  ): Promise<Map<string, DistanceResult>>;
}

export interface RoutingLogger {
  warn(details: { provider: string; reason: string }, message: string): void;
}

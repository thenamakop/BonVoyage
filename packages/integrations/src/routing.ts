import type { Provenance } from '@bonvoyage/shared';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RoutingPlace {
  id: string;
  point: GeoPoint;
  hubSlug?: string;
}

export interface DistanceResult {
  distanceKm: number;
  durationMin: number | null;
  provenance: Provenance;
  source: string;
}

export interface RoutingProvider {
  readonly name: string;
  distance(from: RoutingPlace, to: RoutingPlace): Promise<DistanceResult>;
  matrix(from: RoutingPlace, to: readonly RoutingPlace[]): Promise<DistanceResult[]>;
}

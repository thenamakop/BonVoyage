import type { Provenance } from '@bonvoyage/shared';

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;

// ADR-007: straight-line distance times a 1.3 road factor when no curated road distance exists.
export const ROAD_FACTOR = 1.3;

function assertPoint(p: LatLng): void {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
    throw new RangeError('Coordinates must be finite numbers.');
  }
  if (p.lat < -90 || p.lat > 90) throw new RangeError('Latitude must be between -90 and 90.');
  if (p.lng < -180 || p.lng > 180) throw new RangeError('Longitude must be between -180 and 180.');
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  assertPoint(a);
  assertPoint(b);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateRoadKm(
  a: LatLng,
  b: LatLng,
): { distanceKm: number; provenance: Provenance } {
  return { distanceKm: Math.round(haversineKm(a, b) * ROAD_FACTOR), provenance: 'estimated' };
}

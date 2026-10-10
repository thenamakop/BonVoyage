import { estimateRoadKm, haversineKm } from '@bonvoyage/engine';
import { DESTINATION_TYPES } from '@bonvoyage/shared';
import type { DestinationRow, FareRow, HubRow, PoiRow } from './schemas';
import type { CatalogueIssue } from './load';

// S0-4: pure cross-file catalogue rules. Line numbers are not known here, so
// issues name the offending slug/key in the message instead.

const SCOPE_HUB = 'gurugram';
const SCOPE_KM = 800;
const MIN_PER_TYPE = 2;
const MIN_POIS = 6;
const CAR_ROW_HUBS = ['gurugram', 'delhi'] as const;

export interface CatalogueRows {
  hubs: HubRow[];
  destinations: DestinationRow[];
  fares: FareRow[];
  pois: PoiRow[];
}

export function checkCatalogue(rows: CatalogueRows): CatalogueIssue[] {
  const issues: CatalogueIssue[] = [];
  const { hubs, destinations, fares, pois } = rows;

  const hubBySlug = new Map(hubs.map((h) => [h.slug, h]));
  const destBySlug = new Map(destinations.map((d) => [d.slug, d]));

  const seen = (file: string, what: string) => {
    const set = new Set<string>();
    return (key: string) => {
      if (set.has(key))
        issues.push({ file, severity: 'error', message: `duplicate ${what} "${key}"` });
      set.add(key);
    };
  };

  const dupHub = seen('hubs.csv', 'hub slug');
  for (const h of hubs) dupHub(h.slug);
  const dupDest = seen('destinations.csv', 'destination slug');
  for (const d of destinations) dupDest(d.slug);
  const dupFare = seen('fares.csv', 'fare (origin_hub, destination_slug, mode)');
  for (const f of fares) dupFare(`${f.origin_hub}|${f.destination_slug}|${f.mode}`);
  const poiKeys = new Map<string, Set<string>>();
  for (const p of pois) {
    const set = poiKeys.get(p.destination_slug) ?? new Set<string>();
    if (set.has(p.poi_key)) {
      issues.push({
        file: 'pois.csv',
        severity: 'error',
        message: `duplicate poi_key "${p.poi_key}" within "${p.destination_slug}"`,
      });
    }
    set.add(p.poi_key);
    poiKeys.set(p.destination_slug, set);
  }

  for (const f of fares) {
    if (!hubBySlug.has(f.origin_hub)) {
      issues.push({
        file: 'fares.csv',
        severity: 'error',
        message: `fare references unknown hub "${f.origin_hub}"`,
      });
    }
    if (!destBySlug.has(f.destination_slug)) {
      issues.push({
        file: 'fares.csv',
        severity: 'error',
        message: `fare references unknown destination "${f.destination_slug}"`,
      });
    }
  }
  for (const p of pois) {
    if (!destBySlug.has(p.destination_slug)) {
      issues.push({
        file: 'pois.csv',
        severity: 'error',
        message: `POI references unknown destination "${p.destination_slug}"`,
      });
    }
  }

  for (const d of destinations) {
    const { stay_budget_inr: b, stay_mid_inr: m, stay_premium_inr: p } = d;
    if (b !== undefined && m !== undefined && p !== undefined && !(b <= m && m <= p)) {
      issues.push({
        file: 'destinations.csv',
        severity: 'error',
        message: `"${d.slug}" stay tiers out of order (need budget <= mid <= premium)`,
      });
    }
  }

  for (const p of pois) {
    if ((p.open_time === undefined) !== (p.close_time === undefined)) {
      issues.push({
        file: 'pois.csv',
        severity: 'error',
        message: `"${p.destination_slug}/${p.poi_key}" sets only one of open_time and close_time`,
      });
    } else if (
      p.open_time !== undefined &&
      p.close_time !== undefined &&
      p.close_time <= p.open_time
    ) {
      issues.push({
        file: 'pois.csv',
        severity: 'error',
        message: `"${p.destination_slug}/${p.poi_key}" close_time is not after open_time`,
      });
    }
  }

  for (const f of fares) {
    if (f.mode !== 'car') continue;
    const hub = hubBySlug.get(f.origin_hub);
    const dest = destBySlug.get(f.destination_slug);
    if (!hub || !dest) continue;
    const straight = haversineKm(hub, dest);
    if (f.distance_km < straight) {
      issues.push({
        file: 'fares.csv',
        severity: 'error',
        message: `"${f.origin_hub} -> ${f.destination_slug}" car distance_km ${f.distance_km} is shorter than the straight-line distance ${Math.round(straight)} km`,
      });
    } else if (f.distance_km > 2 * straight) {
      issues.push({
        file: 'fares.csv',
        severity: 'warning',
        message: `"${f.origin_hub} -> ${f.destination_slug}" car distance_km ${f.distance_km} is more than twice the straight-line distance ${Math.round(straight)} km`,
      });
    }
  }

  const gurugram = hubBySlug.get(SCOPE_HUB);
  for (const d of destinations) {
    if (gurugram && estimateRoadKm(gurugram, d).distanceKm > SCOPE_KM) {
      issues.push({
        file: 'destinations.csv',
        severity: 'warning',
        message: `"${d.slug}" is more than ${SCOPE_KM} km from ${SCOPE_HUB} by estimateRoadKm`,
      });
    }
    const poiCount = pois.filter((p) => p.destination_slug === d.slug).length;
    if (poiCount < MIN_POIS) {
      issues.push({
        file: 'pois.csv',
        severity: 'warning',
        message: `"${d.slug}" has fewer than ${MIN_POIS} POIs (${poiCount})`,
      });
    }
    for (const hubSlug of CAR_ROW_HUBS) {
      if (
        !fares.some(
          (f) => f.origin_hub === hubSlug && f.destination_slug === d.slug && f.mode === 'car',
        )
      ) {
        issues.push({
          file: 'fares.csv',
          severity: 'warning',
          message: `"${d.slug}" has no car row from ${hubSlug}`,
        });
      }
    }
  }

  const typeCounts = new Map<string, number>();
  for (const d of destinations)
    for (const t of d.types) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  for (const type of DESTINATION_TYPES) {
    const count = typeCounts.get(type) ?? 0;
    if (count < MIN_PER_TYPE) {
      issues.push({
        file: 'destinations.csv',
        severity: 'warning',
        message: `destination type "${type}" has fewer than ${MIN_PER_TYPE} destinations (${count})`,
      });
    }
  }
  if ((typeCounts.get('beach') ?? 0) === 0) {
    issues.push({
      file: 'destinations.csv',
      severity: 'info',
      message:
        'no beach destination within range: a beach-only group gets the empty-shortlist diagnostic',
    });
  }

  return issues;
}

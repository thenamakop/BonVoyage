import { estimateRoadKm } from '@bonvoyage/engine';
import { describe, expect, it } from 'vitest';
import { estimateProvider } from './estimate';

const origin = { key: 'delhi', lat: 28.6139, lng: 77.209 };

describe('estimate routing provider', () => {
  it('answers every destination using the engine estimate without caching or quota', async () => {
    const provider = estimateProvider();
    const destinations = [
      { id: 'near', lat: 28.6149, lng: 77.209 },
      { id: 'same', lat: origin.lat, lng: origin.lng },
    ];
    const results = await provider.getDistances(origin, destinations);
    expect(provider.dailyLimit).toBeNull();
    expect(provider.cacheable).toBe(false);
    expect(results.size).toBe(2);
    for (const destination of destinations) {
      expect(results.get(destination.id)).toEqual({
        destinationId: destination.id,
        km: estimateRoadKm(origin, destination).distanceKm,
        durationMin: null,
        provenance: 'estimated',
        provider: 'estimate',
        fromCache: false,
      });
    }
    expect(results.get('near')?.km).toBe(1);
    expect(await provider.getDistances(origin, [])).toEqual(new Map());
  });
});

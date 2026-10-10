import { describe, expect, it } from 'vitest';
import { estimateRoadKm, haversineKm } from './geo';

const delhi = { lat: 28.6139, lng: 77.209 };
const mumbai = { lat: 19.076, lng: 72.8777 };

describe('haversineKm', () => {
  it('measures Delhi to Mumbai within 1 per cent of 1148 km', () => {
    expect(Math.abs(haversineKm(delhi, mumbai) - 1148) / 1148).toBeLessThan(0.01);
  });

  it('returns 0 for the same point', () => {
    expect(haversineKm(delhi, delhi)).toBe(0);
  });

  it('is symmetric', () => {
    expect(haversineKm(delhi, mumbai)).toBeCloseTo(haversineKm(mumbai, delhi), 9);
  });

  it.each([
    ['NaN latitude', { lat: Number.NaN, lng: 0 }],
    ['infinite longitude', { lat: 0, lng: Number.POSITIVE_INFINITY }],
    ['latitude above 90', { lat: 91, lng: 0 }],
    ['latitude below -90', { lat: -91, lng: 0 }],
    ['longitude above 180', { lat: 0, lng: 181 }],
    ['longitude below -180', { lat: 0, lng: -181 }],
  ])('throws RangeError for %s', (_name, point) => {
    expect(() => haversineKm(point, delhi)).toThrow(RangeError);
    expect(() => haversineKm(delhi, point)).toThrow(RangeError);
  });
});

describe('estimateRoadKm', () => {
  it('gives 1493 km, labelled estimated, for Delhi to Mumbai', () => {
    expect(estimateRoadKm(delhi, mumbai)).toEqual({ distanceKm: 1493, provenance: 'estimated' });
  });
});

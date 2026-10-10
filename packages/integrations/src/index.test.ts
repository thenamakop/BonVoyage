import { describe, expect, expectTypeOf, it } from 'vitest';
import type { CatalogueSource, DistanceResult, LlmClient, RoutingProvider } from './index';
import { IntegrationError } from './index';

describe('integration interfaces', () => {
  it('RoutingProvider returns DistanceResult values', () => {
    expectTypeOf<RoutingProvider['distance']>().returns.toEqualTypeOf<Promise<DistanceResult>>();
    expectTypeOf<RoutingProvider['matrix']>().returns.toEqualTypeOf<Promise<DistanceResult[]>>();
  });

  it('CatalogueSource resolves to a number or null', () => {
    expectTypeOf<CatalogueSource['roadDistanceKm']>().returns.toEqualTypeOf<
      Promise<number | null>
    >();
  });

  it('LlmClient exposes generateStructured', () => {
    expectTypeOf<LlmClient>().toHaveProperty('generateStructured');
  });

  it('IntegrationError carries provider and retryable', () => {
    const error = new IntegrationError('gemini', 'rate limited', true);
    expect(error).toBeInstanceOf(Error);
    expect(error.provider).toBe('gemini');
    expect(error.retryable).toBe(true);
  });
});

export interface CatalogueSource {
  roadDistanceKm(hubSlug: string, destinationSlug: string): Promise<number | null>;
}

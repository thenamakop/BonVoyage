import { z } from 'zod';

/** Where a figure came from (AGENTS.md 6.4). Its own module so api contracts can import it. */
export const Provenance = z.enum(['live', 'cached', 'curated', 'estimated']);
export type Provenance = z.infer<typeof Provenance>;

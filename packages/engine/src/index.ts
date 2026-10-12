export { ROAD_FACTOR, estimateRoadKm, haversineKm } from './geo';
export type { LatLng } from './geo';
export {
  ACTION_NAMES,
  DO_ACTIVITIES,
  ENTRY_ACTIONS,
  INTERNAL_TRANSITIONS,
  TRANSITIONS,
  TRIP_EVENTS,
  legalEvents,
  nextState,
} from './trip-state';
export type {
  ActionName,
  GuardContext,
  InternalRow,
  NextStateResult,
  TransitionRow,
  TripEvent,
} from './trip-state';

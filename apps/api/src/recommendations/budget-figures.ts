/**
 * Score ranges, and the budget figures members' limits set (D1, #116), are
 * shown only for groups at least this large: with two, each member could read
 * the other's figure off the group's.
 */
export const MIN_MEMBERS_FOR_RANGE = 3;

/** D1, #116: too few contributors for figures set by members' limits. */
export const hidesBudgetFigures = (memberCount: number) => memberCount < MIN_MEMBERS_FOR_RANGE;

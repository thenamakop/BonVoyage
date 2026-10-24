import { compareText } from '../scoring/counts';
import { windowDays } from './context';
import type {
  Diagnostic,
  DiagnosticInput,
  Evaluation,
  EvaluatedConstraintId,
  Failure,
  Suggestion,
} from './types';

// Scoring section 6: ties on near-miss counts resolve in the order F5, F1, F2, F4.
const BINDING_ORDER: EvaluatedConstraintId[] = ['F5', 'F1', 'F2', 'F4'];
// Suggestions print in constraint order for readability.
const SUGGESTION_ORDER: EvaluatedConstraintId[] = ['F1', 'F2', 'F4', 'F5'];

const isNearMiss = (evaluation: Evaluation) => evaluation.failures.length === 1;
// Callers pass near misses only; exactly one failure by construction.
const failureOf = (evaluation: Evaluation): Failure => evaluation.failures[0] as Failure;
const byFailure = (evaluation: Evaluation, id: EvaluatedConstraintId) =>
  isNearMiss(evaluation) && failureOf(evaluation).id === id;
const slugs = (list: readonly Evaluation[]) => list.map((e) => e.slug).sort(compareText);

function buildSuggestions(
  nearMisses: readonly Evaluation[],
  ctx: DiagnosticInput['ctx'],
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const id of SUGGESTION_ORDER) {
    const misses = nearMisses.filter((e) => byFailure(e, id));
    if (misses.length === 0) continue;
    const actuals = misses.map((e) => failureOf(e).actual);
    if (id === 'F1') {
      const newRadiusKm = Math.ceil(Math.min(...actuals) / 10) * 10;
      out.push({
        constraint: 'F1',
        newRadiusKm,
        unlocks: slugs(misses.filter((e) => failureOf(e).actual <= newRadiusKm)),
      });
    } else if (id === 'F2') {
      const newNights = Math.min(...actuals);
      // Clarification of section 6: drop the suggestion when the longer stay would
      // exceed the common window and break F3.
      if (newNights + 1 <= windowDays(ctx.commonWindow.start, ctx.commonWindow.end)) {
        out.push({
          constraint: 'F2',
          newNights,
          unlocks: slugs(misses.filter((e) => failureOf(e).actual <= newNights)),
        });
      }
    } else if (id === 'F4') {
      const shiftMonths = Math.min(...actuals);
      out.push({
        constraint: 'F4',
        shiftMonths,
        unlocks: slugs(misses.filter((e) => failureOf(e).actual <= shiftMonths)),
      });
    } else {
      const newGroupCapInr = Math.ceil(Math.min(...actuals) / 500) * 500;
      const suggestion: Suggestion = {
        constraint: 'F5',
        newGroupCapInr,
        capSource: ctx.capSource,
        unlocks: slugs(misses.filter((e) => failureOf(e).actual <= newGroupCapInr)),
      };
      // 0004 c: the organiser cannot raise members' maxima, so show the new per-person cap.
      if (ctx.capSource === 'members')
        suggestion.newPerPersonMaxInr = Math.ceil(newGroupCapInr / ctx.n / 500) * 500;
      out.push(suggestion);
    }
  }
  return out;
}

export function buildDiagnostic({
  evaluations,
  ctx,
  profile,
  incomplete,
}: DiagnosticInput): Diagnostic {
  const feasible = evaluations
    .filter((e) => e.feasible)
    .map((e) => e.slug)
    .sort(compareText);
  const nearMisses = evaluations.filter(isNearMiss);
  // F3: a blocking group conflict (window) means no alternatives or suggestions.
  if (profile.conflicts.some((conflict) => conflict.blocking)) {
    return {
      feasibleCount: feasible.length,
      feasible,
      nearMisses,
      alternatives: [],
      bindingConstraint: 'F3',
      suggestions: [],
      incomplete: [...incomplete],
    };
  }
  const alternatives = [...nearMisses]
    .sort((a, b) => failureOf(a).relative - failureOf(b).relative || compareText(a.slug, b.slug))
    .slice(0, 3);
  let bindingConstraint: Diagnostic['bindingConstraint'] = null;
  if (feasible.length < 3) {
    let best = 0;
    for (const id of BINDING_ORDER) {
      const count = nearMisses.filter((e) => byFailure(e, id)).length;
      if (count > best) {
        best = count;
        bindingConstraint = id;
      }
    }
  }
  return {
    feasibleCount: feasible.length,
    feasible,
    nearMisses,
    alternatives,
    bindingConstraint,
    suggestions: buildSuggestions(nearMisses, ctx),
    incomplete: [...incomplete],
  };
}

import type { CategoryRule } from '../db';

/**
 * Categorizes a description using an array of category rules.
 * 
 * Matching logic:
 * 1. Matches rules whose non-empty `search_value` is contained in `description` (case-insensitive).
 * 2. Specificity wins: longer `search_value` takes precedence.
 * 3. Priority tie-breaker: lower priority number wins if lengths are equal.
 */
export function categorizeDescription(
  description: string | undefined | null,
  rules: CategoryRule[]
): number | undefined {
  if (!description) return undefined;
  const lowerDesc = description.toLowerCase();

  const matches = rules.filter(rule => {
    const raw = rule.search_value;
    if (!raw || !raw.trim()) return false;
    return lowerDesc.includes(raw.toLowerCase());
  });

  if (matches.length === 0) return undefined;

  matches.sort((a, b) => {
    const lenDiff = b.search_value.length - a.search_value.length;
    if (lenDiff !== 0) return lenDiff;
    return (a.priority ?? 0) - (b.priority ?? 0);
  });

  return matches[0].category_id;
}

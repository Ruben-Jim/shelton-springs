export const DEFAULT_DAMAGE_CATEGORIES = ["Park", "Fence", "Signs", "Other"] as const;

export function normalizeDamageCategories(categories: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of categories) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (trimmed.length > 40) {
      throw new Error("Category names must be 40 characters or fewer");
    }
    result.push(trimmed);
  }

  if (result.length === 0) {
    throw new Error("At least one damage category is required");
  }
  if (result.length > 24) {
    throw new Error("Maximum 24 damage categories allowed");
  }

  return result;
}

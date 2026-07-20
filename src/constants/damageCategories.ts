export const DEFAULT_DAMAGE_CATEGORIES = ['Park', 'Fence', 'Signs', 'Other'] as const;

export function resolveDamageCategories(configured?: string[] | null): string[] {
  const cleaned = (configured ?? []).map((category) => category.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : [...DEFAULT_DAMAGE_CATEGORIES];
}

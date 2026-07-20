/**
 * Compare two semver-like version strings (e.g. 2.9.8).
 * Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) =>
    version
      .trim()
      .split(/[.-]/)
      .map((part) => {
        const n = parseInt(part.replace(/[^\d]/g, ''), 10);
        return Number.isFinite(n) ? n : 0;
      });

  const aParts = parse(a);
  const bParts = parse(b);
  const length = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < length; i += 1) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}

export function isVersionNewer(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}

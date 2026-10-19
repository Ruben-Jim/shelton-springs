/**
 * Household matching for annual dues. Addresses are typed free-hand at signup, so two
 * people in one house can enter "301 Elderberry St" and "301 elderberry street, Shelton WA".
 * Dues are billed once per household, so every "same house?" comparison goes through
 * householdKey(); addressLabel() is only the human-readable text stored on fee rows.
 *
 * Shared by Convex functions and the app (imported from src/ as ../../convex/householdKey).
 */

// Street-type words, dropped so "St", "Street" and a missing suffix all match.
// Only dropped after the first street word, so "100 Court St" keeps "court".
const STREET_SUFFIXES = new Set([
  "st", "street", "ln", "lane", "dr", "drive", "ct", "court", "cir", "circle",
  "rd", "road", "ave", "av", "avenue", "way", "pl", "place", "blvd", "boulevard",
  "ter", "terrace", "trl", "trail", "loop", "pkwy", "parkway", "cv", "cove",
]);

// Town and state words people add after the street when there's no comma before them
const LOCALITY_WORDS = new Set(["shelton", "springs", "wa", "washington", "usa"]);

// "Unit 2", "Apt 2", "Suite 2", "#2" typed into the address itself
const UNIT_IN_ADDRESS = /(?:^|[\s,])(?:(?:unit|apt|apartment|suite|ste)\b\.?|#)\s*#?\s*([a-z0-9-]+)/g;

const normalizeUnit = (unit: string) => unit.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Text stored on fee rows and shown to admins, e.g. "301 Elderberry St Unit 2". */
export function addressLabel(resident: { address?: string; unitNumber?: string }): string {
  return `${resident.address ?? ""}${resident.unitNumber ? ` Unit ${resident.unitNumber}` : ""}`;
}

/**
 * Key that is equal for every way of writing the same house: house number + street name
 * (+ unit). Accepts either a resident's address and unit, or a stored addressLabel().
 */
export function householdKey(address: string | undefined, unitNumber?: string): string {
  let text = (address ?? "").toLowerCase();
  let unit = normalizeUnit(unitNumber ?? "");

  for (const match of text.matchAll(UNIT_IN_ADDRESS)) {
    if (!unit) unit = normalizeUnit(match[1]);
  }
  text = text.replace(UNIT_IN_ADDRESS, " ");

  // Anything after the first comma is town/state/zip
  const tokens = text.split(",")[0].replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

  let parts = tokens;
  if (tokens.length > 0 && /^\d+[a-z]?$/.test(tokens[0])) {
    const [houseNumber, ...rest] = tokens;
    const suffixAt = rest.findIndex((token, i) => i > 0 && STREET_SUFFIXES.has(token));
    let street = suffixAt === -1 ? rest : rest.slice(0, suffixAt);
    while (
      street.length > 1 &&
      (LOCALITY_WORDS.has(street[street.length - 1]) || /^\d{5}$/.test(street[street.length - 1]))
    ) {
      street = street.slice(0, -1);
    }
    parts = [houseNumber, ...street];
  }

  const key = parts.join(" ");
  return unit ? `${key} unit ${unit}` : key;
}

/** Words worth searching on: lowercase, no punctuation, street types and town words dropped. */
export function searchTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !STREET_SUFFIXES.has(word) && !LOCALITY_WORDS.has(word));
}

/** Search-as-you-type: every word typed must start some word in the fields (names, addresses). */
export function matchesSearch(query: string, fields: string[]): boolean {
  const wanted = searchTokens(query);
  if (wanted.length === 0) return true;
  const words = searchTokens(fields.join(" "));
  return wanted.every((typed) => words.some((word) => word.startsWith(typed)));
}

/**
 * Whether a fee row belongs to this household: by its stored address, or, for older rows
 * saved without one, by whether it was billed to one of the household's homeowners.
 */
export function isHouseholdFee(
  fee: { address?: string; userId?: string },
  household: string,
  memberIds: ReadonlySet<string>
): boolean {
  if (fee.address) return householdKey(fee.address) === household;
  return !!fee.userId && memberIds.has(String(fee.userId));
}

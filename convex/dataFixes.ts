import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { addressLabel, householdKey, isHouseholdFee } from "./householdKey";

/**
 * One-off data fixes, run by hand from the CLI (internal, so clients can't call them).
 *
 *   npx convex run dataFixes:moveDocumentToCovenant '{"title":"...","category":"General"}'
 *   npx convex run dataFixes:moveDocumentToCovenant '{"title":"...","category":"General","dryRun":false}'
 */

/**
 * Moves a document filed under Documents (e.g. Meeting Minutes) into Covenants & Rules.
 * The covenant points at the same stored file and only the document row is deleted, so
 * nothing has to be re-uploaded. (Deleting the document in the app would delete the file.)
 * Covenants hold one attachment, so multi-page documents are refused rather than trimmed.
 * Dry run by default: returns what it would move without changing anything.
 */
export const moveDocumentToCovenant = internalMutation({
  args: {
    title: v.string(),
    category: v.union(
      v.literal("Architecture"),
      v.literal("Landscaping"),
      v.literal("Minutes"),
      v.literal("Caveats"),
      v.literal("General")
    ),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    documentId: v.id("documents"),
    title: v.string(),
    type: v.string(),
    uploadedBy: v.string(),
    storageId: v.string(),
    covenantId: v.optional(v.id("covenants")),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const wanted = args.title.trim().toLowerCase();
    const matches = (await ctx.db.query("documents").collect()).filter(
      (document) => document.title.trim().toLowerCase() === wanted
    );
    if (matches.length === 0) {
      throw new Error(`No document titled "${args.title}"`);
    }
    if (matches.length > 1) {
      throw new Error(
        `${matches.length} documents are titled "${args.title}" (${matches.map((d) => d._id).join(", ")}); expected one`
      );
    }
    const document = matches[0];

    // Same rule as the document viewer (documentPages.ts): more than one attachment or photo
    // page is a multi-page document; otherwise the single page is fileStorageId
    const pageCount = Math.max(document.attachments?.length ?? 0, document.imageStorageIds?.length ?? 0, 1);
    if (pageCount > 1) {
      throw new Error(
        `"${document.title}" has ${pageCount} pages; a covenant holds one attachment. Re-add it in Admin > Covenants instead.`
      );
    }
    const storageId = document.fileStorageId;

    const summary = {
      dryRun,
      documentId: document._id,
      title: document.title,
      type: document.type,
      uploadedBy: document.uploadedBy,
      storageId,
    };
    if (dryRun) return summary;

    // "M/D/YYYY" like the Admin form; the upload date stands in for "last updated"
    const uploaded = new Date(document.createdAt);
    const lastUpdated = `${uploaded.getUTCMonth() + 1}/${uploaded.getUTCDate()}/${uploaded.getUTCFullYear()}`;
    const now = Date.now();

    const covenantId = await ctx.db.insert("covenants", {
      title: document.title,
      description: document.description?.trim() || document.title,
      category: args.category,
      lastUpdated,
      fileStorageId: storageId,
      createdAt: now,
      updatedAt: now,
    });
    // Row only: the covenant now owns the stored file
    await ctx.db.delete(document._id);

    return { ...summary, covenantId };
  },
});

const paymentSummary = v.object({
  paymentId: v.id("payments"),
  amount: v.number(),
  method: v.string(),
  status: v.string(),
  verification: v.string(),
  paymentDate: v.string(),
  paidBy: v.string(),
});

/** Small edit distance, for spotting "348 Elderbery" next to "348 Elderberry". */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

/**
 * Read-only report for the household dues fix. Lists every household whose residents typed
 * the address differently (they used to show as separate accounts) or that has more than one
 * annual dues row for a year, with all of its fees, fines and payments, so duplicates can be
 * reviewed before anything is changed. Also lists likely typos the matching can't merge.
 *
 *   npx convex run dataFixes:householdDuesReport
 */
export const householdDuesReport = internalQuery({
  args: {},
  returns: v.object({
    homeowners: v.number(),
    householdsBefore: v.number(),
    householdsAfter: v.number(),
    households: v.array(
      v.object({
        household: v.string(),
        spellings: v.array(v.string()),
        residents: v.array(v.object({ residentId: v.id("residents"), name: v.string(), address: v.string() })),
        notes: v.array(v.string()),
        fees: v.array(
          v.object({
            feeId: v.id("fees"),
            name: v.string(),
            frequency: v.string(),
            year: v.optional(v.number()),
            amount: v.number(),
            status: v.string(),
            storedAddress: v.optional(v.string()),
            billedTo: v.string(),
            payments: v.array(paymentSummary),
          })
        ),
        fines: v.array(
          v.object({
            fineId: v.id("fines"),
            violation: v.string(),
            amount: v.number(),
            status: v.string(),
            payments: v.array(paymentSummary),
          })
        ),
        unlinkedPayments: v.array(paymentSummary),
      })
    ),
    possibleTypos: v.array(
      v.object({
        houseNumber: v.string(),
        households: v.array(v.object({ household: v.string(), spellings: v.array(v.string()) })),
      })
    ),
  }),
  handler: async (ctx) => {
    const residents = await ctx.db.query("residents").collect();
    const homeowners = residents.filter((resident) => resident.isResident && !resident.isRenter);
    const fees = await ctx.db.query("fees").collect();
    const fines = await ctx.db.query("fines").collect();
    const payments = await ctx.db.query("payments").collect();

    const nameOf = new Map(residents.map((r) => [String(r._id), `${r.firstName} ${r.lastName}`]));
    const existingFeeIds = new Set(fees.map((fee) => String(fee._id)));
    const existingFineIds = new Set(fines.map((fine) => String(fine._id)));
    const summarize = (payment: Doc<"payments">) => ({
      paymentId: payment._id,
      amount: payment.amount,
      method: payment.paymentMethod,
      status: payment.status,
      verification: payment.verificationStatus ?? "none",
      paymentDate: payment.paymentDate,
      paidBy: nameOf.get(payment.userId) ?? payment.userId,
    });
    const money = (amount: number) => `$${amount.toFixed(2)}`;

    const households = new Map<string, Doc<"residents">[]>();
    for (const homeowner of homeowners) {
      const key = householdKey(homeowner.address, homeowner.unitNumber);
      households.set(key, [...(households.get(key) ?? []), homeowner]);
    }

    const report = [];
    for (const [household, members] of households) {
      const spellings = [...new Set(members.map((member) => addressLabel(member)))];
      const memberIds = new Set(members.map((member) => String(member._id)));

      const householdFees = fees.filter((fee) => isHouseholdFee(fee, household, memberIds));
      const annualByYear = new Map<number, Doc<"fees">[]>();
      for (const fee of householdFees.filter((f) => f.frequency === "Annually")) {
        const year = fee.year ?? new Date(fee.dueDate).getFullYear();
        annualByYear.set(year, [...(annualByYear.get(year) ?? []), fee]);
      }
      const duplicateYears = [...annualByYear].filter(([, rows]) => rows.length > 1);
      if (spellings.length < 2 && duplicateYears.length === 0) continue;

      const householdFines = fines.filter((fine) => !!fine.residentId && memberIds.has(fine.residentId));
      const feeIds = new Set(householdFees.map((fee) => String(fee._id)));
      const fineIds = new Set(householdFines.map((fine) => String(fine._id)));
      const householdPayments = payments.filter(
        (payment) =>
          memberIds.has(payment.userId) ||
          (!!payment.feeId && feeIds.has(String(payment.feeId))) ||
          (!!payment.fineId && fineIds.has(String(payment.fineId)))
      );
      // Not attached to any fee or fine that still exists (e.g. its fee row was deleted)
      const unlinkedPayments = householdPayments.filter(
        (payment) =>
          !(payment.feeId && existingFeeIds.has(String(payment.feeId))) &&
          !(payment.fineId && existingFineIds.has(String(payment.fineId)))
      );

      const notes: string[] = [];
      if (spellings.length > 1) {
        notes.push(`Residents typed ${spellings.length} spellings; now matched as one household`);
      }
      for (const [year, rows] of duplicateYears) {
        const total = rows.reduce((sum, fee) => sum + fee.amount, 0);
        notes.push(
          `${year}: ${rows.length} annual dues rows totaling ${money(total)} (${rows
            .map((fee) => `${money(fee.amount)} ${fee.status ?? "Pending"}`)
            .join(", ")})`
        );
      }
      if (unlinkedPayments.length > 0) {
        notes.push(`${unlinkedPayments.length} payment(s) not linked to any current fee or fine`);
      }

      report.push({
        household,
        spellings,
        residents: members.map((member) => ({
          residentId: member._id,
          name: `${member.firstName} ${member.lastName}`,
          address: addressLabel(member),
        })),
        notes,
        fees: householdFees.map((fee) => ({
          feeId: fee._id,
          name: fee.name,
          frequency: fee.frequency,
          year: fee.year,
          amount: fee.amount,
          status: fee.status ?? "Pending",
          storedAddress: fee.address,
          billedTo: fee.userId ? (nameOf.get(String(fee.userId)) ?? String(fee.userId)) : "nobody",
          payments: householdPayments.filter((p) => p.feeId === fee._id).map(summarize),
        })),
        fines: householdFines.map((fine) => ({
          fineId: fine._id,
          violation: fine.violation,
          amount: fine.amount,
          status: fine.status,
          payments: householdPayments.filter((p) => p.fineId === fine._id).map(summarize),
        })),
        unlinkedPayments: unlinkedPayments.map(summarize),
      });
    }

    // Same house number, street names a typo apart: matching can't merge these, an address edit can
    const keysByNumber = new Map<string, string[]>();
    for (const key of households.keys()) {
      const [houseNumber] = key.split(" ");
      if (/^\d/.test(houseNumber)) keysByNumber.set(houseNumber, [...(keysByNumber.get(houseNumber) ?? []), key]);
    }
    const possibleTypos = [];
    for (const [houseNumber, keys] of keysByNumber) {
      const street = (key: string) => key.split(" unit ")[0].slice(houseNumber.length + 1);
      const close = keys.filter((key) =>
        keys.some((other) => other !== key && editDistance(street(key), street(other)) <= 2)
      );
      if (close.length > 1) {
        possibleTypos.push({
          houseNumber,
          households: close.map((key) => ({
            household: key,
            spellings: [...new Set(households.get(key)!.map((member) => addressLabel(member)))],
          })),
        });
      }
    }

    return {
      homeowners: homeowners.length,
      householdsBefore: new Set(homeowners.map((homeowner) => addressLabel(homeowner))).size,
      householdsAfter: households.size,
      households: report,
      possibleTypos,
    };
  },
});

/**
 * Puts back the $0 dues rows a one-off cleanup deleted on 2026-10-19 (duplicates the treasurer
 * had zeroed out), so the board can see them and delete them in the app if they choose. The
 * rows come in as arguments, which keeps residents' ids and addresses out of the repo. A row
 * whose original billed resident wasn't recorded goes to the household's first homeowner; the
 * house's record looks the same either way. Only $0 rows, no notifications, no payments touched,
 * and a row that's already back is skipped. Dry run by default.
 *
 *   npx convex run dataFixes:restoreDuesRows "$(cat rows.json)"
 */
export const restoreDuesRows = internalMutation({
  args: {
    rows: v.array(
      v.object({
        household: v.string(),
        name: v.string(),
        year: v.number(),
        amount: v.number(),
        status: v.union(v.literal("Pending"), v.literal("Partial"), v.literal("Paid"), v.literal("Overdue")),
        // Who it was billed to and the address saved on it, when known
        billedTo: v.optional(v.id("residents")),
        address: v.optional(v.string()),
        // Older bulk-created rows had no address saved
        withoutAddress: v.optional(v.boolean()),
      })
    ),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    restored: v.array(
      v.object({
        household: v.string(),
        name: v.string(),
        status: v.string(),
        billedTo: v.string(),
        billedToWasRecorded: v.boolean(),
        address: v.optional(v.string()),
        feeId: v.optional(v.id("fees")),
      })
    ),
    skipped: v.array(v.object({ household: v.string(), name: v.string(), reason: v.string() })),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const residents = await ctx.db.query("residents").collect();
    const fees = await ctx.db.query("fees").collect();
    const homeowners = residents.filter((resident) => resident.isResident && !resident.isRenter);

    const restored = [];
    const skipped: { household: string; name: string; reason: string }[] = [];
    for (const row of args.rows) {
      const skip = (reason: string) => skipped.push({ household: row.household, name: row.name, reason });
      if (row.amount !== 0) {
        skip("only $0 rows are restored with this");
        continue;
      }
      const members = homeowners.filter(
        (resident) => householdKey(resident.address, resident.unitNumber) === row.household
      );
      const memberIds = new Set(members.map((member) => String(member._id)));
      const billed = row.billedTo ? residents.find((r) => r._id === row.billedTo) : members[0];
      if (!billed) {
        skip(row.billedTo ? "billed resident no longer exists" : "no homeowner lives at this household");
        continue;
      }
      if (!memberIds.has(String(billed._id))) {
        skip("billed resident no longer lives at this household");
        continue;
      }

      // Already back: an empty $0 row with this name and year in the household
      let alreadyBack = false;
      for (const fee of fees) {
        if (fee.name !== row.name || fee.year !== row.year || fee.amount > 0.01) continue;
        if (!isHouseholdFee(fee, row.household, memberIds)) continue;
        const payment = await ctx.db
          .query("payments")
          .withIndex("by_fee", (q) => q.eq("feeId", fee._id))
          .first();
        if (!payment) alreadyBack = true;
      }
      if (alreadyBack) {
        skip("already restored");
        continue;
      }

      const address = row.withoutAddress ? undefined : (row.address ?? addressLabel(billed));
      const yearSuffix = ` ${row.year}`;
      const description = row.name.endsWith(yearSuffix) ? row.name.slice(0, -yearSuffix.length) : row.name;
      let feeId;
      if (!dryRun) {
        const now = Date.now();
        feeId = await ctx.db.insert("fees", {
          name: row.name,
          amount: row.amount,
          frequency: "Annually",
          dueDate: `${row.year}-12-31`,
          description,
          isLate: false,
          userId: String(billed._id),
          ...(address ? { address } : {}),
          year: row.year,
          status: row.status,
          createdAt: now,
          updatedAt: now,
        });
      }
      restored.push({
        household: row.household,
        name: row.name,
        status: row.status,
        billedTo: `${billed.firstName} ${billed.lastName}`,
        billedToWasRecorded: !!row.billedTo,
        address,
        feeId,
      });
    }

    return { dryRun, restored, skipped };
  },
});

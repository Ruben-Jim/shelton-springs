import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

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

import { query, mutation, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * Adds the attachment's content type so clients can tell a photo from a PDF (covenants only
 * store fileStorageId). Extra field; older clients ignore it.
 */
async function withFileContentType(ctx: QueryCtx, covenants: Doc<"covenants">[]) {
  return Promise.all(
    covenants.map(async (covenant) => {
      const fileId = covenant.fileStorageId
        ? ctx.db.system.normalizeId("_storage", covenant.fileStorageId)
        : null;
      const file = fileId ? await ctx.db.system.get(fileId) : null;
      return { ...covenant, fileContentType: file?.contentType ?? null };
    })
  );
}

/**
 * Display order: covenants the admin hasn't positioned yet (new ones) come first, newest
 * first, then the admin's arrangement by sortOrder. With no sortOrder set anywhere this is
 * the original newest-first order.
 */
async function getOrderedCovenants(ctx: QueryCtx) {
  const covenants = await ctx.db.query("covenants").order("desc").collect();
  const unordered = covenants.filter((covenant) => covenant.sortOrder === undefined);
  const ordered = covenants
    .filter((covenant) => covenant.sortOrder !== undefined)
    .sort((a, b) => a.sortOrder! - b.sortOrder!);
  return [...unordered, ...ordered];
}

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await getOrderedCovenants(ctx);
  },
});

// Get paginated covenants
export const getPaginated = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;
    
    // Get total count
    const allCovenants = await getOrderedCovenants(ctx);
    const total = allCovenants.length;
    
    // Get paginated covenants
    const covenants = allCovenants.slice(offset, offset + limit);
    
    return {
      items: await withFileContentType(ctx, covenants),
      total,
    };
  },
});

export const getByCategory = query({
  args: { category: v.union(
    v.literal("Architecture"),
    v.literal("Landscaping"),
    v.literal("Minutes"),
    v.literal("Caveats"),
    v.literal("General")
  ) },
  handler: async (ctx, args) => {
    const covenants = await ctx.db
      .query("covenants")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
    return covenants;
  },
});

export const getById = query({
  args: { id: v.id("covenants") },
  handler: async (ctx, args) => {
    const covenant = await ctx.db.get(args.id);
    return covenant;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("Architecture"),
      v.literal("Landscaping"),
      v.literal("Minutes"),
      v.literal("Caveats"),
      v.literal("General")
    ),
    lastUpdated: v.string(),
    pdfUrl: v.optional(v.string()),
    fileStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const covenantId = await ctx.db.insert("covenants", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return covenantId;
  },
});

export const update = mutation({
  args: {
    id: v.id("covenants"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal("Architecture"),
      v.literal("Landscaping"),
      v.literal("Minutes"),
      v.literal("Caveats"),
      v.literal("General")
    )),
    lastUpdated: v.optional(v.string()),
    pdfUrl: v.optional(v.union(v.string(), v.null())),
    fileStorageId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Covenant not found");
    }
    const now = Date.now();

    const nextFileStorageId =
      updates.fileStorageId === undefined
        ? existing.fileStorageId
        : updates.fileStorageId === null
          ? undefined
          : updates.fileStorageId;

    const nextPdfUrl =
      updates.pdfUrl === undefined
        ? existing.pdfUrl
        : updates.pdfUrl === null
          ? undefined
          : updates.pdfUrl;

    await ctx.db.replace(id, {
      title: updates.title ?? existing.title,
      description: updates.description ?? existing.description,
      category: updates.category ?? existing.category,
      lastUpdated: updates.lastUpdated ?? existing.lastUpdated,
      pdfUrl: nextPdfUrl,
      fileStorageId: nextFileStorageId,
      sortOrder: existing.sortOrder,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
  },
});

// Move a covenant one place up or down in the display order (admin arrows)
export const move = mutation({
  args: {
    id: v.id("covenants"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const covenants = await getOrderedCovenants(ctx);
    const index = covenants.findIndex((covenant) => covenant._id === args.id);
    if (index === -1) {
      throw new Error("Covenant not found");
    }
    const target = args.direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= covenants.length) return null;

    [covenants[index], covenants[target]] = [covenants[target], covenants[index]];

    // Number the whole list so every covenant has a fixed position from now on
    await Promise.all(
      covenants.map((covenant, position) =>
        covenant.sortOrder === position
          ? null
          : ctx.db.patch(covenant._id, { sortOrder: position })
      )
    );
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("covenants") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
}); 
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const covenants = await ctx.db
      .query("covenants")
      .order("desc")
      .collect();
    return covenants;
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
    const allCovenants = await ctx.db
      .query("covenants")
      .order("desc")
      .collect();
    const total = allCovenants.length;
    
    // Get paginated covenants
    const covenants = allCovenants.slice(offset, offset + limit);
    
    return {
      items: covenants,
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
      createdAt: existing.createdAt,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("covenants") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
}); 
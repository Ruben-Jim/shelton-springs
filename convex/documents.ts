import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db
      .query("documents")
      .order("desc")
      .collect();
    return documents;
  },
});

// Get paginated documents
export const getPaginated = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;
    
    // Get total count
    const allDocuments = await ctx.db
      .query("documents")
      .order("desc")
      .collect();
    const total = allDocuments.length;
    
    // Get paginated documents
    const documents = allDocuments.slice(offset, offset + limit);
    
    return {
      items: documents,
      total,
    };
  },
});

export const getByType = query({
  args: { type: v.union(v.literal("Minutes"), v.literal("Financial")) },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .order("desc")
      .collect();
    return documents;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    type: v.union(v.literal("Minutes"), v.literal("Financial")),
    fileStorageId: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      description: args.description,
      type: args.type,
      fileStorageId: args.fileStorageId,
      uploadedBy: args.uploadedBy,
      createdAt: now,
      updatedAt: now,
    });
    return documentId;
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    // Get the document to retrieve file storage ID before deletion
    const document = await ctx.db.get(args.id);
    
    // Delete the storage file associated with the document
    if (document?.fileStorageId) {
      try {
        await ctx.storage.delete(document.fileStorageId as any);
      } catch (error) {
        // Log but don't fail if storage deletion fails (file may not exist)
        console.log(`Failed to delete storage file ${document.fileStorageId}:`, error);
      }
    }
    
    // Delete the document record
    await ctx.db.delete(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.union(v.literal("Minutes"), v.literal("Financial"))),
    fileStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
    });
  },
});


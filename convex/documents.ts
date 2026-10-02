import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const MAX_DOCUMENT_PAGES = 10;

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
    // Ordered photo pages; fileStorageId should be the first page so older clients still show page 1
    imageStorageIds: v.optional(v.array(v.string())),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.imageStorageIds && args.imageStorageIds.length > MAX_DOCUMENT_PAGES) {
      throw new Error(`A document can have at most ${MAX_DOCUMENT_PAGES} photos.`);
    }
    const now = Date.now();
    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      description: args.description,
      type: args.type,
      fileStorageId: args.fileStorageId,
      imageStorageIds: args.imageStorageIds?.length ? args.imageStorageIds : undefined,
      uploadedBy: args.uploadedBy,
      createdAt: now,
      updatedAt: now,
    });

    // Notify all residents of new document (triggers push notifications)
    const docTypeLabel = args.type === "Minutes" ? "Minutes" : "Financial";
    await ctx.runMutation(api.notifications.createNotificationForAllResidents, {
      type: "document",
      title: `New ${docTypeLabel} Document`,
      body: `${args.uploadedBy} uploaded: ${args.title}`,
      data: {
        documentId,
        title: args.title,
        type: args.type,
        uploadedBy: args.uploadedBy,
      },
    });

    return documentId;
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    // Get the document to retrieve file storage ID before deletion
    const document = await ctx.db.get(args.id);
    
    // Delete every storage file associated with the document (main file + photo pages)
    const storageIds = new Set<string>(
      [document?.fileStorageId, ...(document?.imageStorageIds ?? [])].filter(
        (id): id is string => !!id
      )
    );
    for (const storageId of storageIds) {
      try {
        await ctx.storage.delete(storageId as any);
      } catch (error) {
        // Log but don't fail if storage deletion fails (file may not exist)
        console.log(`Failed to delete storage file ${storageId}:`, error);
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


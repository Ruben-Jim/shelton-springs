import { query, mutation, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { api } from "./_generated/api";

const MAX_DOCUMENT_PAGES = 10;

const attachmentValidator = v.object({
  storageId: v.string(),
  kind: v.union(v.literal("image"), v.literal("file")),
  name: v.optional(v.string()),
  mimeType: v.optional(v.string()),
});

/**
 * Adds the stored file's content type so clients can tell a single photo from a PDF/Word file
 * (single-file documents only store fileStorageId). Extra field; older clients ignore it.
 */
async function withFileContentType(ctx: QueryCtx, documents: Doc<"documents">[]) {
  return Promise.all(
    documents.map(async (document) => {
      const fileId = ctx.db.system.normalizeId("_storage", document.fileStorageId);
      const file = fileId ? await ctx.db.system.get(fileId) : null;
      return { ...document, fileContentType: file?.contentType ?? null };
    })
  );
}

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db
      .query("documents")
      .order("desc")
      .collect();
    return withFileContentType(ctx, documents);
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
      items: await withFileContentType(ctx, documents),
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
    return withFileContentType(ctx, documents);
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
    // Ordered pages mixing photos and files; fileStorageId should match the first one
    attachments: v.optional(v.array(attachmentValidator)),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.imageStorageIds && args.imageStorageIds.length > MAX_DOCUMENT_PAGES) {
      throw new Error(`A document can have at most ${MAX_DOCUMENT_PAGES} photos.`);
    }
    if (args.attachments && args.attachments.length > MAX_DOCUMENT_PAGES) {
      throw new Error(`A document can have at most ${MAX_DOCUMENT_PAGES} files or photos.`);
    }
    const now = Date.now();
    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      description: args.description,
      type: args.type,
      fileStorageId: args.fileStorageId,
      imageStorageIds: args.imageStorageIds?.length ? args.imageStorageIds : undefined,
      attachments: args.attachments && args.attachments.length > 1 ? args.attachments : undefined,
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
    
    // Delete every storage file associated with the document (main file + photo/file pages)
    const storageIds = new Set<string>(
      [
        document?.fileStorageId,
        ...(document?.imageStorageIds ?? []),
        ...(document?.attachments ?? []).map((a) => a.storageId),
      ].filter(
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


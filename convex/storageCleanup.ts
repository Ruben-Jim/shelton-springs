import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Manual storage cleanup utility
 * 
 * Note: Convex doesn't provide an API to list all storage files,
 * so automatic orphaned file detection isn't possible. This utility
 * provides functions to manually clean up storage files when needed.
 * 
 * Storage cleanup is automatically handled in deletion mutations:
 * - communityPosts.remove() - deletes post images
 * - documents.remove() - deletes document files
 * - pets.remove() - deletes pet images
 * - residentNotifications.remove() - deletes house images
 */

/**
 * Delete a specific storage file by ID
 * Can be used manually if you know a storage ID is orphaned
 */
export const deleteStorageFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    try {
      await ctx.storage.delete(args.storageId);
      return { success: true, storageId: args.storageId };
    } catch (error: any) {
      console.error(`Failed to delete storage file ${args.storageId}:`, error);
      // Don't throw - file may not exist
      return { success: false, storageId: args.storageId, error: error.message };
    }
  },
});

/**
 * Delete multiple storage files by ID
 * Useful for bulk cleanup when you have a list of known orphaned files
 */
export const deleteMultipleStorageFiles = mutation({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const results = [];
    for (const storageId of args.storageIds) {
      try {
        await ctx.storage.delete(storageId);
        results.push({ storageId, success: true });
      } catch (error: any) {
        console.error(`Failed to delete storage file ${storageId}:`, error);
        results.push({ storageId, success: false, error: error.message });
      }
    }
    return {
      total: args.storageIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  },
});

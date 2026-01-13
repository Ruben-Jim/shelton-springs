import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Optional archiving system for old content
 * 
 * This provides manual archiving functionality to help manage storage.
 * Archives posts older than a specified date by deleting their images
 * and optionally removing the posts entirely.
 * 
 * Note: This is an optional feature. To use it, call the archiveOldPosts
 * mutation manually from the Convex dashboard or admin interface.
 */

/**
 * Archive old posts by deleting their images
 * This reduces storage usage while keeping the post content
 * 
 * @param olderThanDays - Archive posts older than this many days (default: 365)
 * @param deletePost - If true, delete the post entirely. If false, just delete images (default: false)
 */
export const archiveOldPosts = mutation({
  args: {
    olderThanDays: v.optional(v.number()),
    deletePost: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const olderThanDays = args.olderThanDays ?? 365; // Default: 1 year
    const deletePost = args.deletePost ?? false;
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    // Get all posts older than the cutoff
    const allPosts = await ctx.db
      .query("communityPosts")
      .collect();
    
    const oldPosts = allPosts.filter(post => post.createdAt < cutoffTime);
    
    let deletedImagesCount = 0;
    let deletedPostsCount = 0;
    
    for (const post of oldPosts) {
      // Delete storage files associated with the post (images)
      if (post.images && Array.isArray(post.images)) {
        for (const imageStorageId of post.images) {
          try {
            await ctx.storage.delete(imageStorageId as any);
            deletedImagesCount++;
          } catch (error) {
            console.log(`Failed to delete storage file ${imageStorageId}:`, error);
          }
        }
      }
      
      // Optionally delete the post entirely
      if (deletePost) {
        // Delete all comments for this post first
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_post", (q) => q.eq("postId", post._id))
          .collect();
        
        for (const comment of comments) {
          await ctx.db.delete(comment._id);
        }
        
        // Delete the post
        await ctx.db.delete(post._id);
        deletedPostsCount++;
      } else {
        // Just remove images from the post but keep the post
        await ctx.db.patch(post._id, {
          images: undefined,
          updatedAt: Date.now(),
        });
      }
    }
    
    return {
      postsProcessed: oldPosts.length,
      deletedImagesCount,
      deletedPostsCount,
      message: deletePost
        ? `Archived ${oldPosts.length} posts (${deletedPostsCount} deleted, ${deletedImagesCount} images removed)`
        : `Archived ${oldPosts.length} posts (${deletedImagesCount} images removed, posts kept)`,
    };
  },
});

/**
 * Get statistics about old posts that could be archived
 */
export const getArchiveStats = query({
  args: {
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const olderThanDays = args.olderThanDays ?? 365;
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    const allPosts = await ctx.db
      .query("communityPosts")
      .collect();
    
    const oldPosts = allPosts.filter(post => post.createdAt < cutoffTime);
    const postsWithImages = oldPosts.filter(post => post.images && post.images.length > 0);
    const totalImages = postsWithImages.reduce((sum, post) => sum + (post.images?.length || 0), 0);
    
    return {
      totalPosts: allPosts.length,
      oldPostsCount: oldPosts.length,
      postsWithImagesCount: postsWithImages.length,
      totalImagesCount: totalImages,
      olderThanDays,
      cutoffDate: new Date(cutoffTime).toISOString(),
    };
  },
});

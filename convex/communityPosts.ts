import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper function to batch resolve storage URLs
async function resolveStorageUrls(ctx: any, storageIds: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const uniqueIds = Array.from(new Set(storageIds.filter(Boolean)));

  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const url = await ctx.storage.getUrl(id);
        if (url) urls.set(id, url);
      } catch (error) {
        console.log(`Failed to resolve URL for storage ID ${id}:`, error);
      }
    })
  );

  return urls;
}

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("communityPosts")
      .order("desc")
      .collect();

    // Get all active residents once for profile image lookup
    const residents = await ctx.db
      .query("residents")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Create a map for quick lookup by full name
    const residentsByName = new Map();
    residents.forEach(resident => {
      const fullName = `${resident.firstName} ${resident.lastName}`;
      residentsByName.set(fullName, resident);
    });

    // Batch fetch all comments for all posts at once
    const postIds = posts.map(post => post._id);
    const allComments = await ctx.db
          .query("comments")
          .collect();

    // Group comments by postId
    const commentsByPostId = new Map();
    allComments.forEach(comment => {
      if (postIds.includes(comment.postId)) {
        if (!commentsByPostId.has(comment.postId)) {
          commentsByPostId.set(comment.postId, []);
        }
        commentsByPostId.get(comment.postId).push(comment);
      }
    });

    // Sort comments within each post and add profile images
    const postsWithComments = await Promise.all(posts.map(async (post) => {
      const comments = (commentsByPostId.get(post._id) || [])
        .sort((a: any, b: any) => a.createdAt - b.createdAt); // Order ascending

        // Get author profile image for each comment
      const commentsWithProfileImages = await Promise.all(comments.map(async (comment: any) => {
          const authorResident = residentsByName.get(comment.author);
          return {
            ...comment,
            authorProfileImageUrl: authorResident?.profileImage
              ? await ctx.storage.getUrl(authorResident.profileImage)
              : null
          };
        }));

        // Get author profile image for the post
        const authorResident = residentsByName.get(post.author);

        return {
          ...post,
          comments: commentsWithProfileImages,
          authorProfileImageUrl: authorResident?.profileImage
            ? await ctx.storage.getUrl(authorResident.profileImage)
            : null
        };
    }));

    return postsWithComments;
  },
});

// Get paginated posts (without comments for lazy loading)
export const getPaginated = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;
    
    // Get total count
    const allPosts = await ctx.db
      .query("communityPosts")
      .collect();
    const total = allPosts.length;
    
    // Get paginated posts
    const posts = await ctx.db
      .query("communityPosts")
      .order("desc")
      .collect();
    
    const paginatedPosts = posts.slice(offset, offset + limit);
    
    // Get all active residents once for profile image lookup
    const residents = await ctx.db
      .query("residents")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Create a map for quick lookup by full name
    const residentsByName = new Map();
    residents.forEach(resident => {
      const fullName = `${resident.firstName} ${resident.lastName}`;
      residentsByName.set(fullName, resident);
    });
    
    // Get author profile image for each post (no comments loaded)
    const postsWithProfileImages = await Promise.all(paginatedPosts.map(async (post) => {
      const authorResident = residentsByName.get(post.author);
      return {
        ...post,
        comments: [], // Empty comments array for lazy loading
        authorProfileImageUrl: authorResident?.profileImage
          ? await ctx.storage.getUrl(authorResident.profileImage)
          : null
      };
    }));
    
    return {
      items: postsWithProfileImages,
      total,
    };
  },
});

export const getByCategory = query({
  args: { category: v.union(
    v.literal("General"),
    v.literal("Event"),
    v.literal("Complaint"),
    v.literal("Suggestion"),
    v.literal("Lost & Found")
  ) },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("communityPosts")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .order("desc")
      .collect();

    // Get all active residents once for profile image lookup
    const residents = await ctx.db
      .query("residents")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Create a map for quick lookup by full name
    const residentsByName = new Map();
    residents.forEach(resident => {
      const fullName = `${resident.firstName} ${resident.lastName}`;
      residentsByName.set(fullName, resident);
    });

    // Batch fetch all comments for all posts at once
    const postIds = posts.map(post => post._id);
    const allComments = await ctx.db
          .query("comments")
          .collect();

    // Group comments by postId
    const commentsByPostId = new Map();
    allComments.forEach(comment => {
      if (postIds.includes(comment.postId)) {
        if (!commentsByPostId.has(comment.postId)) {
          commentsByPostId.set(comment.postId, []);
        }
        commentsByPostId.get(comment.postId).push(comment);
      }
    });

    // Sort comments within each post and add profile images
    const postsWithComments = await Promise.all(posts.map(async (post) => {
      const comments = (commentsByPostId.get(post._id) || [])
        .sort((a: any, b: any) => a.createdAt - b.createdAt); // Order ascending

        // Get author profile image for each comment
      const commentsWithProfileImages = await Promise.all(comments.map(async (comment: any) => {
          const authorResident = residentsByName.get(comment.author);
          return {
            ...comment,
            authorProfileImageUrl: authorResident?.profileImage
              ? await ctx.storage.getUrl(authorResident.profileImage)
              : null
          };
        }));

        // Get author profile image for the post
        const authorResident = residentsByName.get(post.author);

        return {
          ...post,
          comments: commentsWithProfileImages,
          authorProfileImageUrl: authorResident?.profileImage
            ? await ctx.storage.getUrl(authorResident.profileImage)
            : null
        };
    }));

    return postsWithComments;
  },
});

export const getById = query({
  args: { id: v.id("communityPosts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) return null;
    
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", args.id))
      .order("asc")
      .collect();
    
    return { ...post, comments };
  },
});

export const create = mutation({
  args: {
    author: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("General"),
      v.literal("Event"),
      v.literal("Complaint"),
      v.literal("Suggestion"),
      v.literal("Lost & Found")
    ),
    images: v.optional(v.array(v.string())),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const postId = await ctx.db.insert("communityPosts", {
      ...args,
      likes: 0,
      createdAt: now,
      updatedAt: now,
    });
    return postId;
  },
});

export const update = mutation({
  args: {
    id: v.id("communityPosts"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal("General"),
      v.literal("Event"),
      v.literal("Complaint"),
      v.literal("Suggestion"),
      v.literal("Lost & Found")
    )),
    images: v.optional(v.array(v.string())),
    link: v.optional(v.string()),
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

export const remove = mutation({
  args: { id: v.id("communityPosts") },
  handler: async (ctx, args) => {
    // Get the post to retrieve image storage IDs before deletion
    const post = await ctx.db.get(args.id);
    
    // Delete all comments for this post first
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", args.id))
      .collect();
    
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }
    
    // Delete storage files associated with the post (images)
    if (post?.images && Array.isArray(post.images)) {
      for (const imageStorageId of post.images) {
        try {
          await ctx.storage.delete(imageStorageId as any);
        } catch (error) {
          // Log but don't fail if storage deletion fails (file may not exist)
          console.log(`Failed to delete storage file ${imageStorageId}:`, error);
        }
      }
    }
    
    // Delete the post
    await ctx.db.delete(args.id);
  },
});

export const like = mutation({
  args: { id: v.id("communityPosts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) throw new Error("Post not found");
    
    await ctx.db.patch(args.id, {
      likes: post.likes + 1,
      updatedAt: Date.now(),
    });
  },
});

// Comments functions
export const addComment = mutation({
  args: {
    postId: v.id("communityPosts"),
    author: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const commentId = await ctx.db.insert("comments", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return commentId;
  },
});

export const removeComment = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Get comments for a specific post (for lazy loading)
export const getCommentsByPost = query({
  args: { postId: v.id("communityPosts") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .order("asc")
      .collect();
    
    // Get all active residents once for profile image lookup
    const residents = await ctx.db
      .query("residents")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Create a map for quick lookup by full name
    const residentsByName = new Map();
    residents.forEach(resident => {
      const fullName = `${resident.firstName} ${resident.lastName}`;
      residentsByName.set(fullName, resident);
    });
    
    // Get author profile image for each comment
    const commentsWithProfileImages = await Promise.all(comments.map(async comment => {
      const authorResident = residentsByName.get(comment.author);
      return {
        ...comment,
        authorProfileImageUrl: authorResident?.profileImage
          ? await ctx.storage.getUrl(authorResident.profileImage)
          : null
      };
    }));
    
    return commentsWithProfileImages;
  },
});

// Get all comments for admin management
export const getAllComments = query({
  args: {},
  handler: async (ctx) => {
    const comments = await ctx.db
      .query("comments")
      .order("desc")
      .collect();
    
    // Get all active residents for profile image lookup
    const residents = await ctx.db
      .query("residents")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Create a map for quick lookup by full name
    const residentsByName = new Map();
    residents.forEach(resident => {
      const fullName = `${resident.firstName} ${resident.lastName}`;
      residentsByName.set(fullName, resident);
    });
    
    // Get post information and author profile image for each comment
    const commentsWithPosts = await Promise.all(
      comments.map(async (comment) => {
        const post = await ctx.db.get(comment.postId);
        const authorResident = residentsByName.get(comment.author);
        
        return { 
          ...comment, 
          postTitle: post?.title || 'Deleted Post',
          authorProfileImageUrl: authorResident?.profileImage
            ? await ctx.storage.getUrl(authorResident.profileImage)
            : null
        };
      })
    );
    
    return commentsWithPosts;
  },
}); 
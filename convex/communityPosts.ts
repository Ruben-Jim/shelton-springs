import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const GENERIC_DECLINE_MESSAGE = "Your comment was not approved by the board.";

const DECLINE_MESSAGES: Record<string, string> = {
  inappropriate:
    "Your comment was declined because it contained inappropriate or offensive language.",
  off_topic:
    "Your comment was declined because it was off-topic or not community-related.",
  spam: "Your comment was declined because it appeared to be spam or advertising.",
  personal_attack:
    "Your comment was declined because it involved a personal attack or conflict.",
  guidelines:
    "Your comment was declined because it violates community guidelines.",
  no_reason: GENERIC_DECLINE_MESSAGE,
};

function normalizeFullName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function getCommentStatus(
  comment: Pick<Doc<"comments">, "status">,
): "pending" | "approved" | "declined" {
  if (comment.status === "pending" || comment.status === "declined") {
    return comment.status;
  }
  return "approved";
}

function isCommentVisibleToViewer(
  comment: Doc<"comments">,
  viewerName?: string,
): boolean {
  const status = getCommentStatus(comment);
  if (status === "approved") return true;
  if (!viewerName) return false;
  return normalizeFullName(comment.author) === normalizeFullName(viewerName);
}

function resolveDeclineMessage(reasonKey: string, customText?: string): string {
  if (reasonKey === "custom") {
    const trimmed = (customText ?? "").trim();
    return trimmed || GENERIC_DECLINE_MESSAGE;
  }
  return DECLINE_MESSAGES[reasonKey] || GENERIC_DECLINE_MESSAGE;
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

    // Sort comments within each post and add profile image storage IDs
    // Public lists only include approved (or legacy) comments
    const postsWithComments = posts.map((post) => {
      const comments = (commentsByPostId.get(post._id) || [])
        .filter((c: Doc<"comments">) => getCommentStatus(c) === "approved")
        .sort((a: any, b: any) => a.createdAt - b.createdAt);

        // Get author profile image storage ID for each comment
      const commentsWithProfileImages = comments.map((comment: any) => {
          const authorResident = residentsByName.get(comment.author);
          return {
            ...comment,
            authorProfileImage: authorResident?.profileImage || null
          };
        });

        // Get author profile image storage ID for the post
        const authorResident = residentsByName.get(post.author);

        return {
          ...post,
          comments: commentsWithProfileImages,
          authorProfileImage: authorResident?.profileImage || null
        };
    });

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
    
    // Get author profile image storage ID for each post (no comments loaded)
    const postsWithProfileImages = paginatedPosts.map((post) => {
      const authorResident = residentsByName.get(post.author);
      return {
        ...post,
        comments: [], // Empty comments array for lazy loading
        authorProfileImage: authorResident?.profileImage || null
      };
    });
    
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

    // Sort comments within each post and add profile image storage IDs
    const postsWithComments = posts.map((post) => {
      const comments = (commentsByPostId.get(post._id) || [])
        .filter((c: Doc<"comments">) => getCommentStatus(c) === "approved")
        .sort((a: any, b: any) => a.createdAt - b.createdAt);

        // Get author profile image storage ID for each comment
      const commentsWithProfileImages = comments.map((comment: any) => {
          const authorResident = residentsByName.get(comment.author);
          return {
            ...comment,
            authorProfileImage: authorResident?.profileImage || null
          };
        });

        // Get author profile image storage ID for the post
        const authorResident = residentsByName.get(post.author);

        return {
          ...post,
          comments: commentsWithProfileImages,
          authorProfileImage: authorResident?.profileImage || null
        };
    });

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
    
    return {
      ...post,
      comments: comments.filter((c) => getCommentStatus(c) === "approved"),
    };
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
    videos: v.optional(v.array(v.string())),
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
    videos: v.optional(v.array(v.string())),
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
    
    // Delete storage files associated with the post (images and videos)
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
    if (post?.videos && Array.isArray(post.videos)) {
      for (const videoStorageId of post.videos) {
        try {
          await ctx.storage.delete(videoStorageId as any);
        } catch (error) {
          // Log but don't fail if storage deletion fails (file may not exist)
          console.log(`Failed to delete storage file ${videoStorageId}:`, error);
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

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");

    const residents = await ctx.db.query("residents").collect();
    const authorResident = residents.find(
      (r) =>
        normalizeFullName(`${r.firstName} ${r.lastName}`) ===
        normalizeFullName(args.author),
    );
    const autoApprove = !!(
      authorResident &&
      (authorResident.isBoardMember || authorResident.isDev)
    );
    const status = autoApprove ? ("approved" as const) : ("pending" as const);

    const commentId = await ctx.db.insert("comments", {
      postId: args.postId,
      author: args.author,
      content: args.content,
      status,
      ...(autoApprove ? { approvedAt: now, approvedBy: "auto" } : {}),
      createdAt: now,
      updatedAt: now,
    });

    if (autoApprove && post.author !== args.author) {
      const postAuthorResident = residents.find(
        (r) =>
          normalizeFullName(`${r.firstName} ${r.lastName}`) ===
          normalizeFullName(post.author),
      );
      if (postAuthorResident?.isActive) {
        await ctx.runMutation(api.notifications.createNotificationForUsers, {
          userIds: [postAuthorResident._id.toString()],
          type: "community_post",
          title: "New Comment",
          body: `${args.author} commented on: ${post.title}`,
          data: { author: args.author, postTitle: post.title },
        });
      }
    }

    if (!autoApprove) {
      await ctx.runMutation(api.notifications.createNotificationForBoardMembers, {
        type: "community_post",
        title: "Comment awaiting approval",
        body: `${args.author} commented on: ${post.title}`,
        data: {
          author: args.author,
          postTitle: post.title,
          commentId: commentId.toString(),
        },
      });
    }

    return { commentId, status };
  },
});

export const approveComment = mutation({
  args: {
    id: v.id("comments"),
    moderatorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error("Comment not found");

    const now = Date.now();
    await ctx.db.replace(args.id, {
      postId: comment.postId,
      author: comment.author,
      content: comment.content,
      status: "approved",
      approvedAt: now,
      approvedBy: args.moderatorName ?? "board",
      createdAt: comment.createdAt,
      updatedAt: now,
    });

    const post = await ctx.db.get(comment.postId);
    if (post && post.author !== comment.author) {
      const residents = await ctx.db.query("residents").collect();
      const postAuthorResident = residents.find(
        (r) =>
          normalizeFullName(`${r.firstName} ${r.lastName}`) ===
          normalizeFullName(post.author),
      );
      if (postAuthorResident?.isActive) {
        await ctx.runMutation(api.notifications.createNotificationForUsers, {
          userIds: [postAuthorResident._id.toString()],
          type: "community_post",
          title: "New Comment",
          body: `${comment.author} commented on: ${post.title}`,
          data: { author: comment.author, postTitle: post.title },
        });
      }
    }

    const residents = await ctx.db.query("residents").collect();
    const commenter = residents.find(
      (r) =>
        normalizeFullName(`${r.firstName} ${r.lastName}`) ===
        normalizeFullName(comment.author),
    );
    if (commenter?.isActive) {
      await ctx.runMutation(api.notifications.createNotificationForUsers, {
        userIds: [commenter._id.toString()],
        type: "community_post",
        title: "Comment approved",
        body: post
          ? `Your comment on "${post.title}" is now live.`
          : "Your comment was approved and is now live.",
        data: { postTitle: post?.title ?? "" },
      });
    }

    return { success: true };
  },
});

export const declineComment = mutation({
  args: {
    id: v.id("comments"),
    reasonKey: v.string(),
    customReason: v.optional(v.string()),
    moderatorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error("Comment not found");

    const declineReason = resolveDeclineMessage(
      args.reasonKey,
      args.customReason,
    );
    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: "declined",
      declineReason,
      declineReasonKey: args.reasonKey,
      declinedAt: now,
      declinedBy: args.moderatorName ?? "board",
      updatedAt: now,
    });

    const post = await ctx.db.get(comment.postId);
    const residents = await ctx.db.query("residents").collect();
    const commenter = residents.find(
      (r) =>
        normalizeFullName(`${r.firstName} ${r.lastName}`) ===
        normalizeFullName(comment.author),
    );
    if (commenter?.isActive) {
      await ctx.runMutation(api.notifications.createNotificationForUsers, {
        userIds: [commenter._id.toString()],
        type: "community_post",
        title: "Comment declined",
        body: declineReason,
        data: {
          postTitle: post?.title ?? "",
          declineReason,
        },
      });
    }

    return { success: true };
  },
});

/** Move a declined comment back to pending for re-review. */
export const restoreComment = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error("Comment not found");

    const now = Date.now();
    await ctx.db.replace(args.id, {
      postId: comment.postId,
      author: comment.author,
      content: comment.content,
      status: "pending",
      createdAt: comment.createdAt,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const removeComment = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/** Hard-delete declined comments older than 30 days. */
export const purgeDeclinedComments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const declined = await ctx.db
      .query("comments")
      .withIndex("by_status", (q) => q.eq("status", "declined"))
      .collect();

    let deleted = 0;
    for (const comment of declined) {
      if (comment.declinedAt != null && comment.declinedAt < cutoff) {
        await ctx.db.delete(comment._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

// Get comments for a specific post (for lazy loading)
export const getCommentsByPost = query({
  args: {
    postId: v.id("communityPosts"),
    viewerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .order("asc")
      .collect();

    const visible = comments.filter((c) =>
      isCommentVisibleToViewer(c, args.viewerName),
    );

    const residents = await ctx.db
      .query("residents")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const residentsByName = new Map();
    residents.forEach((resident) => {
      const fullName = `${resident.firstName} ${resident.lastName}`;
      residentsByName.set(fullName, resident);
    });

    return visible.map((comment) => {
      const authorResident = residentsByName.get(comment.author);
      return {
        ...comment,
        status: getCommentStatus(comment),
        authorProfileImage: authorResident?.profileImage || null,
      };
    });
  },
});

// Get all comments for admin management
export const getAllComments = query({
  args: {
    statusFilter: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("declined"),
        v.literal("all"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const filter = args.statusFilter ?? "all";
    const comments = await ctx.db.query("comments").order("desc").collect();

    const filtered = comments.filter((c) => {
      const status = getCommentStatus(c);
      if (filter === "all") return true;
      return status === filter;
    });

    const residents = await ctx.db
      .query("residents")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const residentsByName = new Map();
    residents.forEach((resident) => {
      const fullName = `${resident.firstName} ${resident.lastName}`;
      residentsByName.set(fullName, resident);
    });

    const commentsWithPosts = await Promise.all(
      filtered.map(async (comment) => {
        const post = await ctx.db.get(comment.postId);
        const authorResident = residentsByName.get(comment.author);

        return {
          ...comment,
          status: getCommentStatus(comment),
          postTitle: post?.title || "Deleted Post",
          authorProfileImage: authorResident?.profileImage || null,
        };
      }),
    );

    return commentsWithPosts;
  },
});

export const getPendingCommentsCount = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("comments")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending.length;
  },
});

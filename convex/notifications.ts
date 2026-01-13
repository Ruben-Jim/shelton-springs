import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Create notification records for multiple users
export const createNotificationForUsers = mutation({
  args: {
    userIds: v.array(v.string()),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const notifications = args.userIds.map((userId) => ({
      userId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data || {},
      isRead: false,
      createdAt: now,
    }));

    // Insert all notifications in batch
    await Promise.all(
      notifications.map((notification) => ctx.db.insert("userNotifications", notification))
    );

    return notifications.length;
  },
});

// Create notification for all board members
export const createNotificationForBoardMembers = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Get all board members
    const residents = await ctx.db
      .query("residents")
      .filter((q) => q.eq(q.field("isBoardMember"), true))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const boardMemberIds = residents.map((resident) => resident._id.toString());

    if (boardMemberIds.length === 0) {
      return 0;
    }

    // Create notifications for all board members
    const now = Date.now();
    const notifications = boardMemberIds.map((userId) => ({
      userId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data || {},
      isRead: false,
      createdAt: now,
    }));

    await Promise.all(
      notifications.map((notification) => ctx.db.insert("userNotifications", notification))
    );

    return notifications.length;
  },
});

// Create notification for all active residents
export const createNotificationForAllResidents = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Get all active residents
    const residents = await ctx.db
      .query("residents")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const residentIds = residents.map((resident) => resident._id.toString());

    if (residentIds.length === 0) {
      return 0;
    }

    // Create notifications for all residents
    const now = Date.now();
    const notifications = residentIds.map((userId) => ({
      userId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data || {},
      isRead: false,
      createdAt: now,
    }));

    await Promise.all(
      notifications.map((notification) => ctx.db.insert("userNotifications", notification))
    );

    return notifications.length;
  },
});

// Mark a single notification as read
export const markNotificationAsRead = mutation({
  args: {
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      isRead: true,
    });
  },
});

// Mark all unread notifications for a user as read
export const markAllNotificationsAsRead = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const unreadNotifications = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", args.userId).eq("isRead", false))
      .collect();

    await Promise.all(
      unreadNotifications.map((notification) =>
        ctx.db.patch(notification._id, { isRead: true })
      )
    );

    return unreadNotifications.length;
  },
});

// Get unread notifications for a user
export const getUnreadNotifications = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", args.userId).eq("isRead", false))
      .order("desc")
      .collect();

    return notifications;
  },
});

// Get all notifications for a user (read + unread)
export const getAllNotifications = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const notifications = await ctx.db
      .query("userNotifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return notifications;
  },
});

// Get count of unread notifications for a user
export const getUnreadCount = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", args.userId).eq("isRead", false))
      .collect();

    return notifications.length;
  },
});

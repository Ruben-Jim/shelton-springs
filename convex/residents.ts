import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Get all residents
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const residents = await ctx.db.query("residents").collect();

    // Return residents with profileImage storage ID (frontend will resolve URLs)
    return residents;
  },
});

// Get resident by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("residents")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

// Get resident by ID
export const getById = query({
  args: { id: v.id("residents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create new resident (signup)
export const create = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    address: v.string(),
    unitNumber: v.optional(v.string()),
    isResident: v.boolean(),
    isBoardMember: v.boolean(),
    isRenter: v.boolean(),
    isDev: v.optional(v.boolean()),
    password: v.optional(v.string()),
    profileImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existing = await ctx.db
      .query("residents")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (existing) {
      throw new Error("Email already exists");
    }

    const now = Date.now();
    const id = await ctx.db.insert("residents", {
      ...args,
      isDev: args.isDev ?? false, // Default to false if not provided
      isActive: true,
      isBlocked: false,
      blockReason: undefined,
      createdAt: now,
      updatedAt: now,
    });
    
    return id;
  },
});

// Update resident
export const update = mutation({
  args: {
    id: v.id("residents"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    unitNumber: v.optional(v.string()),
    isResident: v.optional(v.boolean()),
    isBoardMember: v.optional(v.boolean()),
    isRenter: v.optional(v.boolean()),
    isDev: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    password: v.optional(v.string()),
    profileImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    // If email is being updated, check if it already exists
    if (updates.email) {
      const existing = await ctx.db
        .query("residents")
        .withIndex("by_email", (q) => q.eq("email", updates.email!))
        .first();
      
      if (existing && existing._id !== id) {
        throw new Error("Email already exists");
      }
    }

    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
    });
    
    return id;
  },
});

// Delete resident
export const remove = mutation({
  args: { id: v.id("residents") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Authenticate resident (login)
export const authenticate = query({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const resident = await ctx.db
      .query("residents")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (!resident) {
      return null;
    }

    // In a real app, you would hash the password and compare hashes
    // For demo purposes, we'll do a simple string comparison
    if (resident.password !== args.password) {
      return null;
    }

    if (!resident.isActive) {
      return null;
    }

    return resident;
  },
});

// Get active residents only
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const residents = await ctx.db
      .query("residents")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Return residents with profileImage storage ID (frontend will resolve URLs)
    return residents;
  },
});

// Update push token for remote notifications (Expo Push)
export const updatePushToken = mutation({
  args: {
    userId: v.id("residents"),
    expoPushToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      expoPushToken: args.expoPushToken ?? undefined,
      updatedAt: now,
    });
    return { success: true };
  },
});

// Internal: Get push tokens for user IDs (used by push action)
export const getPushTokensForUserIds = internalQuery({
  args: {
    userIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const tokens: { userId: string; token: string }[] = [];
    for (const userId of args.userIds) {
      try {
        const resident = await ctx.db.get(userId as Id<"residents">);
        if (resident?.expoPushToken) {
          tokens.push({ userId, token: resident.expoPushToken });
        }
      } catch {
        // Skip invalid IDs
      }
    }
    return tokens;
  },
});

// Block or unblock a resident
export const setBlockStatus = mutation({
  args: {
    id: v.id("residents"),
    isBlocked: v.boolean(),
    blockReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, {
      isBlocked: args.isBlocked,
      blockReason: args.blockReason,
      updatedAt: now,
    });
    
    return { success: true };
  },
});

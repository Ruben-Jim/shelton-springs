import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("fines").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    violation: v.string(),
    amount: v.number(),
    dateIssued: v.string(),
    dueDate: v.string(),
    status: v.union(
      v.literal("Pending"),
      v.literal("Partial"),
      v.literal("Paid"),
      v.literal("Overdue"),
    ),
    description: v.string(),
    residentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("fines", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    id: v.id("fines"),
    violation: v.optional(v.string()),
    amount: v.optional(v.number()),
    dateIssued: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("Pending"),
        v.literal("Partial"),
        v.literal("Paid"),
        v.literal("Overdue"),
      ),
    ),
    description: v.optional(v.string()),
    residentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("fines") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});



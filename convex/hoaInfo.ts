import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const info = await ctx.db.query("hoaInfo").first();
    return info ?? null;
  },
});

export const upsert = mutation({
  args: {
    name: v.string(),
    address: v.string(),
    phone: v.string(),
    email: v.string(),
    website: v.optional(v.string()),
    officeHours: v.string(),
    emergencyContact: v.string(),
    eventText: v.optional(v.string()),
    ccrsPdfStorageId: v.optional(v.string()),
    boardMeetingsSchedule: v.optional(v.string()),
    boardMeetingsLocation: v.optional(v.string()),
    boardMeetingsOpenNote: v.optional(v.string()),
    boardContactGeneral: v.optional(v.string()),
    boardContactUrgent: v.optional(v.string()),
    boardResourceMinutes: v.optional(v.string()),
    boardResourceBylaws: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("hoaInfo").first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    const id = await ctx.db.insert("hoaInfo", { ...args, createdAt: now, updatedAt: now });
    return id;
  },
});

export const updateCcrsPdf = mutation({
  args: {
    ccrsPdfStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("hoaInfo").first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { 
        ccrsPdfStorageId: args.ccrsPdfStorageId,
        updatedAt: now 
      });
      return existing._id;
    }
    // If no HOA info exists, create it with minimal required fields
    const id = await ctx.db.insert("hoaInfo", { 
      name: "HOA Community",
      address: "",
      phone: "",
      email: "",
      officeHours: "",
      emergencyContact: "",
      ccrsPdfStorageId: args.ccrsPdfStorageId,
      createdAt: now, 
      updatedAt: now 
    });
    return id;
  },
});



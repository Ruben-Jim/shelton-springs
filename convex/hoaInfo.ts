import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

async function assertBoardOrDev(ctx: MutationCtx, requesterId: Id<"residents">) {
  const requester = await ctx.db.get(requesterId);
  if (!requester || !requester.isActive || requester.isBlocked) {
    throw new Error("Not authorized");
  }
  if (!requester.isBoardMember && !requester.isDev) {
    throw new Error("Only board members can update the CC&Rs");
  }
}

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

/**
 * Replace the community CC&Rs PDF. The previous file is deleted from storage in
 * the same transaction, so a failed update never leaves the doc pointing at a
 * deleted file and a successful one never leaves the old file orphaned.
 */
export const updateCcrsPdf = mutation({
  args: {
    requesterId: v.id("residents"),
    ccrsPdfStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await assertBoardOrDev(ctx, args.requesterId);

    const existing = await ctx.db.query("hoaInfo").first();
    const now = Date.now();

    if (!existing) {
      // If no HOA info exists, create it with minimal required fields
      return await ctx.db.insert("hoaInfo", {
        name: "HOA Community",
        address: "",
        phone: "",
        email: "",
        officeHours: "",
        emergencyContact: "",
        ccrsPdfStorageId: args.ccrsPdfStorageId,
        createdAt: now,
        updatedAt: now,
      });
    }

    const previousId = existing.ccrsPdfStorageId
      ? ctx.db.system.normalizeId("_storage", existing.ccrsPdfStorageId)
      : null;

    await ctx.db.patch(existing._id, {
      ccrsPdfStorageId: args.ccrsPdfStorageId,
      updatedAt: now,
    });

    // Skip if re-saving the same file, or if the old file is already gone.
    if (previousId && previousId !== args.ccrsPdfStorageId) {
      const previousFile = await ctx.db.system.get(previousId);
      if (previousFile) {
        await ctx.storage.delete(previousId);
      }
    }

    return existing._id;
  },
});

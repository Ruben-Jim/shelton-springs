import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  DEFAULT_DAMAGE_CATEGORIES,
  normalizeDamageCategories,
} from "./damageCategoryUtils";

const statusValidator = v.union(
  v.literal("Pending"),
  v.literal("In Progress"),
  v.literal("Resolved")
);

async function resolveDamageCategories(ctx: { db: any }) {
  const hoa = await ctx.db.query("hoaInfo").first();
  const configured = (hoa?.damageCategories ?? [])
    .map((category: string) => category.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : [...DEFAULT_DAMAGE_CATEGORIES];
}

async function assertValidDamageCategory(ctx: { db: any }, category: string) {
  const trimmed = category.trim();
  if (!trimmed) {
    throw new Error("Damage category is required");
  }
  const validCategories = await resolveDamageCategories(ctx);
  const isValid = validCategories.some(
    (entry: string) => entry.toLowerCase() === trimmed.toLowerCase()
  );
  if (!isValid) {
    throw new Error("Invalid damage category");
  }
  return trimmed;
}

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    return await resolveDamageCategories(ctx);
  },
});

export const updateCategories = mutation({
  args: {
    categories: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeDamageCategories(args.categories);
    const existing = await ctx.db.query("hoaInfo").first();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        damageCategories: normalized,
        updatedAt: now,
      });
      return normalized;
    }

    throw new Error("HOA information must be configured before managing damage categories");
  },
});

export const create = mutation({
  args: {
    residentId: v.string(),
    residentName: v.string(),
    category: v.string(),
    description: v.string(),
    photos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const category = await assertValidDamageCategory(ctx, args.category);
    const now = Date.now();
    const reportId = await ctx.db.insert("damageReports", {
      residentId: args.residentId,
      residentName: args.residentName,
      category,
      description: args.description,
      photos: args.photos,
      status: "Pending",
      createdAt: now,
      updatedAt: now,
    });

    const preview =
      args.description.length > 100
        ? `${args.description.slice(0, 100)}...`
        : args.description;

    await ctx.runMutation(api.notifications.createNotificationForBoardMembers, {
      type: "damage_report",
      title: "New Damage Report",
      body: `${args.residentName} reported ${category} damage: ${preview}`,
      data: {
        reportId,
        category,
        residentId: args.residentId,
      },
    });

    return reportId;
  },
});

export const getByResident = query({
  args: {
    residentId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("damageReports")
      .withIndex("by_resident", (q) => q.eq("residentId", args.residentId))
      .order("desc")
      .collect();
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("damageReports").order("desc").collect();

    const residentIds = [...new Set(reports.map((report) => report.residentId))];
    const residents = await Promise.all(
      residentIds.map((id) => ctx.db.get(id as Id<"residents">))
    );
    const residentsById = new Map<string, (typeof residents)[number]>();
    residents.forEach((resident) => {
      if (resident) {
        residentsById.set(resident._id.toString(), resident);
      }
    });

    return reports.map((report) => {
      const resident = residentsById.get(report.residentId);
      return {
        ...report,
        residentAddress: resident
          ? `${resident.address}${resident.unitNumber ? ` #${resident.unitNumber}` : ""}`
          : "",
      };
    });
  },
});

export const getPendingCount = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("damageReports")
      .withIndex("by_status", (q) => q.eq("status", "Pending"))
      .collect();
    return pending.length;
  },
});

export const updateByResident = mutation({
  args: {
    reportId: v.id("damageReports"),
    residentId: v.string(),
    category: v.string(),
    description: v.string(),
    photos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }
    if (report.residentId !== args.residentId) {
      throw new Error("Not authorized to edit this report");
    }
    if (report.status === "Resolved") {
      throw new Error("Cannot edit a resolved report");
    }

    const category = await assertValidDamageCategory(ctx, args.category);

    await ctx.db.patch(args.reportId, {
      category,
      description: args.description,
      photos: args.photos,
      updatedAt: Date.now(),
    });

    return args.reportId;
  },
});

export const updateStatus = mutation({
  args: {
    reportId: v.id("damageReports"),
    status: statusValidator,
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const statusChanged = report.status !== args.status;

    const patch: {
      status: typeof args.status;
      updatedAt: number;
      adminNotes?: string;
    } = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.adminNotes !== undefined) {
      patch.adminNotes = args.adminNotes;
    }

    await ctx.db.patch(args.reportId, patch);

    if (statusChanged) {
      await ctx.runMutation(api.notifications.createNotificationForUsers, {
        userIds: [report.residentId],
        type: "damage_report_status",
        title: "Damage Report Updated",
        body: `Your ${report.category} damage report is now: ${args.status}`,
        data: {
          reportId: args.reportId,
          status: args.status,
          category: report.category,
        },
      });
    }

    return args.reportId;
  },
});

export const updateAdminNotes = mutation({
  args: {
    reportId: v.id("damageReports"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    await ctx.db.patch(args.reportId, {
      adminNotes: args.adminNotes,
      updatedAt: Date.now(),
    });

    return args.reportId;
  },
});

async function deleteReportPhotos(ctx: { storage: any }, photos?: string[]) {
  if (!photos?.length) return;

  for (const photoId of photos) {
    try {
      await ctx.storage.delete(photoId);
    } catch (error) {
      console.log(`Failed to delete storage file ${photoId}:`, error);
    }
  }
}

export const remove = mutation({
  args: {
    reportId: v.id("damageReports"),
    requesterId: v.string(),
    asAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    if (args.asAdmin) {
      const requester = await ctx.db.get(args.requesterId as Id<"residents">);
      if (!requester || (!requester.isBoardMember && !requester.isDev)) {
        throw new Error("Not authorized to delete this report");
      }
    } else if (report.residentId !== args.requesterId) {
      throw new Error("Not authorized to delete this report");
    }

    await deleteReportPhotos(ctx, report.photos);
    await ctx.db.delete(args.reportId);

    return args.reportId;
  },
});

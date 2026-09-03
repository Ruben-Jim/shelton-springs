import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getNoticeTemplate, NoticeTemplateType, NOTICE_TEMPLATES, isValidSelectedViolation, allocateNextNoticeNumber } from "./adminNoticeTemplates";

const templateTypeValidator = v.union(
  v.literal("notice"),
  v.literal("action_request"),
  v.literal("reminder")
);

const audienceTypeValidator = v.union(
  v.literal("all"),
  v.literal("homeowners"),
  v.literal("renters"),
  v.literal("custom")
);

const channelsValidator = v.union(
  v.literal("push"),
  v.literal("email"),
  v.literal("both")
);

async function assertAdminAccess(ctx: { db: any }, requesterId: Id<"residents">) {
  const requester = await ctx.db.get(requesterId);
  if (!requester || !requester.isActive || requester.isBlocked) {
    throw new Error("Not authorized");
  }
  if (!requester.isBoardMember && !requester.isDev) {
    throw new Error("Not authorized to send admin notices");
  }
  return requester;
}

function filterEligibleResidents(residents: any[]) {
  return residents.filter((r) => r.isActive && !r.isBlocked);
}

function resolveByAudience(
  residents: any[],
  audienceType: "all" | "homeowners" | "renters" | "custom",
  customIds?: Id<"residents">[]
) {
  const eligible = filterEligibleResidents(residents);
  if (audienceType === "all") return eligible;
  if (audienceType === "homeowners") {
    return eligible.filter((r) => r.isResident && !r.isRenter);
  }
  if (audienceType === "renters") {
    return eligible.filter((r) => r.isRenter);
  }
  if (!customIds?.length) return [];
  const idSet = new Set(customIds.map(String));
  return eligible.filter((r) => idSet.has(String(r._id)));
}

export const getTemplates = query({
  args: {},
  handler: async () => {
    return Object.values(NOTICE_TEMPLATES);
  },
});

export const getNextNoticeNumber = query({
  args: {},
  handler: async (ctx) => {
    return allocateNextNoticeNumber(ctx);
  },
});

export const resolveRecipients = query({
  args: {
    requesterId: v.id("residents"),
    audienceType: audienceTypeValidator,
    customRecipientIds: v.optional(v.array(v.id("residents"))),
  },
  handler: async (ctx, args) => {
    await assertAdminAccess(ctx, args.requesterId);
    const residents = await ctx.db.query("residents").collect();
    const resolved = resolveByAudience(
      residents,
      args.audienceType,
      args.customRecipientIds
    );
    return resolved.map((r) => ({
      _id: r._id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      address: r.address,
      unitNumber: r.unitNumber,
      isRenter: r.isRenter,
      isResident: r.isResident,
    }));
  },
});

export const listTickets = query({
  args: {
    requesterId: v.id("residents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertAdminAccess(ctx, args.requesterId);
    const limit = args.limit ?? 50;
    const tickets = await ctx.db
      .query("adminNoticeTickets")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
    return tickets;
  },
});

export const getNoticeForResident = query({
  args: {
    residentId: v.id("residents"),
    ticketId: v.id("adminNoticeTickets"),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;

    const residentIdStr = String(args.residentId);
    const isRecipient = ticket.recipientIds.some(
      (id) => String(id) === residentIdStr
    );
    if (!isRecipient) return null;

    const resident = await ctx.db.get(args.residentId);
    if (!resident || !resident.isActive || resident.isBlocked) return null;

    const template = getNoticeTemplate(ticket.templateType as NoticeTemplateType);
    const address = `${resident.address}${
      resident.unitNumber ? `, Unit ${resident.unitNumber}` : ""
    }`;

    return {
      ticketId: ticket._id,
      noticeNumber: ticket.noticeNumber,
      templateType: ticket.templateType,
      title: ticket.title,
      body: ticket.body,
      emailSubject: ticket.emailSubject,
      sentAt: ticket.sentAt,
      createdByName: ticket.createdByName,
      address,
      emailBody: template.emailBody,
      badgeLabel: template.badgeLabel,
      selectedViolations: ticket.selectedViolations,
    };
  },
});

export const listMyAdminNotices = query({
  args: {
    residentId: v.id("residents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const userId = String(args.residentId);
    const notifications = await ctx.db
      .query("userNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit * 3);

    return notifications
      .filter((n) => n.type === "admin_notice" && n.data?.ticketId)
      .slice(0, limit)
      .map((n) => ({
        notificationId: n._id,
        ticketId: String(n.data.ticketId),
        templateType: n.data.templateType as NoticeTemplateType,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        createdAt: n.createdAt,
      }));
  },
});

export const getTicket = query({
  args: {
    requesterId: v.id("residents"),
    ticketId: v.id("adminNoticeTickets"),
  },
  handler: async (ctx, args) => {
    await assertAdminAccess(ctx, args.requesterId);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;
    const recipients = await ctx.db
      .query("adminNoticeRecipients")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .collect();
    return { ...ticket, recipients };
  },
});

export const send = mutation({
  args: {
    requesterId: v.id("residents"),
    templateType: templateTypeValidator,
    audienceType: audienceTypeValidator,
    customRecipientIds: v.optional(v.array(v.id("residents"))),
    channels: channelsValidator,
    selectedViolations: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const requester = await assertAdminAccess(ctx, args.requesterId);
    const template = getNoticeTemplate(args.templateType as NoticeTemplateType);
    const isComplianceTemplate =
      args.templateType === "action_request" || args.templateType === "reminder";

    let selectedViolations: string[] | undefined;
    if (isComplianceTemplate) {
      const violations = args.selectedViolations ?? [];
      if (violations.length === 0) {
        throw new Error("Select at least one yard maintenance violation");
      }
      for (const item of violations) {
        if (!isValidSelectedViolation(item)) {
          throw new Error("Invalid yard maintenance violation selected");
        }
      }
      selectedViolations = violations;
    } else if (args.selectedViolations?.length) {
      throw new Error("Violations only apply to yard maintenance notices");
    }

    const residents = await ctx.db.query("residents").collect();
    const recipients = resolveByAudience(
      residents,
      args.audienceType,
      args.customRecipientIds
    );

    if (recipients.length === 0) {
      throw new Error("No eligible recipients found for this audience");
    }

    const now = Date.now();
    const sendPush = args.channels === "push" || args.channels === "both";
    const sendEmail = args.channels === "email" || args.channels === "both";
    const pushEligibleCount = sendPush
      ? recipients.filter((r) => Boolean(r.expoPushToken)).length
      : 0;
    const initialStatus =
      sendEmail && !sendPush
        ? ("sending" as const)
        : sendEmail && sendPush && pushEligibleCount === 0
          ? ("sending" as const)
          : sendPush && !sendEmail && pushEligibleCount === 0
            ? ("failed" as const)
            : ("sent" as const);

    const noticeNumber = await allocateNextNoticeNumber(ctx);

    const ticketId = await ctx.db.insert("adminNoticeTickets", {
      createdBy: args.requesterId,
      createdByName: `${requester.firstName} ${requester.lastName}`.trim(),
      templateType: args.templateType,
      audienceType: args.audienceType,
      recipientIds: recipients.map((r) => r._id),
      channels: args.channels,
      title: template.pushTitle,
      body: template.pushBody,
      emailSubject: template.emailSubject,
      noticeNumber,
      selectedViolations,
      status: initialStatus,
      pushSentCount: 0,
      emailSentCount: 0,
      emailFailedCount: 0,
      createdAt: now,
      sentAt: now,
    });

    const recipientRows = recipients.map((r) => ({
      ticketId,
      residentId: r._id,
      residentName: `${r.firstName} ${r.lastName}`.trim(),
      email: r.email,
      pushStatus: sendPush
        ? r.expoPushToken
          ? ("sent" as const)
          : ("skipped" as const)
        : ("not_requested" as const),
      emailStatus: sendEmail
        ? ("pending" as const)
        : ("not_requested" as const),
    }));

    await Promise.all(
      recipientRows.map((row) => ctx.db.insert("adminNoticeRecipients", row))
    );

    const recipientIds = recipients.map((r) => r._id.toString());

    if (sendPush) {
      const notificationNow = Date.now();
      await Promise.all(
        recipientIds.map((userId) =>
          ctx.db.insert("userNotifications", {
            userId,
            type: "admin_notice",
            title: template.pushTitle,
            body: template.pushBody,
            data: {
              ticketId: ticketId.toString(),
              templateType: args.templateType,
            },
            isRead: false,
            createdAt: notificationNow,
          })
        )
      );
      await ctx.scheduler.runAfter(0, internal.push.sendExpoPush, {
        userIds: recipientIds,
        title: template.pushTitle,
        body: template.pushBody,
        data: {
          ticketId: ticketId.toString(),
          templateType: args.templateType,
        },
      });
      await ctx.db.patch(ticketId, { pushSentCount: pushEligibleCount });
    }

    if (sendEmail) {
      await ctx.scheduler.runAfter(0, internal.residentEmail.sendBatch, {
        ticketId,
        templateType: args.templateType,
      });
    }

    return ticketId;
  },
});

export const updateEmailDelivery = internalMutation({
  args: {
    ticketId: v.id("adminNoticeTickets"),
    emailSentCount: v.number(),
    emailFailedCount: v.number(),
    recipientUpdates: v.array(
      v.object({
        residentId: v.id("residents"),
        emailStatus: v.union(v.literal("sent"), v.literal("failed")),
        error: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const update of args.recipientUpdates) {
      const row = await ctx.db
        .query("adminNoticeRecipients")
        .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
        .filter((q) => q.eq(q.field("residentId"), update.residentId))
        .first();
      if (row) {
        await ctx.db.patch(row._id, {
          emailStatus: update.emailStatus,
          error: update.error,
        });
      }
    }

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return;

    const emailOk = args.emailSentCount > 0;
    const emailFailed = args.emailFailedCount > 0;

    let status: "sending" | "sent" | "partial" | "failed" = "sent";
    if (ticket.channels === "both") {
      const pushOk = ticket.pushSentCount > 0;
      if (emailFailed && emailOk) status = "partial";
      else if (emailFailed && !emailOk && !pushOk) status = "failed";
      else if (emailFailed) status = "partial";
      else status = "sent";
    } else if (ticket.channels === "email") {
      status = emailFailed ? (emailOk ? "partial" : "failed") : "sent";
    }

    await ctx.db.patch(args.ticketId, {
      emailSentCount: args.emailSentCount,
      emailFailedCount: args.emailFailedCount,
      status,
    });
  },
});

export const getTicketForEmail = internalQuery({
  args: { ticketId: v.id("adminNoticeTickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;

    const recipients = await ctx.db
      .query("adminNoticeRecipients")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .collect();

    const addressByResidentId: Record<string, string> = {};
    for (const residentId of ticket.recipientIds) {
      const resident = await ctx.db.get(residentId);
      if (resident) {
        addressByResidentId[String(residentId)] = `${resident.address}${
          resident.unitNumber ? `, Unit ${resident.unitNumber}` : ""
        }`;
      }
    }

    return {
      recipients,
      addressByResidentId,
      sentAt: ticket.sentAt,
      emailSubject: ticket.emailSubject,
      noticeNumber: ticket.noticeNumber,
      selectedViolations: ticket.selectedViolations,
    };
  },
});

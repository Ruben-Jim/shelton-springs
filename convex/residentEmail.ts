"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getNoticeEmailHtml } from "./emailTemplates";
import { getNoticeTemplate, NoticeTemplateType } from "./adminNoticeTemplates";

export const sendBatch = internalAction({
  args: {
    ticketId: v.id("adminNoticeTickets"),
    templateType: v.union(
      v.literal("notice"),
      v.literal("action_request"),
      v.literal("reminder")
    ),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ?? "Shelton Springs <onboarding@resend.dev>";

    const ticket = await ctx.runQuery(internal.adminNotices.getTicketForEmail, {
      ticketId: args.ticketId,
    });

    if (!ticket) {
      console.error("Ticket not found for email batch:", args.ticketId);
      return;
    }

    const template = getNoticeTemplate(args.templateType as NoticeTemplateType);
    let emailSentCount = 0;
    let emailFailedCount = 0;
    const recipientUpdates: Array<{
      residentId: any;
      emailStatus: "sent" | "failed";
      error?: string;
    }> = [];

    for (const recipient of ticket.recipients) {
      if (recipient.emailStatus !== "pending") continue;

      if (!apiKey) {
        emailFailedCount += 1;
        recipientUpdates.push({
          residentId: recipient.residentId,
          emailStatus: "failed",
          error: "RESEND_API_KEY is not configured",
        });
        continue;
      }

      const address = ticket.addressByResidentId[String(recipient.residentId)] ?? "";
      const html = getNoticeEmailHtml({
        templateType: args.templateType,
        recipientName: recipient.residentName,
        address,
        body: template.emailBody,
        badgeLabel: template.badgeLabel,
        ctaLabel: template.ctaLabel,
        ctaUrl: template.ctaUrl,
        noticeDateMs: ticket.sentAt ?? Date.now(),
        noticeNumber: ticket.noticeNumber,
        selectedViolations: ticket.selectedViolations,
      });

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": "SheltonSprings/1.0",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: recipient.email,
            subject: ticket.emailSubject ?? template.emailSubject,
            html,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          emailFailedCount += 1;
          recipientUpdates.push({
            residentId: recipient.residentId,
            emailStatus: "failed",
            error: `Resend ${response.status}: ${text}`,
          });
        } else {
          emailSentCount += 1;
          recipientUpdates.push({
            residentId: recipient.residentId,
            emailStatus: "sent",
          });
        }
      } catch (error) {
        emailFailedCount += 1;
        recipientUpdates.push({
          residentId: recipient.residentId,
          emailStatus: "failed",
          error: error instanceof Error ? error.message : "Unknown email error",
        });
      }
    }

    await ctx.runMutation(internal.adminNotices.updateEmailDelivery, {
      ticketId: args.ticketId,
      emailSentCount,
      emailFailedCount,
      recipientUpdates,
    });
  },
});

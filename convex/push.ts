"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // Expo allows max 100 messages per request

/**
 * Send push notifications via Expo Push API
 * Internal action - only callable from other Convex functions
 */
export const sendExpoPush = internalAction({
  args: {
    userIds: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (args.userIds.length === 0) return;

    // Fetch push tokens for recipients
    const tokensWithUsers = await ctx.runQuery(
      internal.residents.getPushTokensForUserIds,
      { userIds: args.userIds }
    );

    if (tokensWithUsers.length === 0) return;

    const messages = tokensWithUsers.map(({ token }) => ({
      to: token,
      title: args.title,
      body: args.body,
      data: args.data ?? {},
      sound: "default",
      priority: "high" as const,
      channelId: "default",
    }));

    // Batch in chunks of 100 (Expo limit)
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(batch),
        });

        if (!response.ok) {
          console.error(
            `Expo Push API error: ${response.status} ${response.statusText}`,
            await response.text()
          );
        }

        const result = await response.json();
        if (result.data?.length) {
          for (let j = 0; j < result.data.length; j++) {
            const ticket = result.data[j];
            if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
              // Token is invalid - could clear it from DB (future enhancement)
              console.warn("Invalid push token, consider clearing:", batch[j]?.to);
            }
          }
        }
      } catch (error) {
        console.error("Failed to send Expo push notifications:", error);
      }
    }
  },
});

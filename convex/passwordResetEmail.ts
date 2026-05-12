"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getPasswordResetHtml } from "./emailTemplates";

const RESET_URL_BASE = "https://sheltonsprings.homes";

export const sendResetEmail = internalAction({
  args: {
    email: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ?? "Shelton Springs <onboarding@resend.dev>";

    if (!apiKey) {
      console.error("RESEND_API_KEY is not set. Cannot send password reset email.");
      return;
    }

    const resetUrl = `${RESET_URL_BASE}?resetToken=${args.token}`;
    const html = getPasswordResetHtml(resetUrl);

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
          to: args.email,
          subject: "Reset your Shelton Springs password",
          html,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(
          `Resend API error ${response.status}: ${response.statusText}`,
          text
        );
      }
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }
  },
});

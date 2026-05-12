import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const RATE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const requestPasswordReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email) {
      return { success: true };
    }

    // Rate limit: check for recent request for this email
    const recentTokens = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    const now = Date.now();
    const recentRequest = recentTokens.find(
      (t) => now - t.createdAt < RATE_LIMIT_MS
    );
    if (recentRequest) {
      return { success: true };
    }

    // Check if resident exists
    const resident = await ctx.db
      .query("residents")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!resident) {
      return { success: true };
    }

    const token = generateSecureToken();
    const expiresAt = now + TOKEN_EXPIRY_MS;

    await ctx.db.insert("passwordResetTokens", {
      token,
      email,
      expiresAt,
      createdAt: now,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.passwordResetEmail.sendResetEmail,
      { email, token }
    );

    return { success: true };
  },
});

export const resetPassword = mutation({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const { token, newPassword } = args;

    if (!newPassword || newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const record = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!record) {
      throw new Error("Invalid or expired reset link. Please request a new one.");
    }

    const now = Date.now();
    if (record.expiresAt < now) {
      await ctx.db.delete(record._id);
      throw new Error("Reset link has expired. Please request a new one.");
    }

    const resident = await ctx.db
      .query("residents")
      .withIndex("by_email", (q) => q.eq("email", record.email))
      .first();

    if (!resident) {
      await ctx.db.delete(record._id);
      throw new Error("Account not found. Please request a new reset link.");
    }

    await ctx.db.patch(resident._id, {
      password: newPassword,
      updatedAt: now,
    });

    await ctx.db.delete(record._id);

    return { success: true };
  },
});

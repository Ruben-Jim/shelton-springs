import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Create a Venmo payment record in the database
export const createVenmoPayment = mutation({
  args: {
    userId: v.string(),
    feeType: v.string(),
    amount: v.number(),
    venmoUsername: v.string(),
    venmoTransactionId: v.string(),
    receiptImage: v.optional(v.string()), // Storage ID for receipt screenshot
    feeId: v.optional(v.id("fees")),
    fineId: v.optional(v.id("fines")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const paymentId = await ctx.db.insert("payments", {
      userId: args.userId,
      feeType: args.feeType,
      amount: args.amount,
      paymentDate: new Date().toISOString().split('T')[0],
      status: "Pending",
      paymentMethod: "Venmo",
      transactionId: args.venmoTransactionId,
      venmoUsername: args.venmoUsername,
      venmoTransactionId: args.venmoTransactionId,
      receiptImage: args.receiptImage,
      verificationStatus: "Pending",
      feeId: args.feeId,
      fineId: args.fineId,
      createdAt: now,
      updatedAt: now,
    });

    return paymentId;
  },
});

// Verify Venmo payment (admin only)
export const verifyVenmoPayment = mutation({
  args: {
    paymentId: v.id("payments"),
    status: v.union(v.literal("Paid"), v.literal("Pending"), v.literal("Overdue")),
    verificationStatus: v.union(v.literal("Verified"), v.literal("Rejected")),
    adminNotes: v.optional(v.string()),
    adjustedAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);

    if (!payment) {
      throw new Error(`Payment not found`);
    }

    // Use adjusted amount if provided, otherwise use original payment amount
    const finalAmount = args.adjustedAmount !== undefined ? args.adjustedAmount : payment.amount;

    // Update payment status, verification status, amount, and admin notes
    await ctx.db.patch(payment._id, {
      status: args.status,
      verificationStatus: args.verificationStatus,
      amount: finalAmount,
      adminNotes: args.adminNotes,
      updatedAt: Date.now(),
    });

    // If payment is verified, check if it fully covers the fee/fine
    if (args.verificationStatus === "Verified") {
      // Check fee amount and compare with payment amount
      if (payment.feeId) {
        const fee = await ctx.db.get(payment.feeId);
        if (fee) {
          // Only mark fee as "Paid" if payment amount >= fee amount
          if (finalAmount >= fee.amount) {
            await ctx.db.patch(payment.feeId, {
              status: "Paid",
              updatedAt: Date.now(),
            });
          } else {
            // Explicitly ensure fee stays "Pending" for partial payments
            await ctx.db.patch(payment.feeId, {
              status: "Pending",
              updatedAt: Date.now(),
            });
          }
        }
      }
      
      // Check fine amount and compare with payment amount
      if (payment.fineId) {
        const fine = await ctx.db.get(payment.fineId);
        if (fine) {
          // Only mark fine as "Paid" if payment amount >= fine amount
          if (finalAmount >= fine.amount) {
            await ctx.db.patch(payment.fineId, {
              status: "Paid",
              updatedAt: Date.now(),
            });
          } else {
            // Explicitly ensure fine stays "Pending" for partial payments
            await ctx.db.patch(payment.fineId, {
              status: "Pending",
              updatedAt: Date.now(),
            });
          }
        }
      }
    }

    // Create notification for user about payment verification status
    const now = Date.now();
    const notificationTitle = args.verificationStatus === "Verified"
      ? "✅ Payment Verified"
      : "❌ Payment Rejected";
    
    // Determine if this was a partial payment
    let isPartialPayment = false;
    if (args.verificationStatus === "Verified" && payment.feeId) {
      const fee = await ctx.db.get(payment.feeId);
      if (fee && finalAmount < fee.amount) {
        isPartialPayment = true;
      }
    } else if (args.verificationStatus === "Verified" && payment.fineId) {
      const fine = await ctx.db.get(payment.fineId);
      if (fine && finalAmount < fine.amount) {
        isPartialPayment = true;
      }
    }
    
    const notificationBody = args.verificationStatus === "Verified"
      ? isPartialPayment
        ? `Your payment of $${finalAmount.toFixed(2)} for ${payment.feeType} has been verified. This is a partial payment.`
        : `Your payment of $${finalAmount.toFixed(2)} for ${payment.feeType} has been verified and marked as paid.`
      : `Your payment of $${finalAmount.toFixed(2)} for ${payment.feeType} was rejected.${args.adminNotes ? ` Reason: ${args.adminNotes}` : ''}`;

    await ctx.runMutation(api.notifications.createNotificationForUsers, {
      userIds: [payment.userId],
      type: "payment_pending",
      title: notificationTitle,
      body: notificationBody,
      data: {
        paymentId: payment._id,
        amount: finalAmount,
        feeType: payment.feeType,
        verificationStatus: args.verificationStatus,
        adminNotes: args.adminNotes,
      },
    });

    return payment._id;
  },
});

// Record check or cash payment (admin only - immediately marks as paid and verified)
export const recordCheckOrCashPayment = mutation({
  args: {
    userId: v.string(),
    feeType: v.string(),
    amount: v.number(),
    paymentMethod: v.union(v.literal("Check"), v.literal("Cash"), v.literal("Venmo")),
    paymentDate: v.string(),
    checkNumber: v.optional(v.string()), // For check payments
    venmoUsername: v.optional(v.string()), // For Venmo payments
    venmoTransactionId: v.optional(v.string()), // For Venmo payments
    notes: v.optional(v.string()), // Admin notes
    feeId: v.optional(v.id("fees")),
    fineId: v.optional(v.id("fines")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Generate a transaction ID based on payment method
    const transactionId = args.paymentMethod === "Check"
      ? `CHK-${Date.now()}-${args.checkNumber || 'manual'}`
      : args.paymentMethod === "Venmo"
      ? `VNM-${Date.now()}-${args.venmoTransactionId || 'manual'}`
      : `CSH-${Date.now()}-manual`;

    // If no specific feeId provided, find all unpaid fees for this user and mark them as paid
    let feesToUpdate: any[] = [];
    let finesToUpdate: any[] = [];
    let linkedFeeId = args.feeId;
    let linkedFineId = args.fineId;

    if (!args.feeId && !args.fineId) {
      // Find all unpaid fees for this user
      const userFees = await ctx.db
        .query("fees")
        .filter((q) => 
          q.and(
            q.eq(q.field("userId"), args.userId),
            q.neq(q.field("status"), "Paid")
          )
        )
        .collect();
      
      feesToUpdate = userFees;
      
      // Find all unpaid fines for this user (fines use residentId)
      const userFines = await ctx.db
        .query("fines")
        .filter((q) => 
          q.and(
            q.eq(q.field("residentId"), args.userId),
            q.neq(q.field("status"), "Paid")
          )
        )
        .collect();
      
      finesToUpdate = userFines;
      
      // Link to the first fee if available
      if (feesToUpdate.length > 0) {
        linkedFeeId = feesToUpdate[0]._id;
      }
      if (finesToUpdate.length > 0) {
        linkedFineId = finesToUpdate[0]._id;
      }
    }

    const paymentId = await ctx.db.insert("payments", {
      userId: args.userId,
      feeType: args.feeType,
      amount: args.amount,
      paymentDate: args.paymentDate,
      status: "Paid", // Immediately marked as paid
      paymentMethod: args.paymentMethod,
      transactionId: transactionId,
      venmoUsername: args.paymentMethod === "Venmo" ? args.venmoUsername : undefined,
      venmoTransactionId: args.paymentMethod === "Venmo" ? args.venmoTransactionId : undefined,
      checkNumber: args.paymentMethod === "Check" ? args.checkNumber : undefined,
      verificationStatus: "Verified", // Immediately verified since admin recorded it
      feeId: linkedFeeId,
      fineId: linkedFineId,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    // Update all unpaid fees for this user to "Paid" status
    if (feesToUpdate.length > 0) {
      for (const fee of feesToUpdate) {
        await ctx.db.patch(fee._id, {
          status: "Paid",
          updatedAt: now,
        });
      }
    } else if (args.feeId) {
      // Update the specific fee if provided
      await ctx.db.patch(args.feeId, {
        status: "Paid",
        updatedAt: now,
      });
    }

    // Update all unpaid fines for this user to "Paid" status
    if (finesToUpdate.length > 0) {
      for (const fine of finesToUpdate) {
        await ctx.db.patch(fine._id, {
          status: "Paid",
          updatedAt: now,
        });
      }
    } else if (args.fineId) {
      // Update the specific fine if provided
      await ctx.db.patch(args.fineId, {
        status: "Paid",
        updatedAt: now,
      });
    }

    const feesUpdated = feesToUpdate.length || (args.feeId ? 1 : 0);
    const finesUpdated = finesToUpdate.length || (args.fineId ? 1 : 0);

    return {
      success: true,
      paymentId: paymentId,
      message: `${args.paymentMethod} payment of $${args.amount.toFixed(2)} recorded successfully. Updated ${feesUpdated} fee(s) and ${finesUpdated} fine(s) to Paid.`,
    };
  },
});

// Get user payment history
export const getUserPayments = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get all payments (admin only)
export const getAllPayments = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("payments")
      .order("desc")
      .collect();
  },
});

// Get payment by transaction ID
export const getPaymentByTransactionId = query({
  args: { transactionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_transaction", (q) => q.eq("transactionId", args.transactionId))
      .first();
  },
});

// Get pending Venmo payments (admin only) - payments awaiting verification
export const getPendingVenmoPayments = query({
  args: {},
  handler: async (ctx) => {
    const payments = await ctx.db
      .query("payments")
      .filter((q) => 
        q.and(
          q.eq(q.field("paymentMethod"), "Venmo"),
          q.or(
            q.eq(q.field("verificationStatus"), "Pending"),
            q.eq(q.field("verificationStatus"), undefined)
          )
        )
      )
      .order("desc")
      .collect();

    // Return receipt image storage IDs (frontend will resolve URLs)
    const paymentsWithReceiptImages = payments.map((payment) => {
      // If it's already a URL (legacy data), keep it, otherwise return storage ID
      const receiptImage = payment.receiptImage?.startsWith('http') 
        ? payment.receiptImage 
        : payment.receiptImage || null;
      
      return {
        ...payment,
        receiptImage,
      };
    });

    return paymentsWithReceiptImages;
  },
});

// Get recent payments (admin only) - cost-efficient query with limit
export const getRecentPayments = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    
    // Get payments ordered by creation date (most recent first) with limit
    // Using take() is more efficient than collecting all and slicing
    const recentPayments = await ctx.db
      .query("payments")
      .order("desc")
      .take(limit);
    
    return recentPayments;
  },
});

// Correct existing verified payment amount (admin only)
// Use this to fix payments that were verified with incorrect amounts
export const correctPaymentAmount = mutation({
  args: {
    paymentId: v.id("payments"),
    correctedAmount: v.number(),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);

    if (!payment) {
      throw new Error(`Payment not found`);
    }

    if (args.correctedAmount <= 0) {
      throw new Error(`Corrected amount must be greater than 0`);
    }

    const oldAmount = payment.amount;
    const correctedAmount = args.correctedAmount;

    // Build admin notes with correction information
    let finalAdminNotes = args.adminNotes?.trim() || '';
    const correctionNote = `[CORRECTED] Amount changed from $${oldAmount.toFixed(2)} to $${correctedAmount.toFixed(2)}.`;
    finalAdminNotes = finalAdminNotes 
      ? `${correctionNote}\n\n${finalAdminNotes}`
      : correctionNote;

    // Update payment amount and admin notes
    await ctx.db.patch(payment._id, {
      amount: correctedAmount,
      adminNotes: finalAdminNotes,
      updatedAt: Date.now(),
    });

    // Recalculate fee/fine status based on corrected amount
    if (payment.feeId) {
      const fee = await ctx.db.get(payment.feeId);
      if (fee) {
        // Only mark fee as "Paid" if corrected payment amount >= fee amount
        if (correctedAmount >= fee.amount) {
          await ctx.db.patch(payment.feeId, {
            status: "Paid",
            updatedAt: Date.now(),
          });
        } else {
          // Explicitly ensure fee stays "Pending" for partial payments
          await ctx.db.patch(payment.feeId, {
            status: "Pending",
            updatedAt: Date.now(),
          });
        }
      }
    }
    
    // Recalculate fine status based on corrected amount
    if (payment.fineId) {
      const fine = await ctx.db.get(payment.fineId);
      if (fine) {
        // Only mark fine as "Paid" if corrected payment amount >= fine amount
        if (correctedAmount >= fine.amount) {
          await ctx.db.patch(payment.fineId, {
            status: "Paid",
            updatedAt: Date.now(),
          });
        } else {
          // Explicitly ensure fine stays "Pending" for partial payments
          await ctx.db.patch(payment.fineId, {
            status: "Pending",
            updatedAt: Date.now(),
          });
        }
      }
    }

    // Update payment status based on whether it fully covers the fee/fine
    let newPaymentStatus: "Paid" | "Pending" = "Paid";
    if (payment.feeId) {
      const fee = await ctx.db.get(payment.feeId);
      if (fee && correctedAmount < fee.amount) {
        newPaymentStatus = "Pending";
      }
    } else if (payment.fineId) {
      const fine = await ctx.db.get(payment.fineId);
      if (fine && correctedAmount < fine.amount) {
        newPaymentStatus = "Pending";
      }
    }

    // Update payment status if needed
    if (payment.status !== newPaymentStatus) {
      await ctx.db.patch(payment._id, {
        status: newPaymentStatus,
        updatedAt: Date.now(),
      });
    }

    // Create notification for user about payment correction (includes push)
    const isPartialPayment = newPaymentStatus === "Pending";
    
    await ctx.runMutation(api.notifications.createNotificationForUsers, {
      userIds: [payment.userId],
      type: "payment_pending",
      title: "📝 Payment Amount Corrected",
      body: isPartialPayment
        ? `Your payment amount has been corrected to $${correctedAmount.toFixed(2)}. This is a partial payment, so your fee remains Pending.`
        : `Your payment amount has been corrected to $${correctedAmount.toFixed(2)} and your fee has been marked as Paid.`,
      data: {
        paymentId: payment._id,
        amount: correctedAmount,
        feeType: payment.feeType,
        oldAmount: oldAmount,
        correctionNote: correctionNote,
      },
    });

    return {
      success: true,
      paymentId: payment._id,
      oldAmount: oldAmount,
      correctedAmount: correctedAmount,
      newPaymentStatus: newPaymentStatus,
      message: `Payment amount corrected from $${oldAmount.toFixed(2)} to $${correctedAmount.toFixed(2)}. Fee status updated accordingly.`,
    };
  },
});



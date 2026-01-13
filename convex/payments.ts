import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);

    if (!payment) {
      throw new Error(`Payment not found`);
    }

    // Update payment status and verification status
    await ctx.db.patch(payment._id, {
      status: args.status,
      verificationStatus: args.verificationStatus,
      adminNotes: args.adminNotes,
      updatedAt: Date.now(),
    });

    // If payment is successful, update the associated fee or fine
    if (args.status === "Paid") {
      if (payment.feeId) {
        await ctx.db.patch(payment.feeId, {
          status: "Paid",
          updatedAt: Date.now(),
        });
      }
      
      if (payment.fineId) {
        await ctx.db.patch(payment.fineId, {
          status: "Paid",
          updatedAt: Date.now(),
        });
      }
    }

    // Create notification for user about payment verification status
    const now = Date.now();
    const notificationTitle = args.verificationStatus === "Verified"
      ? "✅ Payment Verified"
      : "❌ Payment Rejected";
    const notificationBody = args.verificationStatus === "Verified"
      ? `Your payment of $${payment.amount.toFixed(2)} for ${payment.feeType} has been verified and marked as paid.`
      : `Your payment of $${payment.amount.toFixed(2)} for ${payment.feeType} was rejected.${args.adminNotes ? ` Reason: ${args.adminNotes}` : ''}`;

    await ctx.db.insert("userNotifications", {
      userId: payment.userId,
      type: "payment_pending",
      title: notificationTitle,
      body: notificationBody,
      data: {
        paymentId: payment._id,
        amount: payment.amount,
        feeType: payment.feeType,
        verificationStatus: args.verificationStatus,
        adminNotes: args.adminNotes,
      },
      isRead: false,
      createdAt: now,
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
    paymentMethod: v.union(v.literal("Check"), v.literal("Cash")),
    paymentDate: v.string(),
    checkNumber: v.optional(v.string()), // For check payments
    notes: v.optional(v.string()), // Admin notes
    feeId: v.optional(v.id("fees")),
    fineId: v.optional(v.id("fines")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Generate a transaction ID based on payment method
    const transactionId = args.paymentMethod === "Check"
      ? `CHK-${Date.now()}-${args.checkNumber || 'manual'}`
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
      venmoUsername: undefined, // Not applicable for check/cash
      venmoTransactionId: undefined, // Not applicable for check/cash
      checkNumber: args.checkNumber, // For check payments
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

    // Resolve receipt image URLs server-side
    const paymentsWithReceiptUrls = await Promise.all(payments.map(async (payment) => {
      let receiptImageUrl = null;
      if (payment.receiptImage) {
        try {
          // Check if it's already a URL
          if (payment.receiptImage.startsWith('http')) {
            receiptImageUrl = payment.receiptImage;
          } else {
            // Cast to storage ID type and resolve
            receiptImageUrl = await ctx.storage.getUrl(payment.receiptImage as any);
          }
        } catch (error) {
          console.log(`Failed to resolve receipt image URL for payment ${payment._id}:`, error);
        }
      }
      return {
        ...payment,
        receiptImageUrl,
      };
    }));

    return paymentsWithReceiptUrls;
  },
});



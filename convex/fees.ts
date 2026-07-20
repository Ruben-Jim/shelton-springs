import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("fees").order("desc").collect();
  },
});

// Get paginated fees
export const getPaginated = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;
    
    // Get total count
    const allFees = await ctx.db.query("fees").order("desc").collect();
    const total = allFees.length;
    
    // Get paginated fees
    const fees = allFees.slice(offset, offset + limit);
    
    return {
      items: fees,
      total,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    amount: v.number(),
    frequency: v.union(
      v.literal("Monthly"),
      v.literal("Quarterly"),
      v.literal("Annually"),
      v.literal("One-time")
    ),
    dueDate: v.string(),
    description: v.string(),
    isLate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("fees", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    id: v.id("fees"),
    name: v.optional(v.string()),
    amount: v.optional(v.number()),
    frequency: v.optional(
      v.union(
        v.literal("Monthly"),
        v.literal("Quarterly"),
        v.literal("Annually"),
        v.literal("One-time")
      )
    ),
    dueDate: v.optional(v.string()),
    description: v.optional(v.string()),
    isLate: v.optional(v.boolean()),
    status: v.optional(
      v.union(
        v.literal("Pending"),
        v.literal("Partial"),
        v.literal("Paid"),
        v.literal("Overdue")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const fee = await ctx.db.get(id);
    
    if (!fee) {
      throw new Error(`Fee with ID ${id} not found`);
    }
    
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("fees") },
  handler: async (ctx, args) => {
    const fee = await ctx.db.get(args.id);
    if (!fee) {
      throw new Error(`Fee with ID ${args.id} not found`);
    }

    const linkedPayments = await ctx.db
      .query("payments")
      .filter((q) => q.eq(q.field("feeId"), args.id))
      .collect();

    const now = Date.now();
    for (const payment of linkedPayments) {
      await ctx.db.patch(payment._id, {
        feeId: undefined,
        updatedAt: now,
      });
    }

    await ctx.db.delete(args.id);

    return {
      success: true,
      unlinkedPaymentCount: linkedPayments.length,
    };
  },
});

// Get user-specific fees based on their status
export const getUserFees = query({
  args: { 
    userId: v.string(),
    userType: v.string(), // 'resident', 'renter', 'board-member'
    hasPaid: v.boolean()
  },
  handler: async (ctx, args) => {
    // Generate dynamic fees based on user status
    const currentYear = new Date().getFullYear();
    const currentDate = new Date();
    
    // Base fee structure for residents/homeowners
    let userFees = [];
    
    // Only homeowners (isResident = true and not renters) get annual fees
    if (args.userType === 'homeowner' || args.userType === 'board-member') {
      // Annual HOA Fee - $300 for homeowners
      userFees.push({
        _id: `annual-fee-${args.userId}`,
        name: 'Annual HOA Fee',
        amount: 300,
        frequency: 'Annually',
        dueDate: `${currentYear}-12-31`,
        description: 'Annual HOA assessment for community maintenance and services',
        isLate: !args.hasPaid && new Date() > new Date(`${currentYear}-12-31`),
        status: args.hasPaid ? 'Paid' : 'Pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    
    return userFees;
  },
});

// Create a fee payment record
export const recordPayment = mutation({
  args: {
    userId: v.string(),
    feeType: v.string(),
    amount: v.number(),
    paymentDate: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("payments", {
      userId: args.userId,
      feeType: args.feeType,
      amount: args.amount,
      paymentDate: args.paymentDate,
      status: 'Paid',
      paymentMethod: 'Venmo', // Default to Venmo for legacy payments
      transactionId: `legacy-${now}`, // Legacy payment without Venmo transaction
      createdAt: now,
      updatedAt: now,
    });
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

// Check if user has paid annual fee for current year
export const hasPaidAnnualFee = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const currentYear = new Date().getFullYear();
    // If there are any unpaid fines, the user is not fully paid
    const unpaidFines = await ctx.db
      .query("fines")
      .filter((q) =>
        q.and(
          q.eq(q.field("residentId"), args.userId),
          q.neq(q.field("status"), "Paid")
        )
      )
      .collect();
    if (unpaidFines.length > 0) return false;

    // Get user's address to check fees by address (for households)
    const residentId = args.userId as Id<"residents">;
    const user = await ctx.db.get(residentId);
    const addressKey = user
      ? `${user.address}${user.unitNumber ? ` Unit ${user.unitNumber}` : ''}`
      : null;

    // Prefer explicit fee records when present (check by address first, then userId)
    let userAnnualFees = addressKey
      ? await ctx.db
          .query("fees")
          .filter((q) =>
            q.and(
              q.eq(q.field("address"), addressKey),
              q.eq(q.field("frequency"), "Annually"),
              q.eq(q.field("year"), currentYear)
            )
          )
          .collect()
      : [];

    // Fall back to userId if no address-based fees found (backward compatibility)
    if (userAnnualFees.length === 0) {
      userAnnualFees = await ctx.db
        .query("fees")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.userId),
            q.eq(q.field("frequency"), "Annually"),
            q.eq(q.field("year"), currentYear)
          )
        )
        .collect();
    }

    if (userAnnualFees.length > 0) {
      // User is fully paid only if all annual fees for the year are Paid
      const allAnnualFeesPaid = userAnnualFees.every((fee) => fee.status === "Paid");
      return allAnnualFeesPaid;
    }

    // Fallback to payment records
    // Check if user has any verified paid payments for this year that cover their fees
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const verifiedPaidPayments = payments.filter((payment) => {
      // Payment must have status "Paid" AND verificationStatus "Verified"
      const isPaid = payment.status === "Paid";
      const isVerified = payment.verificationStatus === "Verified";
      return isPaid && isVerified;
    });

    // Check if all fees for the user are covered by verified payments
    // Check fees by address first, then userId
    let userFees = addressKey
      ? await ctx.db
          .query("fees")
          .filter((q) => q.eq(q.field("address"), addressKey))
          .collect()
      : [];
    
    if (userFees.length === 0) {
      userFees = await ctx.db
        .query("fees")
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .collect();
    }

    // If user has fees, check if all are paid via verified payments
    if (userFees.length > 0) {
      const allFeesCovered = userFees.every((fee) => 
        verifiedPaidPayments.some((payment) => 
          payment.feeId === fee._id && payment.status === "Paid" && payment.verificationStatus === "Verified"
        )
      );
      return allFeesCovered;
    }

    // If no fees exist, check if there's any verified payment for the current year
    const hasAnyVerifiedPayment = verifiedPaidPayments.some((payment) => {
      const paymentYear = new Date(payment.paymentDate).getFullYear();
      return paymentYear === currentYear;
    });

    return hasAnyVerifiedPayment;
  },
});

// Get all homeowners' payment status for admin view (excludes renters)
export const getAllHomeownersPaymentStatus = query({
  args: {},
  handler: async (ctx) => {
    // First check if there are any fees in the system
    const allFees = await ctx.db.query("fees").collect();
    
    // If no fees exist, return empty array
    if (allFees.length === 0) {
      return [];
    }
    
    const residents = await ctx.db.query("residents").collect();
    const currentYear = new Date().getFullYear();
    
    // Filter to only include homeowners (isResident = true and not renters)
    const homeowners = residents.filter(resident => resident.isResident && !resident.isRenter);
    
    // Build address key for each homeowner
    const addressKeyMap = new Map<string, string>();
    for (const homeowner of homeowners) {
      const addressKey = `${homeowner.address}${homeowner.unitNumber ? ` Unit ${homeowner.unitNumber}` : ''}`;
      addressKeyMap.set(homeowner._id, addressKey);
    }
    
    // Get all homeowners at each address
    const homeownersByAddress = new Map<string, typeof homeowners>();
    for (const homeowner of homeowners) {
      const addressKey = addressKeyMap.get(homeowner._id)!;
      if (!homeownersByAddress.has(addressKey)) {
        homeownersByAddress.set(addressKey, []);
      }
      homeownersByAddress.get(addressKey)!.push(homeowner);
    }
    
    const homeownersWithPaymentStatus = await Promise.all(
      homeowners.map(async (homeowner) => {
        // Determine paid status based on unpaid items (fees + fines)
        const unpaidFines = await ctx.db
          .query("fines")
          .filter((q) =>
            q.and(
              q.eq(q.field("residentId"), homeowner._id),
              q.neq(q.field("status"), "Paid")
            )
          )
          .collect();

        // Get address key for this homeowner
        const addressKey = addressKeyMap.get(homeowner._id)!;
        
        // Find fees by address (for households with multiple residents)
        const addressAnnualFees = allFees.filter(
          (fee) =>
            fee.address === addressKey &&
            fee.year === currentYear &&
            fee.frequency === "Annually"
        );

        // If no address-based fees, fall back to userId (for backward compatibility)
        const userAnnualFees = addressAnnualFees.length === 0
          ? allFees.filter(
              (fee) =>
                fee.userId === homeowner._id &&
                fee.year === currentYear &&
                fee.frequency === "Annually"
            )
          : addressAnnualFees;

        // If there are explicit annual fee records, require all to be Paid
        let hasPaid = false;
        if (userAnnualFees.length > 0) {
          const allAnnualFeesPaid = userAnnualFees.every((fee) => fee.status === "Paid");
          hasPaid = allAnnualFeesPaid && unpaidFines.length === 0;
        } else {
          // Fallback to payment records
          // Get all homeowners at this address to check their payments
          const homeownersAtAddress = homeownersByAddress.get(addressKey) || [homeowner];
          const homeownerIdsAtAddress = homeownersAtAddress.map(h => h._id);
          
          // Check payments from any homeowner at this address
          const allPayments = await Promise.all(
            homeownerIdsAtAddress.map(userId =>
              ctx.db
                .query("payments")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .collect()
            )
          );
          const payments = allPayments.flat();
          
          const verifiedPaidPayments = payments.filter((payment) => {
            // Payment must have status "Paid" AND verificationStatus "Verified"
            // Do NOT count rejected or pending payments
            const isPaid = payment.status === "Paid";
            const isVerified = payment.verificationStatus === "Verified";
            // Exclude payments that are rejected
            const isNotRejected = payment.verificationStatus !== "Rejected";
            return isPaid && isVerified && isNotRejected;
          });
          const hasPaidViaPaymentRecord = verifiedPaidPayments.some((payment) => {
            const paymentYear = new Date(payment.paymentDate).getFullYear();
            const isAnnualFee = typeof payment.feeType === "string" && payment.feeType.startsWith("Annual HOA Fee");
            return paymentYear === currentYear && isAnnualFee;
          });
          hasPaid = hasPaidViaPaymentRecord && unpaidFines.length === 0;
        }
        
        // Find the annual fee for this address (or fall back to userId)
        const homeownerFee = addressAnnualFees.length > 0
          ? addressAnnualFees[0]
          : allFees.find(fee => 
              fee.userId === homeowner._id && 
              fee.year === currentYear &&
              fee.frequency === "Annually"
            );
        
        // Determine user type
        let userType = 'homeowner';
        if (homeowner.isBoardMember) userType = 'board-member';
        
        return {
          ...homeowner,
          userType,
          hasPaidAnnualFee: hasPaid,
          paymentStatus: hasPaid ? 'Paid' : 'Pending',
          annualFeeAmount: homeownerFee?.amount || 300, // Use actual fee amount or default to 300
        };
      })
    );
    
    return homeownersWithPaymentStatus;
  },
});

// Create annual fees for all homeowners for a specific year
export const createYearFeesForAllHomeowners = mutation({
  args: {
    year: v.number(),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const residents = await ctx.db.query("residents").collect();
    
    // Filter to only include homeowners (isResident = true and not renters)
    const homeowners = residents.filter(resident => resident.isResident && !resident.isRenter);
    
    // Group homeowners by address (including unit number)
    const addressMap = new Map<string, typeof homeowners>();
    for (const homeowner of homeowners) {
      // Create address key: address + unitNumber (if present)
      const addressKey = `${homeowner.address}${homeowner.unitNumber ? ` Unit ${homeowner.unitNumber}` : ''}`;
      
      if (!addressMap.has(addressKey)) {
        addressMap.set(addressKey, []);
      }
      addressMap.get(addressKey)!.push(homeowner);
    }
    
    // Check for existing fees for this year to avoid duplicates
    const existingFees = await ctx.db
      .query("fees")
      .filter((q) =>
        q.and(
          q.eq(q.field("frequency"), "Annually"),
          q.eq(q.field("year"), args.year)
        )
      )
      .collect();
    
    const existingAddresses = new Set(
      existingFees
        .filter(fee => fee.address)
        .map(fee => fee.address!)
    );
    const existingUserIds = new Set(
      existingFees
        .filter(fee => fee.userId)
        .map(fee => String(fee.userId))
    );
    
    const now = Date.now();
    const feeRecords = [];
    const notifiedHomeownerIds: string[] = [];

    // Create one fee record per unique address
    for (const [addressKey, homeownersAtAddress] of addressMap.entries()) {
      // Skip if fee already exists for this address and year.
      // Also skip when a legacy userId-based annual fee already exists
      // for any homeowner at this address (backward compatibility guard).
      const hasLegacyUserFeeAtAddress = homeownersAtAddress.some((homeowner) =>
        existingUserIds.has(String(homeowner._id))
      );
      if (existingAddresses.has(addressKey) || hasLegacyUserFeeAtAddress) {
        continue;
      }
      
      // Use the first homeowner's ID for backward compatibility
      const primaryHomeownerId = homeownersAtAddress[0]._id;
      
      const feeRecord = await ctx.db.insert("fees", {
        name: `${args.description} ${args.year}`,
        amount: args.amount,
        frequency: "Annually",
        dueDate: `${args.year}-12-31`,
        description: args.description,
        isLate: false, // Initially not late
        userId: primaryHomeownerId, // Link to primary homeowner for backward compatibility
        address: addressKey, // Store address to group fees by household
        year: args.year,
        createdAt: now,
        updatedAt: now,
      });
      
      feeRecords.push(feeRecord);
      notifiedHomeownerIds.push(primaryHomeownerId.toString());
    }

    // Notify all affected homeowners of new annual fees (triggers push notifications)
    if (notifiedHomeownerIds.length > 0) {
      const dueDate = `${args.year}-12-31`;
      await ctx.runMutation(api.notifications.createNotificationForUsers, {
        userIds: notifiedHomeownerIds,
        type: "fee",
        title: "New Annual Fee",
        body: `${args.description} ${args.year} - $${args.amount.toFixed(2)} (Due: ${dueDate})`,
        data: {
          year: args.year,
          amount: args.amount,
          description: args.description,
          dueDate,
        },
      });
    }
    
    return {
      success: true,
      feesCreated: feeRecords.length,
      message: `Created ${feeRecords.length} annual fees for year ${args.year} (grouped by address)`,
    };
  },
});

/** Add one annual fee row for a single property (admin full-record / manual catch-up). */
export const createAnnualFeeForAddress = mutation({
  args: {
    year: v.number(),
    amount: v.number(),
    description: v.string(),
    addressKey: v.string(),
    primaryResidentId: v.id("residents"),
  },
  handler: async (ctx, args) => {
    const existingFees = await ctx.db
      .query("fees")
      .filter((q) =>
        q.and(
          q.eq(q.field("frequency"), "Annually"),
          q.eq(q.field("year"), args.year)
        )
      )
      .collect();

    if (existingFees.some((f) => f.address === args.addressKey)) {
      throw new Error(
        `An annual fee for ${args.year} already exists for this address.`
      );
    }

    const existingUserIds = new Set(
      existingFees.filter((fee) => fee.userId).map((fee) => String(fee.userId))
    );
    if (existingUserIds.has(String(args.primaryResidentId))) {
      throw new Error(
        `This resident already has an annual fee record for ${args.year}.`
      );
    }

    const now = Date.now();
    const dueDate = `${args.year}-12-31`;
    const feeId = await ctx.db.insert("fees", {
      name: `${args.description} ${args.year}`,
      amount: args.amount,
      frequency: "Annually",
      dueDate,
      description: args.description,
      isLate: false,
      userId: args.primaryResidentId,
      address: args.addressKey,
      year: args.year,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(api.notifications.createNotificationForUsers, {
      userIds: [args.primaryResidentId.toString()],
      type: "fee",
      title: "New Annual Fee",
      body: `${args.description} ${args.year} - $${args.amount.toFixed(2)} (Due: ${dueDate})`,
      data: {
        year: args.year,
        amount: args.amount,
        description: args.description,
        dueDate,
      },
    });

    return {
      success: true,
      feeId,
      message: `Annual fee for ${args.year} added for this address.`,
    };
  },
});

/**
 * Create the year's annual HOA fee for a homeowner if missing (new signups / role changes).
 * Defaults: current calendar year, $300, "Annual HOA Fee".
 */
export const ensureAnnualFeeForHomeowner = mutation({
  args: {
    residentId: v.id("residents"),
    year: v.optional(v.number()),
    amount: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resident = await ctx.db.get(args.residentId);
    if (!resident || !resident.isResident || resident.isRenter) {
      return { created: false, reason: "not_homeowner" as const };
    }

    const year = args.year ?? new Date().getFullYear();
    const amount = args.amount ?? 300;
    const description = args.description ?? "Annual HOA Fee";
    const addressKey = `${resident.address}${resident.unitNumber ? ` Unit ${resident.unitNumber}` : ""}`;

    const annualForYear = await ctx.db
      .query("fees")
      .filter((q) =>
        q.and(
          q.eq(q.field("frequency"), "Annually"),
          q.eq(q.field("year"), year)
        )
      )
      .collect();

    const hasForAddress = annualForYear.some((f) => f.address === addressKey);
    const hasForUser = annualForYear.some(
      (f) => f.userId && String(f.userId) === String(resident._id)
    );
    if (hasForAddress || hasForUser) {
      return { created: false, reason: "already_exists" as const };
    }

    const now = Date.now();
    const dueDate = `${year}-12-31`;
    await ctx.db.insert("fees", {
      name: `${description} ${year}`,
      amount,
      frequency: "Annually",
      dueDate,
      description,
      isLate: false,
      userId: resident._id,
      address: addressKey,
      year,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(api.notifications.createNotificationForUsers, {
      userIds: [resident._id.toString()],
      type: "fee",
      title: "New Annual Fee",
      body: `${description} ${year} - $${amount.toFixed(2)} (Due: ${dueDate})`,
      data: { year, amount, description, dueDate },
    });

    return { created: true, reason: "inserted" as const };
  },
});

// Update all annual fees for a specific year
export const updateAllAnnualFees = mutation({
  args: {
    year: v.number(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const allFees = await ctx.db.query("fees").collect();
    
    // Filter to get all annual fees for the specified year that are not paid
    const annualFeesToUpdate = allFees.filter(
      (fee) =>
        fee.frequency === "Annually" &&
        fee.year === args.year &&
        fee.status !== "Paid"
    );
    
    const now = Date.now();
    let updatedCount = 0;
    
    // Update each fee
    for (const fee of annualFeesToUpdate) {
      await ctx.db.patch(fee._id, {
        amount: args.amount,
        updatedAt: now,
      });
      updatedCount++;
    }
    
    return {
      success: true,
      updatedCount: updatedCount,
      message: `Updated ${updatedCount} annual fee${updatedCount !== 1 ? 's' : ''} for year ${args.year} to $${args.amount.toFixed(2)}`,
    };
  },
});

// Add a fine to a specific property address
export const addFineToProperty = mutation({
  args: {
    address: v.string(),
    homeownerId: v.string(),
    amount: v.number(),
    reason: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Create the fine record in the fines table
    const fineRecord = await ctx.db.insert("fines", {
      violation: args.reason,
      amount: args.amount,
      dateIssued: new Date().toISOString().split('T')[0],
      status: "Pending",
      description: args.description || `Fine for ${args.reason}`,
      residentId: args.homeownerId,
      createdAt: now,
      updatedAt: now,
    });

    // Notify the homeowner of the new fine (triggers push notification)
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await ctx.runMutation(api.notifications.createNotificationForUsers, {
      userIds: [args.homeownerId],
      type: "fine",
      title: "New Fine",
      body: `Fine issued: ${args.reason} - $${args.amount.toFixed(2)} (Due: ${dueDate})`,
      data: {
        fineId: fineRecord,
        violation: args.reason,
        amount: args.amount,
        dueDate,
      },
    });
    
    return {
      success: true,
      fineId: fineRecord,
      message: `Fine of $${args.amount} added to ${args.address}`,
    };
  },
});

// Get all fines for admin view
export const getAllFines = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("fines")
      .order("desc")
      .collect();
  },
});

// Get fines for a specific homeowner
export const getFinesForHomeowner = query({
  args: { homeownerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("fines")
      .filter((q) => q.eq(q.field("residentId"), args.homeownerId))
      .order("desc")
      .collect();
  },
});

// Update fine status (mark as paid, etc.)
export const updateFineStatus = mutation({
  args: {
    fineId: v.id("fines"),
    status: v.union(
      v.literal("Paid"),
      v.literal("Pending"),
      v.literal("Partial"),
      v.literal("Overdue"),
    ),
  },
  handler: async (ctx, args) => {
    const fine = await ctx.db.get(args.fineId);
    
    if (!fine) {
      throw new Error(`Fine with ID ${args.fineId} not found`);
    }
    
    await ctx.db.patch(args.fineId, { 
      status: args.status,
      updatedAt: Date.now(),
    });
    
    return {
      success: true,
      message: `Fine status updated to ${args.status}`,
    };
  },
});

// Add past due amount to a resident
export const addPastDueAmount = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    description: v.string(),
    dueDate: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dueDateObj = new Date(args.dueDate);
    const isLate = dueDateObj < new Date();
    
    const feeRecord = await ctx.db.insert("fees", {
      name: `Past Due: ${args.description}`,
      amount: args.amount,
      frequency: "One-time",
      dueDate: args.dueDate,
      description: args.description,
      isLate: isLate,
      userId: args.userId,
      status: "Overdue",
      createdAt: now,
      updatedAt: now,
    });

    // Notify the homeowner that a past due amount was added
    await ctx.runMutation(api.notifications.createNotificationForUsers, {
      userIds: [args.userId],
      type: "fee",
      title: "Past Due Amount Added",
      body: `A past due amount of $${args.amount.toFixed(2)} has been added: ${args.description} (Due: ${args.dueDate})`,
      data: {
        feeId: feeRecord,
        amount: args.amount,
        description: args.description,
        dueDate: args.dueDate,
        isOverdue: true,
      },
    });
    
    return {
      success: true,
      feeId: feeRecord,
      message: `Past due amount of $${args.amount} added successfully`,
    };
  },
});

// Fix mismatched userId values in fee records
export const fixFeeUserIds = mutation({
  args: {},
  handler: async (ctx) => {
    const allFees = await ctx.db.query("fees").collect();
    const allResidents = await ctx.db.query("residents").collect();

    // Create a map of resident emails to IDs for quick lookup
    const residentEmailToId = new Map<string, string>();
    allResidents.forEach(resident => {
      if (resident.email) {
        residentEmailToId.set(resident.email.toLowerCase(), resident._id);
      }
    });

    let fixedCount = 0;
    let skippedCount = 0;

    for (const fee of allFees) {
      // Skip fees that already have valid userId
      if (fee.userId) {
        const residentExists = allResidents.some(r => r._id === fee.userId);
        if (residentExists) {
          continue; // This fee's userId is already correct
        }
      }

      // Try to find the correct resident ID
      let correctUserId: string | null = null;

      // If fee has an address field, try to match by address
      if (fee.address) {
        const residentByAddress = allResidents.find(r =>
          r.address && r.address.toLowerCase().includes(fee.address!.toLowerCase())
        );
        if (residentByAddress) {
          correctUserId = residentByAddress._id;
        }
      }

      // If still not found and fee has a name, try to match by name
      if (!correctUserId && fee.name) {
        // Extract potential names from fee name (e.g., "Annual HOA Fee 2025" -> try to match)
        const nameParts = fee.name.toLowerCase().split(' ');
        for (const resident of allResidents) {
          const residentName = `${resident.firstName} ${resident.lastName}`.toLowerCase();
          if (nameParts.some(part => residentName.includes(part))) {
            correctUserId = resident._id;
            break;
          }
        }
      }

      if (correctUserId) {
        await ctx.db.patch(fee._id, {
          userId: correctUserId,
          updatedAt: Date.now(),
        });
        fixedCount++;
      } else {
        console.log(`Could not fix fee ${fee._id} with name: ${fee.name}`);
        skippedCount++;
      }
    }

    return {
      success: true,
      fixedCount,
      skippedCount,
      message: `Fixed ${fixedCount} fee records. ${skippedCount} could not be matched.`,
    };
  },
});







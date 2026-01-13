import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all active resident notifications
export const getAllActive = query({
  args: {},
  handler: async (ctx) => {
    const notifications = await ctx.db
      .query("residentNotifications")
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("desc")
      .collect();
    
    // Batch fetch all unique resident IDs
    const residentIds = [...new Set(notifications.map(notification => notification.residentId))];
    
    // Fetch all residents in parallel
    const residents = await Promise.all(
      residentIds.map(id => ctx.db.get(id))
    );
    
    // Create a map for quick lookup by ID
    const residentsById = new Map();
    residents.forEach(resident => {
      if (resident) {
        residentsById.set(resident._id, resident);
      }
    });
    
    // Collect all storage IDs for batch resolution
    const allStorageIds: string[] = [];
    notifications.forEach((notification) => {
      const resident = residentsById.get(notification.residentId);
      if (resident?.profileImage) allStorageIds.push(resident.profileImage);
      if (notification.houseImage) allStorageIds.push(notification.houseImage);
    });

    // Resolve all URLs in batch
    const urlMap = new Map();
    await Promise.all(
      Array.from(new Set(allStorageIds)).map(async (id) => {
        try {
          const url = await ctx.storage.getUrl(id);
          if (url) urlMap.set(id, url);
        } catch (error) {
          console.log(`Failed to resolve URL for storage ID ${id}:`, error);
        }
      })
    );

    // Join with resident data using the map
    const notificationsWithResidentInfo = notifications.map((notification) => {
      const resident = residentsById.get(notification.residentId);
        return {
          ...notification,
          residentName: resident ? `${resident.firstName} ${resident.lastName}` : 'Unknown',
          residentAddress: resident
            ? `${resident.address}${resident.unitNumber ? ` #${resident.unitNumber}` : ''}`
            : '',
          profileImageUrl: resident?.profileImage ? urlMap.get(resident.profileImage) || null : null,
          houseImageUrl: notification.houseImage ? urlMap.get(notification.houseImage) || null : null,
        };
    });
    
    return notificationsWithResidentInfo;
  },
});

// Create a new resident notification
export const create = mutation({
  args: {
    residentId: v.id("residents"),
    createdBy: v.string(), // Email of the user creating the notification
    type: v.union(v.literal("Selling"), v.literal("Moving")),
    listingDate: v.optional(v.string()),
    closingDate: v.optional(v.string()),
    realtorInfo: v.optional(v.string()),
    newResidentName: v.optional(v.string()),
    isRental: v.optional(v.boolean()),
    additionalInfo: v.optional(v.string()),
    houseImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const notificationId = await ctx.db.insert("residentNotifications", {
      residentId: args.residentId,
      createdBy: args.createdBy,
      type: args.type,
      listingDate: args.listingDate,
      closingDate: args.closingDate,
      realtorInfo: args.realtorInfo,
      newResidentName: args.newResidentName,
      isRental: args.isRental,
      additionalInfo: args.additionalInfo,
      houseImage: args.houseImage,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return notificationId;
  },
});

// Update a resident notification
export const update = mutation({
  args: {
    id: v.id("residentNotifications"),
    updatedBy: v.string(), // Email of the user attempting to update
    listingDate: v.optional(v.string()),
    closingDate: v.optional(v.string()),
    realtorInfo: v.optional(v.string()),
    newResidentName: v.optional(v.string()),
    isRental: v.optional(v.boolean()),
    additionalInfo: v.optional(v.string()),
    houseImage: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, updatedBy, ...updates } = args;
    
    // Check if the notification exists and get the creator
    const notification = await ctx.db.get(id);
    if (!notification) {
      throw new Error("Notification not found");
    }
    
    // Only allow the creator to update the notification
    // If createdBy doesn't exist (old notifications), allow edit (backwards compatibility)
    if (notification.createdBy && notification.createdBy !== updatedBy) {
      throw new Error("You can only edit notifications that you created");
    }
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Delete/Deactivate a resident notification
export const remove = mutation({
  args: {
    id: v.id("residentNotifications"),
    deletedBy: v.string(), // Email of the user attempting to delete
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.id);
    if (!notification) {
      throw new Error("Notification not found");
    }
    
    // Only allow the creator to delete the notification
    // If createdBy doesn't exist (old notifications), allow delete (backwards compatibility)
    if (notification.createdBy && notification.createdBy !== args.deletedBy) {
      throw new Error("You can only delete notifications that you created");
    }
    
    // Delete the storage file associated with the house image
    if (notification.houseImage) {
      try {
        await ctx.storage.delete(notification.houseImage as any);
      } catch (error) {
        // Log but don't fail if storage deletion fails (file may not exist)
        console.log(`Failed to delete storage file ${notification.houseImage}:`, error);
      }
    }
    
    // Delete the notification record
    await ctx.db.delete(args.id);
    return args.id;
  },
});


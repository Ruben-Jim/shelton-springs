import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  boardMembers: defineTable({
    name: v.string(),
    position: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    image: v.optional(v.string()),
    termEnd: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  covenants: defineTable({
    title: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("Architecture"),
      v.literal("Landscaping"),
      v.literal("Minutes"),
      v.literal("Caveats"),
      v.literal("General")
    ),
    lastUpdated: v.string(),
    pdfUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_category", ["category"]),

  fees: defineTable({
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
    userId: v.optional(v.string()), // Link to homeowner
    year: v.optional(v.number()), // For annual fees
    address: v.optional(v.string()), // Property address for fines
    reason: v.optional(v.string()), // Reason for fine
    type: v.optional(v.string()), // 'Fee' or 'Fine'
    status: v.optional(v.union(
      v.literal("Pending"),
      v.literal("Paid"),
      v.literal("Overdue")
    )),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_type", ["type"]),

  fines: defineTable({
    violation: v.string(),
    amount: v.number(),
    dateIssued: v.string(),
    status: v.union(
      v.literal("Pending"),
      v.literal("Paid"),
      v.literal("Overdue")
    ),
    description: v.string(),
    residentId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  communityPosts: defineTable({
    author: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("General"),
      v.literal("Event"),
      v.literal("Complaint"),
      v.literal("Suggestion"),
      v.literal("Lost & Found")
    ),
    images: v.optional(v.array(v.string())), // Array of image URLs
    link: v.optional(v.string()), // Optional link URL
    likes: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_category", ["category"]),

  comments: defineTable({
    postId: v.id("communityPosts"),
    author: v.string(),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_post", ["postId"]),

  hoaInfo: defineTable({
    name: v.string(),
    address: v.string(),
    phone: v.string(),
    email: v.string(),
    website: v.optional(v.string()),
    officeHours: v.string(),
    emergencyContact: v.string(),
    eventText: v.optional(v.string()),
    ccrsPdfStorageId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  residents: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    address: v.string(),
    unitNumber: v.optional(v.string()),
    isResident: v.boolean(),
    isBoardMember: v.boolean(),
    isRenter: v.boolean(),
    isDev: v.optional(v.boolean()),
    isActive: v.boolean(),
    isBlocked: v.boolean(),
    blockReason: v.optional(v.string()),
    password: v.optional(v.string()), // In production, this should be hashed
    profileImage: v.optional(v.string()), // URL to profile image
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),

  payments: defineTable({
    userId: v.string(),
    feeType: v.string(),
    amount: v.number(),
    paymentDate: v.string(),
    status: v.union(
      v.literal("Pending"),
      v.literal("Paid"),
      v.literal("Overdue")
    ),
    paymentMethod: v.union(
      v.literal("Venmo"),
      v.literal("Check"),
      v.literal("Cash")
    ),
    transactionId: v.string(),             // Payment reference ID (Venmo transaction, check number, etc.)
    venmoUsername: v.optional(v.string()), // User's Venmo username (Venmo payments only)
    venmoTransactionId: v.optional(v.string()), // User-provided Venmo transaction ID (Venmo payments only)
    checkNumber: v.optional(v.string()),   // Check number (Check payments only)
    notes: v.optional(v.string()),         // Admin notes
    receiptImage: v.optional(v.string()),  // Storage ID for receipt screenshot
    adminNotes: v.optional(v.string()),   // Admin notes when verifying/rejecting
    verificationStatus: v.optional(v.union(
      v.literal("Pending"),
      v.literal("Verified"),
      v.literal("Rejected")
    )),
    feeId: v.optional(v.id("fees")),
    fineId: v.optional(v.id("fines")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_transaction", ["transactionId"]),

  polls: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    options: v.array(v.string()), // Array of poll options
    isActive: v.boolean(),
    allowMultipleVotes: v.boolean(),
    expiresAt: v.optional(v.number()), // Optional expiration timestamp
    createdBy: v.string(), // Admin/board member who created the poll
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active", ["isActive"]),

  residentNotifications: defineTable({
    residentId: v.id("residents"),
    createdBy: v.optional(v.string()), // Email of the user who created the notification
    type: v.union(
      v.literal("Selling"),
      v.literal("Moving")
    ),
    listingDate: v.optional(v.string()),
    closingDate: v.optional(v.string()),
    realtorInfo: v.optional(v.string()),
    newResidentName: v.optional(v.string()),
    isRental: v.optional(v.boolean()),
    additionalInfo: v.optional(v.string()),
    houseImage: v.optional(v.string()), // Storage ID for house image
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_resident", ["residentId"]),

  pollVotes: defineTable({
    pollId: v.id("polls"),
    userId: v.string(), // Resident ID who voted
    selectedOptions: v.array(v.number()), // Array of option indices
    createdAt: v.number(),
  }).index("by_poll", ["pollId"]).index("by_user", ["userId"]),

  pets: defineTable({
    residentId: v.id("residents"),
    name: v.string(),
    image: v.string(), // Storage ID for pet image
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_resident", ["residentId"]),

  documents: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    type: v.union(
      v.literal("Minutes"),
      v.literal("Financial")
    ),
    fileStorageId: v.string(), // Storage ID for document file (PDF, etc.)
    uploadedBy: v.string(), // User who uploaded the document
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_type", ["type"]),

  conversations: defineTable({
    participants: v.array(v.string()), // Array of participant user IDs
    createdBy: v.string(), // ID of board member who started conversation
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(), // User ID of sender
    senderName: v.string(), // Name of sender (for board: "Shelton Springs Board")
    senderRole: v.string(), // Role of sender (board/individual name)
    content: v.string(), // Message text
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  userNotifications: defineTable({
    userId: v.string(), // Recipient user ID
    type: v.string(), // Notification type (community_post, poll, payment_pending, etc.)
    title: v.string(), // Notification title
    body: v.string(), // Notification body
    data: v.optional(v.any()), // Additional notification data
    isRead: v.boolean(), // Whether user has seen/read the notification
    createdAt: v.number(), // Timestamp
  }).index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"]),
}); 
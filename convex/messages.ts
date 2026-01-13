import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all conversations for a user
export const getUserConversations = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get all conversations and filter by participant
    const allConversations = await ctx.db
      .query("conversations")
      .collect();

    const userConversations = allConversations.filter((conv) =>
      conv.participants.includes(args.userId)
    );

    // Get latest message for each conversation and participant info
    const conversationsWithDetails = await Promise.all(
      userConversations.map(async (conv) => {
        // Get latest message
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .take(1);

        const latestMessage = messages[0] || null;

        // Get participant info (excluding current user)
        const otherParticipantId = conv.participants.find(
          (id) => id !== args.userId
        );
        let otherParticipant = null;
        if (otherParticipantId) {
          // Try to find as resident
          const residents = await ctx.db
            .query("residents")
            .collect();
          otherParticipant = residents.find(
            (r) => r._id === otherParticipantId
          );
        }

        // Resolve profile image URL if exists
        let profileImageUrl = null;
        if (otherParticipant?.profileImage) {
          profileImageUrl = otherParticipant.profileImage.startsWith('http')
            ? otherParticipant.profileImage  // Already a URL, use directly
            : await ctx.storage.getUrl(otherParticipant.profileImage);  // Resolve storage ID
        }

        return {
          ...conv,
          latestMessage,
          otherParticipant: otherParticipant
            ? {
                id: otherParticipant._id,
                name: `${otherParticipant.firstName} ${otherParticipant.lastName}`,
                email: otherParticipant.email,
                profileImageUrl,
                isBoardMember: otherParticipant.isBoardMember,
              }
            : null,
        };
      })
    );

    // Sort by updatedAt descending
    return conversationsWithDetails.sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  },
});

// Get all messages in a conversation
export const getConversationMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();

    return messages;
  },
});

// Create a new conversation between board and user
export const createConversation = mutation({
  args: {
    boardMemberId: v.string(), // ID of board member creating conversation
    boardMemberName: v.string(), // Name of board member
    recipientId: v.string(), // ID of recipient user
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if conversation already exists
    const existingConversations = await ctx.db
      .query("conversations")
      .collect();

    const existing = existingConversations.find(
      (conv) =>
        conv.participants.includes(args.boardMemberId) &&
        conv.participants.includes(args.recipientId) &&
        conv.participants.length === 2
    );

    if (existing) {
      return existing._id;
    }

    // Create new conversation
    const conversationId = await ctx.db.insert("conversations", {
      participants: [args.boardMemberId, args.recipientId],
      createdBy: args.boardMemberId,
      createdAt: now,
      updatedAt: now,
    });

    return conversationId;
  },
});

// Send a message in a conversation
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.string(),
    senderName: v.string(), // For board: "Shelton Springs Board"
    senderRole: v.string(), // Individual board member name
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create message
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      senderName: args.senderName,
      senderRole: args.senderRole,
      content: args.content,
      createdAt: now,
    });

    // Update conversation updatedAt
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
    });

    return messageId;
  },
});

// Get unread count (for future use)
export const getUnreadCount = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get all conversations for user
    const allConversations = await ctx.db
      .query("conversations")
      .collect();

    const userConversations = allConversations.filter((conv) =>
      conv.participants.includes(args.userId)
    );

    // For now, return total conversations (can be enhanced with read tracking)
    return userConversations.length;
  },
});


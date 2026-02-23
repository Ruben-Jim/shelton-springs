import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Get all conversations for a user (ultra-optimized for free tier)
export const getUserConversations = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get all conversations efficiently (using index for faster sorting)
    const allConversations = await ctx.db
      .query("conversations")
      .withIndex("by_updated_at")
      .order("desc")
      .collect();

    // Filter conversations where user is a participant (client-side for now)
    const userConversations = allConversations.filter((conv) =>
      conv.participants.includes(args.userId)
    );

    // Early return if no conversations to avoid unnecessary work
    if (userConversations.length === 0) {
      return [];
    }

    // Get all residents once (single query for all conversations)
    const allResidents = await ctx.db.query("residents").collect();

    // Pre-fetch all latest messages in a single batch operation
    // Collect all conversation IDs first
    const conversationIds = userConversations.map(conv => conv._id);

    // Get latest message for each conversation in parallel
    const latestMessages = await Promise.all(
      conversationIds.map(async (conversationId) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
          .order("desc")
          .take(1);
        return { conversationId, message: messages[0] || null };
      })
    );

    // Create a map for fast message lookup
    const messageMap = new Map(
      latestMessages.map(({ conversationId, message }) => [conversationId, message])
    );

    // Build final result with optimized lookups
    const conversationsWithDetails = await Promise.all(userConversations.map(async (conv) => {
      const latestMessage = messageMap.get(conv._id) || null;

      // Find participant info using pre-fetched residents
      const otherParticipantId = conv.participants.find(
        (id) => id !== args.userId
      );

      const otherParticipant = otherParticipantId
        ? allResidents.find((r) => r._id === otherParticipantId)
        : null;

      // Return profile image storage ID (frontend will resolve URL)
      const profileImage = otherParticipant?.profileImage || null;

      return {
        ...conv,
        latestMessage,
        otherParticipant: otherParticipant
          ? {
              id: otherParticipant._id,
              name: `${otherParticipant.firstName} ${otherParticipant.lastName}`,
              email: otherParticipant.email,
              profileImage,
              isBoardMember: otherParticipant.isBoardMember,
            }
          : null,
      };
    }));

    // Already sorted by updatedAt due to index usage
    return conversationsWithDetails;
  },
});

// Get all messages in a conversation (optimized)
export const getConversationMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    // Use index and collect all messages efficiently
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();

    return messages;
  },
});

// Create a new conversation between board and user (optimized)
export const createConversation = mutation({
  args: {
    boardMemberId: v.string(), // ID of board member creating conversation
    boardMemberName: v.string(), // Name of board member
    recipientId: v.string(), // ID of recipient user
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if conversation already exists (still need to scan, but optimized logic)
    const allConversations = await ctx.db.query("conversations").collect();

    // Find existing conversation between these two participants
    const existing = allConversations.find(
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

    // Get conversation to find recipient
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;

    const recipientId = conversation.participants.find((id) => id !== args.senderId);

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

    // Create notification for recipient (triggers Expo push)
    if (recipientId) {
      const body = args.content.length > 50 ? `${args.content.substring(0, 50)}...` : args.content;
      await ctx.runMutation(api.notifications.createNotificationForUsers, {
        userIds: [recipientId],
        type: "message",
        title: `New Message from ${args.senderName}`,
        body,
        data: {
          senderName: args.senderName,
          senderId: args.senderId,
          conversationId: args.conversationId,
          content: args.content,
        },
      });
    }

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


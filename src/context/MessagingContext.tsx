import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from './AuthContext';
import { Id } from '../../convex/_generated/dataModel';

interface Conversation {
  _id: Id<"conversations">;
  participants: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  latestMessage?: {
    _id: Id<"messages">;
    conversationId: Id<"conversations">;
    senderId: string;
    senderName: string;
    senderRole: string;
    content: string;
    createdAt: number;
  } | null;
  otherParticipant?: {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
    isBoardMember: boolean;
  } | null;
}

interface Message {
  _id: Id<"messages">;
  conversationId: Id<"conversations">;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: number;
}

interface MessagingContextType {
  conversations: Conversation[];
  isLoading: boolean;
  openConversation: (conversationId: Id<"conversations"> | null) => void;
  activeConversationId: Id<"conversations"> | null;
  activeConversationMessages: Message[];
  sendMessage: (content: string) => Promise<void>;
  createConversationWithUser: (recipientId: string) => Promise<Id<"conversations"> | null>;
  hasUnreadMessages: boolean;
  latestMessagePreview: string | null;
  showOverlay: boolean;
  setShowOverlay: (show: boolean) => void;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<Id<"conversations"> | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  // Queries - only poll conversations when overlay is visible or for non-board members (to show unread indicator)
  // This reduces operations by ~400K/month for board members not actively using messaging
  const shouldQueryConversations = showOverlay || (!user?.isBoardMember && user);
  const conversations = useQuery(
    api.messages.getUserConversations,
    shouldQueryConversations && user ? { userId: user._id } : "skip"
  ) || [];

  const activeConversationMessages = useQuery(
    api.messages.getConversationMessages,
    activeConversationId ? { conversationId: activeConversationId } : "skip"
  ) || [];

  // Mutations
  const createConversation = useMutation(api.messages.createConversation);
  const sendMessageMutation = useMutation(api.messages.sendMessage);

  // Check for unread messages (for non-board users) - optimized to reduce re-computations
  const hasUnreadMessages = React.useMemo(() => {
    if (!user || user.isBoardMember) return false;
    // For now, consider any conversation as "unread" for non-board users
    // This could be enhanced with actual read tracking later
    return conversations.length > 0;
  }, [conversations.length, user]);

  // Get latest message preview for minimized bubble - optimized
  const latestMessagePreview = React.useMemo(() => {
    if (conversations.length === 0) return null;
    // Conversations are already sorted by updatedAt, so first one is latest
    const latestConv = conversations[0];
    return latestConv.latestMessage?.content || null;
  }, [conversations.length > 0 ? conversations[0]?.latestMessage?.content : null]);

  const openConversation = useCallback((conversationId: Id<"conversations"> | null) => {
    setActiveConversationId(conversationId);
  }, []);

  const createConversationWithUser = useCallback(async (recipientId: string): Promise<Id<"conversations"> | null> => {
    if (!user || !user.isBoardMember) return null;

    try {
      const conversationId = await createConversation({
        boardMemberId: user._id,
        boardMemberName: `${user.firstName} ${user.lastName}`,
        recipientId,
      });
      setActiveConversationId(conversationId);
      return conversationId;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  }, [user, createConversation]);

  const sendMessage = useCallback(async (content: string) => {
    if (!activeConversationId || !user || !content.trim()) return;

    try {
      const senderName = user.isBoardMember
        ? "Shelton Springs Board"
        : `${user.firstName} ${user.lastName}`;
      
      const senderRole = user.isBoardMember
        ? `${user.firstName} ${user.lastName}`
        : user.isRenter
        ? "Renter"
        : "Homeowner";

      await sendMessageMutation({
        conversationId: activeConversationId,
        senderId: user._id,
        senderName,
        senderRole,
        content: content.trim(),
      });

      // Note: For recipient notifications, remote push notifications would be needed
      // This local notification only works for the sender's device
      // In a production app, you'd want to send remote push notifications to the recipient
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [activeConversationId, user, sendMessageMutation]);

  // Note: New message notifications are created server-side in messages.sendMessage
  // and delivered via Expo Push (when app closed) or useUserNotifications (when app open)

  const value: MessagingContextType = {
    conversations,
    isLoading: conversations === undefined,
    openConversation,
    activeConversationId,
    activeConversationMessages,
    sendMessage,
    createConversationWithUser,
    hasUnreadMessages,
    latestMessagePreview,
    showOverlay,
    setShowOverlay,
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
};


import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../../convex/_generated/api';
import { useAuth } from './AuthContext';
import { Id } from '../../convex/_generated/dataModel';
import { useDemoQuery } from '../hooks/useDemoQuery';
import { useDemoMutation } from '../hooks/useDemoMutation';

interface Conversation {
  _id: Id<'conversations'>;
  participants: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  latestMessage?: {
    _id: Id<'messages'>;
    conversationId: Id<'conversations'>;
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
  _id: Id<'messages'>;
  conversationId: Id<'conversations'>;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: number;
}

interface MessagingContextType {
  conversations: Conversation[];
  isLoading: boolean;
  openConversation: (conversationId: Id<'conversations'> | null) => void;
  activeConversationId: Id<'conversations'> | null;
  activeConversationMessages: Message[];
  sendMessage: (content: string) => Promise<void>;
  createConversationWithUser: (recipientId: string) => Promise<Id<'conversations'> | null>;
  hasUnreadMessages: boolean;
  latestMessagePreview: string | null;
  showOverlay: boolean;
  setShowOverlay: (show: boolean) => void;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<Id<'conversations'> | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const shouldQueryConversations = showOverlay || (!user?.isBoardMember && user);

  const conversations =
    useDemoQuery(
      api.messages.getUserConversations,
      shouldQueryConversations && user ? { userId: user._id } : 'skip',
      (s, args) => s.conversationsByUserId[String(args.userId)] ?? []
    ) ?? [];

  const activeConversationMessages =
    useDemoQuery(
      api.messages.getConversationMessages,
      activeConversationId ? { conversationId: activeConversationId } : 'skip',
      (s, args) => s.messagesByConversationId[String(args.conversationId)] ?? []
    ) ?? [];

  const createConversation = useDemoMutation(api.messages.createConversation);
  const sendMessageMutation = useDemoMutation(api.messages.sendMessage);

  const hasUnreadMessages = React.useMemo(() => {
    if (!user || user.isBoardMember) return false;
    return conversations.length > 0;
  }, [conversations.length, user]);

  const latestMessagePreview = React.useMemo(() => {
    if (conversations.length === 0) return null;
    const latestConv = conversations[0];
    return latestConv.latestMessage?.content || null;
  }, [conversations.length > 0 ? conversations[0]?.latestMessage?.content : null]);

  const openConversation = useCallback((conversationId: Id<'conversations'> | null) => {
    setActiveConversationId(conversationId);
  }, []);

  const createConversationWithUser = useCallback(
    async (recipientId: string): Promise<Id<'conversations'> | null> => {
      if (!user || !user.isBoardMember) return null;

      try {
        const conversationId = (await createConversation({
          boardMemberId: user._id,
          boardMemberName: `${user.firstName} ${user.lastName}`,
          recipientId,
        })) as Id<'conversations'> | null;
        if (conversationId) {
          setActiveConversationId(conversationId);
        }
        return conversationId;
      } catch (error) {
        console.error('Error creating conversation:', error);
        return null;
      }
    },
    [user, createConversation]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId || !user || !content.trim()) return;

      try {
        const senderName = user.isBoardMember
          ? 'Shelton Springs Board'
          : `${user.firstName} ${user.lastName}`;

        const senderRole = user.isBoardMember
          ? `${user.firstName} ${user.lastName}`
          : user.isRenter
            ? 'Renter'
            : 'Homeowner';

        await sendMessageMutation({
          conversationId: activeConversationId,
          senderId: user._id,
          senderName,
          senderRole,
          content: content.trim(),
        });
      } catch (error) {
        console.error('Error sending message:', error);
        throw error;
      }
    },
    [activeConversationId, user, sendMessageMutation]
  );

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

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
};

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
};

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import ProfileImage from './ProfileImage';
import { Id } from '../../convex/_generated/dataModel';

interface MessagingOverlayProps {
  visible: boolean;
  onClose: () => void;
}

const MessagingOverlay: React.FC<MessagingOverlayProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const {
    conversations,
    activeConversationId,
    activeConversationMessages,
    openConversation,
    sendMessage,
    createConversationWithUser,
  } = useMessaging();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 1024;
  const isBoardMember = user?.isBoardMember && user?.isActive;

  const [messageText, setMessageText] = useState('');
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const messageInputRef = useRef<TextInput>(null);

  // Get all residents for board member to select from
  const allResidents = useQuery(api.residents.getAll) || [];

  // Animation values
  const slideAnim = useRef(new Animated.Value(isDesktop ? screenWidth : Dimensions.get('window').height)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: isDesktop ? screenWidth : Dimensions.get('window').height,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [visible, isDesktop, screenWidth]);

  // Auto-open conversation for non-board members when they have messages
  useEffect(() => {
    if (visible && !isBoardMember && conversations.length > 0 && !activeConversationId) {
      openConversation(conversations[0]._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isBoardMember, conversations.length, activeConversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (activeConversationMessages.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [activeConversationMessages.length]);

  // Handle keyboard show/hide for mobile
  useEffect(() => {
    if (isDesktop || Platform.OS === 'web') return;

    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        // Use negative value to move up (translateY moves down with positive values)
        Animated.timing(keyboardOffset, {
          toValue: -e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
          useNativeDriver: Platform.OS !== 'web',
        }).start(() => {
          // Scroll to bottom when keyboard appears
          if (scrollViewRef.current && activeConversationId) {
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        });
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        setKeyboardVisible(false);
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [keyboardOffset, isDesktop, activeConversationId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeConversationId) return;

    try {
      await sendMessage(messageText);
      setMessageText('');
      messageInputRef.current?.blur();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSelectUser = async (userId: string) => {
    const conversationId = await createConversationWithUser(userId);
    if (conversationId) {
      setShowUserSelector(false);
      setSearchQuery('');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredResidents = allResidents.filter((resident) => {
    if (resident._id === user?._id) return false;
    const fullName = `${resident.firstName} ${resident.lastName}`.toLowerCase();
    const email = resident.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  const currentConversation = conversations.find((c) => c._id === activeConversationId);
  const otherParticipant = currentConversation?.otherParticipant;

  // Add console log for debugging on iOS
  useEffect(() => {
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      hardwareAccelerated={Platform.OS === 'android'}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: opacityAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={isDesktop ? undefined : onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <Animated.View
          style={[
            styles.container,
            isDesktop ? styles.desktopContainer : styles.mobileContainer,
            {
              transform: isDesktop
                ? [{ translateX: slideAnim }]
                : [
                    { translateY: slideAnim },
                    { translateY: keyboardOffset },
                  ],
              maxHeight: isDesktop ? '80vh' : '90%',
              bottom: isDesktop ? 0 : 0,
              right: isDesktop ? 0 : undefined,
              paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
              ...(Platform.OS === 'ios' && {
                position: 'absolute' as any,
                left: 0,
                right: 0,
              }),
            },
          ]}
        >
          <SafeAreaView edges={['top']} style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {isBoardMember && !activeConversationId && (
                  <TouchableOpacity
                    style={styles.newMessageButton}
                    onPress={() => setShowUserSelector(true)}
                  >
                    <Ionicons name="add" size={20} color="#2563eb" />
                    <Text style={styles.newMessageText}>New Message</Text>
                  </TouchableOpacity>
                )}
                {activeConversationId && (
                  <>
                    {isBoardMember && (
                      <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => {
                          openConversation(null);
                          setShowUserSelector(false);
                        }}
                      >
                        <Ionicons name="arrow-back" size={24} color="#1f2937" />
                      </TouchableOpacity>
                    )}
                    {otherParticipant && isBoardMember && (
                      <View style={[styles.conversationHeader, styles.conversationHeaderCentered]}>
                        <ProfileImage
                          source={otherParticipant.profileImageUrl}
                          size={40}
                          initials={otherParticipant.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .substring(0, 2)}
                        />
                        <View style={[styles.conversationHeaderInfo, styles.conversationHeaderInfoCentered]}>
                          <Text style={styles.conversationHeaderName}>
                            {otherParticipant.name}
                          </Text>
                          <Text style={styles.conversationHeaderEmail}>
                            {otherParticipant.email}
                          </Text>
                        </View>
                      </View>
                    )}
                    {(!otherParticipant || !isBoardMember) && (
                      <View style={[styles.conversationHeader, !isBoardMember && styles.conversationHeaderCentered]}>
                        <View style={styles.boardIconContainer}>
                          <Ionicons name="shield" size={20} color="#2563eb" />
                        </View>
                        <View style={[styles.conversationHeaderInfo, !isBoardMember && styles.conversationHeaderInfoCentered]}>
                          <Text style={styles.conversationHeaderName}>
                            Shelton Springs Board
                          </Text>
                        </View>
                      </View>
                    )}
                  </>
                )}
                {!isBoardMember && !activeConversationId && (
                  <View style={[styles.conversationHeader, styles.conversationHeaderCentered]}>
                    <View style={styles.boardIconContainer}>
                      <Ionicons name="shield" size={20} color="#2563eb" />
                    </View>
                    <View style={[styles.conversationHeaderInfo, styles.conversationHeaderInfoCentered]}>
                      <Text style={styles.conversationHeaderName}>
                        Shelton Springs Board
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* User Selector (Board Members Only) */}
            {isBoardMember && showUserSelector && (
              <View style={styles.userSelector}>
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search users..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color="#6b7280" />
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={styles.userList}>
                  {filteredResidents.map((resident) => (
                    <TouchableOpacity
                      key={resident._id}
                      style={styles.userItem}
                      onPress={() => handleSelectUser(resident._id)}
                    >
                      <ProfileImage
                        source={resident.profileImageUrl}
                        size={48}
                        initials={`${resident.firstName[0]}${resident.lastName[0]}`}
                      />
                      <View style={styles.userItemInfo}>
                        <Text style={styles.userItemName}>
                          {resident.firstName} {resident.lastName}
                        </Text>
                        <Text style={styles.userItemEmail}>{resident.email}</Text>
                        <View style={styles.userItemBadges}>
                          {resident.isBoardMember && (
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>Board</Text>
                            </View>
                          )}
                          {resident.isRenter && (
                            <View style={[styles.badge, styles.renterBadge]}>
                              <Text style={styles.badgeText}>Renter</Text>
                            </View>
                          )}
                          {!resident.isRenter && resident.isResident && (
                            <View style={[styles.badge, styles.homeownerBadge]}>
                              <Text style={styles.badgeText}>Homeowner</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Conversation List (Board Members Only, when no active conversation) */}
            {isBoardMember && !activeConversationId && !showUserSelector && (
              <ScrollView style={styles.conversationList}>
                {conversations.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
                    <Text style={styles.emptyStateText}>No conversations yet</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Start a new conversation to message a user
                    </Text>
                  </View>
                ) : (
                  conversations.map((conversation) => {
                    const other = conversation.otherParticipant;
                    return (
                      <TouchableOpacity
                        key={conversation._id}
                        style={styles.conversationItem}
                        onPress={() => openConversation(conversation._id)}
                      >
                        <ProfileImage
                          source={other?.profileImageUrl}
                          size={48}
                          initials={
                            other
                              ? `${other.name.split(' ')[0][0]}${other.name.split(' ')[1]?.[0] || ''}`
                              : 'BS'
                          }
                        />
                        <View style={styles.conversationItemInfo}>
                          <View style={styles.conversationItemHeader}>
                            <Text style={styles.conversationItemName}>
                              {other?.name || 'Shelton Springs Board'}
                            </Text>
                            <Text style={styles.conversationItemTime}>
                              {formatTime(conversation.updatedAt)}
                            </Text>
                          </View>
                          <Text style={styles.conversationItemPreview} numberOfLines={1}>
                            {conversation.latestMessage?.content || 'No messages yet'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}

            {/* Messages View */}
            {activeConversationId && (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.messagesContainer}
                keyboardVerticalOffset={0}
                enabled={Platform.OS === 'ios'}
              >
                <ScrollView
                  ref={scrollViewRef}
                  style={styles.messagesList}
                  contentContainerStyle={styles.messagesContent}
                >
                  {activeConversationMessages.length === 0 ? (
                    <View style={styles.emptyMessages}>
                      <Text style={styles.emptyMessagesText}>
                        No messages yet. Start the conversation!
                      </Text>
                    </View>
                  ) : (
                    activeConversationMessages.map((message) => {
                      const isFromBoard = message.senderName === 'Shelton Springs Board';
                      const isCurrentUser = message.senderId === user?._id;

                      return (
                        <View
                          key={message._id}
                          style={[
                            styles.messageBubble,
                            isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft,
                          ]}
                        >
                          {!isCurrentUser && isBoardMember && (
                            <ProfileImage
                              source={
                                isFromBoard
                                  ? undefined
                                  : currentConversation?.otherParticipant?.profileImage
                              }
                              size={32}
                              initials={
                                isFromBoard
                                  ? 'BS'
                                  : currentConversation?.otherParticipant?.name
                                      .split(' ')
                                      .map((n) => n[0])
                                      .join('')
                                      .substring(0, 2) || 'U'
                              }
                              style={styles.messageAvatar}
                            />
                          )}
                          {isCurrentUser && isBoardMember && (
                            <ProfileImage
                              source={
                                user?.profileImageUrl
                              }
                              size={32}
                              initials={
                                user
                                  ? `${user.firstName[0]}${user.lastName[0]}`
                                  : 'U'
                              }
                              style={styles.messageAvatar}
                            />
                          )}
                          <View
                            style={[
                              styles.messageContent,
                              isCurrentUser ? styles.messageContentRight : styles.messageContentLeft,
                            ]}
                          >
                            {!isCurrentUser && (
                              <Text style={styles.messageSender}>
                                {isFromBoard ? 'Shelton Springs Board' : message.senderName}
                              </Text>
                            )}
                            {isFromBoard && !isCurrentUser && (
                              <Text style={styles.messageSenderRole}>
                                sent by {message.senderRole}
                              </Text>
                            )}
                            <Text
                              style={[
                                styles.messageText,
                                isCurrentUser ? styles.messageTextRight : styles.messageTextLeft,
                              ]}
                            >
                              {message.content}
                            </Text>
                            <Text
                              style={[
                                styles.messageTime,
                                isCurrentUser ? styles.messageTimeRight : styles.messageTimeLeft,
                              ]}
                            >
                              {formatTime(message.createdAt)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                {/* Message Input */}
                <View style={styles.inputContainer}>
                  <TextInput
                    ref={messageInputRef}
                    style={styles.input}
                    placeholder="Type a message..."
                    value={messageText}
                    onChangeText={setMessageText}
                    multiline
                    maxLength={1000}
                    onSubmitEditing={handleSendMessage}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      !messageText.trim() && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSendMessage}
                    disabled={!messageText.trim()}
                  >
                    <Ionicons
                      name="send"
                      size={20}
                      color={messageText.trim() ? '#ffffff' : '#9ca3af'}
                    />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            )}

          </SafeAreaView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }),
    ...(Platform.OS === 'ios' && {
      position: 'absolute' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }),
  },
  container: {
    backgroundColor: '#ffffff',
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      zIndex: 10000,
    }),
  },
  desktopContainer: {
    width: 400,
    maxWidth: '90vw',
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  mobileContainer: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    ...(Platform.OS === 'ios' && {
      position: 'absolute' as any,
      bottom: 0,
      left: 0,
      right: 0,
    }),
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  newMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  newMessageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  backButton: {
    padding: 4,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  boardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationHeaderInfo: {
    flex: 1,
  },
  conversationHeaderCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationHeaderInfoCentered: {
    alignItems: 'center',
  },
  conversationHeaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  conversationHeaderEmail: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
  },
  userSelector: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  userList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  userItemInfo: {
    flex: 1,
  },
  userItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  userItemEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  userItemBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f59e0b', // Board Member - matches AdminScreen
  },
  renterBadge: {
    backgroundColor: '#3b82f6', // Renter - matches AdminScreen
  },
  homeownerBadge: {
    backgroundColor: '#10b981', // Homeowner - matches AdminScreen
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  conversationList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  conversationItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  conversationItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  conversationItemTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  conversationItemPreview: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyMessagesText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  messageBubble: {
    marginBottom: 12,
    width: '100%',
  },
  messageBubbleLeft: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 8,
  },
  messageBubbleRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageAvatar: {
    marginTop: 4,
  },
  messageContent: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  messageContentLeft: {
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 4,
  },
  messageContentRight: {
    backgroundColor: '#2563eb',
    borderTopRightRadius: 4,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  messageSenderRole: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextLeft: {
    color: '#1f2937',
  },
  messageTextRight: {
    color: '#ffffff',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeLeft: {
    color: '#9ca3af',
  },
  messageTimeRight: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#374151',
    maxHeight: 100,
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none' as any,
    }),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  sendButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  autoOpenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  autoOpenButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  autoOpenText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default MessagingOverlay;


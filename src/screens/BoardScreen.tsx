import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
  ImageBackground,
  Dimensions,
  Animated,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

import { useAuth } from '../context/AuthContext';
import { useCachedResidents } from '../context/QueryCacheContext';
import BoardMemberIndicator from '../components/BoardMemberIndicator';
import DeveloperIndicator from '../components/DeveloperIndicator';
import { DesktopTabBarSlot, useDesktopTabBarScrollSync } from '../components/DesktopTabBarLayer';
import MobileTabBar from '../components/MobileTabBar';
import ProfileImage from '../components/ProfileImage';
import { getBoardMemberPhoto } from '../utils/boardMemberPhoto';
import MessagingButton from '../components/MessagingButton';
import { useMessaging } from '../context/MessagingContext';
import CovenantsContent from '../components/board/CovenantsContent';
import DocumentsContent from '../components/board/DocumentsContent';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { useScrollToTop } from '../hooks/useScrollToTop';
import {
  HERO_TAB_CONTAINER_STYLE,
  HERO_TAB_SAFE_AREA_EDGES,
  HERO_TAB_SAFE_AREA_STYLE,
} from '../hooks/useHeroHeaderPadding';
import TabHeroHeader from '../components/TabHeroHeader';

type BoardSubTab = 'board' | 'covenants' | 'documents';

const HOA_TAB_ACCENT = '#f97316';

const BoardScreen = () => {
  const { user } = useAuth();
  const route = useRoute();
  const { setShowOverlay } = useMessaging();
  const isBoardMember = user?.isBoardMember && user?.isActive;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<BoardSubTab>('board');
  
  // State for dynamic responsive behavior (only for web/desktop)
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Dynamic responsive check - show mobile nav when screen is too narrow for desktop nav
  // On mobile, always show mobile nav regardless of screen size
  const isMobileDevice = Platform.OS === 'ios' || Platform.OS === 'android';
  const showMobileNav = isMobileDevice || screenWidth < 1024; // Always mobile on mobile devices, responsive on web
  const showDesktopNav = !isMobileDevice && screenWidth >= 1024; // Only desktop nav on web when wide enough

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current; // Start at 1 to avoid white flash
  const membersAnim = useRef(new Animated.Value(0)).current;
  const infoAnim = useRef(new Animated.Value(0)).current;
  
  // ScrollView ref for better control
  const scrollViewRef = useRef<ScrollView>(null);
  const { showScrollToTop, scrollToTop, handleScroll: baseHandleScroll } = useScrollToTop(scrollViewRef);
  const syncDesktopTabBar = useDesktopTabBarScrollSync();
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      baseHandleScroll(event);
      syncDesktopTabBar();
    },
    [baseHandleScroll, syncDesktopTabBar]
  );
  
  const handleContact = (member: any, type: 'phone' | 'email') => {
    if (type === 'phone') {
      Linking.openURL(`tel:${member.phone}`);
    } else {
      Linking.openURL(`mailto:${member.email}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const members = useQuery(api.boardMembers.getAll) ?? [];
  const residents = useCachedResidents();
  const hoaInfo = useQuery(api.hoaInfo.get) ?? null;

  // Board page content — fall back to hardcoded defaults when not set by admin
  const boardMeetingsSchedule =
    hoaInfo?.boardMeetingsSchedule ?? 'Second Tuesday of each month at 7:00 PM';
  const boardMeetingsLocation =
    hoaInfo?.boardMeetingsLocation ?? 'Community Center';
  const boardMeetingsOpenNote =
    hoaInfo?.boardMeetingsOpenNote ?? 'Open to residents - speak during open forum';
  const boardContactGeneral =
    hoaInfo?.boardContactGeneral ?? 'General inquiries: Contact board secretary or use contact info above';
  const boardContactUrgent =
    hoaInfo?.boardContactUrgent ?? 'Urgent matters: Contact HOA office directly';
  const boardResourceMinutes =
    hoaInfo?.boardResourceMinutes ?? 'Meeting minutes and agendas available upon request';
  const boardResourceBylaws =
    hoaInfo?.boardResourceBylaws ?? 'Board decisions are made in accordance with HOA bylaws';
  
  // Rainbow colors for board member cards
  const borderColors = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
  ];

  // Animation functions
  const animateStaggeredContent = () => {
    Animated.stagger(200, [
      Animated.timing(membersAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(infoAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };


  // Initialize animations on component mount
  useEffect(() => {
    animateStaggeredContent();
  }, []);

  // Listen for window size changes (only on web/desktop)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        setScreenWidth(window.width);
      });

      return () => subscription?.remove();
    }
  }, []);

  useEffect(() => {
    const params = route.params as { activeSubTab?: BoardSubTab } | undefined;
    if (params?.activeSubTab) {
      setActiveSubTab(params.activeSubTab);
    }
  }, [route.params]);

  // Set initial cursor and cleanup on unmount (web only)
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Set initial cursor
      document.body.style.cursor = 'grab';
      
      // Ensure scroll view is properly initialized
      setTimeout(() => {
        if (scrollViewRef.current) {
          // Force a layout update
          scrollViewRef.current.scrollTo({ y: 0, animated: false });
          
          // Debug logging removed
        }
      }, 100);
      
      return () => {
        document.body.style.cursor = 'default';
      };
    }
  }, [screenWidth, showMobileNav, showDesktopNav]);

  return (
    <SafeAreaView style={HERO_TAB_SAFE_AREA_STYLE} edges={HERO_TAB_SAFE_AREA_EDGES}>
      <View style={HERO_TAB_CONTAINER_STYLE}>
      {/* Mobile Navigation - Only when screen is narrow */}
      {showMobileNav && (
        <MobileTabBar 
          isMenuOpen={isMenuOpen}
          onMenuClose={() => setIsMenuOpen(false)}
        />
      )}
      
      <ScrollView 
        ref={scrollViewRef}
        style={[styles.container, Platform.OS === 'web' && styles.webScrollContainer]}
        contentContainerStyle={[styles.scrollContent, Platform.OS === 'web' && styles.webScrollContent]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bounces={true}
        scrollEnabled={true}
        alwaysBounceVertical={false}
        nestedScrollEnabled={true}
        removeClippedSubviews={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        // Enhanced desktop scrolling
        decelerationRate="normal"
        directionalLockEnabled={true}
        canCancelContentTouches={true}
        // Web-specific enhancements
        {...(Platform.OS === 'web' && {
          onScrollBeginDrag: () => {
            if (Platform.OS === 'web') {
              document.body.style.cursor = 'grabbing';
              document.body.style.userSelect = 'none';
            }
          },
          onScrollEndDrag: () => {
            if (Platform.OS === 'web') {
              document.body.style.cursor = 'grab';
              document.body.style.userSelect = 'auto';
            }
          },
        })}
      >
        <TabHeroHeader
          screenWidth={screenWidth}
          showMobileNav={showMobileNav}
          isBoardMember={!!isBoardMember}
          onOpenMenu={() => setIsMenuOpen(true)}
          onOpenMessaging={() => setShowOverlay(true)}
          title="Board of Directors"
          subtitle="Your elected representatives serving the community"
          animatedOpacity={fadeAnim}
        />

        {/* Custom Tab Bar - Only when screen is wide enough */}
        {showDesktopNav && (
          <Animated.View style={{
            opacity: fadeAnim,
          }}>
            <DesktopTabBarSlot />
          </Animated.View>
        )}

        {/* Board Sub-Tab Bar */}
        <View style={styles.subTabBar}>
          {([
            { id: 'board', label: 'Board Members', icon: 'people' },
            { id: 'covenants', label: 'Covenants', icon: 'document-text' },
            { id: 'documents', label: 'Documents', icon: 'folder' },
          ] as { id: BoardSubTab; label: string; icon: string }[]).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.subTab, activeSubTab === tab.id && styles.subTabActive]}
              onPress={() => setActiveSubTab(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeSubTab === tab.id ? HOA_TAB_ACCENT : '#6b7280'}
              />
              <Text style={[styles.subTabText, activeSubTab === tab.id && styles.subTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Covenants Sub-Tab Content */}
        {activeSubTab === 'covenants' && (
          <CovenantsContent isActive={activeSubTab === 'covenants'} />
        )}

        {/* Documents Sub-Tab Content */}
        {activeSubTab === 'documents' && (
          <DocumentsContent isActive={activeSubTab === 'documents'} />
        )}

      <Animated.View style={{
        opacity: membersAnim,
        display: activeSubTab === 'board' ? 'flex' : 'none',
      }}>
        {members.map((member: any, index: number) => (
          <View key={member._id} style={[
            styles.memberCard,
            {
              borderLeftColor: borderColors[index % borderColors.length],
            }
          ]}>
            {/* Member Header with Avatar and Basic Info */}
            <View style={styles.memberHeader}>
              <View style={styles.avatarContainer}>
                <ProfileImage 
                  source={getBoardMemberPhoto(member, residents)}
                  size={70}
                  style={styles.avatarImage}
                />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberPosition}>{member.position}</Text>
                {member.termEnd && (
                  <View style={styles.memberTermContainer}>
                    <Ionicons name="calendar" size={16} color="#6b7280" />
                    <Text style={styles.memberTerm}>
                      Term ends: {formatDate(member.termEnd)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Member Bio Section */}
            {member.bio && (
              <Text style={styles.memberBio} numberOfLines={10}>
                {member.bio}
              </Text>
            )}

            {/* Contact Section */}
            <View style={styles.contactSection}>
              <View style={styles.contactHeader}>
                <Ionicons name="information-circle" size={16} color="#6b7280" />
                <Text style={styles.contactLabel}>Contact Information</Text>
              </View>
              <View style={styles.contactButtons}>
                {member.phone && (
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => handleContact(member, 'phone')}
                  >
                    <Ionicons name="call" size={20} color="#2563eb" />
                    <Text style={styles.contactText}>{member.phone}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => handleContact(member, 'email')}
                >
                  <Ionicons name="mail" size={20} color="#2563eb" />
                  <Text style={styles.contactText} numberOfLines={2}>{member.email}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </Animated.View>

      <Animated.View style={{
        opacity: infoAnim,
        display: activeSubTab === 'board' ? 'flex' : 'none',
      }}>
        {/* Board Meetings Section */}
        <View style={[styles.infoSection, {
          borderLeftColor: borderColors[(members.length) % borderColors.length], // Next color after last member
        }]}>
          
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="calendar" size={24} color="#2563eb" />
            </View>
            <Text style={styles.infoTitle}>Board Meetings</Text>
          </View>
          <View style={styles.infoContent}>
            <View style={styles.infoItem}>
              <Ionicons name="time" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{boardMeetingsSchedule}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="location" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{boardMeetingsLocation}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="people" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{boardMeetingsOpenNote}</Text>
            </View>
          </View>
        </View>

        {/* Contact Information Section */}
        <View style={[styles.infoSection, {
          borderLeftColor: borderColors[(members.length + 1) % borderColors.length], // Second color after last member
        }]}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="mail" size={24} color="#2563eb" />
            </View>
            <Text style={styles.infoTitle}>Contact the Board</Text>
          </View>
          <View style={styles.infoContent}>
            <View style={styles.infoItem}>
              <Ionicons name="information-circle" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{boardContactGeneral}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.infoText}>{boardContactUrgent}</Text>
            </View>
          </View>
        </View>

        {/* Additional Resources Section */}
        <View style={[styles.infoSection, {
          borderLeftColor: borderColors[(members.length + 2) % borderColors.length], // Third color after last member
        }]}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="document-text" size={24} color="#2563eb" />
            </View>
            <Text style={styles.infoTitle}>Resources</Text>
          </View>
          <View style={styles.infoContent}>
            <View style={styles.infoItem}>
              <Ionicons name="document" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{boardResourceMinutes}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{boardResourceBylaws}</Text>
            </View>
          </View>
        </View>
      </Animated.View>
      
      {/* Additional content to ensure scrollable content */}
      <View style={styles.spacer} />
      </ScrollView>
      <ScrollToTopButton visible={showScrollToTop} onPress={scrollToTop} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  webScrollContainer: {
    ...(Platform.OS === 'web' && {
      cursor: 'grab' as any,
      userSelect: 'none' as any,
      WebkitUserSelect: 'none' as any,
      MozUserSelect: 'none' as any,
      msUserSelect: 'none' as any,
      overflow: 'auto' as any,
      height: '100vh' as any,
      maxHeight: '100vh' as any,
      position: 'relative' as any,
    }),
  },
  scrollContent: {
    paddingBottom: 20,
  },
  webScrollContent: {
    ...(Platform.OS === 'web' && {
      minHeight: '100vh' as any,
      flexGrow: 1,
      paddingBottom: 100 as any,
    }),
  },
  spacer: {
    height: Platform.OS === 'web' ? 200 : 100,
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 8,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabActive: {
    borderBottomColor: HOA_TAB_ACCENT,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  subTabTextActive: {
    color: HOA_TAB_ACCENT,
    fontWeight: '600',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  headerContainerIOS: {
    width: Dimensions.get('window').width,
    alignSelf: 'stretch',
    overflow: 'hidden',
    marginLeft: 0,
    marginRight: 0,
    marginHorizontal: 0,
  },
  header: {
    height: 180,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
    position: 'relative',
    justifyContent: 'space-between',
    width: '100%',
    alignSelf: 'stretch',
  },
  headerNonMember: {
    height: 170,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
    position: 'relative',
    justifyContent: 'space-between',
    width: '100%',
    alignSelf: 'stretch',
  },
  headerImage: {
    borderRadius: 0,
    width: Dimensions.get('window').width,
    height: 240,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerSpacer: {
    width: 44, // Same width as MessagingButton (icon + padding)
  },
  menuButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    marginRight: 12,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  headerTitle: ({
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)' as any,
    textAlign: 'center',
  } as any),
  headerSubtitle: ({
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.9,
    marginTop: 8,
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)' as any,
    textAlign: 'center',
  } as any),
  memberCard: {
    backgroundColor: '#ffffff',
    margin: 15,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    // borderLeftColor is now set dynamically in the component
  },
  memberHeader: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarImage: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  memberInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  memberName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  memberPosition: {
    fontSize: 18,
    color: '#2563eb',
    fontWeight: '600',
    marginBottom: 8,
  },
  memberTermContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberTerm: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  memberBio: {
    fontSize: 15,
    color: '#4b5563',
    fontStyle: 'italic',
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 22,
    fontWeight: '400',
    paddingHorizontal: 4,
  },
  contactSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  contactButtons: {
    gap: 12,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  contactText: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
    flexShrink: 1,
  },
  infoSection: {
    backgroundColor: '#ffffff',
    margin: 15,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    // borderLeftColor is now set dynamically in the component
    borderLeftColor: '#2563eb',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 0,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
    marginTop: 8,
    lineHeight: 24,
  },
  infoContent: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    flex: 1,
    fontWeight: '500',
  },
});

export default BoardScreen; 
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useRoute, useIsFocused } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

import { useAuth } from '../context/AuthContext';
import { useCachedResidents } from '../context/QueryCacheContext';
import BoardMemberIndicator from '../components/BoardMemberIndicator';
import DeveloperIndicator from '../components/DeveloperIndicator';
import { DesktopTabBarSlot, useDesktopTabBarScrollSync } from '../components/DesktopTabBarLayer';
import { useWindowWidth } from '../hooks/useWindowWidth';
import MobileTabBar from '../components/MobileTabBar';
import ProfileImage from '../components/ProfileImage';
import { getBoardMemberPhoto } from '../utils/boardMemberPhoto';
import MessagingButton from '../components/MessagingButton';
import { useMessaging } from '../context/MessagingContext';
import CovenantsContent from '../components/board/CovenantsContent';
import DocumentsContent from '../components/board/DocumentsContent';
import { HOA_TAB_ACCENT, DESKTOP_CONTENT_STYLE, SECTION_ACCENTS } from '../constants/hoaTheme';
import SubTabBar from '../components/SubTabBar';
import { BOARD_SUB_TABS, BoardSubTabId } from '../navigation/mainTabs';
import TabEntrance from '../components/motion/TabEntrance';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { useScrollToTop } from '../hooks/useScrollToTop';
import {
  HERO_TAB_CONTAINER_STYLE,
  HERO_TAB_SAFE_AREA_EDGES,
  HERO_TAB_SAFE_AREA_STYLE,
} from '../hooks/useHeroHeaderPadding';
import TabHeroHeader from '../components/TabHeroHeader';

type BoardSubTab = BoardSubTabId;


const MIN_MEMBER_CARD_WIDTH = 320;
const MEMBER_GRID_GAP = 15;
/** memberGrid's horizontal padding; onLayout width includes it, so subtract it before sizing cards. */
const MEMBER_GRID_PADDING = 15;

const BoardScreen = () => {
  const { user } = useAuth();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { setShowOverlay } = useMessaging();
  const hasBoardAccess = Boolean(user?.isActive && (user?.isBoardMember || user?.isDev));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<BoardSubTab>('board');
  
  // State for dynamic responsive behavior (only for web/desktop)
  // Shared, frame-throttled width; paused while this screen sits under another one
  const screenWidth = useWindowWidth(isFocused);
  
  // Dynamic responsive check - show mobile nav when screen is too narrow for desktop nav
  // On mobile, always show mobile nav regardless of screen size
  const isMobileDevice = Platform.OS === 'ios' || Platform.OS === 'android';
  const showMobileNav = isMobileDevice || screenWidth < 1024; // Always mobile on mobile devices, responsive on web
  const showDesktopNav = !isMobileDevice && screenWidth >= 1024; // Only desktop nav on web when wide enough

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current; // Start at 1 to avoid white flash
  const membersAnim = useRef(new Animated.Value(1)).current;
  const infoAnim = useRef(new Animated.Value(1)).current;
  
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
  
  // Emails/phones compared ignoring case, spaces and punctuation (e.g. ALL-CAPS copies of the HOA email)
  const sameContact = (a?: string | null, b?: string | null) =>
    !!a && !!b && a.toLowerCase().replace(/[^a-z0-9@.]/g, '') === b.toLowerCase().replace(/[^a-z0-9@.]/g, '');

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

  // Shared board inbox: the HOA email from settings, else the email most members list
  const boardEmail = useMemo(() => {
    const configured = hoaInfo?.email?.trim();
    if (configured) return configured;
    const counts = new Map<string, { email: string; count: number }>();
    members.forEach((m: any) => {
      const email = m.email?.trim();
      if (!email) return;
      const key = email.toLowerCase();
      const entry = counts.get(key) ?? { email, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    });
    const [best] = [...counts.values()].sort((x, y) => y.count - x.count);
    return best?.email ?? '';
  }, [hoaInfo?.email, members]);

  const [memberGridWidth, setMemberGridWidth] = useState(0);
  const memberGridInnerWidth = Math.max(0, memberGridWidth - MEMBER_GRID_PADDING * 2);
  const memberColumns = Math.max(
    1,
    Math.floor((memberGridInnerWidth + MEMBER_GRID_GAP) / (MIN_MEMBER_CARD_WIDTH + MEMBER_GRID_GAP))
  );
  const memberCardWidth = memberGridInnerWidth
    ? Math.floor((memberGridInnerWidth - MEMBER_GRID_GAP * (memberColumns - 1)) / memberColumns)
    : undefined;

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
  // Sidebar color per card; `text` is a darker shade of the same hue so labels stay readable on white
  const cardColors = [
    { accent: '#ef4444', text: '#b91c1c' }, // Red
    { accent: '#f97316', text: '#c2410c' }, // Orange
    { accent: '#eab308', text: '#a16207' }, // Yellow
    { accent: '#22c55e', text: '#15803d' }, // Green
    { accent: '#3b82f6', text: '#1d4ed8' }, // Blue
    { accent: '#6366f1', text: '#4338ca' }, // Indigo
    { accent: '#8b5cf6', text: '#6d28d9' }, // Violet
  ];
  const cardColor = (index: number) => cardColors[index % cardColors.length];

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
    // Mount only: re-running on resize scrolled the page back to the top
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          hasBoardAccess={hasBoardAccess}
          onOpenMenu={() => setIsMenuOpen(true)}
          onOpenMessaging={() => setShowOverlay(true)}
          title="HOA Governance"
          subtitle="Board members, covenants, and community records"
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
        <TabEntrance>
        <SubTabBar
          tabs={BOARD_SUB_TABS}
          activeId={activeSubTab}
          onChange={setActiveSubTab}
          accent={SECTION_ACCENTS.Board}
          desktop={showDesktopNav}
        />
        </TabEntrance>

        {/* Sub-tab content rises in just after the sub-tab bar */}
        <TabEntrance delay={70} style={showDesktopNav ? DESKTOP_CONTENT_STYLE : undefined}>
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
        {/* One shared inbox for the whole board, shown once instead of on every card */}
        {boardEmail ? (
          <TouchableOpacity
            style={styles.emailBoardBanner}
            onPress={() => Linking.openURL(`mailto:${boardEmail}`)}
            activeOpacity={0.75}
          >
            <View style={styles.emailBoardIcon}>
              <Ionicons name="mail" size={20} color={HOA_TAB_ACCENT} />
            </View>
            <View style={styles.emailBoardTextWrap}>
              <Text style={styles.emailBoardTitle}>Email the Board</Text>
              <Text style={styles.emailBoardAddress} numberOfLines={1}>
                {boardEmail}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}

        {/* Auto-fit grid: as many columns as fit at MIN_MEMBER_CARD_WIDTH */}
        <View
          style={styles.memberGrid}
          onLayout={(e) => setMemberGridWidth(e.nativeEvent.layout.width)}
        >
        {members.map((member: any, index: number) => {
          const showEmail = !!member.email && !sameContact(member.email, boardEmail);
          const showPhone = !!member.phone && !sameContact(member.phone, hoaInfo?.phone);
          const hasDetails = !!member.bio || showEmail || showPhone;
          return (
          <View key={member._id} style={[
            styles.memberCard,
            // Full width until the grid has been measured
            { width: memberCardWidth ?? '100%' },
            {
              borderLeftColor: cardColor(index).accent,
            }
          ]}>
            {/* Member Header with Avatar and Basic Info */}
            <View style={[styles.memberHeader, !hasDetails && styles.memberHeaderOnly]}>
              <View style={styles.avatarContainer}>
                <ProfileImage 
                  source={getBoardMemberPhoto(member, residents)}
                  size={70}
                  style={styles.avatarImage}
                />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={[styles.memberPosition, { color: cardColor(index).text }]}>{member.position}</Text>
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

            {/* Personal contact only when it differs from the shared board contact */}
            {(showEmail || showPhone) && (
              <View style={[styles.contactSection, styles.contactButtons, !!member.bio && styles.contactSectionAfterBio]}>
                {showPhone && (
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => handleContact(member, 'phone')}
                  >
                    <Ionicons name="call" size={20} color={cardColor(index).accent} />
                    <Text style={styles.contactText}>{member.phone}</Text>
                  </TouchableOpacity>
                )}
                {showEmail && (
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => handleContact(member, 'email')}
                  >
                    <Ionicons name="mail" size={20} color={cardColor(index).accent} />
                    <Text style={styles.contactText} numberOfLines={2}>{member.email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          );
        })}
        </View>
      </Animated.View>

      <Animated.View style={{
        opacity: infoAnim,
        display: activeSubTab === 'board' ? 'flex' : 'none',
      }}>
        {/* Board Meetings Section */}
        <View style={[styles.infoSection, {
          borderLeftColor: cardColor(members.length).accent, // Next color after last member
        }]}>
          
          <View style={styles.infoHeader}>
            <View style={[styles.infoIconContainer, { backgroundColor: `${cardColor(members.length).accent}1A` }]}>
              <Ionicons name="calendar" size={24} color={cardColor(members.length).accent} />
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
          borderLeftColor: cardColor(members.length + 1).accent, // Second color after last member
        }]}>
          <View style={styles.infoHeader}>
            <View style={[styles.infoIconContainer, { backgroundColor: `${cardColor(members.length + 1).accent}1A` }]}>
              <Ionicons name="mail" size={24} color={cardColor(members.length + 1).accent} />
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
          borderLeftColor: cardColor(members.length + 2).accent, // Third color after last member
        }]}>
          <View style={styles.infoHeader}>
            <View style={[styles.infoIconContainer, { backgroundColor: `${cardColor(members.length + 2).accent}1A` }]}>
              <Ionicons name="document-text" size={24} color={cardColor(members.length + 2).accent} />
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
        </TabEntrance>
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
  emailBoardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 15,
    marginTop: 15,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    ...(Platform.OS === 'web' && { cursor: 'pointer' as any }),
  },
  emailBoardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
  },
  emailBoardTextWrap: {
    flex: 1,
  },
  emailBoardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  emailBoardAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  memberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MEMBER_GRID_GAP,
    padding: 15,
  },
  memberCard: {
    backgroundColor: '#ffffff',
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
  memberHeaderOnly: {
    marginBottom: 0,
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
    // Header's marginBottom already separates the bio; card padding closes the bottom
    marginTop: 0,
    marginBottom: 0,
    lineHeight: 22,
    fontWeight: '400',
    paddingHorizontal: 4,
  },
  contactSectionAfterBio: {
    marginTop: 16,
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
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ImageBackground,
  Platform,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useQuery, useMutation } from 'convex/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { useCachedHoaInfo, useCachedResidents } from '../context/QueryCacheContext';
import BoardMemberIndicator from '../components/BoardMemberIndicator';
import DeveloperIndicator from '../components/DeveloperIndicator';
import { DesktopTabBarSlot, useDesktopTabBarScrollSync } from '../components/DesktopTabBarLayer';
import MobileTabBar from '../components/MobileTabBar';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import ProfileImage from '../components/ProfileImage';
import MessagingButton from '../components/MessagingButton';
import { useMessaging } from '../context/MessagingContext';
import { usePostLoginPrompts } from '../context/PostLoginPromptsContext';
import { useBrandSplash } from '../context/BrandSplashContext';
import HomeQuickLinks, { HomeQuickLink } from '../components/home/HomeQuickLinks';
import HomeAttentionStrip, { HomeAttentionItem } from '../components/home/HomeAttentionStrip';
import HomeHoaNoticesSection from '../components/home/HomeHoaNoticesSection';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { useScrollToTop } from '../hooks/useScrollToTop';
import {
  HERO_TAB_CONTAINER_STYLE,
  HERO_TAB_SAFE_AREA_EDGES,
  HERO_TAB_SAFE_AREA_STYLE,
  HERO_HEADER_IMAGE,
  useHeroHeaderLayout,
} from '../hooks/useHeroHeaderPadding';

const RAINBOW_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
] as const;

const HOME_UI_UPDATE_NOTICE_VERSION = '2026-07-home-public-ui-v1';
/** Set true and bump HOME_UI_UPDATE_NOTICE_VERSION when shipping the next major Home UI change. */
const HOME_UI_UPDATE_NOTICE_ENABLED = false;

function buildRainbowSectionColors(options: {
  hasActivePoll: boolean;
  hasNeighborUpdates: boolean;
}) {
  let index = 0;
  const next = () => RAINBOW_COLORS[index++ % RAINBOW_COLORS.length];

  return {
    dashboard: next(),
    events: next(),
    posts: next(),
    poll: options.hasActivePoll ? next() : undefined,
    neighbors: options.hasNeighborUpdates ? next() : undefined,
    office: next(),
  };
}

const HomeScreen = () => {
  const { user } = useAuth();
  const { setPromptBlocked, notificationPromptHandled } = usePostLoginPrompts();
  const { visible: splashVisible } = useBrandSplash();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { setShowOverlay } = useMessaging();
  const isBoardMember = user?.isBoardMember && user?.isActive;
  const heroHeaderLayout = useHeroHeaderLayout();
  const isDev = user?.isDev ?? false;
  const showFeesAccess = isBoardMember || !user?.isRenter;
  const hoaInfo = useCachedHoaInfo();
  const residents = useCachedResidents();
  // Use paginated queries with small initial limits for home screen (conditional based on screen focus)
  const communityPostsData = useQuery(
    api.communityPosts.getPaginated,
    isFocused ? { limit: 5, offset: 0 } : "skip"
  );
  const communityPosts = communityPostsData?.items ?? [];
  
  const pollsData = useQuery(
    api.polls.getPaginated,
    isFocused ? { limit: 1, offset: 0 } : "skip"
  );
  const polls = pollsData?.items ?? [];
  const userVotes = useQuery(
    api.polls.getAllUserVotes,
    isFocused && user ? { userId: user._id } : "skip"
  );
  const residentNotifications = useQuery(
    api.residentNotifications.getAllActive,
    isFocused ? {} : "skip"
  ) ?? [];
  const myDamageReports = useQuery(
    api.damageReports.getByResident,
    isFocused && user?._id ? { residentId: user._id } : "skip"
  ) ?? [];
  const hasPaidAnnualFee = useQuery(
    api.fees.hasPaidAnnualFee,
    isFocused && user?._id && showFeesAccess ? { userId: user._id } : "skip"
  );
  const voteOnPoll = useMutation(api.polls.vote);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedPollVotes, setSelectedPollVotes] = useState<{[pollId: string]: number[]}>({});
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  
  // State for dynamic responsive behavior (only for web/desktop)
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Dynamic responsive check - show mobile nav when screen is too narrow for desktop nav
  // On mobile, always show mobile nav regardless of screen size
  const isMobileDevice = Platform.OS === 'ios' || Platform.OS === 'android';
  const showMobileNav = isMobileDevice || screenWidth < 1024; // Always mobile on mobile devices, responsive on web
  const showDesktopNav = !isMobileDevice && screenWidth >= 1024; // Only desktop nav on web when wide enough

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current; // Start at 1 to avoid white flash
  const quickActionsAnim = useRef(new Animated.Value(0)).current;
  const postsAnim = useRef(new Animated.Value(0)).current;
  const officeAnim = useRef(new Animated.Value(0)).current;
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Pet registration prompt modal (board requires residents to register pets)
  const [showPetRegistrationModal, setShowPetRegistrationModal] = useState(false);
  const [petRegistrationConfirmed, setPetRegistrationConfirmed] = useState(true);
  const [showUiUpdateModal, setShowUiUpdateModal] = useState(false);
  
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

  // Animation functions

  const animateStaggeredContent = () => {
    Animated.stagger(200, [
      Animated.timing(quickActionsAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(postsAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(officeAnim, {
        toValue: 1,
        duration: 500,
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
          
          // ScrollView initialized for web
        }
      }, 100);
      
      return () => {
        document.body.style.cursor = 'default';
      };
    }
  }, [screenWidth, showMobileNav, showDesktopNav]);

  // Update selectedPollVotes when userVotes data is available
  useEffect(() => {
    if (userVotes) {
      setSelectedPollVotes(userVotes);
    }
  }, [userVotes]);

  // Check if user needs onboarding (previously showed arrow towards nav bar)
  useEffect(() => {
    const clearLegacyOnboarding = async () => {
      try {
        if (user?._id) {
          await AsyncStorage.setItem(`onboarding_seen_${user._id}`, 'true');
        }
      } catch (error) {
        console.error('Error clearing onboarding flag:', error);
      }
      setShowOnboarding(false);
    };
    clearLegacyOnboarding();
  }, [user?._id]);

  // Pet registration prompt — after splash and push notification permission.
  useEffect(() => {
    const checkPetRegistrationPrompt = async () => {
      if (!user?._id || !isFocused || splashVisible || !notificationPromptHandled) return;
      try {
        const confirmed = await AsyncStorage.getItem(`pet_registration_confirmed_${user._id}`);
        const isConfirmed = confirmed === 'true';
        setPetRegistrationConfirmed(isConfirmed);
        if (!isConfirmed) {
          setShowPetRegistrationModal(true);
        }
      } catch (error) {
        console.error('Error checking pet registration status:', error);
      }
    };
    checkPetRegistrationPrompt();
  }, [user?._id, isFocused, splashVisible, notificationPromptHandled]);

  useEffect(() => {
    setPromptBlocked('pet-registration', showPetRegistrationModal);
    return () => setPromptBlocked('pet-registration', false);
  }, [showPetRegistrationModal, setPromptBlocked]);

  // One-time "What's New" for major Home UI updates (disabled until next release).
  useEffect(() => {
    if (!HOME_UI_UPDATE_NOTICE_ENABLED || !user?._id || !isFocused) return;

    let cancelled = false;
    const storageKey = `home_ui_notice_seen_${HOME_UI_UPDATE_NOTICE_VERSION}_${user._id}`;

    const maybeShowUiUpdateNotice = async () => {
      try {
        const seen = await AsyncStorage.getItem(storageKey);
        if (seen === 'true' || cancelled) return;
        setShowUiUpdateModal(true);
      } catch (error) {
        // Fallback silently if local storage is unavailable.
      }
    };

    maybeShowUiUpdateNotice();

    return () => {
      cancelled = true;
    };
  }, [isFocused, user?._id]);

  const handleDismissUiUpdateModal = async () => {
    if (!user?._id) {
      setShowUiUpdateModal(false);
      return;
    }
    const storageKey = `home_ui_notice_seen_${HOME_UI_UPDATE_NOTICE_VERSION}_${user._id}`;
    try {
      await AsyncStorage.setItem(storageKey, 'true');
    } catch (error) {
      // Best effort only.
    }
    setShowUiUpdateModal(false);
  };

  const handlePetRegistrationNotYet = () => {
    setShowPetRegistrationModal(false);
    (navigation as any).navigate('Community', { activeSubTab: 'pets' });
  };

  const handlePetRegistrationYes = async () => {
    if (user?._id) {
      try {
        await AsyncStorage.setItem(`pet_registration_confirmed_${user._id}`, 'true');
      } catch (error) {
        console.error('Error saving pet registration confirmation:', error);
      }
    }
    setPetRegistrationConfirmed(true);
    setShowPetRegistrationModal(false);
  };

  const navigateCommunity = (activeSubTab?: 'posts' | 'polls' | 'notifications' | 'pets' | 'damage') => {
    (navigation as any).navigate('Community', activeSubTab ? { activeSubTab } : undefined);
  };

  const navigateBoard = (activeSubTab?: 'board' | 'covenants' | 'documents') => {
    (navigation as any).navigate('Board', activeSubTab ? { activeSubTab } : undefined);
  };

  const filteredPosts = useMemo(
    () => (communityPosts?.filter((post: any) => post.category !== 'Complaint') ?? []),
    [communityPosts]
  );

  const activePoll = useMemo(
    () => polls.find((poll: any) => poll.isActive) ?? polls[0] ?? null,
    [polls]
  );

  const eventLines = useMemo(
    () => (hoaInfo?.eventText || '').split(/\r?\n/).filter((line: string) => line.trim().length > 0),
    [hoaInfo?.eventText]
  );

  const quickLinks = useMemo((): HomeQuickLink[] => {
    const linkDefs = [
      {
        id: 'hoa',
        label: 'HOA Board',
        icon: 'business',
        onPress: () => navigateBoard('board'),
      },
      {
        id: 'community',
        label: 'Community',
        icon: 'chatbubbles',
        onPress: () => navigateCommunity('posts'),
      },
      {
        id: 'covenants',
        label: 'Rules & Docs',
        icon: 'document-text',
        onPress: () => navigateBoard('covenants'),
      },
      {
        id: 'damage',
        label: 'Report Damage',
        icon: 'construct-outline',
        onPress: () => navigateCommunity('damage'),
      },
    ];

    if (showFeesAccess) {
      linkDefs.push({
        id: 'fees',
        label: 'Fees',
        icon: 'card',
        onPress: () => navigation.navigate('Fees' as never),
      });
    }

    if (isBoardMember || isDev) {
      linkDefs.push({
        id: 'admin',
        label: 'Admin',
        icon: 'settings',
        onPress: () => navigation.navigate('Admin' as never),
      });
    }

    return linkDefs.map((link, index) => ({
      ...link,
      color: RAINBOW_COLORS[index % RAINBOW_COLORS.length],
    }));
  }, [navigation, showFeesAccess, isBoardMember, isDev]);

  const sectionRainbowColors = useMemo(
    () =>
      buildRainbowSectionColors({
        hasActivePoll: !!activePoll,
        hasNeighborUpdates: (residentNotifications ?? []).length > 0,
      }),
    [activePoll, residentNotifications]
  );

  const myAdminNotices = useQuery(
    api.adminNotices.listMyAdminNotices,
    user?._id ? { residentId: user._id, limit: 10 } : 'skip'
  );

  const attentionItems = useMemo((): HomeAttentionItem[] => {
    const items: HomeAttentionItem[] = [];

    const unreadAdminNotice = myAdminNotices?.find((notice) => !notice.isRead);
    if (unreadAdminNotice) {
      items.push({
        id: `notice-${unreadAdminNotice.ticketId}`,
        label: unreadAdminNotice.title,
        icon: 'mail',
        color: '#dc2626',
        onPress: () =>
          (navigation as any).navigate('ResidentNotice', {
            ticketId: unreadAdminNotice.ticketId,
          }),
      });
    }

    if (activePoll?.isActive) {
      const hasVoted = (selectedPollVotes[activePoll._id]?.length ?? 0) > 0;
      if (!hasVoted) {
        const pollTitle =
          activePoll.title.length > 26 ? `${activePoll.title.slice(0, 26).trim()}…` : activePoll.title;
        items.push({
          id: 'poll',
          label: `Vote · ${pollTitle}`,
          icon: 'bar-chart',
          color: '#f97316',
          onPress: () => navigateCommunity('polls'),
        });
      }
    }

    if (showFeesAccess && hasPaidAnnualFee === false) {
      items.push({
        id: 'dues',
        label: 'Unpaid annual dues',
        icon: 'card',
        color: '#ec4899',
        onPress: () => navigation.navigate('Fees' as never),
      });
    }

    if (user?._id && !petRegistrationConfirmed) {
      items.push({
        id: 'pet',
        label: 'Register your pet',
        icon: 'paw',
        color: '#eab308',
        onPress: () => navigateCommunity('pets'),
      });
    }

    const openDamageReport = myDamageReports.find(
      (report: any) => report.status === 'Pending' || report.status === 'In Progress'
    );
    if (openDamageReport) {
      items.push({
        id: 'damage-status',
        label: `Damage · ${openDamageReport.status}`,
        icon: 'construct-outline',
        color: '#6366f1',
        onPress: () => navigateCommunity('damage'),
      });
    }

    if (residentNotifications.length > 0) {
      items.push({
        id: 'moving',
        label: `${residentNotifications.length} neighbor update${residentNotifications.length === 1 ? '' : 's'}`,
        icon: 'home',
        color: '#3b82f6',
        onPress: () => navigateCommunity('notifications'),
      });
    }

    return items;
  }, [
    activePoll,
    selectedPollVotes,
    showFeesAccess,
    hasPaidAnnualFee,
    user?._id,
    petRegistrationConfirmed,
    myDamageReports,
    residentNotifications.length,
    myAdminNotices,
    navigation,
  ]);

  const handleVoteOnPoll = async (pollId: string, optionIndex: number) => {
    if (!user) {
      showAlert({
        title: 'Error',
        message: 'You must be logged in to vote',
        type: 'error'
      });
      
      // Auto-dismiss error alert after 3 seconds
      setTimeout(() => {
        hideAlert();
      }, 3000);
      return;
    }

    try {
      const currentVotes = selectedPollVotes[pollId] || [];
      let newVotes: number[];

      if (currentVotes.includes(optionIndex)) {
        // Remove vote if already selected
        newVotes = currentVotes.filter(vote => vote !== optionIndex);
      } else {
        // Add vote
        const poll = polls?.find(p => p._id === pollId);
        if (poll && !poll.allowMultipleVotes) {
          // Single vote only - replace current vote
          newVotes = [optionIndex];
        } else {
          // Multiple votes allowed - add to existing votes
          newVotes = [...currentVotes, optionIndex];
        }
      }

      setSelectedPollVotes(prev => ({
        ...prev,
        [pollId]: newVotes
      }));

      await voteOnPoll({
        userId: user._id,
        pollId: pollId as any,
        selectedOptions: newVotes
      });
      
      showAlert({
        title: 'Success',
        message: 'Your vote has been recorded!',
        type: 'success'
      });
      
      // Auto-dismiss success alert after 2 seconds
      setTimeout(() => {
        hideAlert();
      }, 2000);
    } catch (error) {
      console.error('Error voting on poll:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to record your vote. Please try again.',
        type: 'error'
      });
      
      // Auto-dismiss error alert after 3 seconds
      setTimeout(() => {
        hideAlert();
      }, 3000);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      return 'Invalid date';
    }
  };


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
          style={[styles.scrollContainer, Platform.OS === 'web' && styles.webScrollContainer]}
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
      {/* Header */}
      <Animated.View
        style={[
          {
        opacity: fadeAnim,
          },
          styles.headerContainerIOS,
          { width: screenWidth }
        ]}
      >
        <ImageBackground
          source={HERO_HEADER_IMAGE}
          style={[
            styles.header,
            {
              paddingTop: heroHeaderLayout.paddingTop,
              height: heroHeaderLayout.height,
            },
          ]}
          imageStyle={[
            styles.headerImage,
            { width: screenWidth, height: heroHeaderLayout.imageHeight },
          ]}
          resizeMode="stretch"
        >
        <View style={styles.headerOverlay} />
        <View style={styles.headerTop}>
          {/* Hamburger Menu - Only when mobile nav is shown */}
          {showMobileNav && (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setIsMenuOpen(true)}
            >
              <Ionicons name="menu" size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
          
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeText}>Welcome to</Text>
            <Text style={styles.hoaName}>{hoaInfo?.name ?? 'HOA'}</Text>
            <Text style={styles.subtitle}>Your Community Connection</Text>
          </View>

          {/* Spacer for non-board members to center the text */}
          {!isBoardMember && <View style={styles.headerSpacer} />}

          {/* Messaging Button - Board Members Only */}
          {isBoardMember && (
            <View style={styles.headerRight}>
              <MessagingButton onPress={() => setShowOverlay(true)} />
            </View>
          )}
        </View>
              
        {user && (
          <View style={styles.userInfo}>
            <View style={styles.userNameContainer}>
              <Text style={styles.userName}>
                Welcome back, {user.firstName} {user.lastName}
              </Text>
              <DeveloperIndicator />
              <BoardMemberIndicator />
            </View>
            <Text style={styles.userRole}>
              {(user.isDev ?? false) ? 'Developer' : user.isBoardMember ? 'Board Member' : user.isRenter ? 'Renter' : 'Resident'} • {user.address}
            </Text>
          </View>
        )}
        </ImageBackground>
      </Animated.View>

      {/* Custom Tab Bar - Only when screen is wide enough */}
      {showDesktopNav && (
        <Animated.View style={{
          opacity: fadeAnim,
        }}>
          <DesktopTabBarSlot />
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.dashboardPanel,
          !showMobileNav && styles.dashboardPanelDesktop,
          {
            opacity: quickActionsAnim,
            transform: [{
              translateY: quickActionsAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            }],
          },
        ]}
      >
        <HomeAttentionStrip items={attentionItems} embedded />
        <HomeQuickLinks
          links={quickLinks}
          embedded
          showDivider={attentionItems.length > 0}
        />
      </Animated.View>

      {myAdminNotices && myAdminNotices.length > 0 ? (
        <Animated.View
          style={[
            styles.section,
            !showMobileNav && styles.sectionDesktop,
            {
              opacity: quickActionsAnim,
              transform: [{
                translateY: quickActionsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              }],
            },
          ]}
        >
          <HomeHoaNoticesSection
            notices={myAdminNotices}
            onOpenNotice={(ticketId) =>
              (navigation as any).navigate('ResidentNotice', { ticketId })
            }
          />
        </Animated.View>
      ) : null}

      {/* Upcoming Events */}
      <Animated.View style={[
        styles.section,
        !showMobileNav && styles.sectionDesktop,
        {
          opacity: officeAnim,
          transform: [{
            translateY: officeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            })
          }]
        }
      ]}>
        <View style={styles.officeHeader}>
          <Ionicons name="calendar" size={24} color="#64748b" />
          <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>Upcoming Events</Text>
        </View>
        <View style={styles.infoCard}>
          {eventLines.length > 0 ? (
            eventLines.map((line: string, idx: number) => (
              <Text key={idx} style={styles.eventText}>{line}</Text>
            ))
          ) : (
            <Text style={styles.eventText}>No upcoming events posted.</Text>
          )}
        </View>
      </Animated.View>

      {/* Recent Community Posts */}
      <Animated.View style={[
        styles.section,
        !showMobileNav && styles.sectionDesktop,
        {
          opacity: postsAnim,
          transform: [{
            translateY: postsAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            })
          }]
        }
      ]}>
        <View style={styles.communityHeader}>
          <Ionicons name="people" size={24} color="#64748b" />
          <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>Recent Community Posts</Text>
        </View>
        {filteredPosts.length > 0 ? (
          filteredPosts.slice(0, 3).map((post: any, index: number) => (
            <TouchableOpacity
              key={post._id}
              activeOpacity={0.8}
              onPress={() => {
                navigateCommunity('posts');
              }}
            >
              <View style={styles.compactPostCard}>
                <View style={styles.postHeader}>
                  <View style={styles.postAuthorInfo}>
                    <ProfileImage
                      source={
                        post.authorProfileImage ||
                        (residents?.find((r: any) => `${r.firstName} ${r.lastName}` === post.author)?.profileImage) ||
                        null
                      }
                      size={36}
                      style={{ marginRight: 8 }}
                    />
                    <View style={styles.compactPostMeta}>
                      <Text style={styles.postAuthor} numberOfLines={1}>{post.author}</Text>
                      <Text style={styles.postTime}>{formatDate(new Date(post.createdAt).toISOString())}</Text>
                    </View>
                  </View>
                  <Text style={styles.postCategory} numberOfLines={1}>{post.category}</Text>
                </View>
                <Text style={styles.compactPostTitle} numberOfLines={1}>{post.title}</Text>
                <Text style={styles.compactPostContent} numberOfLines={2}>{post.content}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptySectionState}>
            <Ionicons name="chatbubbles-outline" size={28} color="#9ca3af" />
            <Text style={styles.emptySectionText}>No community posts yet</Text>
            <TouchableOpacity style={styles.emptySectionButton} onPress={() => navigateCommunity('posts')}>
              <Text style={styles.emptySectionButtonText}>Browse community</Text>
            </TouchableOpacity>
          </View>
        )}

        {filteredPosts.length > 0 ? (
          <TouchableOpacity
            style={styles.viewMoreButton}
            onPress={() => navigateCommunity('posts')}
          >
            <Text style={[styles.viewMoreButtonText, { color: sectionRainbowColors.posts }]}>
              View all posts
            </Text>
            <Ionicons name="arrow-forward" size={14} color={sectionRainbowColors.posts} />
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      {/* Active Poll */}
      {activePoll ? (
        <Animated.View style={[
          styles.section,
          !showMobileNav && styles.sectionDesktop,
          {
            opacity: postsAnim,
            transform: [{
              translateY: postsAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              })
            }]
          }
        ]}>
          <View style={styles.communityHeader}>
            <Ionicons name="bar-chart" size={24} color="#64748b" />
            <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>
              {activePoll.isActive ? 'Active Poll' : 'Recent Poll'}
            </Text>
          </View>
          {(() => {
            const poll = activePoll;
            return (
            <Animated.View 
              key={poll._id} 
              style={[
                styles.postCard,
                {
                  opacity: postsAnim,
                  transform: [{
                    translateY: postsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    })
                  }]
                }
              ]}
            >
              <View style={styles.postHeader}>
                <View style={styles.postAuthorInfo}>
                  {/* <View style={styles.postAvatar}>
                    <Ionicons name="bar-chart" size={20} color="#6b7280" />
                  </View> */}
                  <Text style={styles.postAuthor}>Community Poll</Text>
                </View>
                <Text style={styles.postTime}>
                  {new Date(poll.createdAt).toLocaleDateString()}
                </Text>
              </View>
              
              <Text style={styles.postTitle}>{poll.title}</Text>
              {poll.description && (
                <Text style={styles.postContent}>{poll.description}</Text>
              )}
              
              {/* Poll Options */}
              <View style={styles.pollOptionsContainer}>
                {poll.options.map((option: string, optionIndex: number) => {
                  const isSelected = selectedPollVotes[poll._id]?.includes(optionIndex) || false;
                  const voteCount = poll.optionVotes?.[optionIndex] || 0;
                  const totalVotes = poll.totalVotes || 0;
                  const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                  const isWinningOption = !poll.isActive && poll.winningOption && poll.winningOption.tiedIndices?.includes(optionIndex);
                  const isTied = isWinningOption && poll.winningOption?.isTied;
                  
                  return (
                    <TouchableOpacity
                      key={optionIndex}
                      style={[
                        styles.pollOption,
                        isSelected && styles.pollOptionSelected,
                        !poll.isActive && styles.pollOptionDisabled,
                        isWinningOption && styles.pollWinningOption
                      ]}
                      onPress={() => poll.isActive ? handleVoteOnPoll(poll._id, optionIndex) : null}
                      disabled={!poll.isActive}
                    >
                      <View style={styles.pollOptionContent}>
                        <Text style={[
                          styles.pollOptionText,
                          isSelected && styles.pollOptionTextSelected,
                          isWinningOption && styles.pollWinningOptionText
                        ]}>
                          {option}
                        </Text>
                        <Text style={[
                          styles.pollVoteCount,
                          isWinningOption && styles.pollWinningVoteCount
                        ]}>
                          {voteCount} votes ({percentage.toFixed(1)}%)
                        </Text>
                      </View>
                      <View style={styles.pollOptionActions}>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#2563eb" />
                        )}
                        {isWinningOption && (
                          <View style={styles.winningBadge}>
                            <Ionicons name="trophy" size={16} color="#ffffff" />
                            <Text style={styles.winningBadgeText}>
                              {isTied ? 'Tied' : 'Most Voted'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              <View style={styles.postFooter}>
                <View style={styles.actionButton}>
                  <Ionicons name="people" size={16} color="#6b7280" />
                  <Text style={styles.actionText}>{poll.totalVotes || 0} total votes</Text>
                </View>
                
                {poll.allowMultipleVotes && (
                  <View style={styles.actionButton}>
                    <Ionicons name="checkmark-done" size={16} color="#6b7280" />
                    <Text style={styles.actionText}>Multiple votes allowed</Text>
                  </View>
                )}
              </View>
            </Animated.View>
            );
          })()}
                
          <TouchableOpacity 
            style={[
              styles.viewMoreButton,
              (isMobileDevice || screenWidth < 1024) && styles.viewMoreButtonMobile
            ]}
            onPress={() => navigateCommunity('polls')}
          >
            <Text style={[styles.viewMoreButtonText, { color: sectionRainbowColors.poll }]}>
              View all polls
            </Text>
            <Ionicons name="arrow-forward" size={14} color={sectionRainbowColors.poll} />
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      {residentNotifications.length > 0 ? (
        <Animated.View style={[
          styles.section,
          !showMobileNav && styles.sectionDesktop,
          {
            opacity: officeAnim,
            transform: [{
              translateY: officeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              })
            }]
          }
        ]}>
          <View style={styles.communityHeader}>
            <Ionicons name="home" size={24} color="#64748b" />
            <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>Neighbor Updates</Text>
          </View>
          {residentNotifications.slice(0, 2).map((notification: any) => (
            <TouchableOpacity
              key={notification._id}
              style={styles.neighborUpdateCard}
              activeOpacity={0.85}
              onPress={() => navigateCommunity('notifications')}
            >
              <Text style={styles.neighborUpdateTitle}>
                {notification.type === 'Selling' ? 'Home for sale' : 'Moving out'} · {notification.residentName}
              </Text>
              <Text style={styles.neighborUpdateAddress} numberOfLines={1}>
                {notification.residentAddress}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.viewMoreButton} onPress={() => navigateCommunity('notifications')}>
            <Text style={[styles.viewMoreButtonText, { color: sectionRainbowColors.neighbors }]}>
              View all updates
            </Text>
            <Ionicons name="arrow-forward" size={14} color={sectionRainbowColors.neighbors} />
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      {/* Office Information */}
      <Animated.View style={[
        styles.section,
        !showMobileNav && styles.sectionDesktop,
        {
          opacity: officeAnim,
          transform: [{
            translateY: officeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            })
          }]
        }
      ]}>
        <View style={styles.officeHeader}>
          <Ionicons name="business" size={24} color="#64748b" />
          <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>Office Information</Text>
        </View>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color="#6b7280" />
            <Text style={styles.infoText}>{hoaInfo?.address ?? ''}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time" size={20} color="#6b7280" />
            <Text style={styles.infoText}>{hoaInfo?.officeHours ?? ''}</Text>
          </View>
          {/* <View style={styles.infoRow}>
            <Ionicons name="call" size={20} color="#6b7280" />
            <Text style={styles.infoText}>{hoaInfo?.phone ?? ''}</Text>
          </View> */}
          <View style={styles.infoRow}>
            <Ionicons name="mail" size={20} color="#6b7280" />
            <Text style={styles.infoText}>{hoaInfo?.email ?? ''}</Text>
          </View>
        </View>
      </Animated.View>
      
      {/* Final spacer for extra scroll space */}
      <View style={styles.spacer} />
      </ScrollView>
      <ScrollToTopButton visible={showScrollToTop} onPress={scrollToTop} />
      </View>

      
      {/* Custom Alert */}
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        type={alertState.type}
        onClose={hideAlert}
        
      />

      {/* What's New — only when HOME_UI_UPDATE_NOTICE_ENABLED is true */}
      <Modal
        visible={HOME_UI_UPDATE_NOTICE_ENABLED && showUiUpdateModal}
        transparent
        animationType="fade"
      >
        <View style={styles.uiUpdateModalOverlay}>
          <View style={styles.uiUpdateModalContent}>
            <Image
              source={require('../../assets/HOME_UI_UPDATE_NOTICE_VERSION.png')}
              style={styles.uiUpdateModalImage}
              resizeMode="contain"
            />
            <Text style={styles.uiUpdateModalTitle}>What's New</Text>
            <Text style={styles.uiUpdateModalMessage}>
              New HOA tab/content and improved damage report flow are now live.
            </Text>
            <TouchableOpacity
              style={styles.uiUpdateModalButton}
              onPress={handleDismissUiUpdateModal}
            >
              <Text style={styles.uiUpdateModalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pet Registration Prompt Modal */}
      <Modal
        visible={showPetRegistrationModal}
        transparent
        animationType="fade"
      >
        <View style={styles.petModalOverlay}>
          <View style={styles.petModalContent}>
            <View style={styles.petModalIcon}>
              <Ionicons name="paw" size={48} color="#eab308" />
            </View>
            <Text style={styles.petModalTitle}>Pet Registration</Text>
            <Text style={styles.petModalMessage}>
              Have you registered your pet with the HOA? Pet registration is required per community guidelines.
            </Text>
            <View style={styles.petModalButtons}>
              <TouchableOpacity
                style={[styles.petModalButton, styles.petModalButtonNotYet]}
                onPress={handlePetRegistrationNotYet}
              >
                <Ionicons name="paw-outline" size={20} color="#ffffff" />
                <Text style={styles.petModalButtonText}>Not Yet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.petModalButton, styles.petModalButtonYes]}
                onPress={handlePetRegistrationYes}
              >
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                <Text style={styles.petModalButtonText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollContainer: {
    flex: 1,
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
    justifyContent: 'space-between',
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  headerImage: {
    borderRadius: 0,
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
    marginBottom: 10,
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
  userInfo: {
    marginTop: 5,
    zIndex: 1,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userRole: {
    fontSize: 14,
    color: '#e0e7ff',
    opacity: 0.9,
  },
  welcomeText: ({
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
    opacity: 0.95,
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)' as any,
    textAlign: 'center',
  } as any),
  hoaName: ({
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)' as any,
    textAlign: 'center',
  } as any),
  subtitle: ({
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.9,
    marginTop: 8,
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)' as any,
    textAlign: 'center',
  } as any),
  // quickActions: {
  //   flexDirection: 'row',
  //   justifyContent: 'space-around',
  //   padding: 20,
  //   backgroundColor: '#ffffff',
  //   margin: 15,
  //   borderRadius: 16,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 4 },
  //   shadowOpacity: 0.08,
  //   shadowRadius: 12,
  //   elevation: 4,
  //   borderWidth: 1,
  //   borderColor: '#f1f5f9',
  // },
  actionButton: {
    alignItems: 'center',
    padding: 15,
  },
  actionText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  section: {
    marginHorizontal: 15,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderLeftWidth: 0,
  },
  sectionDesktop: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    marginHorizontal: 0,
    marginBottom: 16,
  },
  dashboardPanel: {
    marginHorizontal: 15,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderLeftWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  dashboardPanelDesktop: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    marginHorizontal: 0,
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 15,
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  officeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  notificationCard: {
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  notificationContent: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  postCard: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  compactPostCard: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compactPostMeta: {
    flex: 1,
    minWidth: 0,
  },
  compactPostTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  compactPostContent: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  emptySectionState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptySectionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptySectionButton: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  emptySectionButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  neighborUpdateCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  neighborUpdateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  neighborUpdateAddress: {
    fontSize: 13,
    color: '#475569',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  postAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  postAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  postCategory: {
    fontSize: 11,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    flexShrink: 0,
    maxWidth: 88,
    textAlign: 'center',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    lineHeight: 22,
  },
  postContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 8,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  postTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postStatsText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
    marginRight: 12,
  },
  postImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 12,
    gap: 8,
  },
  postImageWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  postImage: {
    width: Platform.OS === 'web' ? 120 : 100,
    height: Platform.OS === 'web' ? 120 : 100,
    borderRadius: 8,
  },
  imageLoading: {
    width: Platform.OS === 'web' ? 120 : 100,
    height: Platform.OS === 'web' ? 120 : 100,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 4,
  },
  viewMoreButtonMobile: {
    alignSelf: 'flex-end',
    width: '100%',
    justifyContent: 'flex-end',
  },
  viewMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pollOptionsContainer: {
    marginVertical: 12,
  },
  pollOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  pollOptionSelected: {
    backgroundColor: '#e0e7ff',
    borderColor: '#2563eb',
  },
  pollOptionContent: {
    flex: 1,
  },
  pollOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 4,
  },
  pollOptionTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  pollVoteCount: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  pollOptionDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
    opacity: 0.6,
  },
  pollWinningOption: {
    backgroundColor: '#fef3c7',
    borderLeftColor: '#f59e0b',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  pollWinningOptionText: {
    color: '#92400e',
    fontWeight: '700',
  },
  pollWinningVoteCount: {
    color: '#92400e',
    fontWeight: '700',
  },
  pollOptionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  winningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  winningBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
    marginLeft: 4,
  },
  viewMoreText: {
    fontSize: 12,
    color: '#f97316',
    marginRight: 4,
  },
  viewPollButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewPollButtonOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  guidelineText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
  eventText: {
    fontSize: 14,
    color: '#374151',
  },
  petModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  petModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
  },
  petModalIcon: {
    marginBottom: 16,
  },
  petModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  petModalMessage: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  petModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  petModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    minWidth: 120,
  },
  petModalButtonNotYet: {
    backgroundColor: '#3b82f6',
  },
  petModalButtonYes: {
    backgroundColor: '#10b981',
  },
  petModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  uiUpdateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  uiUpdateModalContent: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  uiUpdateModalImage: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    marginBottom: 12,
  },
  uiUpdateModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  uiUpdateModalMessage: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 14,
  },
  uiUpdateModalButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  uiUpdateModalButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default HomeScreen; 
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ImageBackground,
  Platform,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from 'convex/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import BoardMemberIndicator from '../components/BoardMemberIndicator';
import DeveloperIndicator from '../components/DeveloperIndicator';
import CustomTabBar from '../components/CustomTabBar';
import MobileTabBar from '../components/MobileTabBar';
import { webCompatibleAlert } from '../utils/webCompatibleAlert';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import ProfileImage from '../components/ProfileImage';
import MessagingButton from '../components/MessagingButton';
import { useMessaging } from '../context/MessagingContext';

const HomeScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { setShowOverlay } = useMessaging();
  const isBoardMember = user?.isBoardMember && user?.isActive;
  const hoaInfo = useQuery(api.hoaInfo.get);
  // Use paginated queries with small initial limits for home screen
  const communityPostsData = useQuery(api.communityPosts.getPaginated, { limit: 5, offset: 0 });
  const communityPosts = communityPostsData?.items ?? [];
  
  const pollsData = useQuery(api.polls.getPaginated, { limit: 1, offset: 0 });
  const polls = pollsData?.items ?? [];
  const userVotes = useQuery(api.polls.getAllUserVotes, user ? { userId: user._id } : "skip");
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
  
  // ScrollView ref for better control
  const scrollViewRef = useRef<ScrollView>(null);

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

  const handleContact = (type: 'phone' | 'email') => {
    if (type === 'phone') {
      if (hoaInfo?.phone) Linking.openURL(`tel:${hoaInfo.phone}`);
    } else {
      if (hoaInfo?.email) Linking.openURL(`mailto:${hoaInfo.email}`);
    }
  };

  const handleEmergency = () => {
    webCompatibleAlert({
      title: 'Emergency Contact',
      message: `Call: ${hoaInfo?.emergencyContact ?? ''}`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call Now', 
          onPress: () => hoaInfo?.emergencyContact && Linking.openURL(`tel:${hoaInfo.emergencyContact}`) 
        }
      ]
    });
  };

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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
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
          showsVerticalScrollIndicator={true}
          bounces={true}
          scrollEnabled={true}
          alwaysBounceVertical={false}
          nestedScrollEnabled={true}
          removeClippedSubviews={false}
          scrollEventThrottle={16}
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
            onScroll: () => {
              // Ensure scrolling is working
            },
          })}
        >
      {/* Header */}
      <Animated.View
        style={[
          {
        opacity: fadeAnim,
          },
          styles.headerContainerIOS
        ]}
      >
        <ImageBackground
          source={require('../../assets/hoa-4k.jpg')}
          style={[styles.header, !isBoardMember && styles.headerNonMember]}
          imageStyle={styles.headerImage}
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
          <CustomTabBar />
        </Animated.View>
      )}

      {/* Quick Actions */}
      {/* <Animated.View style={[
        styles.quickActions,
        {
          opacity: quickActionsAnim,
          transform: [{
            translateY: quickActionsAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            })
          }]
        }
      ]}>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleContact('phone')}
          >
            <Ionicons name="call" size={24} color="#64748b" />
            <Text style={styles.actionText}>Call Office</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleContact('email')}
          >
            <Ionicons name="mail" size={24} color="#64748b" />
            <Text style={styles.actionText}>Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleEmergency}
          >
            <Ionicons name="warning" size={24} color="#64748b" />
            <Text style={styles.actionText}>Emergency</Text>
          </TouchableOpacity>
        </View>
      </Animated.View> */}

      {/* Recent Community Posts */}
      {(communityPosts?.filter((post: any) => post.category !== 'Complaint') || []).length > 0 && (
      <Animated.View style={[
        styles.section,
        { borderLeftColor: '#ef4444' }, // Orange
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
        {(communityPosts?.filter((post: any) => post.category !== 'Complaint') || []).slice(0, 2).map((post: any, index: number) => {
          return (
            <TouchableOpacity
              key={post._id}
              activeOpacity={0.8}
              onPress={() => {
                navigation.navigate('Community' as never, {
                  activeSubTab: 'posts',
                  selectedPostId: post._id
                });
              }}
            >
              <Animated.View
                style={[
                  styles.postCard,
                  {
                    opacity: postsAnim,
                    transform: [{
                      translateY: postsAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [30 + (index * 20), 0],
                      })
                    }]
                  }
                ]}
              >
              <View style={styles.postHeader}>
                <View style={styles.postAuthorInfo}>
                  <ProfileImage source={post.authorProfileImageUrl} size={40} style={{ marginRight: 8 }} />
                  <Text style={styles.postAuthor}>{post.author}</Text>
                </View>
                <Text style={styles.postCategory}>{post.category}</Text>
              </View>
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postContent}>
                {post.content}
              </Text>
              
              <View style={styles.postFooter}>
                <Text style={styles.postTime}>{formatDate(new Date(post.createdAt).toISOString())}</Text>
                <View style={styles.postStats}>
                  <Ionicons name="heart" size={16} color="#6b7280" />
                  <Text style={styles.postStatsText}>{post.likes}</Text>
                  <Ionicons name="chatbubble" size={16} color="#6b7280" />
                  <Text style={styles.postStatsText}>{post.comments?.length ?? 0}</Text>
                </View>
              </View>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
        
        {/* View More Button */}
        <TouchableOpacity
          style={styles.viewMoreButton}
          onPress={() => {
            navigation.navigate('Community' as never);
          }}
        >
          <Text style={styles.viewMoreButtonText}>View More</Text>
          <Ionicons name="arrow-forward" size={14} color="#ef4444" />
        </TouchableOpacity>
      </Animated.View>
      )}

      {/* Recent Polls */}
      {polls && polls.length > 0 && (
        <Animated.View style={[
          styles.section,
          { borderLeftColor: '#f97316' }, // Yellow
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
            <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>Recent Polls</Text>
          </View>
          {polls.slice(0, 1).map((poll: any, index: number) => (
            <Animated.View 
              key={poll._id} 
              style={[
                styles.postCard,
                {
                  opacity: postsAnim,
                  transform: [{
                    translateY: postsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30 + (index * 20), 0],
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
          ))}
                
          {/* View Poll Button */}
                <TouchableOpacity 
            style={[
              styles.viewMoreButton,
              (isMobileDevice || screenWidth < 1024) && styles.viewMoreButtonMobile
            ]}
                  onPress={() => {
              (navigation.navigate as any)('Community', { activeSubTab: 'polls' });
                  }}
                >
            <Text style={styles.viewMoreButtonText}>View Poll</Text>
            <Ionicons name="arrow-forward" size={14} color="#ef4444" />
                </TouchableOpacity>
        </Animated.View>
      )}

      {/* Office Information */}
      <Animated.View style={[
        styles.section,
        { borderLeftColor: '#eab308' }, // Green
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
      
      {/* Additional sections for more content - Community Guidelines */}
      <Animated.View style={[
        styles.section,
        { borderLeftColor: '#22c55e' }, // Blue
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
          <Ionicons name="information-circle" size={24} color="#64748b" />
          <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>Community Guidelines</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.guidelineText}>
            • Please keep noise levels down during quiet hours (10 PM - 7 AM)
          </Text>
          <Text style={styles.guidelineText}>
            • Maintain your property and common areas clean
          </Text>
          <Text style={styles.guidelineText}>
            • Follow parking regulations and assigned spaces
          </Text>
          <Text style={styles.guidelineText}>
            • Report maintenance issues promptly
          </Text>
        </View>
      </Animated.View>
      
      {/* Upcoming Events */}
      <Animated.View style={[
        styles.section,
        { borderLeftColor: '#3b82f6' }, // Indigo
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
          {(hoaInfo?.eventText || '').split(/\r?\n/).filter(line => line.trim().length > 0).length > 0 ? (
            (hoaInfo?.eventText || '').split(/\r?\n/).map((line, idx) => (
              <Text key={idx} style={styles.eventText}>{line}</Text>
            ))
          ) : (
            <Text style={styles.eventText}>No upcoming events posted.</Text>
          )}
        </View>
      </Animated.View>
      
      {/* Final spacer for extra scroll space */}
      <View style={styles.spacer} />
      </ScrollView>
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
    height: 240,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
    position: 'relative',
    justifyContent: 'space-between',
    width: '100%',
    alignSelf: 'stretch',
  },
  headerNonMember: {
    height: 215,
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
    margin: 15,
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
    borderLeftWidth: 4,
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
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
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
    color: '#ef4444',
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
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 8,
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
});

export default HomeScreen; 
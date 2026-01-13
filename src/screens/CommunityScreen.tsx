import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Image,
  ImageBackground,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { useQuery, useMutation } from 'convex/react';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import BoardMemberIndicator from '../components/BoardMemberIndicator';
import DeveloperIndicator from '../components/DeveloperIndicator';
import CustomTabBar from '../components/CustomTabBar';
import MobileTabBar from '../components/MobileTabBar';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import ProfileImage from '../components/ProfileImage';
import OptimizedImage from '../components/OptimizedImage';
import { getUploadReadyImage } from '../utils/imageUpload';
import MessagingButton from '../components/MessagingButton';
import { useMessaging } from '../context/MessagingContext';
import * as Linking from 'expo-linking';
import { notifyNewCommunityPost, notifyNewComment, notifyNewPoll, notifyResidentNotification } from '../utils/notificationHelpers';

const CommunityScreen = () => {
  const { user } = useAuth();
  const { setShowOverlay } = useMessaging();
  const convex = useConvex();
  const isBoardMember = user?.isBoardMember && user?.isActive;
  const route = useRoute();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'polls' | 'notifications' | 'pets'>('posts');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPostForComment, setSelectedPostForComment] = useState<any>(null);
  const [newComment, setNewComment] = useState('');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [loadedComments, setLoadedComments] = useState<{[postId: string]: any[]}>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Pagination state
  const [postsLimit, setPostsLimit] = useState(20);
  const [pollsLimit, setPollsLimit] = useState(20);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    category: 'General' as any,
    link: '',
  });

  // Notification state
  const [showAddNotificationModal, setShowAddNotificationModal] = useState(false);
  const [showEditNotificationModal, setShowEditNotificationModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [selectedImageStorageId, setSelectedImageStorageId] = useState<string | null>(null);
  const [selectedNotificationType, setSelectedNotificationType] = useState<string | null>(null);
  const [notificationSearchQuery, setNotificationSearchQuery] = useState('');
  const [notificationFormData, setNotificationFormData] = useState({
    residentId: '',
    type: 'Selling' as 'Selling' | 'Moving',
    listingDate: '',
    closingDate: '',
    realtorInfo: '',
    newResidentName: '',
    isRental: false,
    additionalInfo: '',
    houseImage: null as string | null,
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Pet state
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [showEditPetModal, setShowEditPetModal] = useState(false);
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [petPreviewImage, setPetPreviewImage] = useState<string | null>(null);
  const [removingPetImage, setRemovingPetImage] = useState(false);
  const [petFormData, setPetFormData] = useState({
    name: '',
    image: null as string | null,
  });
  const petModalOpacity = useRef(new Animated.Value(0)).current;
  const petModalTranslateY = useRef(new Animated.Value(300)).current;

  // Poll voting state
  const [selectedPollVotes, setSelectedPollVotes] = useState<{[pollId: string]: number[]}>({});
  
  // Poll creation state
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollForm, setPollForm] = useState({
    title: '',
    description: '',
    options: ['', ''],
    allowMultipleVotes: false,
    expiresAt: '',
  });
  
  // Image upload state
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [isSavingPet, setIsSavingPet] = useState(false);
  const [uploadingPetImage, setUploadingPetImage] = useState(false);
  const [isSavingNotification, setIsSavingNotification] = useState(false);
  const [uploadingNotificationImage, setUploadingNotificationImage] = useState(false);
  
  // Rainbow colors for posts and polls
  const borderColors = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
  ];

  // State for dynamic responsive behavior (only for web/desktop)
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Dynamic responsive check - show mobile nav when screen is too narrow for desktop nav
  // On mobile, always show mobile nav regardless of screen size
  const isMobileDevice = Platform.OS === 'ios' || Platform.OS === 'android';
  const showMobileNav = isMobileDevice || screenWidth < 1024; // Always mobile on mobile devices, responsive on web
  const showDesktopNav = !isMobileDevice && screenWidth >= 1024; // Only desktop nav on web when wide enough

  // Animation values
  const postModalOpacity = useRef(new Animated.Value(0)).current;
  const postModalTranslateY = useRef(new Animated.Value(300)).current;
  const commentModalOpacity = useRef(new Animated.Value(0)).current;
  const commentModalTranslateY = useRef(new Animated.Value(400)).current;
  const notificationModalOpacity = useRef(new Animated.Value(0)).current;
  const notificationModalTranslateY = useRef(new Animated.Value(300)).current;
  const pollModalOpacity = useRef(new Animated.Value(0)).current;
  const pollModalTranslateY = useRef(new Animated.Value(300)).current;
  const contentAnim = useRef(new Animated.Value(1)).current;
  
  // Scroll reference for better control
  const listRef = useRef<FlatList<any>>(null);

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
        if (listRef.current) {
          // Force a layout update
          listRef.current.scrollToOffset({ offset: 0, animated: false });
          
          // Debug logging removed
        }
      }, 100);
      
      return () => {
        document.body.style.cursor = 'default';
      };
    }
  }, [screenWidth, showMobileNav, showDesktopNav]);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current; // Start at 1 to avoid flash on tab click

  // Convex queries - using paginated queries
  const postsData = useQuery(api.communityPosts.getPaginated, { limit: postsLimit, offset: 0 });
  const posts = postsData?.items ?? [];
  const postsTotal = postsData?.total ?? 0;
  
  const pollsData = useQuery(api.polls.getPaginated, { limit: pollsLimit, offset: 0 });
  const polls = pollsData?.items ?? [];
  const pollsTotal = pollsData?.total ?? 0;
  
  const userVotes = useQuery(api.polls.getAllUserVotes, user ? { userId: user._id } : "skip");
  
  // Lazy load comments for posts when expanded
  const postsWithComments = (posts || []).map((post: any) => {
    if (!post || !post._id) return post;
    const postId = post._id;
    const hasLoadedComments = loadedComments[postId] !== undefined;
    const comments = hasLoadedComments ? (loadedComments[postId] || []) : (post.comments || []);
    return { ...post, comments };
  });
  const notifications = useQuery(api.residentNotifications.getAllActive);
  const residents = useQuery(api.residents.getAll);
  const pets = useQuery(api.pets.getAll) || [];
  
  // Helper function to check if a comment author is a board member
  const isCommentAuthorBoardMember = (authorName: string) => {
    if (!residents || !Array.isArray(residents) || !authorName) return false;
    const resident = residents.find((r: any) => {
      if (!r || !r.firstName || !r.lastName) return false;
      const fullName = `${r.firstName} ${r.lastName}`;
      return fullName === authorName;
    });
    return resident?.isBoardMember && resident?.isActive;
  };

  // Helper function to check if a comment author is a developer
  const isCommentAuthorDeveloper = (authorName: string) => {
    if (!residents || !Array.isArray(residents) || !authorName) return false;
    const resident = residents.find((r: any) => {
      if (!r || !r.firstName || !r.lastName) return false;
      const fullName = `${r.firstName} ${r.lastName}`;
      return fullName === authorName;
    });
    return resident?.isDev ?? false;
  };

  // Convex mutations
  const createPost = useMutation(api.communityPosts.create);
  const addComment = useMutation(api.communityPosts.addComment);
  const likePost = useMutation(api.communityPosts.like);
  const voteOnPoll = useMutation(api.polls.vote);
  const createPoll = useMutation(api.polls.create);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const deleteStorageFile = useMutation(api.storage.deleteStorageFile);
  const createNotification = useMutation(api.residentNotifications.create);
  const updateNotification = useMutation(api.residentNotifications.update);
  const deleteNotification = useMutation(api.residentNotifications.remove);
  const createPet = useMutation(api.pets.create);
  const updatePet = useMutation(api.pets.update);
  const deletePet = useMutation(api.pets.remove);

  const categories = ['General', 'Event', 'Suggestion', 'Lost & Found'];
  const postCategories = ['General', 'Event', 'Complaint', 'Suggestion', 'Lost & Found']; // Include Complaint for post creation
  const COMMENTS_PREVIEW_LIMIT = 2; // Show only 2 comments initially

  // Modern animation functions
  const animateIn = (modalType: 'post' | 'comment') => {
    const opacity = modalType === 'post' ? postModalOpacity : commentModalOpacity;
    const translateY = modalType === 'post' ? postModalTranslateY : commentModalTranslateY;
    
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const animateOut = (modalType: 'post' | 'comment', callback: () => void) => {
    const opacity = modalType === 'post' ? postModalOpacity : commentModalOpacity;
    const translateY = modalType === 'post' ? postModalTranslateY : commentModalTranslateY;
    
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: modalType === 'post' ? 300 : 400,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      callback();
    });
  };

  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  // fadeAnim starts at 1, no fade-in animation needed
  // const animateFadeIn = () => {
  //   Animated.timing(fadeAnim, {
  //     toValue: 1,
  //     duration: 600,
  //     useNativeDriver: Platform.OS !== 'web',
  //   }).start();
  // };

  // Initialize animations on component mount
  // fadeAnim is already at 1, no need to animate
  // useEffect(() => {
  //   Animated.timing(fadeAnim, {
  //     toValue: 1,
  //     duration: 600,
  //     useNativeDriver: Platform.OS !== 'web',
  //   }).start();
  // }, []);

  // Handle route params to set active sub-tab and selected post
  useEffect(() => {
    const params = route.params as {
      activeSubTab?: 'posts' | 'polls' | 'notifications' | 'pets';
      selectedPostId?: string;
    } | undefined;
    if (params?.activeSubTab) {
      setActiveSubTab(params.activeSubTab);
    }
    if (params?.selectedPostId) {
      setSelectedPostId(params.selectedPostId);
    }
  }, [route.params]);

  // Clear selected post when navigating away from posts tab
  useEffect(() => {
    if (activeSubTab !== 'posts') {
      setSelectedPostId(null);
    }
  }, [activeSubTab]);

  // Update selectedPollVotes when userVotes data is available
  useEffect(() => {
    if (userVotes) {
      setSelectedPollVotes(userVotes);
    }
  }, [userVotes]);

  // Handle poll modal animation when visibility changes
  useEffect(() => {
    if (showPollModal) {
      pollModalOpacity.setValue(1);
      pollModalTranslateY.setValue(0);
      pollModalTranslateY.setValue(50);
      Animated.spring(pollModalTranslateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      overlayOpacity.setValue(1);
    } else {
      pollModalOpacity.setValue(0);
      pollModalTranslateY.setValue(300);
      overlayOpacity.setValue(0);
    }
  }, [showPollModal]);

  const filteredPosts = postsWithComments.filter((post: any) => {
    // Exclude complaint posts from regular users - only admins see them in AdminScreen
    if (post.category === 'Complaint') {
      return false;
    }
    // Apply category filter if one is selected
    return !selectedCategory || post.category === selectedCategory;
  });

  // Separate posts and polls for display
  const postsContent = filteredPosts.map(post => ({ ...post, type: 'post' })).sort((a, b) => b.createdAt - a.createdAt);
  const pollsContent = polls.map(poll => ({ ...poll, type: 'poll' })).sort((a, b) => b.createdAt - a.createdAt);

  // Scroll to selected post when it's set
  useEffect(() => {
    if (selectedPostId && postsContent && listRef.current) {
      const selectedIndex = postsContent.findIndex((post: any) => post._id === selectedPostId);
      if (selectedIndex >= 0) {
        // Scroll to the selected post with some offset for the header
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index: selectedIndex,
            animated: true,
            viewOffset: 100, // Offset for header
          });
        }, 500); // Delay to allow list to render
      }
    }
  }, [selectedPostId, postsContent]);

  // Pagination: show all posts/polls up to the limit, with "Load More" button
  const hasMorePosts = postsTotal > postsLimit;
  const hasMorePolls = pollsTotal > pollsLimit;
  
  const loadMorePosts = () => {
    setPostsLimit(prev => prev + 20);
  };
  
  const loadMorePolls = () => {
    setPollsLimit(prev => prev + 20);
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleLike = async (postId: string) => {
    try {
      await likePost({ id: postId as any });
    } catch (error) {
      // Silently handle like errors
      Alert.alert('Error', 'Failed to like post');
    }
  };

  // Lazy load comments for expanded posts - load comments when post is expanded
  // We'll load comments on-demand when toggleComments is called

  // Lazy load comments: Query comments for posts that are expanded
  // We'll query for up to 5 expanded posts at a time to limit concurrent queries
  const expandedPostIds = Array.from(expandedComments || []);
  const postsNeedingComments = expandedPostIds
    .filter(postId => postId && !loadedComments[postId])
    .slice(0, 5); // Limit to 5 concurrent comment queries
  
  // Query comments for posts that need them
  const comment1 = useQuery(
    api.communityPosts.getCommentsByPost,
    postsNeedingComments[0] ? { postId: postsNeedingComments[0] as any } : "skip"
  );
  const comment2 = useQuery(
    api.communityPosts.getCommentsByPost,
    postsNeedingComments[1] ? { postId: postsNeedingComments[1] as any } : "skip"
  );
  const comment3 = useQuery(
    api.communityPosts.getCommentsByPost,
    postsNeedingComments[2] ? { postId: postsNeedingComments[2] as any } : "skip"
  );
  const comment4 = useQuery(
    api.communityPosts.getCommentsByPost,
    postsNeedingComments[3] ? { postId: postsNeedingComments[3] as any } : "skip"
  );
  const comment5 = useQuery(
    api.communityPosts.getCommentsByPost,
    postsNeedingComments[4] ? { postId: postsNeedingComments[4] as any } : "skip"
  );
  
  const commentResults = [comment1, comment2, comment3, comment4, comment5];
  
  // Update loadedComments when comments are fetched
  React.useEffect(() => {
    if (!postsNeedingComments || postsNeedingComments.length === 0) return;
    
    postsNeedingComments.forEach((postId, index) => {
      if (!postId) return;
      const comments = commentResults[index];
      if (comments && Array.isArray(comments) && !loadedComments[postId]) {
        setLoadedComments(prev => ({
          ...prev,
          [postId]: comments
        }));
      }
    });
  }, [postsNeedingComments.join(','), commentResults.map(c => c ? 'loaded' : 'pending').join(',')]);
  
  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handleCommentPress = (post: any) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to comment');
      return;
    }
    setSelectedPostForComment(post);
    setShowCommentModal(true);
    animateIn('comment');
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    if (!selectedPostForComment) {
      Alert.alert('Error', 'No post selected');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Please sign in to comment');
      return;
    }

    try {
      await addComment({
        postId: selectedPostForComment._id as any,
        author: `${user.firstName} ${user.lastName}`,
        content: newComment.trim(),
      });

      // Send notification for new comment
      await notifyNewComment(`${user.firstName} ${user.lastName}`, selectedPostForComment.title);

      // Auto-expand comments for the post that just got a new comment
      setExpandedComments(prev => new Set(prev).add(selectedPostForComment._id));

      setNewComment('');
      animateOut('comment', () => {
        setShowCommentModal(false);
        setSelectedPostForComment(null);
      });
    } catch (error) {
      // Silently handle comment errors
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Please sign in to create a post');
      return;
    }

    try {
      setIsCreatingPost(true);
      // Upload images first
      const uploadedImageUrls = await uploadImages();

      await createPost({
        title: newPost.title,
        content: newPost.content,
        category: newPost.category,
        author: `${user.firstName} ${user.lastName}`,
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
        link: newPost.link.trim() || undefined,
      });

      // Send notification for new community post
      await notifyNewCommunityPost(`${user.firstName} ${user.lastName}`, newPost.title, newPost.category, convex);

      setNewPost({ title: '', content: '', category: 'General', link: '' });
      setSelectedImages([]);
      animateOut('post', () => {
        setShowNewPostModal(false);
      });
    } catch (error) {
      // Silently handle post creation errors
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setIsCreatingPost(false);
    }
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

    // Check if poll is active
    const poll = polls.find(p => p._id === pollId);
    if (!poll || !poll.isActive) {
      showAlert({
        title: 'Error',
        message: 'This poll is no longer active',
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
        const poll = polls.find(p => p._id === pollId);
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
        pollId: pollId as any,
        userId: user._id,
        selectedOptions: newVotes,
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

  // Poll creation handlers
  const handleCreatePoll = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to create a poll');
      return;
    }

    try {
      if (!pollForm.title || pollForm.options.filter(opt => opt.trim()).length < 2) {
        Alert.alert('Error', 'Please provide a title and at least 2 options.');
        return;
      }

      const validOptions = pollForm.options.filter(opt => opt.trim());
      
      await createPoll({
        title: pollForm.title,
        description: pollForm.description || undefined,
        options: validOptions,
        allowMultipleVotes: pollForm.allowMultipleVotes,
        expiresAt: pollForm.expiresAt ? new Date(pollForm.expiresAt).getTime() : undefined,
        createdBy: `${user.firstName} ${user.lastName}`,
      });

      // Send notification for new poll
      await notifyNewPoll(pollForm.title, `${user.firstName} ${user.lastName}`, convex);

      Alert.alert('Success', 'Poll created successfully!');
      
      setShowPollModal(false);
      setPollForm({
        title: '',
        description: '',
        options: ['', ''],
        allowMultipleVotes: false,
        expiresAt: '',
      });
      pollModalOpacity.setValue(0);
      pollModalTranslateY.setValue(300);
      overlayOpacity.setValue(0);
    } catch (error) {
      console.error('Error creating poll:', error);
      Alert.alert('Error', 'Failed to create poll. Please try again.');
    }
  };

  const handleCancelPoll = () => {
    setShowPollModal(false);
    setPollForm({
      title: '',
      description: '',
      options: ['', ''],
      allowMultipleVotes: false,
      expiresAt: '',
    });
    pollModalOpacity.setValue(0);
    pollModalTranslateY.setValue(300);
    overlayOpacity.setValue(0);
  };

  const addPollOption = () => {
    if (pollForm.options.length < 10) {
      setPollForm(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removePollOption = (index: number) => {
    if (pollForm.options.length > 2) {
      setPollForm(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    setPollForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const pickImage = async () => {
    if (selectedImages.length >= 5) {
      Alert.alert('Limit Reached', 'You can only add up to 5 images per post.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setSelectedImages(prev => [...prev, imageUri]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (selectedImages.length === 0) return [];

    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    try {
      for (const imageUri of selectedImages) {
        try {
          const uploadUrl = await generateUploadUrl();
          const { blob, mimeType } = await getUploadReadyImage(imageUri);

          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': mimeType },
            body: blob,
          });

          if (!uploadResponse.ok) {
            throw new Error('Upload failed');
          }

          const { storageId } = await uploadResponse.json();
          uploadedUrls.push(storageId);
        } catch (imageError: any) {
          console.error('Error uploading individual image:', imageError);
          console.error('Image URI:', imageUri);
          console.error('Error details:', {
            message: imageError?.message,
            stack: imageError?.stack,
            name: imageError?.name,
          });
          // Continue with other images even if one fails
          throw imageError;
        }
      }

      return uploadedUrls;
    } catch (error: any) {
      console.error('Error uploading images:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      Alert.alert('Error', `Failed to upload images: ${error?.message || 'Unknown error'}`);
      return [];
    } finally {
      setUploadingImages(false);
    }
  };

  // Helper component for displaying images with URL resolution
  const PostImage = ({ storageId }: { storageId: string }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedImageStorageId(storageId);
        setShowImageModal(true);
      }}
      activeOpacity={0.9}
      style={styles.postImageWrapper}
    >
      <OptimizedImage
        storageId={storageId}
        style={styles.postImage}
        contentFit="cover"
        priority="high"
      />
    </TouchableOpacity>
  );

  // Helper component for notification house images
  const HouseImage = ({ storageId, isFullScreen = false }: { storageId: string; isFullScreen?: boolean }) => {
    return (
      <OptimizedImage
        storageId={storageId}
        style={isFullScreen ? styles.fullImage : styles.cardHouseImage}
        contentFit={isFullScreen ? 'contain' : 'cover'}
        priority="high"
        placeholderContent={
          <View style={isFullScreen ? styles.fullImageLoading : styles.imageLoading}>
            <Ionicons name="image" size={24} color="#9ca3af" />
          </View>
        }
      />
    );
  };

  // Notification helper functions
  const formatDateInput = (text: string): string => {
    const numbers = text.replace(/\D/g, '');
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 4)}-${numbers.slice(4, 8)}`;
    }
  };

  const pickNotificationImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPreviewImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadNotificationImage = async (imageUri: string): Promise<string> => {
    try {
      const uploadUrl = await generateUploadUrl();
      const { blob, mimeType } = await getUploadReadyImage(imageUri);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });
      const { storageId } = await uploadResponse.json();
      return storageId;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  };

  const animateNotificationModalIn = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(notificationModalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(notificationModalTranslateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const animateNotificationModalOut = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(notificationModalOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(notificationModalTranslateY, {
        toValue: 300,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(callback);
  };

  const handleAddNotification = () => {
    setNotificationFormData({
      residentId: '',
      type: 'Selling',
      listingDate: '',
      closingDate: '',
      realtorInfo: '',
      newResidentName: '',
      isRental: false,
      additionalInfo: '',
      houseImage: null,
    });
    setPreviewImage(null);
    setShowAddNotificationModal(true);
    animateNotificationModalIn();
  };

  const handleEditNotification = (notification: any) => {
    setSelectedNotification(notification);
    setNotificationFormData({
      residentId: notification.residentId,
      type: notification.type,
      listingDate: notification.listingDate || '',
      closingDate: notification.closingDate || '',
      realtorInfo: notification.realtorInfo || '',
      newResidentName: notification.newResidentName || '',
      isRental: notification.isRental || false,
      additionalInfo: notification.additionalInfo || '',
      houseImage: notification.houseImage || null,
    });
    setPreviewImage(null);
    setShowEditNotificationModal(true);
    animateNotificationModalIn();
  };

  const handleSubmitNotification = async () => {
    if (!notificationFormData.residentId) {
      Alert.alert('Error', 'Please select a resident');
      return;
    }

    setIsSavingNotification(true);

    try {
      let houseImageId: string | undefined;
      if (previewImage) {
        setUploadingNotificationImage(true);
        houseImageId = await uploadNotificationImage(previewImage);
        setUploadingNotificationImage(false);
      }

      if (showEditNotificationModal && selectedNotification) {
        if (!user?.email) {
          Alert.alert('Error', 'User email not found. Please log in again.');
          return;
        }
        await updateNotification({
          id: selectedNotification._id,
          updatedBy: user.email,
          listingDate: notificationFormData.listingDate || undefined,
          closingDate: notificationFormData.closingDate || undefined,
          realtorInfo: notificationFormData.realtorInfo || undefined,
          newResidentName: notificationFormData.newResidentName || undefined,
          isRental: notificationFormData.isRental || undefined,
          additionalInfo: notificationFormData.additionalInfo || undefined,
          houseImage: houseImageId || notificationFormData.houseImage || undefined,
        });
        Alert.alert('Success', 'Notification updated successfully');
      } else {
        if (!user?.email) {
          Alert.alert('Error', 'User email not found. Please log in again.');
          return;
        }
        await createNotification({
          residentId: notificationFormData.residentId as any,
          createdBy: user.email,
          type: notificationFormData.type,
          listingDate: notificationFormData.listingDate || undefined,
          closingDate: notificationFormData.closingDate || undefined,
          realtorInfo: notificationFormData.realtorInfo || undefined,
          newResidentName: notificationFormData.newResidentName || undefined,
          isRental: notificationFormData.isRental,
          additionalInfo: notificationFormData.additionalInfo || undefined,
          houseImage: houseImageId,
        });
        
        // Send notification for new resident notification
        const resident = residents?.find((r: any) => r._id === notificationFormData.residentId);
        if (resident) {
          const residentName = `${resident.firstName} ${resident.lastName}`;
          const address = `${resident.address}${resident.unitNumber ? ` #${resident.unitNumber}` : ''}`;
          await notifyResidentNotification(notificationFormData.type, residentName, address, convex);
        }
        
        Alert.alert('Success', showEditNotificationModal ? 'Notification updated successfully' : 'Notification created successfully');
      }

      setShowAddNotificationModal(false);
      setShowEditNotificationModal(false);
      setSelectedNotification(null);
      setPreviewImage(null);
      setNotificationSearchQuery('');
      setNotificationFormData({
        residentId: '',
        type: 'Selling',
        listingDate: '',
        closingDate: '',
        realtorInfo: '',
        newResidentName: '',
        isRental: false,
        additionalInfo: '',
        houseImage: null,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save notification');
    } finally {
      setIsSavingNotification(false);
      setUploadingNotificationImage(false);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!user?.email) {
      Alert.alert('Error', 'User email not found. Please log in again.');
      return;
    }
    
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNotification({ 
                id: notificationId as any,
                deletedBy: user.email 
              });
              Alert.alert('Success', 'Notification deleted');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const getResidentInfo = (residentId: any) => {
    const resident = residents?.find((r: any) => r._id === residentId);
    if (!resident) return { name: 'Unknown', address: '' };
    return {
      name: `${resident.firstName} ${resident.lastName}`,
      address: `${resident.address}${resident.unitNumber ? ` #${resident.unitNumber}` : ''}`,
    };
  };

  const notificationCards = notifications?.map((notification: any) => {
    const residentInfo = getResidentInfo(notification.residentId);
    return { ...notification, ...residentInfo };
  }).filter((notification: any) => {
    if (!selectedNotificationType) return true;
    return notification.type === selectedNotificationType;
  });

  // Pet helper functions
  const pickPetImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        setPetPreviewImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadPetImage = async (imageUri: string): Promise<string> => {
    try {
      setUploadingPetImage(true);
      const uploadUrl = await generateUploadUrl();
      const { blob, mimeType } = await getUploadReadyImage(imageUri);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });
      const { storageId } = await uploadResponse.json();
      return storageId;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    } finally {
      setUploadingPetImage(false);
    }
  };

  const handleRemovePetImage = async () => {
    if (!selectedPet || !selectedPet.image) {
      return;
    }

    try {
      setRemovingPetImage(true);
      
      // Delete the image from Convex storage
      if (!selectedPet.image.startsWith('http')) {
        await deleteStorageFile({ storageId: selectedPet.image as any });
      }
      
      // Update the pet to remove the image reference
      await updatePet({
        id: selectedPet._id,
        image: undefined,
      });

      // Update local state to remove the image
      setPetFormData({ ...petFormData, image: null });

      showAlert({
        title: 'Success',
        message: 'Pet image removed successfully!',
        type: 'success'
      });

      setTimeout(() => {
        hideAlert();
      }, 2000);
    } catch (error: any) {
      console.error('Error removing pet image:', error);
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to remove pet image',
        type: 'error'
      });
      
      setTimeout(() => {
        hideAlert();
      }, 2000);
    } finally {
      setRemovingPetImage(false);
    }
  };

  const animatePetModalIn = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(petModalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(petModalTranslateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const animatePetModalOut = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(petModalOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(petModalTranslateY, {
        toValue: 300,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(callback);
  };

  const handleAddPet = () => {
    if (!user?._id) {
      Alert.alert('Error', 'Please sign in to register a pet');
      return;
    }
    setPetFormData({
      name: '',
      image: null,
    });
    setPetPreviewImage(null);
    setShowAddPetModal(true);
    animatePetModalIn();
  };

  const handleEditPet = (pet: any) => {
    setSelectedPet(pet);
    setPetFormData({
      name: pet.name,
      image: pet.image || null,
    });
    setPetPreviewImage(null);
    setShowEditPetModal(true);
    animatePetModalIn();
  };

  const handleSubmitPet = async () => {
    if (!petFormData.name.trim()) {
      Alert.alert('Error', 'Please enter a pet name');
      return;
    }

    if (!user?._id) {
      Alert.alert('Error', 'Please sign in to register a pet');
      return;
    }

    try {
      setIsSavingPet(true);
      let petImageId: string | undefined;
      if (petPreviewImage) {
        // If editing, delete the old image before uploading the new one
        if (showEditPetModal && selectedPet && selectedPet.image) {
          await deleteStorageFile({ storageId: selectedPet.image as any });
        }
        petImageId = await uploadPetImage(petPreviewImage);
      } else if (!petFormData.image) {
        Alert.alert('Error', 'Please add a pet image');
        setIsSavingPet(false);
        return;
      }

      if (showEditPetModal && selectedPet) {
        await updatePet({
          id: selectedPet._id,
          name: petFormData.name.trim(),
          image: petImageId || petFormData.image || undefined,
        });
        Alert.alert('Success', 'Pet updated successfully');
      } else {
        await createPet({
          residentId: user._id as any,
          name: petFormData.name.trim(),
          image: petImageId || petFormData.image || '',
        });
        Alert.alert('Success', 'Pet registered successfully');
      }
      
      setShowAddPetModal(false);
      setShowEditPetModal(false);
      setSelectedPet(null);
      setPetPreviewImage(null);
      setPetFormData({
        name: '',
        image: null,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save pet');
    } finally {
      setIsSavingPet(false);
    }
  };

  const handleDeletePet = async (petId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this pet registration?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePet({ id: petId as any });
              Alert.alert('Success', 'Pet registration deleted');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  // Helper component for pet images
  const PetImage = ({ storageId, isFullScreen = false }: { storageId: string; isFullScreen?: boolean }) => (
    <OptimizedImage
      storageId={storageId}
      style={isFullScreen ? styles.fullImage : styles.petCardImage}
      contentFit={isFullScreen ? 'contain' : 'cover'}
      priority="high"
      placeholderContent={
        <View style={isFullScreen ? styles.fullImageLoading : styles.petImageLoading}>
          <Ionicons name="paw" size={32} color="#cbd5e1" />
          {isFullScreen && (
            <ActivityIndicator size="large" color="#cbd5e1" style={{ marginTop: 12 }} />
          )}
        </View>
      }
    />
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Event':
        return 'calendar';
      case 'Complaint':
        return 'warning';
      case 'Suggestion':
        return 'bulb';
      case 'Lost & Found':
        return 'search';
      default:
        return 'chatbubble';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Event':
        return '#3b82f6';
      case 'Complaint':
        return '#ef4444';
      case 'Suggestion':
        return '#f59e0b';
      case 'Lost & Found':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const renderTopContent = () => (
    <>
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
          source={Platform.OS === 'ios' ? require('../../assets/hoa-1k.jpg') : require('../../assets/hoa-2k.jpg')}
          style={[styles.header, !isBoardMember && styles.headerNonMember]}
          imageStyle={styles.headerImage}
          resizeMode="stretch"
        >
          <View style={styles.headerOverlay} />
          <View style={styles.headerTop}>
            {/* Hamburger Menu - Only when mobile nav is shown */}
            {showMobileNav && (
              <TouchableOpacity style={styles.menuButton} onPress={() => setIsMenuOpen(true)}>
                <Ionicons name="menu" size={24} color="#ffffff" />
              </TouchableOpacity>
            )}

            <View style={styles.headerLeft}>
              <View style={styles.titleContainer}>
                <Text style={styles.headerTitle}>Community Forum</Text>
              </View>
              <Text style={styles.headerSubtitle}>Connect with your neighbors and stay informed</Text>
              <View style={styles.indicatorsContainer}>
                <DeveloperIndicator />
                <BoardMemberIndicator />
              </View>
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
        </ImageBackground>
      </Animated.View>

      {/* Custom Tab Bar - Only when screen is wide enough */}
      {showDesktopNav && (
        <Animated.View
          style={{
            opacity: fadeAnim,
          }}
        >
          <CustomTabBar />
        </Animated.View>
      )}

      {/* Sub-tab Selector (Posts/Notifications/Pets) */}
      <Animated.View
        style={[
          styles.subTabContainer,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabContent}
          style={styles.subTabScrollView}
        >
          <TouchableOpacity
            style={[styles.subTabButton, activeSubTab === 'posts' && styles.subTabButtonActive]}
            onPress={() => setActiveSubTab('posts')}
          >
            <Ionicons
              name="chatbubbles"
              size={18}
              color={activeSubTab === 'posts' ? '#eab308' : '#6b7280'}
            />
            <Text
              style={[
                styles.subTabButtonText,
                activeSubTab === 'posts' && styles.subTabButtonTextActive,
              ]}
            >
              Posts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabButton, activeSubTab === 'polls' && styles.subTabButtonActive]}
            onPress={() => setActiveSubTab('polls')}
          >
            <Ionicons
              name="bar-chart"
              size={18}
              color={activeSubTab === 'polls' ? '#eab308' : '#6b7280'}
            />
            <Text
              style={[
                styles.subTabButtonText,
                activeSubTab === 'polls' && styles.subTabButtonTextActive,
              ]}
            >
              Polls
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTabButton,
              activeSubTab === 'notifications' && styles.subTabButtonActive,
            ]}
            onPress={() => setActiveSubTab('notifications')}
          >
            <Ionicons
              name="home"
              size={18}
              color={activeSubTab === 'notifications' ? '#eab308' : '#6b7280'}
            />
            <Text
              style={[
                styles.subTabButtonText,
                activeSubTab === 'notifications' && styles.subTabButtonTextActive,
              ]}
            >
              Moving/Leaving
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabButton, activeSubTab === 'pets' && styles.subTabButtonActive]}
            onPress={() => setActiveSubTab('pets')}
          >
            <Ionicons
              name="paw"
              size={18}
              color={activeSubTab === 'pets' ? '#eab308' : '#6b7280'}
            />
            <Text
              style={[
                styles.subTabButtonText,
                activeSubTab === 'pets' && styles.subTabButtonTextActive,
              ]}
            >
              Pet Registration
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Category Filter / Type Filter with Action Buttons */}
      {activeSubTab === 'posts' ? (
        <Animated.View
          style={[
            styles.categoryContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.filterRow}>
            <View style={styles.filterLabelContainer}>
              <Ionicons name="filter" size={16} color="#6b7280" style={styles.filterIcon} />
              <Text style={styles.filterLabel}>Filter:</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryContent}
              style={styles.categoryScrollView}
            >
              <TouchableOpacity
                style={[styles.categoryButton, !selectedCategory && styles.categoryButtonActive]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    !selectedCategory && styles.categoryButtonTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>

              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category && styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      selectedCategory === category && styles.categoryButtonTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Action Buttons - Desktop Only */}
            {showDesktopNav && (
              <View style={styles.actionButtonsContainer}>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={styles.newPostButton}
                    onPress={() => {
                      animateButtonPress();
                      setShowNewPostModal(true);
                      animateIn('post');
                    }}
                  >
                    <Ionicons name="add" size={18} color="#ffffff" />
                    <Text style={styles.newPostButtonText}>New Post</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}
          </View>
        </Animated.View>
      ) : activeSubTab === 'notifications' ? (
        <Animated.View
          style={[
            styles.typeFilterContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.filterRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typeFilterContent}
              style={styles.typeFilterScrollView}
            >
              <TouchableOpacity
                style={[
                  styles.typeFilterButton,
                  !selectedNotificationType && styles.typeFilterButtonActive,
                ]}
                onPress={() => setSelectedNotificationType(null)}
              >
                <Text
                  style={[
                    styles.typeFilterButtonText,
                    !selectedNotificationType && styles.typeFilterButtonTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeFilterButton,
                  selectedNotificationType === 'Selling' && styles.typeFilterButtonActive,
                ]}
                onPress={() => setSelectedNotificationType('Selling')}
              >
                <Text
                  style={[
                    styles.typeFilterButtonText,
                    selectedNotificationType === 'Selling' && styles.typeFilterButtonTextActive,
                  ]}
                >
                  Selling
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeFilterButton,
                  selectedNotificationType === 'Moving' && styles.typeFilterButtonActive,
                ]}
                onPress={() => setSelectedNotificationType('Moving')}
              >
                <Text
                  style={[
                    styles.typeFilterButtonText,
                    selectedNotificationType === 'Moving' && styles.typeFilterButtonTextActive,
                  ]}
                >
                  Moving
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Action Buttons - Desktop Only */}
            {showDesktopNav && (
              <View style={styles.actionButtonsContainer}>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity style={styles.addNotificationButton} onPress={handleAddNotification}>
                    <Ionicons name="add" size={18} color="#ffffff" />
                    <Text style={styles.addNotificationButtonText}>Add Notification</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}
          </View>
        </Animated.View>
      ) : activeSubTab === 'pets' ? (
        <Animated.View
          style={[
            styles.petsFilterContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={[styles.filterRow, styles.petsFilterRow]}>
            {/* Action Buttons - Desktop Only */}
            {showDesktopNav && (
              <View style={styles.actionButtonsContainer}>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity style={styles.addPetButton} onPress={handleAddPet}>
                    <Ionicons name="add" size={18} color="#ffffff" />
                    <Text style={styles.addPetButtonText}>Register Pet</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}
          </View>
        </Animated.View>
      ) : null}
    </>
  );

  const canLoadMorePosts = hasMorePosts;

  const handleLoadMorePosts = () => {
    if (canLoadMorePosts) {
      loadMorePosts();
    }
  };
  
  const canLoadMorePolls = hasMorePolls;
  
  const handleLoadMorePolls = () => {
    if (canLoadMorePolls) {
      loadMorePolls();
    }
  };

  const renderPostsEmpty = () => (
    <View style={styles.contentWrapper}>
      <View style={styles.emptyState}>
        <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
        <Text style={styles.emptyStateText}>No posts found</Text>
        <Text style={styles.emptyStateSubtext}>Be the first to start a conversation!</Text>
      </View>
    </View>
  );

  const renderPostItem = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.postItemWrapper}>
      <Animated.View
        style={[
          styles.postCard,
          selectedPostId === item._id && styles.selectedPostCard,
          {
            borderLeftColor: selectedPostId === item._id ? '#eab308' : borderColors[index % borderColors.length],
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.postHeader}>
          <View style={styles.postAuthor}>
            <ProfileImage source={item.authorProfileImageUrl} size={40} style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.authorName}>{item.author}</Text>
              <Text style={styles.postTime}>{formatDate(new Date(item.createdAt).toISOString())}</Text>
            </View>
          </View>
          <View style={styles.categoryBadge}>
            <Ionicons name={getCategoryIcon(item.category) as any} size={12} color={getCategoryColor(item.category)} />
            <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>{item.category}</Text>
          </View>
        </View>

        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postContent}>{item.content}</Text>

        {item.link && (
          <TouchableOpacity
            style={styles.linkContainer}
            onPress={() => {
              if (item.link) {
                Linking.openURL(item.link).catch(err => {
                  console.error('Failed to open link:', err);
                  Alert.alert('Error', 'Could not open the link');
                });
              }
            }}
          >
            <Ionicons name="link" size={16} color="#2563eb" />
            <Text style={styles.linkText} numberOfLines={1}>
              {item.link}
            </Text>
            <Ionicons name="open-outline" size={16} color="#2563eb" />
          </TouchableOpacity>
        )}

        {item.images && item.images.length > 0 && (
          <View style={styles.postImagesContainer}>
            {item.images.map((imageStorageId: string, imageIndex: number) => (
              <PostImage key={imageStorageId ?? imageIndex} storageId={imageStorageId} />
            ))}
          </View>
        )}

        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item._id)}>
            <Ionicons name="heart" size={16} color="#6b7280" />
            <Text style={styles.actionText}>{item.likes ?? 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => handleCommentPress(item)}>
            <Ionicons name="chatbubble" size={16} color="#6b7280" />
            <Text style={styles.actionText}>{item.comments?.length ?? 0}</Text>
          </TouchableOpacity>
        </View>

        {item.comments && item.comments.length > 0 && (
          <View style={styles.commentsSection}>
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Comments ({item.comments.length})</Text>
              {item.comments.length > COMMENTS_PREVIEW_LIMIT && (
                <TouchableOpacity style={styles.viewAllButton} onPress={() => toggleComments(item._id)}>
                  <Text style={styles.viewAllButtonText}>
                    {expandedComments.has(item._id) ? 'Show Less' : 'View All'}
                  </Text>
                  <Ionicons
                    name={expandedComments.has(item._id) ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#2563eb"
                  />
                </TouchableOpacity>
              )}
            </View>

            {item.comments.slice(0, COMMENTS_PREVIEW_LIMIT).map((comment: any, commentIndex: number) => (
              <View key={comment._id ?? commentIndex} style={styles.commentItem}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAuthorInfo}>
                    <ProfileImage source={comment.authorProfileImageUrl} size={24} style={{ marginRight: 6 }} />
                    <Text style={styles.commentAuthor}>{comment.author}</Text>
                    {isCommentAuthorDeveloper(comment.author) ? (
                      <View style={styles.developerBadge}>
                        <Ionicons name="code-slash" size={10} color="#ffffff" />
                        <Text style={styles.developerBadgeText}>Developer</Text>
                      </View>
                    ) : (
                      isCommentAuthorBoardMember(comment.author) && (
                        <View style={styles.boardMemberBadge}>
                          <Ionicons name="shield" size={10} color="#ffffff" />
                          <Text style={styles.boardMemberBadgeText}>Board Member</Text>
                        </View>
                      )
                    )}
                  </View>
                  <Text style={styles.commentTime}>
                    {formatDate(
                      comment.createdAt
                        ? new Date(comment.createdAt).toISOString()
                        : comment.timestamp || new Date().toISOString()
                    )}
                  </Text>
                </View>
                <Text style={styles.commentContent}>{comment.content}</Text>
              </View>
            ))}

            {expandedComments.has(item._id) && item.comments.length > COMMENTS_PREVIEW_LIMIT && (
              <View style={styles.expandedComments}>
                <View style={styles.commentsDivider} />
                <ScrollView style={styles.expandedCommentsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {item.comments.slice(COMMENTS_PREVIEW_LIMIT).map((comment: any, extraIndex: number) => (
                    <View key={comment._id ?? `expanded-${extraIndex}`} style={styles.commentItem}>
                      <View style={styles.commentHeader}>
                        <View style={styles.commentAuthorInfo}>
                          <ProfileImage source={comment.authorProfileImageUrl} size={24} style={{ marginRight: 6 }} />
                          <Text style={styles.commentAuthor}>{comment.author}</Text>
                          {isCommentAuthorDeveloper(comment.author) ? (
                            <View style={styles.developerBadge}>
                              <Ionicons name="code-slash" size={10} color="#ffffff" />
                              <Text style={styles.developerBadgeText}>Developer</Text>
                            </View>
                          ) : (
                            isCommentAuthorBoardMember(comment.author) && (
                              <View style={styles.boardMemberBadge}>
                                <Ionicons name="shield" size={10} color="#ffffff" />
                                <Text style={styles.boardMemberBadgeText}>Board Member</Text>
                              </View>
                            )
                          )}
                        </View>
                        <Text style={styles.commentTime}>
                          {formatDate(
                            comment.createdAt
                              ? new Date(comment.createdAt).toISOString()
                              : comment.timestamp || new Date().toISOString()
                          )}
                        </Text>
                      </View>
                      <Text style={styles.commentContent}>{comment.content}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
      {/* Mobile Navigation - Only when screen is narrow */}
      {showMobileNav && (
        <MobileTabBar 
          isMenuOpen={isMenuOpen}
          onMenuClose={() => setIsMenuOpen(false)}
        />
      )}
      
      {/* Posts List */}
      {activeSubTab === 'posts' ? (
        <Animated.FlatList
          ref={listRef}
          data={postsContent}
          keyExtractor={(item: any) => item._id}
          renderItem={renderPostItem}
          getItemLayout={(data, index) => ({
            length: 280, // Approximate height of each post card
            offset: 280 * index,
            index,
          })}
          ListHeaderComponent={renderTopContent}
          ListEmptyComponent={renderPostsEmpty}
          ListFooterComponent={
            canLoadMorePosts ? (
              <View style={styles.listFooter}>
                <ActivityIndicator size="small" color="#6b7280" />
                <Text style={styles.listFooterText}>Loading more posts...</Text>
              </View>
            ) : (
              <View style={styles.footerSpacer} />
            )
          }
          style={[styles.postsContainer, Platform.OS === 'web' && styles.webScrollContainer]}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'web' && { paddingBottom: 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          onEndReached={handleLoadMorePosts}
          onEndReachedThreshold={0.4}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={false}
          nestedScrollEnabled={true}
        />
      ) : (
        <ScrollView
          style={[styles.postsContainer, Platform.OS === 'web' && styles.webScrollContainer]}
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
          decelerationRate="normal"
          directionalLockEnabled={true}
          canCancelContentTouches={true}
          {...(Platform.OS === 'web' && {
            onScrollBeginDrag: () => {
              document.body.style.cursor = 'grabbing';
              document.body.style.userSelect = 'none';
            },
            onScrollEndDrag: () => {
              document.body.style.cursor = 'grab';
              document.body.style.userSelect = 'auto';
            },
          })}
        >
          {renderTopContent()}
        
        {/* Content with padding */}
        <View style={styles.contentWrapper}>
          {activeSubTab === 'polls' ? (
            pollsContent.length > 0 ? (
              <View style={styles.postsContainer}>
                {pollsContent.map((poll: any, index: number) => (
                  <Animated.View 
                    key={poll._id} 
                    style={[
                      styles.postCard,
                      {
                        borderLeftColor: borderColors[index % borderColors.length],
                        opacity: contentAnim,
                        transform: [{
                          translateY: contentAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [50, 0],
                          })
                        }]
                      }
                    ]}
                  >
                    <View style={styles.postHeader}>
                      <View style={styles.postAuthor}>
                        <View style={styles.avatar}>
                          <Ionicons name="bar-chart" size={20} color="#2563eb" />
                        </View>
                        <View>
                          <Text style={styles.authorName}>Community Poll</Text>
                          <Text style={styles.postTime}>
                            {formatDate(new Date(poll.createdAt).toISOString())}
                          </Text>
                        </View>
                      </View>
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
                {canLoadMorePolls && (
                  <View style={styles.listFooter}>
                    <TouchableOpacity 
                      style={styles.loadMoreButton}
                      onPress={handleLoadMorePolls}
                    >
                      <Text style={styles.loadMoreButtonText}>Load More Polls</Text>
                      <Ionicons name="chevron-down" size={16} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="bar-chart-outline" size={64} color="#9ca3af" />
                <Text style={styles.emptyStateText}>No polls yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Board members can create polls to gather community feedback
                </Text>
              </View>
            )
          ) : activeSubTab === 'notifications' ? (
            notificationCards && notificationCards.length > 0 ? (
              <View style={[
                styles.notificationsCardsContainer,
                showMobileNav && styles.notificationsCardsContainerMobile
              ]}>
                {notificationCards.map((notification: any) => {
                  const typeColor = notification.type === 'Selling' ? '#10b981' : '#f59e0b';
                  return (
                    <Animated.View 
                      key={notification._id} 
                      style={[
                        styles.notificationCard,
                        showMobileNav && styles.notificationCardMobile,
                        {
                          opacity: contentAnim,
                          transform: [{
                            translateY: contentAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [50, 0],
                            })
                          }]
                        }
                      ]}
                    >
                      <View style={styles.notificationCardContent}>
                        <View style={styles.notificationCardMainInfo}>
                          <ProfileImage 
                            source={notification.profileImageUrl} 
                            size={48}
                            style={{ marginRight: 10 }}
                            initials={notification.name ? notification.name.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2) : undefined}
                          />
                          
                          <View style={styles.notificationCardDetails}>
                            {notification.createdBy && user?.email === notification.createdBy && (
                              <TouchableOpacity
                                onPress={() => handleEditNotification(notification)}
                                style={styles.editButtonTopRight}
                              >
                                <Ionicons name="create-outline" size={18} color="#6b7280" />
                              </TouchableOpacity>
                            )}
                            
                            <Text style={styles.notificationCardType} numberOfLines={1}>
                              {notification.type}
                            </Text>
                            
                            <Text style={styles.notificationCardEmail} numberOfLines={1}>
                              {notification.name || 'Unknown'}
                            </Text>
                            
                            <Text style={styles.notificationCardAddress} numberOfLines={1}>
                              {notification.address || ''}
                            </Text>
                          </View>
                        </View>

                        {/* House Image */}
                        {notification.houseImage && (
                          <TouchableOpacity 
                            onPress={() => {
                              setSelectedImageStorageId(notification.houseImage);
                              setShowImageModal(true);
                            }}
                            activeOpacity={0.9}
                          >
                            <View style={styles.houseImageContainer}>
                              <HouseImage storageId={notification.houseImage} />
                              <View style={styles.imageOverlay}>
                                <Ionicons name="expand" size={20} color="#ffffff" />
                                <Text style={styles.viewImageText}>Tap to View</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        )}

                        {/* Additional Details Section */}
                        <View style={styles.notificationCardDetailsSection}>
                          {/* Dates Row */}
                          {(notification.listingDate || notification.closingDate) && (
                            <View style={styles.dateRow}>
                              {notification.listingDate && (
                                <View style={styles.dateItem}>
                                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                                  <Text style={styles.dateLabel}>Listing:</Text>
                                  <Text style={styles.dateValue}>{notification.listingDate}</Text>
                                </View>
                              )}
                              {notification.closingDate && (
                                <View style={styles.dateItem}>
                                  <Ionicons name="calendar" size={16} color="#6b7280" />
                                  <Text style={styles.dateLabel}>Closing:</Text>
                                  <Text style={styles.dateValue}>{notification.closingDate}</Text>
                                </View>
                              )}
                            </View>
                          )}

                          {/* Realtor Info */}
                          {notification.realtorInfo && (
                            <View style={styles.infoBlock}>
                              <View style={styles.infoHeader}>
                                <Ionicons name="business" size={14} color="#2563eb" />
                                <Text style={styles.infoBlockTitle}>Realtor Contact</Text>
                              </View>
                              <Text style={styles.infoBlockContent}>{notification.realtorInfo}</Text>
                            </View>
                          )}

                          {/* New Resident Info */}
                          {notification.newResidentName && (
                            <View style={styles.infoBlock}>
                              <View style={styles.infoHeader}>
                                <Ionicons
                                  name={notification.isRental ? 'key-outline' : 'person-outline'}
                                  size={14}
                                  color={notification.isRental ? '#f59e0b' : '#10b981'}
                                />
                                <Text style={styles.infoBlockTitle}>
                                  New {notification.isRental ? 'Renter' : 'Owner'}
                                </Text>
                              </View>
                              <Text style={styles.infoBlockContent}>{notification.newResidentName}</Text>
                            </View>
                          )}

                          {/* Additional Info */}
                          {notification.additionalInfo && (
                            <View style={styles.infoBlock}>
                              <View style={styles.infoHeader}>
                                <Ionicons name="chatbubble-outline" size={14} color="#6b7280" />
                                <Text style={styles.infoBlockTitle}>Additional Details</Text>
                              </View>
                              <Text style={styles.infoBlockContent}>{notification.additionalInfo}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="home-outline" size={64} color="#9ca3af" />
                <Text style={styles.emptyStateText}>No notifications yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Residents can submit information when selling or moving
                </Text>
              </View>
            )
          ) : activeSubTab === 'pets' ? (
            pets.length > 0 ? (
              <View style={[
                styles.petsCardsContainer,
                showMobileNav && styles.petsCardsContainerMobile
              ]}>
                {pets.map((pet: any) => (
                  <Animated.View 
                    key={pet._id} 
                    style={[
                      styles.petCard,
                      showMobileNav && styles.petCardMobile,
                      {
                        opacity: contentAnim,
                        transform: [{
                          translateY: contentAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [50, 0],
                          })
                        }]
                      }
                    ]}
                  >
                    <View style={styles.petCardContent}>
                      <View style={styles.petCardHeader}>
                        {pet.residentId === user?._id && (
                          <TouchableOpacity
                            onPress={() => handleEditPet(pet)}
                            style={styles.editButtonTopRight}
                          >
                            <Ionicons name="create-outline" size={18} color="#6b7280" />
                          </TouchableOpacity>
                        )}
                        <View style={styles.petImageContainer}>
                          <PetImage storageId={pet.image} />
                        </View>
                        <Text style={styles.petCardName}>{pet.name}</Text>
                        <Text style={styles.petCardOwner}>
                          Owner: {pet.residentName || 'Unknown'}
                        </Text>
                        <Text style={styles.petCardAddress}>{pet.residentAddress || ''}</Text>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="paw-outline" size={64} color="#9ca3af" />
                <Text style={styles.emptyStateText}>No pets registered yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Register your pet according to HOA guide laws
                </Text>
              </View>
            )
          ) : null}
        </View>
        
        {/* Additional content to ensure scrollable content */}
        <View style={styles.spacer} />
      </ScrollView>
      )}

      {/* Floating Action Button for Mobile */}
      {showMobileNav && (
        ((activeSubTab === 'polls' && isBoardMember) || 
         (activeSubTab !== 'polls')) && (
          <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 150, right: 20, zIndex: 1000, elevation: 10 }}>
            <Pressable
              style={({ pressed }) => [
                styles.floatingActionButton,
                pressed && { opacity: 0.8 }
              ]}
              onPress={() => {
                animateButtonPress();
                if (activeSubTab === 'posts') {
                  setShowNewPostModal(true);
                  animateIn('post');
                } else if (activeSubTab === 'polls' && isBoardMember) {
                  setShowPollModal(true);
                } else if (activeSubTab === 'notifications') {
                  handleAddNotification();
                } else if (activeSubTab === 'pets') {
                  handleAddPet();
                }
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="add" size={28} color="#ffffff" />
            </Pressable>
          </View>
        )
      )}

      {/* New Post Modal */}
      <Modal
        visible={showNewPostModal}
        transparent={true}
        animationType="none"
      >
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <Animated.View style={[
            styles.modalContainer,
            {
              opacity: postModalOpacity,
              transform: [{ translateY: postModalTranslateY }],
            }
          ]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New Post</Text>
            <TouchableOpacity onPress={() => animateOut('post', () => setShowNewPostModal(false))}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categorySelector}>
              {postCategories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryOption,
                    newPost.category === category && styles.categoryOptionActive
                  ]}
                  onPress={() => setNewPost(prev => ({ ...prev, category }))}
                >
                  <Text style={[
                    styles.categoryOptionText,
                    newPost.category === category && styles.categoryOptionTextActive
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter post title..."
              value={newPost.title}
              onChangeText={(text) => setNewPost(prev => ({ ...prev, title: text }))}
            />

            <Text style={styles.inputLabel}>Content</Text>
            <TextInput
              style={[styles.textInput, styles.contentInput]}
              placeholder="Write your post content..."
              value={newPost.content}
              onChangeText={(text) => setNewPost(prev => ({ ...prev, content: text }))}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>Link (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="https://example.com"
              value={newPost.link}
              onChangeText={(text) => setNewPost(prev => ({ ...prev, link: text }))}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Image Upload Section */}
            <Text style={styles.inputLabel}>Images (Optional)</Text>
            <View style={styles.imageUploadContainer}>
              {selectedImages.map((imageUri, index) => (
                <View key={index} style={styles.imagePreview}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              
              {selectedImages.length < 5 && (
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={pickImage}
                  disabled={uploadingImages}
                >
                  <Ionicons 
                    name="camera" 
                    size={24} 
                    color={uploadingImages ? "#9ca3af" : "#eab308"} 
                  />
                  <Text style={[
                    styles.addImageText,
                    uploadingImages && styles.addImageTextDisabled
                  ]}>
                    {uploadingImages ? 'Uploading...' : 'Add Image'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            {selectedImages.length > 0 && (
              <Text style={styles.imageLimitText}>
                {selectedImages.length}/5 images selected
              </Text>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => animateOut('post', () => setShowNewPostModal(false))}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.createButton,
                (isCreatingPost || uploadingImages) && styles.createButtonDisabled
              ]}
              onPress={handleCreatePost}
              disabled={isCreatingPost || uploadingImages}
            >
              {(isCreatingPost || uploadingImages) ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.createButtonText}>
                    {uploadingImages ? 'Uploading images...' : 'Creating...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.createButtonText}>Create Post</Text>
              )}
            </TouchableOpacity>
          </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        transparent={true}
        animationType="none"
      >
        <Animated.View style={[styles.commentModalOverlay, { opacity: overlayOpacity }]}>
          <Animated.View style={[
            styles.commentModalContainer,
            {
              opacity: commentModalOpacity,
              transform: [{ translateY: commentModalTranslateY }],
            }
          ]}>
            <View style={styles.commentModalHeader}>
              <View style={styles.commentModalHeaderContent}>
                <Text style={styles.modalTitle}>Add Comment</Text>
                {selectedPostForComment && (
                  <Text style={styles.commentPostTitle}>
                    on "{selectedPostForComment.title}"
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => animateOut('comment', () => setShowCommentModal(false))}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.commentModalContent}>
              <Text style={styles.inputLabel}>Comment</Text>
              <TextInput
                style={[styles.textInput, styles.commentInput]}
                placeholder="Write your comment..."
                value={newComment}
                onChangeText={(text) => setNewComment(text)}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.commentModalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => animateOut('comment', () => setShowCommentModal(false))}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleAddComment}
              >
                <Text style={styles.createButtonText}>Add Comment</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Add/Edit Notification Modal */}
      <Modal
        visible={showAddNotificationModal || showEditNotificationModal}
        animationType="none"
        transparent={true}
        onRequestClose={() => {
          animateNotificationModalOut(() => {
            setShowAddNotificationModal(false);
            setShowEditNotificationModal(false);
          });
        }}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalWrapper}
          >
            <Animated.View 
              style={[
                styles.modalContainer,
                {
                  opacity: notificationModalOpacity,
                  transform: [{ translateY: notificationModalTranslateY }],
                }
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {showEditNotificationModal ? 'Edit Notification' : 'Add Notification'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    animateNotificationModalOut(() => {
                      setShowAddNotificationModal(false);
                      setShowEditNotificationModal(false);
                    });
                  }}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalContent} 
                contentContainerStyle={styles.modalContentContainer}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Resident *</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or address..."
                    value={notificationSearchQuery}
                    onChangeText={setNotificationSearchQuery}
                  />
                  <ScrollView style={styles.picker} nestedScrollEnabled>
                    {residents
                      ?.filter(resident => {
                        const query = notificationSearchQuery.toLowerCase();
                        return query === '' ||
                          resident.firstName.toLowerCase().includes(query) ||
                          resident.lastName.toLowerCase().includes(query) ||
                          resident.address.toLowerCase().includes(query);
                      })
                      .map((resident: any) => (
                      <TouchableOpacity
                        key={resident._id}
                        style={[
                          styles.pickerOption,
                          notificationFormData.residentId === resident._id && styles.pickerOptionSelected,
                        ]}
                        onPress={() => setNotificationFormData({ ...notificationFormData, residentId: resident._id })}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            notificationFormData.residentId === resident._id && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {resident.firstName} {resident.lastName}
                        </Text>
                        <Text style={[
                          styles.pickerOptionSubtext,
                          notificationFormData.residentId === resident._id && styles.pickerOptionSubtextSelected,
                        ]}>
                          {resident.address}
                          {resident.unitNumber ? ` #${resident.unitNumber}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Type *</Text>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        notificationFormData.type === 'Selling' && styles.typeButtonSelected,
                      ]}
                      onPress={() => setNotificationFormData({ ...notificationFormData, type: 'Selling' })}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          notificationFormData.type === 'Selling' && styles.typeButtonTextSelected,
                        ]}
                      >
                        Selling
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        notificationFormData.type === 'Moving' && styles.typeButtonSelected,
                      ]}
                      onPress={() => setNotificationFormData({ ...notificationFormData, type: 'Moving' })}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          notificationFormData.type === 'Moving' && styles.typeButtonTextSelected,
                        ]}
                      >
                        Moving
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Listing Date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="DD-MM-YYYY"
                    value={notificationFormData.listingDate}
                    onChangeText={(text) => {
                      const formatted = formatDateInput(text);
                      setNotificationFormData({ ...notificationFormData, listingDate: formatted });
                    }}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Closing Date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="DD-MM-YYYY"
                    value={notificationFormData.closingDate}
                    onChangeText={(text) => {
                      const formatted = formatDateInput(text);
                      setNotificationFormData({ ...notificationFormData, closingDate: formatted });
                    }}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Realtor Information</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Realtor name and contact info"
                    value={notificationFormData.realtorInfo}
                    onChangeText={(text) => setNotificationFormData({ ...notificationFormData, realtorInfo: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Owner/Renter Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Name of new occupant"
                    value={notificationFormData.newResidentName}
                    onChangeText={(text) => setNotificationFormData({ ...notificationFormData, newResidentName: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Is this a rental?</Text>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        notificationFormData.isRental === true && styles.typeButtonSelected,
                      ]}
                      onPress={() => setNotificationFormData({ ...notificationFormData, isRental: true })}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          notificationFormData.isRental === true && styles.typeButtonTextSelected,
                        ]}
                      >
                        Yes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        notificationFormData.isRental === false && styles.typeButtonSelected,
                      ]}
                      onPress={() => setNotificationFormData({ ...notificationFormData, isRental: false })}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          notificationFormData.isRental === false && styles.typeButtonTextSelected,
                        ]}
                      >
                        No
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>House Image (Optional)</Text>
                  {previewImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: previewImage }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => setPreviewImage(null)}
                      >
                        <Ionicons name="close-circle" size={24} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.imagePickerButton}
                      onPress={pickNotificationImage}
                    >
                      <Ionicons name="image-outline" size={24} color="#6b7280" />
                      <Text style={styles.imagePickerText}>Add House Image</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Additional Information</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Any additional information"
                    value={notificationFormData.additionalInfo}
                    onChangeText={(text) => setNotificationFormData({ ...notificationFormData, additionalInfo: text })}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (isSavingNotification || uploadingNotificationImage) && styles.submitButtonDisabled
                  ]}
                  onPress={handleSubmitNotification}
                  disabled={isSavingNotification || uploadingNotificationImage}
                >
                  {(isSavingNotification || uploadingNotificationImage) ? (
                    <View style={styles.buttonLoadingContainer}>
                      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                      <Text style={styles.submitButtonText}>
                        {uploadingNotificationImage ? 'Uploading image...' : (showEditNotificationModal ? 'Updating...' : 'Creating...')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {showEditNotificationModal ? 'Update' : 'Create'} Notification
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity 
            style={styles.imageModalClose}
            onPress={() => setShowImageModal(false)}
          >
            <Ionicons name="close" size={32} color="#ffffff" />
          </TouchableOpacity>
          {selectedImageStorageId && (
            <HouseImage storageId={selectedImageStorageId} isFullScreen={true} />
          )}
        </View>
      </Modal>

      {/* Add/Edit Pet Modal */}
      <Modal
        visible={showAddPetModal || showEditPetModal}
        animationType="none"
        transparent={true}
        onRequestClose={() => {
          animatePetModalOut(() => {
            setShowAddPetModal(false);
            setShowEditPetModal(false);
          });
        }}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalWrapper}
          >
            <Animated.View 
              style={[
                styles.modalContainer,
                {
                  opacity: petModalOpacity,
                  transform: [{ translateY: petModalTranslateY }],
                }
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {showEditPetModal ? 'Edit Pet' : 'Register Pet'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    animatePetModalOut(() => {
                      setShowAddPetModal(false);
                      setShowEditPetModal(false);
                    });
                  }}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalContent} 
                contentContainerStyle={styles.modalContentContainer}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Pet Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter pet name"
                    value={petFormData.name}
                    onChangeText={(text) => setPetFormData({ ...petFormData, name: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Pet Photo *</Text>
                  {petPreviewImage ? (
                    <View style={styles.petImagePreviewContainer}>
                      <Image source={{ uri: petPreviewImage }} style={styles.petImagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => setPetPreviewImage(null)}
                      >
                        <Ionicons name="close-circle" size={24} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : petFormData.image ? (
                    <View style={styles.petImagePreviewContainer}>
                      <PetImage storageId={petFormData.image} />
                    </View>
                  ) : (
                    <View style={styles.emptyImageContainer}>
                      <Ionicons name="paw" size={64} color="#d1d5db" />
                      <Text style={styles.emptyImageText}>No Pet Photo</Text>
                    </View>
                  )}

                  {/* Show add buttons only if no image exists */}
                  {!petPreviewImage && !petFormData.image && (
                    <>
                      <TouchableOpacity
                        style={styles.imagePickerButton}
                        onPress={pickPetImage}
                      >
                        <Ionicons name="image" size={32} color="#6b7280" />
                        <Text style={styles.imagePickerText}>Choose from Gallery</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.imagePickerButton, { marginTop: 12 }]}
                        onPress={pickPetImage}
                      >
                        <Ionicons name="camera" size={32} color="#6b7280" />
                        <Text style={styles.imagePickerText}>Take Photo</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Show remove button if there's a current image and no new image selected (only in edit mode) */}
                {showEditPetModal && petFormData.image && !petPreviewImage && (
                  <TouchableOpacity
                    style={[styles.removeButton, removingPetImage && styles.removeButtonDisabled]}
                    onPress={handleRemovePetImage}
                    disabled={removingPetImage}
                  >
                    {removingPetImage ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={20} color="#ffffff" />
                        <Text style={styles.removeButtonText}>Remove Pet Image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Show save button if there's a new image selected */}
                {petPreviewImage ? (
                  <TouchableOpacity 
                    style={[
                      styles.submitButton,
                      (isSavingPet || uploadingPetImage) && styles.submitButtonDisabled
                    ]} 
                    onPress={handleSubmitPet}
                    disabled={isSavingPet || uploadingPetImage}
                  >
                    {(isSavingPet || uploadingPetImage) ? (
                      <View style={styles.buttonLoadingContainer}>
                        <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.submitButtonText}>
                          {uploadingPetImage ? 'Uploading image...' : (showEditPetModal ? 'Updating...' : 'Registering...')}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.submitButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                ) : !showEditPetModal || !petFormData.image ? (
                  /* 
                    Show Register/Update button when:
                    - Not in edit mode (!showEditPetModal) - shows "Register Pet"
                    - In edit mode but no current image (!petFormData.image) - shows "Update Pet"
                    
                    Don't show when:
                    - In edit mode with existing image - user needs to remove image first
                  */
                  <TouchableOpacity 
                    style={[
                      styles.submitButton,
                      (isSavingPet || uploadingPetImage) && styles.submitButtonDisabled
                    ]} 
                    onPress={handleSubmitPet}
                    disabled={isSavingPet || uploadingPetImage}
                  >
                    {(isSavingPet || uploadingPetImage) ? (
                      <View style={styles.buttonLoadingContainer}>
                        <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.submitButtonText}>
                          {uploadingPetImage ? 'Uploading image...' : (showEditPetModal ? 'Updating...' : 'Registering...')}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {showEditPetModal ? 'Update' : 'Register'} Pet
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>

      {/* Poll Modal */}
      <Modal
        key={`poll-modal-${showPollModal}`}
        visible={showPollModal}
        transparent={true}
        animationType="none"
        onRequestClose={handleCancelPoll}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <Animated.View style={[
            styles.boardMemberModalContent,
            {
              opacity: pollModalOpacity,
              transform: [{ translateY: pollModalTranslateY }],
            }
          ]}
          pointerEvents="box-none"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Create Poll
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCancelPoll}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalForm} 
              contentContainerStyle={styles.modalFormContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Poll Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter poll title"
                  value={pollForm.title}
                  onChangeText={(text) => setPollForm(prev => ({ ...prev, title: text }))}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Enter poll description (optional)"
                  value={pollForm.description}
                  onChangeText={(text) => setPollForm(prev => ({ ...prev, description: text }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Poll Options *</Text>
                {pollForm.options.map((option, index) => (
                  <View key={index} style={styles.pollOptionInput}>
                    <TextInput
                      style={[styles.textInput, styles.pollOptionTextInput]}
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChangeText={(text) => updatePollOption(index, text)}
                    />
                    {pollForm.options.length > 2 && (
                      <TouchableOpacity
                        style={styles.removeOptionButton}
                        onPress={() => removePollOption(index)}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                
                {pollForm.options.length < 10 && (
                  <TouchableOpacity
                    style={styles.addOptionButton}
                    onPress={addPollOption}
                  >
                    <Ionicons name="add-circle" size={20} color="#2563eb" />
                    <Text style={styles.addOptionText}>Add Option</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Settings</Text>
                
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setPollForm(prev => ({ ...prev, allowMultipleVotes: !prev.allowMultipleVotes }))}
                >
                  <View style={[styles.checkbox, pollForm.allowMultipleVotes && styles.checkboxChecked]}>
                    {pollForm.allowMultipleVotes && (
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Allow multiple votes</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Expiration Date (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  value={pollForm.expiresAt}
                  onChangeText={(text) => setPollForm(prev => ({ ...prev, expiresAt: text }))}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelPoll}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreatePoll}
                >
                  <Text style={styles.createButtonText}>Create Poll</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
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
    zIndex: 1,
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
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 44, // Same width as MessagingButton (icon + padding)
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
  newPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eab308',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newPostButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  floatingActionButton: {
    position: 'absolute',
    bottom: -150,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eab308',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  categoryContainer: {
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 12 : 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 12,
    marginTop: Platform.OS === 'ios' ? 8 : 0,
    marginBottom: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  filterLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  categoryScrollView: {
    flex: 1,
    marginLeft: 0,
  },
  categoryContent: {
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  categoryButtonActive: {
    backgroundColor: '#eab308',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#ffffff',
  },
  postsContainer: {
    flex: 1,
  },
  contentWrapper: {
    padding: 15,
  },
  webScrollContainer: {
    ...(Platform.OS === 'web' ? {
      cursor: 'grab' as any,
      userSelect: 'none' as any,
      WebkitUserSelect: 'none' as any,
      MozUserSelect: 'none' as any,
      msUserSelect: 'none' as any,
      overflow: 'auto' as any,
      height: '100vh' as any,
      maxHeight: '100vh' as any,
      position: 'relative' as any,
    } : {}),
  } as any,
  scrollContent: {
    paddingBottom: 20,
  },
  webScrollContent: {
    ...(Platform.OS === 'web' ? {
      minHeight: '100vh' as any,
      flexGrow: 1,
      paddingBottom: 100 as any,
    } : {}),
  } as any,
  spacer: {
    height: Platform.OS === 'web' ? 120 : 80,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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
  postItemWrapper: {
    paddingHorizontal: 15,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    // borderLeftColor is set dynamically per card
  },
  selectedPostCard: {
    backgroundColor: '#fefce8', // Light yellow background
    shadowColor: '#eab308',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  postTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: '#2563eb',
    marginLeft: 8,
    marginRight: 8,
  },
  postFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewAllButtonText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
    marginRight: 4,
  },
  expandedComments: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  commentsDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  expandedCommentsScroll: {
    maxHeight: 200, // Limit height for scrollable expanded comments
  },
  listFooter: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    gap: 8,
  },
  loadMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    justifyContent: 'center',
  },
  listFooterText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  footerSpacer: {
    height: 40,
  },
  commentItem: {
    marginBottom: 12,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#e5e7eb',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginRight: 4,
  },
  boardMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
    gap: 4,
  },
  boardMemberBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
  },
  developerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
    gap: 4,
  },
  developerBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
  },
  commentContent: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  commentTime: {
    fontSize: 10,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    } : {}),
  } as any,
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 0,
    width: '90%',
    maxWidth: Platform.OS === 'web' ? 600 : undefined,
    maxHeight: Platform.OS === 'web' ? '90vh' : '90%',
    minHeight: Platform.OS === 'web' ? undefined : '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    ...(Platform.OS === 'web' ? {
      position: 'relative' as any,
      zIndex: 1002,
      overflow: 'hidden' as any,
    } : {}),
  } as any,
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 20,
  },
  modalContentContainer: {
    paddingBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 16,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  categoryOptionActive: {
    backgroundColor: '#eab308',
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  categoryOptionTextActive: {
    color: '#ffffff',
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#374151',
    marginBottom: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  contentInput: {
    height: 140,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#eab308',
    alignItems: 'center',
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentModalHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
  },
  commentPostTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  commentInput: {
    height: 100, // Adjust height for comment input
  },
  commentModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  commentModalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 20,
    maxHeight: '60%',
    minHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  commentModalHeaderContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
  },
  commentModalContent: {
    marginTop: 20,
    flex: 1,
  },
  commentModalFooter: {
    flexDirection: 'row',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 20,
  },
  // Poll styles
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
  pollOptionDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
    opacity: 0.6,
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
  // Image upload styles
  imageUploadContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  imagePreview: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  addImageText: {
    fontSize: 12,
    color: '#eab308',
    fontWeight: '600',
    marginTop: 4,
  },
  addImageTextDisabled: {
    color: '#9ca3af',
  },
  imageLimitText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  // Post image display styles
  postImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 12,
    gap: 12,
  },
  postImageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  postImage: {
    width: Platform.OS === 'web' ? 300 : 280,
    height: Platform.OS === 'web' ? 300 : 280,
    borderRadius: 12,
  },
  imageLoading: {
    width: Platform.OS === 'web' ? 300 : 280,
    height: Platform.OS === 'web' ? 300 : 280,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  // Sub-tab styles
  subTabContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  subTabRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    gap: 12,
  },
  subTabScrollView: {
    flex: 1,
  },
  subTabContent: {
    paddingHorizontal: 15,
    gap: 12,
  },
  subTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    gap: 8,
  },
  subTabButtonActive: {
    backgroundColor: '#eff6ff',
  },
  subTabButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  subTabButtonTextActive: {
    color: '#eab308',
    fontWeight: '600',
  },
  // Action buttons container
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  // Notification styles
  typeFilterContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  typeFilterScrollView: {
    flex: 1,
  },
  typeFilterContent: {
    paddingHorizontal: 0,
  },
  typeFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  typeFilterButtonActive: {
    backgroundColor: '#eab308',
  },
  typeFilterButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  typeFilterButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  addNotificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eab308',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addNotificationButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationsCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
    gap: 12,
  },
  notificationsCardsContainerMobile: {
    flexDirection: 'column',
    gap: 16,
    padding: 15,
  },
  notificationCard: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationCardMobile: {
    minWidth: '100%',
    maxWidth: '100%',
  },
  notificationCardContent: {
    padding: 12,
  },
  notificationCardMainInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  notificationCardDetails: {
    flex: 1,
    position: 'relative',
  },
  editButtonTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
  },
  notificationCardType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    marginTop: 4,
  },
  notificationCardEmail: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  notificationCardAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  notificationCardDetailsSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 10,
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: '45%',
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  dateValue: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
  },
  infoBlock: {
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#e5e7eb',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoBlockTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoBlockContent: {
    fontSize: 12,
    color: '#1f2937',
    lineHeight: 16,
  },
  houseImageContainer: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  cardHouseImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewImageText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
    marginTop: 4,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  fullImage: {
    width: '90%',
    height: '80%',
    alignSelf: 'center',
    marginTop: 100,
  },
  fullImageLoading: {
    width: '90%',
    height: '80%',
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 100,
    borderRadius: 12,
  },
  // Notification modal styles (shared with post modal, but adding missing ones)
  modalWrapper: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      position: 'relative' as any,
      zIndex: 1001,
    } : {}),
  } as any,
  closeButton: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  picker: {
    maxHeight: 150,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pickerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  pickerOptionTextSelected: {
    color: '#eab308',
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  pickerOptionSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  pickerOptionSubtextSelected: {
    color: '#d97706',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  typeButtonSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#eab308',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  typeButtonTextSelected: {
    color: '#eab308',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#eab308',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  removeButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
  },
  // Pet styles
  petsFilterContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  petsFilterRow: {
    justifyContent: 'flex-end',
  },
  addPetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eab308',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addPetButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  petsCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
    gap: 12,
  },
  petsCardsContainerMobile: {
    flexDirection: 'column',
    gap: 16,
    padding: 15,
  },
  petCard: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  petCardMobile: {
    minWidth: '100%',
    maxWidth: '100%',
  },
  petCardContent: {
    padding: 12,
  },
  petCardHeader: {
    alignItems: 'center',
    position: 'relative',
  },
  petImageContainer: {
    width: 240,
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#e5e7eb',
  },
  petCardImage: {
    width: '100%',
    height: '100%',
  },
  petCardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  petCardOwner: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  petCardAddress: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  petImageLoading: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyImageContainer: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    backgroundColor: '#f9fafb',
    borderWidth: 3,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignSelf: 'center',
    marginVertical: 12,
  },
  emptyImageText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '500',
  },
  petImagePreviewContainer: {
    position: 'relative',
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    alignSelf: 'center',
    marginVertical: 12,
    borderWidth: 3,
    borderColor: '#e5e7eb',
  },
  petImagePreview: {
    width: '100%',
    height: '100%',
  },
  // Poll modal styles
  pollOptionInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pollOptionTextInput: {
    flex: 1,
    marginRight: 8,
  },
  removeOptionButton: {
    padding: 4,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
    marginTop: 8,
  },
  addOptionText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
    marginLeft: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  // Board member modal content style (matching AdminScreen)
  boardMemberModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  // Poll modal styles (matching AdminScreen)
  modalForm: {
    maxHeight: 400,
    padding: 20,
  },
  modalFormContent: {
    paddingBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
});

export default CommunityScreen; 
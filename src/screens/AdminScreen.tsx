import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  FlatList,
  Image,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDemoQuery } from '../hooks/useDemoQuery';
import { useDemoMutation } from '../hooks/useDemoMutation';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { useCachedResidents, useCachedHoaInfo } from '../context/QueryCacheContext';
import BoardMemberIndicator from '../components/BoardMemberIndicator';
import DeveloperIndicator from '../components/DeveloperIndicator';
import CustomTabBar from '../components/CustomTabBar';
import MobileTabBar from '../components/MobileTabBar';
import ProfileImage from '../components/ProfileImage';
import OptimizedImage from '../components/OptimizedImage';
import { getUploadReadyImage } from '../utils/imageUpload';
import {
  notifyNewPoll,
  notifyBoardUpdate
} from '../utils/notificationHelpers';
import HomeownerRecordsModal from '../components/HomeownerRecordsModal';
import {
  WEBSITE_URL,
  ANDROID_PLAY_STORE_URL,
  getIosAppStoreUrl,
} from '../constants/publicLinks';

const AdminScreen = () => {
  const { user } = useAuth();
  const convex = useConvex();
  
  // State for dynamic responsive behavior (only for web/desktop)
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Dynamic responsive check - show mobile nav when screen is too narrow for desktop nav
  // On mobile, always show mobile nav regardless of screen size
  const isMobileDevice = Platform.OS === 'ios' || Platform.OS === 'android';
  const showMobileNav = isMobileDevice || screenWidth < 1024; // Always mobile on mobile devices, responsive on web
  const showDesktopNav = !isMobileDevice && screenWidth >= 1024; // Only desktop nav on web when wide enough
  const iosAppStoreUrl = getIosAppStoreUrl();
  
  // Listen for window/dimension changes (web resize, tablet rotation, etc.)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  // Pagination state for large lists
  const [covenantsLimit, setCovenantsLimit] = useState(50);
  const [postsLimit, setPostsLimit] = useState(50);
  const [pollsLimit, setPollsLimit] = useState(50);
  
  // State (define early so it can be used in conditional queries)
  const [activeTab, setActiveTab] = useState<'SheltonHOA' | 'residents' | 'board' | 'covenants' | 'Community' | 'fees'>('SheltonHOA');
  const shareLinkItems = useMemo(
    () =>
      [
        { key: 'website', label: 'Website', url: WEBSITE_URL },
        { key: 'android', label: 'Google Play (Android)', url: ANDROID_PLAY_STORE_URL },
        iosAppStoreUrl ? { key: 'ios', label: 'App Store (iOS)', url: iosAppStoreUrl } : null,
      ].filter(Boolean) as Array<{ key: string; label: string; url: string }>,
    [iosAppStoreUrl]
  );
  const [expandedShareQrKey, setExpandedShareQrKey] = useState<string | null>('website');
  const shareQrRefs = useRef<Record<string, any>>({});
  
  // Data queries - using paginated queries for large lists
  // Always loaded: residents, boardMembers (needed for all tabs)
  // Use cached queries to prevent duplicates across screens
  const residents = useCachedResidents();
  const hoaInfo = useCachedHoaInfo();
  const boardMembers =
    useDemoQuery(api.boardMembers.getAll, {}, (s) => s.boardMembers ?? []) ?? [];

  // Conditional queries - only load when tab is active (lazy loading)
  const covenantsData = useDemoQuery(
    api.covenants.getPaginated,
    activeTab === 'covenants' ? { limit: covenantsLimit, offset: 0 } : 'skip',
    (s, args) => {
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;
      const items = s.allCovenants.slice(offset, offset + limit);
      return { items, total: s.allCovenants.length };
    }
  );
  const covenants = covenantsData?.items ?? [];

  const communityPostsData = useDemoQuery(
    api.communityPosts.getPaginated,
    activeTab === 'Community' ? { limit: postsLimit, offset: 0 } : 'skip',
    (s, args) => {
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;
      const items = s.allCommunityPosts.slice(offset, offset + limit);
      return { items, total: s.allCommunityPosts.length };
    }
  );
  const communityPosts = communityPostsData?.items ?? [];

  const comments =
    useDemoQuery(
      api.communityPosts.getAllComments,
      activeTab === 'Community' ? {} : 'skip',
      (s) => s.allCommentsFlat ?? []
    ) ?? [];

  const pollsData = useDemoQuery(
    api.polls.getPaginated,
    activeTab === 'Community' ? { limit: pollsLimit, offset: 0 } : 'skip',
    (s, args) => {
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;
      const items = s.allPolls.slice(offset, offset + limit);
      return { items, total: s.allPolls.length };
    }
  );
  const polls = pollsData?.items ?? [];

  const petsGrouped =
    useDemoQuery(
      api.pets.getAllGroupedByResident,
      activeTab === 'Community' ? {} : 'skip',
      (s) => s.petsGrouped ?? []
    ) ?? [];
  const totalPetsCount = petsGrouped.reduce((n: number, g: any) => n + g.pets.length, 0);

  const homeownersPaymentStatus =
    useDemoQuery(
      api.fees.getAllHomeownersPaymentStatus,
      activeTab === 'fees' ? {} : 'skip',
      (s) => s.homeownersPaymentStatus ?? []
    ) ?? [];

  const allFeesFromDatabase =
    useDemoQuery(api.fees.getAll, activeTab === 'fees' ? {} : 'skip', (s) => s.allFees) ?? [];

  const allFinesFromDatabase =
    useDemoQuery(api.fees.getAllFines, activeTab === 'fees' ? {} : 'skip', (s) => s.allFines) ?? [];

  const pendingVenmoPayments =
    useDemoQuery(
      api.payments.getPendingVenmoPayments,
      activeTab === 'fees' ? {} : 'skip',
      (s) => s.pendingVenmoPayments ?? []
    ) ?? [];

  const allPayments =
    useDemoQuery(api.payments.getAllPayments, activeTab === 'fees' ? {} : 'skip', (s) => s.allPayments) ?? [];

  // Load HOA info into form when it's available
  useEffect(() => {
    if (hoaInfo) {
      setHoaInfoForm({
        name: hoaInfo.name || '',
        address: hoaInfo.address || '',
        phone: hoaInfo.phone || '',
        email: hoaInfo.email || '',
        website: hoaInfo.website || '',
        officeHours: hoaInfo.officeHours || '',
        emergencyContact: hoaInfo.emergencyContact || '',
        eventText: (hoaInfo as any).eventText || '',
      });
    }
  }, [hoaInfo]);

  // ========== MEMOIZED DATA CACHING - Optimize Convex DB calls ==========
  
  // Resident lookup map for O(1) access instead of O(n) find()
  const residentsMap = useMemo(() => {
    const map = new Map<string, any>();
    residents.forEach((resident: any) => {
      map.set(resident._id, resident);
    });
    return map;
  }, [residents]);

  // Filtered homeowners list (residents who are not renters)
  const homeownersList = useMemo(() => {
    return residents.filter((r: any) => r.isResident && !r.isRenter);
  }, [residents]);

  // Cached resident role counts
  const residentRoleCounts = useMemo(() => {
    return {
      homeowners: residents.filter((r: any) => r.isResident && !r.isRenter).length,
      renters: residents.filter((r: any) => r.isRenter).length,
    };
  }, [residents]);


  // Fees grouped by userId for quick lookup (includes fees by address for households)
  const feesByUserId = useMemo(() => {
    const map = new Map<string, any[]>();
    
    // First, build address map for homeowners
    const addressMap = new Map<string, string[]>();
    homeownersList.forEach((homeowner: any) => {
      const addressKey = `${homeowner.address}${homeowner.unitNumber ? ` Unit ${homeowner.unitNumber}` : ''}`;
      if (!addressMap.has(addressKey)) {
        addressMap.set(addressKey, []);
      }
      addressMap.get(addressKey)!.push(homeowner._id);
    });
    
    allFeesFromDatabase.forEach((fee: any) => {
      // Track which homeowner IDs have already received this fee
      const homeownerIdsWithFee = new Set<string>();
      
      // If fee has an address, add it to all homeowners at that address
      if (fee.address) {
        const homeownerIds = addressMap.get(fee.address) || [];
        homeownerIds.forEach((homeownerId: string) => {
          const userIdString = String(homeownerId);
          const existing = map.get(userIdString) || [];
          map.set(userIdString, [...existing, fee]);
          homeownerIdsWithFee.add(userIdString);
        });
      }
      
      // Also add by userId for backward compatibility (if not already added via address)
      if (fee.userId) {
        const userIdString = String(fee.userId);
        if (!homeownerIdsWithFee.has(userIdString)) {
          const existing = map.get(userIdString) || [];
          map.set(userIdString, [...existing, fee]);
        }
      }
    });
    
    return map;
  }, [allFeesFromDatabase, homeownersList]);

  // Fines grouped by residentId for quick lookup
  const finesByResidentId = useMemo(() => {
    const map = new Map<string, any[]>();
    allFinesFromDatabase.forEach((fine: any) => {
      if (fine.residentId) {
        const existing = map.get(fine.residentId) || [];
        map.set(fine.residentId, [...existing, fine]);
      }
    });
    return map;
  }, [allFinesFromDatabase]);

  // Payments grouped by userId for quick lookup (to show payment method)
  const paymentsByUserId = useMemo(() => {
    const map = new Map<string, any[]>();
    allPayments.forEach((payment: any) => {
      if (payment.userId) {
        const userIdString = String(payment.userId);
        const existing = map.get(userIdString) || [];
        map.set(userIdString, [...existing, payment]);
      }
    });
    return map;
  }, [allPayments]);


  // Filtered fees arrays - cached to avoid repeated filtering
  const unpaidAnnualFees = useMemo(() => {
    return allFeesFromDatabase.filter((fee: any) => 
      fee.frequency === 'Annually' && fee.status !== 'Paid'
    );
  }, [allFeesFromDatabase]);

  const paidFees = useMemo(() => {
    return allFeesFromDatabase.filter((fee: any) => fee.status === 'Paid');
  }, [allFeesFromDatabase]);

  const unpaidFees = useMemo(() => {
    return allFeesFromDatabase.filter((fee: any) => fee.status !== 'Paid');
  }, [allFeesFromDatabase]);

  const paidFines = useMemo(() => {
    return allFinesFromDatabase.filter((fine: any) => fine.status === 'Paid');
  }, [allFinesFromDatabase]);

  const unpaidFinesList = useMemo(() => {
    return allFinesFromDatabase.filter((fine: any) => fine.status !== 'Paid');
  }, [allFinesFromDatabase]);

  // Homeowners with fees or fines - cached filtered list
  const homeownersWithFeesOrFines = useMemo(() => {
    return homeownersPaymentStatus.filter((item: any) => {
      const hasFees = feesByUserId.has(item._id);
      const hasFines = finesByResidentId.has(item._id);
      return hasFees || hasFines;
    });
  }, [homeownersPaymentStatus, feesByUserId, finesByResidentId]);

  // Group homeowners by address (including unit number)
  const homeownersGroupedByAddress = useMemo(() => {
    const addressMap = new Map<string, any[]>();
    
    homeownersPaymentStatus.forEach((homeowner: any) => {
      // Create address key: address + unitNumber (if present)
      const addressKey = `${homeowner.address}${homeowner.unitNumber ? ` Unit ${homeowner.unitNumber}` : ''}`;
      
      if (!addressMap.has(addressKey)) {
        addressMap.set(addressKey, []);
      }
      addressMap.get(addressKey)!.push(homeowner);
    });
    
    // Convert map to array of grouped addresses
    return Array.from(addressMap.entries()).map(([addressKey, homeowners]) => {
      // Aggregate records for all homeowners at this address.
      // Use maps keyed by _id to prevent duplicates when household-level
      // records (e.g., address-based annual fees) are attached to each homeowner.
      const feesById = new Map<string, any>();
      const finesById = new Map<string, any>();
      const paymentsById = new Map<string, any>();
      
      homeowners.forEach((homeowner: any) => {
        const homeownerFees = feesByUserId.get(String(homeowner._id)) || [];
        const homeownerFines = finesByResidentId.get(homeowner._id) || [];
        const homeownerPayments = paymentsByUserId.get(String(homeowner._id)) || [];
        
        homeownerFees.forEach((fee: any) => {
          if (fee?._id) feesById.set(String(fee._id), fee);
        });
        homeownerFines.forEach((fine: any) => {
          if (fine?._id) finesById.set(String(fine._id), fine);
        });
        homeownerPayments.forEach((payment: any) => {
          if (payment?._id) paymentsById.set(String(payment._id), payment);
        });
      });

      const allFees = Array.from(feesById.values());
      const allFines = Array.from(finesById.values());
      const allPayments = Array.from(paymentsById.values());

      const verifiedTowardFee = (feeId: string) =>
        allPayments
          .filter((p: any) => p.feeId === feeId && p.verificationStatus === 'Verified')
          .reduce((s: number, p: any) => s + p.amount, 0);
      const verifiedTowardFine = (fineId: string) =>
        allPayments
          .filter((p: any) => p.fineId === fineId && p.verificationStatus === 'Verified')
          .reduce((s: number, p: any) => s + p.amount, 0);

      const feesOutstanding = allFees.reduce(
        (s: number, fee: any) => s + Math.max(0, fee.amount - verifiedTowardFee(fee._id)),
        0,
      );
      const finesOutstanding = allFines.reduce(
        (s: number, fine: any) => s + Math.max(0, fine.amount - verifiedTowardFine(fine._id)),
        0,
      );
      const outstandingBalance = feesOutstanding + finesOutstanding;

      const totalAssessedFees = allFees.reduce((s: number, fee: any) => s + fee.amount, 0);
      const totalAssessedFines = allFines.reduce((s: number, fine: any) => s + fine.amount, 0);
      const totalAssessed = totalAssessedFees + totalAssessedFines;

      const totalVerifiedTowardHousehold = allPayments
        .filter(
          (p: any) =>
            p.verificationStatus === 'Verified' &&
            ((p.feeId && feesById.has(String(p.feeId))) ||
              (p.fineId && finesById.has(String(p.fineId)))),
        )
        .reduce((s: number, p: any) => s + p.amount, 0);

      const hasObligations = allFees.length > 0 || allFines.length > 0;
      const balanceCaughtUp = outstandingBalance < 0.01;
      const isPartiallyPaid =
        hasObligations && outstandingBalance >= 0.01 && totalVerifiedTowardHousehold > 0;

      // Back-compat name: true only when this household has fees/fines and verified payments cover the balance
      const allFeesPaid = hasObligations && balanceCaughtUp;

      // Get the most recent paid payment method across all homeowners
      const paidPayments = allPayments.filter((p: any) => p.status === 'Paid' && p.verificationStatus === 'Verified');
      const latestPayment = paidPayments.length > 0 
        ? paidPayments.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0] 
        : null;
      
      const totalFeeAmount = totalAssessed;
      const totalPaidAmount = totalVerifiedTowardHousehold;
      
      // Create a map of payments by fineId for quick lookup
      const paymentsByFineId = new Map<string, any>();
      allPayments.forEach((payment: any) => {
        if (payment.fineId) {
          paymentsByFineId.set(payment.fineId, payment);
        }
      });
      
      return {
        addressKey,
        address: homeowners[0].address,
        unitNumber: homeowners[0].unitNumber,
        homeowners,
        fees: allFees,
        fines: allFines,
        payments: allPayments,
        latestPayment,
        allFeesPaid,
        totalFeeAmount,
        totalPaidAmount,
        isPartiallyPaid,
        outstandingBalance,
        totalAssessed,
        paymentsByFineId,
      };
    });
  }, [homeownersPaymentStatus, feesByUserId, finesByResidentId, paymentsByUserId]);

  // Fee statistics - household-level counts (fees are per address/household)
  const feeStats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let unpaid = 0;
    homeownersGroupedByAddress.forEach((g: any) => {
      const hasItems = g.fees.length > 0 || g.fines.length > 0;
      if (hasItems) {
        total += 1;
        if (g.allFeesPaid) paid += 1;
        else unpaid += 1;
      }
    });
    return { total, paid, unpaid };
  }, [homeownersGroupedByAddress]);

  // Dues management buttons: responsive layout for all resolutions
  // Breakpoints: xs <360 | sm 360-479 | md 480-639 | lg 640-1023 | xl 1024-1279 | 2xl >=1280
  const duesButtonLayout = useMemo((): {
    flexBasis: '100%' | '48%' | '32%' | '24%';
    maxWidth: '100%' | '48%' | '32%' | '24%';
    minWidth: number | undefined;
    paddingH: number;
    paddingV: number;
    fontSize: number;
    gap: number;
  } => {
    const w = screenWidth;
    if (w < 360) {
      return { flexBasis: '100%', maxWidth: '100%', minWidth: undefined, paddingH: 12, paddingV: 10, fontSize: 11, gap: 10 };
    }
    if (w < 480) {
      return { flexBasis: '48%', maxWidth: '48%', minWidth: undefined, paddingH: 10, paddingV: 10, fontSize: 11, gap: 10 };
    }
    if (w < 640) {
      return { flexBasis: '48%', maxWidth: '48%', minWidth: undefined, paddingH: 12, paddingV: 11, fontSize: 11, gap: 12 };
    }
    if (w < 768) {
      return { flexBasis: '32%', maxWidth: '32%', minWidth: 100, paddingH: 10, paddingV: 11, fontSize: 11, gap: 10 };
    }
    if (w < 1024) {
      return { flexBasis: '32%', maxWidth: '32%', minWidth: 120, paddingH: 14, paddingV: 12, fontSize: 12, gap: 12 };
    }
    if (w < 1280) {
      return { flexBasis: '24%', maxWidth: '24%', minWidth: 140, paddingH: 16, paddingV: 12, fontSize: 12, gap: 12 };
    }
    return { flexBasis: '24%', maxWidth: '24%', minWidth: 160, paddingH: 18, paddingV: 12, fontSize: 12, gap: 12 };
  }, [screenWidth]);

  const duesButtonWrapperStyle = useMemo(() => ({
    flexBasis: duesButtonLayout.flexBasis,
    flexGrow: 1 as const,
    flexShrink: 1 as const,
    maxWidth: duesButtonLayout.maxWidth,
    minWidth: duesButtonLayout.minWidth,
  }), [duesButtonLayout]);

  const fineStats = useMemo(() => {
    return {
      total: allFinesFromDatabase.length,
      paid: paidFines.length,
      unpaid: unpaidFinesList.length,
    };
  }, [allFinesFromDatabase.length, paidFines.length, unpaidFinesList.length]);

  // ========== END MEMOIZED DATA CACHING ==========
  
  // Mutations
  const setBlockStatus = useDemoMutation(api.residents.setBlockStatus);
  const removeResident = useDemoMutation(api.residents.remove);
  const deleteCovenant = useDemoMutation(api.covenants.remove);
  const deleteCommunityPost = useDemoMutation(api.communityPosts.remove);
  const deleteBoardMember = useDemoMutation(api.boardMembers.remove);
  const deleteComment = useDemoMutation(api.communityPosts.removeComment);
  const createBoardMember = useDemoMutation(api.boardMembers.create);
  const updateBoardMember = useDemoMutation(api.boardMembers.update);
  const generateUploadUrl = useDemoMutation(api.storage.generateUploadUrl);
  
  // Fee management mutations
  const createYearFeesForAllHomeowners = useDemoMutation(api.fees.createYearFeesForAllHomeowners);
  const addFineToProperty = useDemoMutation(api.fees.addFineToProperty);
  const updateFee = useDemoMutation(api.fees.update);
  const createFee = useDemoMutation(api.fees.create);
  const addPastDueAmount = useDemoMutation(api.fees.addPastDueAmount);
  const updateAllAnnualFees = useDemoMutation(api.fees.updateAllAnnualFees);
  
  // Covenant management mutations
  const createCovenant = useDemoMutation(api.covenants.create);
  const updateCovenant = useDemoMutation(api.covenants.update);
  const updateCcrsPdf = useDemoMutation(api.hoaInfo.updateCcrsPdf);
  
  // Poll management mutations
  const createPoll = useDemoMutation(api.polls.create);
  const updatePoll = useDemoMutation(api.polls.update);
  const deletePoll = useDemoMutation(api.polls.remove);
  const togglePollActive = useDemoMutation(api.polls.toggleActive);
  
  // Payment management mutations
  const verifyVenmoPayment = useDemoMutation(api.payments.verifyVenmoPayment);
  const recordCheckOrCashPayment = useDemoMutation(api.payments.recordCheckOrCashPayment);
  const correctPaymentAmount = useDemoMutation(api.payments.correctPaymentAmount);
  
  // Pet management mutations
  const deletePet = useDemoMutation(api.pets.remove);
  const updatePet = useDemoMutation(api.pets.update);
  
  // HOA Info management mutation
  const upsertHoaInfo = useDemoMutation(api.hoaInfo.upsert);
  
  // State
  const [refreshing, setRefreshing] = useState(false);
  // activeTab moved earlier (before queries) for lazy loading
  const [postsSubTab, setPostsSubTab] = useState<'posts' | 'comments' | 'polls' | 'pets' | 'complaints'>('posts');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Transactions modal state - declared early so it can be used in queries
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showShareQrModal, setShowShareQrModal] = useState(false);
  const [transactionsLimit, setTransactionsLimit] = useState(50);
  const [transactionsSearchQuery, setTransactionsSearchQuery] = useState('');
  
  // Accordion state for sections (collapse/expand entire sections)

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  
  // Board member modal state
  const [showBoardMemberModal, setShowBoardMemberModal] = useState(false);
  const [isEditingBoardMember, setIsEditingBoardMember] = useState(false);
  const [boardMemberForm, setBoardMemberForm] = useState({
    name: '',
    position: '',
    email: '',
    phone: '',
    bio: '',
    termEnd: '',
  });
  const [boardMemberImage, setBoardMemberImage] = useState<string | null>(null);
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [selectedPaymentForVerification, setSelectedPaymentForVerification] = useState<any>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [adjustedPaymentAmount, setAdjustedPaymentAmount] = useState<string>('');
  const [selectedPaymentForCorrection, setSelectedPaymentForCorrection] = useState<any>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctedAmount, setCorrectedAmount] = useState<string>('');
  const [correctionNotes, setCorrectionNotes] = useState<string>('');
  const [selectedReceiptImage, setSelectedReceiptImage] = useState<string | null>(null);
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);
  
  // Filtered pending payments (client-side filtering) - moved after state declarations
  const filteredPendingPayments = useMemo(() => {
    if (!paymentSearchQuery.trim()) {
      return pendingVenmoPayments;
    }
    const query = paymentSearchQuery.toLowerCase();
    return pendingVenmoPayments.filter((payment: any) => {
      const resident = residentsMap.get(payment.userId);
      const residentName = resident ? `${resident.firstName} ${resident.lastName}`.toLowerCase() : '';
      const address = resident ? `${resident.address}${resident.unitNumber ? ` #${resident.unitNumber}` : ''}`.toLowerCase() : '';
      const feeType = payment.feeType?.toLowerCase() || '';
      const venmoUsername = payment.venmoUsername?.toLowerCase() || '';
      const transactionId = (payment.transactionId || payment.venmoTransactionId || '').toLowerCase();
      const amount = payment.amount.toString();
      
      return residentName.includes(query) ||
             address.includes(query) ||
             feeType.includes(query) ||
             venmoUsername.includes(query) ||
             transactionId.includes(query) ||
             amount.includes(query);
    });
  }, [pendingVenmoPayments, paymentSearchQuery, residentsMap]);

  // Conditional query for recent payments - only fetch when transactions modal is open
  // Moved here after state declarations to avoid initialization error
  const recentPayments =
    useDemoQuery(
      api.payments.getRecentPayments,
      showTransactionsModal ? { limit: transactionsLimit } : 'skip',
      (s, args) => {
        const lim = (args as { limit?: number }).limit ?? transactionsLimit;
        return (s.recentPayments ?? []).slice(0, lim);
      }
    ) ?? [];

  // Filtered transactions (client-side filtering)
  const filteredTransactions = useMemo(() => {
    if (!transactionsSearchQuery.trim()) {
      return recentPayments;
    }
    const query = transactionsSearchQuery.toLowerCase();
    return recentPayments.filter((payment: any) => {
      const resident = residentsMap.get(payment.userId);
      const residentName = resident ? `${resident.firstName} ${resident.lastName}`.toLowerCase() : '';
      const address = resident ? `${resident.address}${resident.unitNumber ? ` #${resident.unitNumber}` : ''}`.toLowerCase() : '';
      const feeType = payment.feeType?.toLowerCase() || '';
      const paymentMethod = payment.paymentMethod?.toLowerCase() || '';
      const venmoUsername = payment.venmoUsername?.toLowerCase() || '';
      const transactionId = (payment.transactionId || payment.venmoTransactionId || payment.checkNumber || '').toLowerCase();
      const amount = payment.amount.toString();
      const status = payment.status?.toLowerCase() || '';
      const verificationStatus = payment.verificationStatus?.toLowerCase() || '';
      const paymentDate = payment.paymentDate?.toLowerCase() || '';
      
      return residentName.includes(query) ||
             address.includes(query) ||
             feeType.includes(query) ||
             paymentMethod.includes(query) ||
             venmoUsername.includes(query) ||
             transactionId.includes(query) ||
             amount.includes(query) ||
             status.includes(query) ||
             verificationStatus.includes(query) ||
             paymentDate.includes(query);
    });
  }, [recentPayments, transactionsSearchQuery, residentsMap]);
  
  // Fee management modal state
  const [showYearFeeModal, setShowYearFeeModal] = useState(false);
  const [showAddFineModal, setShowAddFineModal] = useState(false);
  const [showUpdateDuesModal, setShowUpdateDuesModal] = useState(false);
  const [showPastDueModal, setShowPastDueModal] = useState(false);
  const [yearFeeForm, setYearFeeForm] = useState({
    year: new Date().getFullYear().toString(),
    amount: '300',
    description: 'Annual HOA Fee',
  });
  const [fineForm, setFineForm] = useState({
    selectedAddress: '',
    amount: '',
    reason: '',
    description: '',
  });
  const [updateDuesForm, setUpdateDuesForm] = useState({
    selectedFeeId: '',
    newAmount: '',
  });
  const [pastDueForm, setPastDueForm] = useState({
    selectedResidentId: '',
    amount: '',
    description: '',
    dueDate: '',
  });
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  // Homeowner full-record modal — Fees & Payments tab
  const [showHomeownerRecordsModal, setShowHomeownerRecordsModal] = useState(false);
  const [selectedHomeownerGroup, setSelectedHomeownerGroup] = useState<any>(null);

  // Keep homeowner full-record modal data in sync when fees/payments/fines update (e.g. admin edit)
  useEffect(() => {
    if (!showHomeownerRecordsModal || !selectedHomeownerGroup?.addressKey) return;
    const next = homeownersGroupedByAddress.find(
      (g: any) => g.addressKey === selectedHomeownerGroup.addressKey,
    );
    if (next) setSelectedHomeownerGroup(next);
  }, [homeownersGroupedByAddress, showHomeownerRecordsModal, selectedHomeownerGroup?.addressKey]);

  const [paymentForm, setPaymentForm] = useState({
    homeownerId: '',
    homeownerName: '',
    feeId: '',
    fineId: '',
    amount: '',
    paymentMethod: 'Check' as 'Check' | 'Cash' | 'Venmo',
    paymentDate: new Date().toISOString().split('T')[0],
    checkNumber: '',
    venmoUsername: '',
    venmoTransactionId: '',
    notes: '',
  });

  // Homeowners grid sort (client-side only - no Convex cost)
  const [feesGridSortOrder, setFeesGridSortOrder] = useState<'alphabet' | 'paid' | 'pending' | 'clear'>('alphabet');

  // Sorted and filtered homeowners grid (client-side only - no Convex cost)
  const sortedHomeownersGroupedByAddress = useMemo(() => {
    const getSortKey = (g: (typeof homeownersGroupedByAddress)[0]) => {
      const isClear = g.fees.length === 0 && g.fines.length === 0;
      const isPaid = g.allFeesPaid;
      const isPending = !isClear && !isPaid;
      const firstNameKey = g.homeowners.map((h: any) => `${h.firstName} ${h.lastName}`).join(' ').toLowerCase();
      return { isClear, isPaid, isPending, firstNameKey, addressKey: g.addressKey.toLowerCase() };
    };
    const nameSort = (a: (typeof homeownersGroupedByAddress)[0], b: (typeof homeownersGroupedByAddress)[0]) =>
      getSortKey(a).firstNameKey.localeCompare(getSortKey(b).firstNameKey);

    if (feesGridSortOrder === 'alphabet') {
      return [...homeownersGroupedByAddress].sort(nameSort);
    }
    if (feesGridSortOrder === 'paid') {
      return [...homeownersGroupedByAddress].filter((g) => getSortKey(g).isPaid).sort(nameSort);
    }
    if (feesGridSortOrder === 'pending') {
      return [...homeownersGroupedByAddress].filter((g) => getSortKey(g).isPending).sort(nameSort);
    }
    if (feesGridSortOrder === 'clear') {
      return [...homeownersGroupedByAddress].filter((g) => getSortKey(g).isClear).sort(nameSort);
    }
    return homeownersGroupedByAddress;
  }, [homeownersGroupedByAddress, feesGridSortOrder]);

  // Residents grid sort (client-side only - no Convex cost)
  const [residentsGridSortOrder, setResidentsGridSortOrder] = useState<'alphabet' | 'blocked' | 'board' | 'homeowner' | 'renter' | 'developer'>('alphabet');

  const sortedResidents = useMemo(() => {
    const firstNameKey = (r: any) => `${r.firstName} ${r.lastName}`.toLowerCase();
    const nameSort = (a: any, b: any) => firstNameKey(a).localeCompare(firstNameKey(b));

    if (residentsGridSortOrder === 'alphabet') {
      return [...residents].sort(nameSort);
    }
    if (residentsGridSortOrder === 'blocked') {
      return residents.filter((r) => r.isBlocked).sort(nameSort);
    }
    if (residentsGridSortOrder === 'board') {
      return residents.filter((r) => r.isBoardMember && !r.isBlocked).sort(nameSort);
    }
    if (residentsGridSortOrder === 'homeowner') {
      return residents.filter((r) => r.isResident && !r.isRenter && !r.isBlocked).sort(nameSort);
    }
    if (residentsGridSortOrder === 'renter') {
      return residents.filter((r) => r.isRenter && !r.isBlocked).sort(nameSort);
    }
    if (residentsGridSortOrder === 'developer') {
      return residents.filter((r) => r.isDev && !r.isBlocked).sort(nameSort);
    }
    return residents;
  }, [residents, residentsGridSortOrder]);

  // Search state for modals
  const [fineSearchQuery, setFineSearchQuery] = useState('');
  const [pastDueSearchQuery, setPastDueSearchQuery] = useState('');

  // Covenant modal state
  const [showCovenantModal, setShowCovenantModal] = useState(false);
  const [isEditingCovenant, setIsEditingCovenant] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [covenantForm, setCovenantForm] = useState({
    title: '',
    description: '',
    category: 'General' as 'Architecture' | 'Landscaping' | 'Minutes' | 'Caveats' | 'General',
    lastUpdated: new Date().toLocaleDateString('en-US'),
    /** Existing Convex storage id when editing (preserve if no new upload) */
    fileStorageId: '',
  });
  const [covenantSelectedDoc, setCovenantSelectedDoc] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [covenantSelectedImageUri, setCovenantSelectedImageUri] = useState<string | null>(null);
  const [covenantClearAttachment, setCovenantClearAttachment] = useState(false);
  const [covenantUploading, setCovenantUploading] = useState(false);

  const COVENANT_DOC_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const;

  const uploadCovenantAttachmentToStorage = async (
    doc: DocumentPicker.DocumentPickerAsset | null,
    imageUri: string | null,
  ): Promise<string> => {
    if (!doc && !imageUri) {
      throw new Error('No file selected');
    }
    const uploadUrl = await generateUploadUrl();
    let blob: Blob;
    let mimeType: string;

    if (doc) {
      const response = await fetch(doc.uri);
      blob = await response.blob();
      mimeType = blob.type || doc.mimeType || 'application/pdf';
      const sizeMB = blob.size / (1024 * 1024);
      if (sizeMB > 10) {
        throw new Error('Document too large. Maximum 10MB allowed.');
      }
    } else if (imageUri) {
      try {
        const r = await getUploadReadyImage(imageUri, {
          format: ImageManipulator.SaveFormat.WEBP,
          maxDimension: 1200,
          compress: 0.82,
        });
        blob = r.blob;
        mimeType = r.mimeType;
      } catch {
        const r = await getUploadReadyImage(imageUri, {
          format: ImageManipulator.SaveFormat.JPEG,
          maxDimension: 1200,
          compress: 0.82,
        });
        blob = r.blob;
        mimeType = r.mimeType;
      }
      const sizeMB = blob.size / (1024 * 1024);
      if (sizeMB > 10) {
        throw new Error('Image too large after compression. Maximum 10MB allowed.');
      }
    } else {
      throw new Error('No file selected');
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: blob,
    });
    if (!uploadResponse.ok) {
      throw new Error('Upload failed');
    }
    const { storageId } = await uploadResponse.json();
    return storageId as string;
  };

  const handleCovenantPickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...COVENANT_DOC_TYPES],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        setCovenantSelectedDoc(result.assets[0]);
        setCovenantSelectedImageUri(null);
        setCovenantClearAttachment(false);
      }
    } catch (e) {
      console.error('Covenant document pick:', e);
      Alert.alert('Error', 'Failed to pick document.');
    }
  };

  const handleCovenantPickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets[0]) {
        setCovenantSelectedImageUri(result.assets[0].uri);
        setCovenantSelectedDoc(null);
        setCovenantClearAttachment(false);
      }
    } catch (e) {
      console.error('Covenant image pick:', e);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };
  
  // HOA Info form state
  const [hoaInfoForm, setHoaInfoForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    officeHours: '',
    emergencyContact: '',
    eventText: '',
  });

  // Poll modal state
  const [showPollModal, setShowPollModal] = useState(false);
  const [isEditingPoll, setIsEditingPoll] = useState(false);
  const [pollForm, setPollForm] = useState({
    title: '',
    description: '',
    options: ['', ''],
    allowMultipleVotes: false,
    expiresAt: '',
  });

  // Animation values
  const blockModalOpacity = useRef(new Animated.Value(0)).current;
  const blockModalTranslateY = useRef(new Animated.Value(300)).current;
  const removeModalOpacity = useRef(new Animated.Value(0)).current;
  const removeModalTranslateY = useRef(new Animated.Value(300)).current;
  const deleteModalOpacity = useRef(new Animated.Value(0)).current;
  const deleteModalTranslateY = useRef(new Animated.Value(300)).current;
  const boardMemberModalOpacity = useRef(new Animated.Value(0)).current;
  const boardMemberModalTranslateY = useRef(new Animated.Value(300)).current;
  const yearFeeModalOpacity = useRef(new Animated.Value(0)).current;
  const yearFeeModalTranslateY = useRef(new Animated.Value(300)).current;
  const addFineModalOpacity = useRef(new Animated.Value(0)).current;
  const addFineModalTranslateY = useRef(new Animated.Value(300)).current;
  const updateDuesModalOpacity = useRef(new Animated.Value(0)).current;
  const updateDuesModalTranslateY = useRef(new Animated.Value(300)).current;
  const pastDueModalOpacity = useRef(new Animated.Value(0)).current;
  const pastDueModalTranslateY = useRef(new Animated.Value(300)).current;
  const covenantModalOpacity = useRef(new Animated.Value(0)).current;
  const covenantModalTranslateY = useRef(new Animated.Value(300)).current;
  const pollModalOpacity = useRef(new Animated.Value(0)).current;
  const pollModalTranslateY = useRef(new Animated.Value(300)).current;
  const recordPaymentModalOpacity = useRef(new Animated.Value(0)).current;
  const recordPaymentModalTranslateY = useRef(new Animated.Value(300)).current;
  const transactionsModalOpacity = useRef(new Animated.Value(0)).current;
  const transactionsModalTranslateY = useRef(new Animated.Value(300)).current;
  const shareQrModalOpacity = useRef(new Animated.Value(0)).current;
  const shareQrModalTranslateY = useRef(new Animated.Value(300)).current;
  const categoryDropdownOpacity = useRef(new Animated.Value(0)).current;
  const categoryDropdownScale = useRef(new Animated.Value(0.95)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current; // Start at 0 for individual item animations
  const scrollViewRef = useRef<ScrollView>(null);

  // Handle poll modal animation when visibility changes
  useEffect(() => {
    if (showPollModal) {
      // Make content visible immediately and start animation
      pollModalOpacity.setValue(1);
      pollModalTranslateY.setValue(0);
      // Start from slightly below and animate up
      pollModalTranslateY.setValue(50);
      Animated.spring(pollModalTranslateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else {
      // Reset animation values when closing
      pollModalOpacity.setValue(0);
      pollModalTranslateY.setValue(300);
    }
  }, [showPollModal]);

  // Check if current user is a board member
  const isBoardMember = user?.isBoardMember && user?.isActive;

  // Modern animation functions
  const animateIn = (modalType: 'block' | 'remove' | 'delete' | 'boardMember' | 'yearFee' | 'addFine' | 'updateDues' | 'pastDue' | 'covenant' | 'poll' | 'recordPayment' | 'transactions' | 'shareQr') => {
    const opacity = modalType === 'block' ? blockModalOpacity :
                   modalType === 'remove' ? removeModalOpacity :
                   modalType === 'delete' ? deleteModalOpacity :
                   modalType === 'boardMember' ? boardMemberModalOpacity :
                   modalType === 'yearFee' ? yearFeeModalOpacity :
                   modalType === 'addFine' ? addFineModalOpacity :
                   modalType === 'updateDues' ? updateDuesModalOpacity :
                   modalType === 'pastDue' ? pastDueModalOpacity :
                   modalType === 'covenant' ? covenantModalOpacity :
                   modalType === 'recordPayment' ? recordPaymentModalOpacity :
                   modalType === 'transactions' ? transactionsModalOpacity :
                   modalType === 'shareQr' ? shareQrModalOpacity :
                   pollModalOpacity;
    const translateY = modalType === 'block' ? blockModalTranslateY :
                      modalType === 'remove' ? removeModalTranslateY :
                      modalType === 'delete' ? deleteModalTranslateY:
                      modalType === 'boardMember' ? boardMemberModalTranslateY :
                      modalType === 'yearFee' ? yearFeeModalTranslateY :
                      modalType === 'addFine' ? addFineModalTranslateY :
                      modalType === 'updateDues' ? updateDuesModalTranslateY :
                      modalType === 'pastDue' ? pastDueModalTranslateY :
                      modalType === 'covenant' ? covenantModalTranslateY :
                      modalType === 'recordPayment' ? recordPaymentModalTranslateY :
                      modalType === 'transactions' ? transactionsModalTranslateY :
                      modalType === 'shareQr' ? shareQrModalTranslateY :
                      pollModalTranslateY;
    
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

  const animateOut = (modalType: 'block' | 'remove' | 'delete' | 'boardMember' | 'yearFee' | 'addFine' | 'updateDues' | 'pastDue' | 'covenant' | 'poll' | 'recordPayment' | 'transactions' | 'shareQr', callback: () => void) => {
    const opacity = modalType === 'block' ? blockModalOpacity :
                   modalType === 'remove' ? removeModalOpacity :
                   modalType === 'delete' ? deleteModalOpacity :
                   modalType === 'boardMember' ? boardMemberModalOpacity :
                   modalType === 'yearFee' ? yearFeeModalOpacity :
                   modalType === 'addFine' ? addFineModalOpacity :
                   modalType === 'updateDues' ? updateDuesModalOpacity :
                   modalType === 'pastDue' ? pastDueModalOpacity :
                   modalType === 'covenant' ? covenantModalOpacity :
                   modalType === 'recordPayment' ? recordPaymentModalOpacity :
                   modalType === 'transactions' ? transactionsModalOpacity :
                   modalType === 'shareQr' ? shareQrModalOpacity :
                   pollModalOpacity;
    const translateY = modalType === 'block' ? blockModalTranslateY :
                      modalType === 'remove' ? removeModalTranslateY :
                      modalType === 'delete' ? deleteModalTranslateY :
                      modalType === 'boardMember' ? boardMemberModalTranslateY :
                      modalType === 'yearFee' ? yearFeeModalTranslateY :
                      modalType === 'addFine' ? addFineModalTranslateY :
                      modalType === 'updateDues' ? updateDuesModalTranslateY :
                      modalType === 'pastDue' ? pastDueModalTranslateY :
                      modalType === 'covenant' ? covenantModalTranslateY :
                      modalType === 'recordPayment' ? recordPaymentModalTranslateY :
                      modalType === 'transactions' ? transactionsModalTranslateY :
                      modalType === 'shareQr' ? shareQrModalTranslateY :
                      pollModalTranslateY;
    
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
        toValue: 300,
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

  const animateFadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  // Initialize animations on component mount
  useEffect(() => {
    // Animate individual items
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleBlockResident = (resident: any) => {
    setSelectedItem(resident);
    setBlockReason('');
    setShowBlockModal(true);
    animateIn('block');
  };

  const handleUnblockResident = async (resident: any) => {
    try {
      await setBlockStatus({
        id: resident._id,
        isBlocked: false,
        blockReason: undefined,
      });
      Alert.alert('Success', `${resident.firstName} ${resident.lastName} has been unblocked.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to unblock resident. Please try again.');
    }
  };

  const handleDeleteItem = (item: any, type: string) => {
    setSelectedItem({ ...item, type });
    setShowDeleteModal(true);
    animateIn('delete');
  };

  const confirmBlockResident = async () => {
    if (!blockReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for blocking this resident.');
      return;
    }

    try {
      await setBlockStatus({
        id: selectedItem._id,
        isBlocked: true,
        blockReason: blockReason.trim(),
      });
      Alert.alert('Success', `${selectedItem.firstName} ${selectedItem.lastName} has been blocked.`);
      animateOut('block', () => {
        setShowBlockModal(false);
        setSelectedItem(null);
        setBlockReason('');
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to block resident. Please try again.');
    }
  };

  const handleRemoveResident = (resident: any) => {
    if (user && resident._id === user._id) {
      Alert.alert('Error', 'You cannot remove your own account.');
      return;
    }
    setSelectedItem(resident);
    setShowRemoveModal(true);
    animateIn('remove');
  };

  const confirmRemoveResident = async () => {
    if (!selectedItem) return;
    try {
      await removeResident({ id: selectedItem._id });
      Alert.alert('Success', `${selectedItem.firstName} ${selectedItem.lastName} has been removed.`);
      animateOut('remove', () => {
        setShowRemoveModal(false);
        setSelectedItem(null);
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to remove resident. Please try again.');
    }
  };

  const confirmDeleteItem = async () => {
    try {
      switch (selectedItem.type) {
        case 'covenant':
          await deleteCovenant({ id: selectedItem._id });
          Alert.alert('Success', 'Covenant deleted successfully.');
          break;
        case 'post':
          await deleteCommunityPost({ id: selectedItem._id });
          Alert.alert('Success', 'Community post deleted successfully.');
          break;
        case 'board':
          await deleteBoardMember({ id: selectedItem._id });
          Alert.alert('Success', 'Board member deleted successfully.');
          break;
        case 'comment':
          await deleteComment({ id: selectedItem._id });
          Alert.alert('Success', 'Comment deleted successfully.');
          break;
        case 'pet':
          await deletePet({ id: selectedItem._id });
          Alert.alert('Success', 'Pet registration deleted successfully.');
          break;
        case 'poll':
          await deletePoll({ id: selectedItem._id });
          Alert.alert('Success', 'Poll deleted successfully.');
          break;
        default:
          Alert.alert('Error', 'Unknown item type.');
      }
      animateOut('delete', () => {
        setShowDeleteModal(false);
        setSelectedItem(null);
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item. Please try again.');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // HOA Info handler
  const handleSaveHoaInfo = async () => {
    try {
      await upsertHoaInfo({
        name: hoaInfoForm.name.trim() || '',
        address: hoaInfoForm.address.trim() || '',
        phone: hoaInfoForm.phone.trim() || '',
        email: hoaInfoForm.email.trim() || '',
        website: hoaInfoForm.website.trim() || undefined,
        officeHours: hoaInfoForm.officeHours.trim() || '',
        emergencyContact: hoaInfoForm.emergencyContact.trim() || '',
        eventText: hoaInfoForm.eventText.trim() || undefined,
      });

      // Send notification for HOA info update
      await notifyBoardUpdate('HOA Information Updated', 'HOA contact information has been updated', convex);

      Alert.alert('Success', 'HOA information updated successfully.');
    } catch (error) {
      console.error('Error saving HOA info:', error);
      Alert.alert('Error', 'Failed to save HOA information. Please try again.');
    }
  };

  const handleCopyToClipboard = async (label: string, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert('Copied', `${label} copied to clipboard.`);
    } catch (error) {
      Alert.alert('Copy failed', 'Could not copy this link. Please copy manually.');
    }
  };

  const handleCopyQrImage = async (item: { key: string; label: string; url: string }) => {
    const copyLinkFallback = async () => {
      await Clipboard.setStringAsync(item.url);
      Alert.alert(
        'Copied link',
        `${item.label} link copied. This browser may block image clipboard on mobile web.`
      );
    };

    try {
      const qrRef = shareQrRefs.current[item.key];
      if (!qrRef || typeof qrRef.toDataURL !== 'function') {
        await copyLinkFallback();
        return;
      }

      qrRef.toDataURL(async (base64: string) => {
        try {
          if (!base64) {
            await copyLinkFallback();
            return;
          }

          const base64ToPngBlob = () => {
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i += 1) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            return new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
          };

          // Native devices: open OS share flow for saving/copying image.
          if (Platform.OS === 'ios' || Platform.OS === 'android') {
            if (typeof Sharing.isAvailableAsync === 'function' && await Sharing.isAvailableAsync()) {
              const safeKey = item.key.replace(/[^a-z0-9_-]/gi, '_');
              const fileUri = `${FileSystem.cacheDirectory}qr-${safeKey}.png`;
              await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
              });
              await Sharing.shareAsync(fileUri, {
                mimeType: 'image/png',
                dialogTitle: `${item.label} QR Code`,
                UTI: 'public.png',
              });
              return;
            }
          }

          // Mobile web: system share sheet (image when supported, else URL).
          if (
            Platform.OS === 'web' &&
            typeof navigator !== 'undefined' &&
            typeof navigator.share === 'function'
          ) {
            const ua = navigator.userAgent || '';
            const isMobileWeb =
              /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
              (typeof window !== 'undefined' &&
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(pointer: coarse)').matches);

            if (isMobileWeb) {
              try {
                if (typeof File !== 'undefined') {
                  const pngBlob = base64ToPngBlob();
                  const safeKey = item.key.replace(/[^a-z0-9_-]/gi, '_');
                  const file = new File([pngBlob], `shelton-springs-qr-${safeKey}.png`, {
                    type: 'image/png',
                  });
                  if (
                    typeof navigator.canShare === 'function' &&
                    navigator.canShare({ files: [file] })
                  ) {
                    await navigator.share({
                      title: `${item.label} QR Code`,
                      text: item.url,
                      files: [file],
                    });
                    return;
                  }
                }
              } catch (err: unknown) {
                if (err instanceof Error && err.name === 'AbortError') return;
              }
              try {
                if (
                  typeof navigator.canShare === 'function' &&
                  navigator.canShare({ url: item.url })
                ) {
                  await navigator.share({
                    title: item.label,
                    text: item.url,
                    url: item.url,
                  });
                  return;
                }
              } catch (err: unknown) {
                if (err instanceof Error && err.name === 'AbortError') return;
              }
            }
          }

          // Prefer native web clipboard image write for mobile browsers.
          if (
            Platform.OS === 'web' &&
            typeof window !== 'undefined' &&
            typeof navigator !== 'undefined' &&
            (navigator as any).clipboard?.write &&
            typeof (window as any).ClipboardItem !== 'undefined'
          ) {
            const pngBlob = base64ToPngBlob();
            const clipboardItem = new (window as any).ClipboardItem({ 'image/png': pngBlob });
            await (navigator as any).clipboard.write([clipboardItem]);
            Alert.alert('Copied QR image', `${item.label} QR image copied to clipboard.`);
            return;
          }

          // expo-clipboard image API path (native + supported web runtimes).
          const clipboardAny = Clipboard as any;
          if (typeof clipboardAny.setImageAsync === 'function') {
            await clipboardAny.setImageAsync(base64);
            Alert.alert('Copied QR image', `${item.label} QR image copied to clipboard.`);
            return;
          }
          await copyLinkFallback();
        } catch {
          await copyLinkFallback();
        }
      });
    } catch {
      await copyLinkFallback();
    }
  };

  // Board member handlers
  const handleAddBoardMember = () => {
    setBoardMemberForm({
      name: '',
      position: '',
      email: '',
      phone: '',
      bio: '',
      termEnd: '',
    });
    setBoardMemberImage(null);
    setIsEditingBoardMember(false);
    setShowBoardMemberModal(true);
    animateIn('boardMember');
  };

  const handleEditBoardMember = (member: any) => {
    setBoardMemberForm({
      name: member.name || '',
      position: member.position || '',
      email: member.email || '',
      phone: member.phone || '',
      bio: member.bio || '',
      termEnd: member.termEnd || '',
    });
    setBoardMemberImage(member.image || null);
    setIsEditingBoardMember(true);
    setSelectedItem(member);
    setShowBoardMemberModal(true);
    animateIn('boardMember');
  };

  const handleSaveBoardMember = async () => {
    if (!boardMemberForm.name.trim() || !boardMemberForm.position.trim() || !boardMemberForm.email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields (Name, Position, Email).');
      return;
    }

    try {
      let imageUrl: string | undefined;
      
      // Upload image if selected
      if (boardMemberImage) {
        imageUrl = await uploadImage(boardMemberImage);
      }

      const memberData = {
        ...boardMemberForm,
        image: imageUrl,
      };

      if (isEditingBoardMember) {
        await updateBoardMember({
          id: selectedItem._id,
          ...memberData,
        });
        // Send notification for board member update
        await notifyBoardUpdate('Board Member Updated', `${memberData.name} - ${memberData.position}`, convex);
        Alert.alert('Success', 'Board member updated successfully.');
      } else {
        await createBoardMember(memberData);
        // Send notification for new board member
        await notifyBoardUpdate('New Board Member', `${memberData.name} - ${memberData.position}`, convex);
        Alert.alert('Success', 'Board member added successfully.');
      }
      
      animateOut('boardMember', () => {
        setShowBoardMemberModal(false);
        setBoardMemberForm({
          name: '',
          position: '',
          email: '',
          phone: '',
          bio: '',
          termEnd: '',
        });
        setBoardMemberImage(null);
        setSelectedItem(null);
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to save board member. Please try again.');
    }
  };

  const handleCancelBoardMember = () => {
    animateOut('boardMember', () => {
      setShowBoardMemberModal(false);
      setBoardMemberForm({
        name: '',
        position: '',
        email: '',
        phone: '',
        bio: '',
        termEnd: '',
      });
      setBoardMemberImage(null);
      setSelectedItem(null);
    });
  };

  // Fee management handlers
  const handleAddYearFees = async () => {
    try {
      const year = parseInt(yearFeeForm.year);
      const amount = parseFloat(yearFeeForm.amount);
      
      if (!year || !amount) {
        Alert.alert('Error', 'Please enter valid year and amount.');
        return;
      }

      // Call Convex mutation to create annual fees for all homeowners
      const result = await createYearFeesForAllHomeowners({
        year: year,
        amount: amount,
        description: yearFeeForm.description,
      });

      if (result.success) {
        // Notification sent by Convex createYearFeesForAllHomeowners (includes push)
        Alert.alert(
          'Year Fees Added', 
          result.message
        );
        
        setShowYearFeeModal(false);
        setYearFeeForm({
          year: new Date().getFullYear().toString(),
          amount: '300',
          description: 'Annual HOA Fee',
        });
      } else {
        Alert.alert('Error', 'Failed to create year fees. Please try again.');
      }
    } catch (error) {
      console.error('Error adding year fees:', error);
      Alert.alert('Error', 'Failed to add year fees. Please try again.');
    }
  };

  const handleAddFine = async () => {
    try {
      const amount = parseFloat(fineForm.amount);
      
      if (!fineForm.selectedAddress || !amount || !fineForm.reason) {
        Alert.alert('Error', 'Please fill in all required fields.');
        return;
      }

      // Find the homeowner ID for the selected address
      const selectedHomeowner = homeownersPaymentStatus?.find(homeowner => 
        `${homeowner.address}${homeowner.unitNumber ? ` Unit ${homeowner.unitNumber}` : ''}` === fineForm.selectedAddress
      );

      if (!selectedHomeowner) {
        Alert.alert('Error', 'Could not find homeowner for selected address.');
        return;
      }

      // Call Convex mutation to add a fine to the selected address
      const result = await addFineToProperty({
        address: fineForm.selectedAddress,
        homeownerId: selectedHomeowner._id,
        amount: amount,
        reason: fineForm.reason,
        description: fineForm.description,
      });

      if (result.success) {
        // Notification sent by Convex addFineToProperty (includes push)
        
        Alert.alert(
          'Fine Added', 
          result.message
        );
        
        setShowAddFineModal(false);
        setFineForm({
          selectedAddress: '',
          amount: '',
          reason: '',
          description: '',
        });
        setFineSearchQuery('');
      } else {
        Alert.alert('Error', 'Failed to add fine. Please try again.');
      }
    } catch (error) {
      console.error('Error adding fine:', error);
      Alert.alert('Error', 'Failed to add fine. Please try again.');
    }
  };

  const handleRecordPayment = async () => {
    try {
      // Validation
      if (!paymentForm.homeownerId) {
        Alert.alert('Error', 'Please select a homeowner.');
        return;
      }

      const amount = parseFloat(paymentForm.amount);
      if (!amount || amount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount.');
        return;
      }

      if (!paymentForm.paymentDate) {
        Alert.alert('Error', 'Please enter a payment date.');
        return;
      }

      // For now, we'll record a general payment without linking to specific fees
      // In a future enhancement, we could add fee selection
      const result = await recordCheckOrCashPayment({
        userId: paymentForm.homeownerId,
        feeType: 'Manual Payment', // General payment type
        amount: amount,
        paymentMethod: paymentForm.paymentMethod,
        paymentDate: paymentForm.paymentDate,
        checkNumber: paymentForm.checkNumber || undefined,
        venmoUsername: paymentForm.venmoUsername || undefined,
        venmoTransactionId: paymentForm.venmoTransactionId || undefined,
        notes: paymentForm.notes || undefined,
        feeId: undefined, // Not linking to specific fees for now
        fineId: undefined,
      });

      if (result.success) {
        Alert.alert('Success', result.message);
        setShowRecordPaymentModal(false);
        setPaymentSearchQuery('');
        setPaymentForm({
          homeownerId: '',
          homeownerName: '',
          feeId: '',
          fineId: '',
          amount: '',
          paymentMethod: 'Check',
          paymentDate: new Date().toISOString().split('T')[0],
          checkNumber: '',
          venmoUsername: '',
          venmoTransactionId: '',
          notes: '',
        });
      } else {
        Alert.alert('Error', 'Failed to record payment.');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert('Error', 'Failed to record payment. Please try again.');
    }
  };

  const handleUpdateDues = async () => {
    try {
      const newAmount = parseFloat(updateDuesForm.newAmount);
      const currentYear = new Date().getFullYear();
      
      if (!newAmount || newAmount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount.');
        return;
      }

      // Call Convex mutation to update all annual fees for the current year
      const result = await updateAllAnnualFees({
        year: currentYear,
        amount: newAmount,
      });

      if (result.success) {
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Error', 'Failed to update dues. Please try again.');
      }
      
      setShowUpdateDuesModal(false);
      setUpdateDuesForm({
        selectedFeeId: '',
        newAmount: '',
      });
    } catch (error) {
      console.error('Error updating dues:', error);
      Alert.alert('Error', 'Failed to update dues amount. Please try again.');
    }
  };

  const handleAddPastDue = async () => {
    try {
      const amount = parseFloat(pastDueForm.amount);
      
      if (!pastDueForm.selectedResidentId || !amount || amount <= 0 || !pastDueForm.description || !pastDueForm.dueDate) {
        Alert.alert('Error', 'Please fill in all required fields.');
        return;
      }

      // Call Convex mutation to add past due amount
      const result = await addPastDueAmount({
        userId: pastDueForm.selectedResidentId,
        amount: amount,
        description: pastDueForm.description,
        dueDate: pastDueForm.dueDate,
      });

      if (result.success) {
        Alert.alert('Success', result.message);

        setShowPastDueModal(false);
        setPastDueSearchQuery('');
        setPastDueForm({
          selectedResidentId: '',
          amount: '',
          description: '',
          dueDate: new Date().toISOString().split('T')[0],
        });
      } else {
        Alert.alert('Error', 'Failed to add past due amount. Please try again.');
      }
    } catch (error) {
      console.error('Error adding past due amount:', error);
      Alert.alert('Error', 'Failed to add past due amount. Please try again.');
    }
  };


  // Get unique addresses for fine selection
  const getUniqueAddresses = () => {
    if (!homeownersPaymentStatus) return [];
    
    const addresses = homeownersPaymentStatus.map(homeowner => ({
      address: `${homeowner.address}${homeowner.unitNumber ? ` Unit ${homeowner.unitNumber}` : ''}`,
      fullAddress: `${homeowner.address}${homeowner.unitNumber ? ` Unit ${homeowner.unitNumber}` : ''}`,
      homeownerId: homeowner._id,
      homeownerName: `${homeowner.firstName} ${homeowner.lastName}`
    }));
    
    // Remove duplicates based on address
    const uniqueAddresses = addresses.filter((address, index, self) => 
      index === self.findIndex(a => a.address === address.address)
    );
    
    return uniqueAddresses;
  };

  // Covenant handlers
  const resetCovenantAttachmentState = () => {
    setCovenantSelectedDoc(null);
    setCovenantSelectedImageUri(null);
    setCovenantClearAttachment(false);
  };

  const handleAddCovenant = async () => {
    try {
      if (!covenantForm.title || !covenantForm.description) {
        Alert.alert('Error', 'Please fill in all required fields.');
        return;
      }

      setCovenantUploading(true);
      let fileStorageId: string | undefined;
      if (covenantSelectedDoc || covenantSelectedImageUri) {
        fileStorageId = await uploadCovenantAttachmentToStorage(
          covenantSelectedDoc,
          covenantSelectedImageUri,
        );
      }

      await createCovenant({
        title: covenantForm.title,
        description: covenantForm.description,
        category: covenantForm.category,
        lastUpdated: covenantForm.lastUpdated,
        fileStorageId,
      });

      Alert.alert('Success', 'Covenant created successfully!');

      setShowCovenantModal(false);
      setShowCategoryDropdown(false);
      animateCategoryDropdownOut();
      resetCovenantAttachmentState();
      setCovenantForm({
        title: '',
        description: '',
        category: 'General',
        lastUpdated: new Date().toLocaleDateString('en-US'),
        fileStorageId: '',
      });
    } catch (error: any) {
      console.error('Error creating covenant:', error);
      Alert.alert('Error', error?.message || 'Failed to create covenant. Please try again.');
    } finally {
      setCovenantUploading(false);
    }
  };

  const handleEditCovenant = (covenant: any) => {
    setCovenantForm({
      title: covenant.title,
      description: covenant.description,
      category: covenant.category,
      lastUpdated: covenant.lastUpdated,
      fileStorageId: covenant.fileStorageId || '',
    });
    resetCovenantAttachmentState();
    setIsEditingCovenant(true);
    setSelectedItem(covenant);
    setShowCovenantModal(true);
    animateIn('covenant');
  };

  const handleUpdateCovenant = async () => {
    try {
      if (!covenantForm.title || !covenantForm.description) {
        Alert.alert('Error', 'Please fill in all required fields.');
        return;
      }

      setCovenantUploading(true);

      const payload: {
        id: any;
        title: string;
        description: string;
        category: typeof covenantForm.category;
        lastUpdated: string;
        fileStorageId?: string | null;
        pdfUrl?: string | null;
      } = {
        id: selectedItem._id,
        title: covenantForm.title,
        description: covenantForm.description,
        category: covenantForm.category,
        lastUpdated: covenantForm.lastUpdated,
      };

      if (covenantSelectedDoc || covenantSelectedImageUri) {
        payload.fileStorageId = await uploadCovenantAttachmentToStorage(
          covenantSelectedDoc,
          covenantSelectedImageUri,
        );
        payload.pdfUrl = null;
      } else if (covenantClearAttachment) {
        payload.fileStorageId = null;
        payload.pdfUrl = null;
      }

      await updateCovenant(payload);

      Alert.alert('Success', 'Covenant updated successfully!');

      setShowCovenantModal(false);
      setIsEditingCovenant(false);
      setShowCategoryDropdown(false);
      animateCategoryDropdownOut();
      setSelectedItem(null);
      resetCovenantAttachmentState();
      setCovenantForm({
        title: '',
        description: '',
        category: 'General',
        lastUpdated: new Date().toLocaleDateString('en-US'),
        fileStorageId: '',
      });
    } catch (error: any) {
      console.error('Error updating covenant:', error);
      Alert.alert('Error', error?.message || 'Failed to update covenant. Please try again.');
    } finally {
      setCovenantUploading(false);
    }
  };

  const handleCancelCovenant = () => {
    setShowCovenantModal(false);
    setIsEditingCovenant(false);
    setShowCategoryDropdown(false);
    animateCategoryDropdownOut();
    setSelectedItem(null);
    resetCovenantAttachmentState();
    setCovenantForm({
      title: '',
      description: '',
      category: 'General',
      lastUpdated: new Date().toLocaleDateString('en-US'),
      fileStorageId: '',
    });
    animateOut('covenant', () => {});
  };

  // Poll management handlers
  const handleCreatePoll = async () => {
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
        createdBy: user ? `${user.firstName} ${user.lastName}` : 'Admin',
      });

      // Send notification for new poll
      await notifyNewPoll(pollForm.title, user ? `${user.firstName} ${user.lastName}` : 'Admin', convex);

      Alert.alert('Success', 'Poll created successfully!');
      
      setShowPollModal(false);
      setIsEditingPoll(false);
      setSelectedItem(null);
      setPollForm({
        title: '',
        description: '',
        options: ['', ''],
        allowMultipleVotes: false,
        expiresAt: '',
      });
      animateOut('poll', () => {});
    } catch (error) {
      console.error('Error creating poll:', error);
      Alert.alert('Error', 'Failed to create poll. Please try again.');
    }
  };

  const handleEditPoll = (poll: any) => {
    setSelectedItem(poll);
    setIsEditingPoll(true);
    setPollForm({
      title: poll.title,
      description: poll.description || '',
      options: poll.options,
      allowMultipleVotes: poll.allowMultipleVotes,
      expiresAt: poll.expiresAt ? new Date(poll.expiresAt).toISOString().split('T')[0] : '',
    });
    setShowPollModal(true);
  };

  const handleUpdatePoll = async () => {
    try {
      if (!pollForm.title || pollForm.options.filter(opt => opt.trim()).length < 2) {
        Alert.alert('Error', 'Please provide a title and at least 2 options.');
        return;
      }

      const validOptions = pollForm.options.filter(opt => opt.trim());
      
      await updatePoll({
        id: selectedItem._id,
        title: pollForm.title,
        description: pollForm.description || undefined,
        options: validOptions,
        allowMultipleVotes: pollForm.allowMultipleVotes,
        expiresAt: pollForm.expiresAt ? new Date(pollForm.expiresAt).getTime() : undefined,
      });

      Alert.alert('Success', 'Poll updated successfully!');
      
      setShowPollModal(false);
      setIsEditingPoll(false);
      setSelectedItem(null);
      setPollForm({
        title: '',
        description: '',
        options: ['', ''],
        allowMultipleVotes: false,
        expiresAt: '',
      });
      animateOut('poll', () => {});
    } catch (error) {
      console.error('Error updating poll:', error);
      Alert.alert('Error', 'Failed to update poll. Please try again.');
    }
  };

  const handleDeletePoll = (poll: any) => {
    setSelectedItem({ ...poll, type: 'poll' });
    setShowDeleteModal(true);
    animateIn('delete');
  };

  const handleTogglePollActive = async (poll: any) => {
    try {
      await togglePollActive({ id: poll._id });
      Alert.alert('Success', `Poll ${poll.isActive ? 'deactivated' : 'activated'} successfully!`);
    } catch (error) {
      console.error('Error toggling poll status:', error);
      Alert.alert('Error', 'Failed to update poll status. Please try again.');
    }
  };

  const handleCancelPoll = () => {
    setShowPollModal(false);
    setIsEditingPoll(false);
    setSelectedItem(null);
    setPollForm({
      title: '',
      description: '',
      options: ['', ''],
      allowMultipleVotes: false,
      expiresAt: '',
    });
    animateOut('poll', () => {});
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

  // Category dropdown animation functions
  const animateCategoryDropdownIn = () => {
    Animated.parallel([
      Animated.timing(categoryDropdownOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(categoryDropdownScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const animateCategoryDropdownOut = () => {
    Animated.parallel([
      Animated.timing(categoryDropdownOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(categoryDropdownScale, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  // Image upload functions
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setBoardMemberImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setBoardMemberImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const uploadImage = async (imageUri: string): Promise<string> => {
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

  // Helper component for pet images
  const PetImage = ({ storageId }: { storageId: string }) => (
    <OptimizedImage
      storageId={storageId}
      style={styles.petCardImage}
      contentFit="cover"
      priority="high"
      placeholderContent={
        <View style={styles.petImageLoading}>
          <Ionicons name="paw" size={32} color="#cbd5e1" />
        </View>
      }
    />
  );

  if (!isBoardMember) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.accessDeniedContainer}>
            <Ionicons name="lock-closed" size={64} color="#ef4444" />
            <Text style={styles.accessDeniedTitle}>Access Denied</Text>
            <Text style={styles.accessDeniedText}>
              Only board members can access this administrative area.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'SheltonHOA':
        return (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Shelton HOA Information</Text>
            </View>
            
            <View style={styles.hoaInfoContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>HOA Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={hoaInfoForm.name}
                  onChangeText={(text) => setHoaInfoForm({ ...hoaInfoForm, name: text })}
                  placeholder="e.g., Shelton Homeowners Association"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={styles.textInput}
                  value={hoaInfoForm.address}
                  onChangeText={(text) => setHoaInfoForm({ ...hoaInfoForm, address: text })}
                  placeholder="e.g., 123 Main Street, Shelton, CT 06484"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.textInput}
                  value={hoaInfoForm.phone}
                  onChangeText={(text) => setHoaInfoForm({ ...hoaInfoForm, phone: text })}
                  placeholder="e.g., (203) 555-1234"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={hoaInfoForm.email}
                  onChangeText={(text) => setHoaInfoForm({ ...hoaInfoForm, email: text })}
                  placeholder="e.g., info@sheltonhoa.org"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Website</Text>
                <TextInput
                  style={styles.textInput}
                  value={hoaInfoForm.website}
                  onChangeText={(text) => setHoaInfoForm({ ...hoaInfoForm, website: text })}
                  placeholder="e.g., https://www.sheltonhoa.org"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Office Hours</Text>
                <TextInput
                  style={styles.textInput}
                  value={hoaInfoForm.officeHours}
                  onChangeText={(text) => setHoaInfoForm({ ...hoaInfoForm, officeHours: text })}
                  placeholder="e.g., Monday-Friday 9:00 AM - 5:00 PM"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Emergency Contact</Text>
                <TextInput
                  style={styles.textInput}
                  value={hoaInfoForm.emergencyContact}
                  onChangeText={(text) => setHoaInfoForm({ ...hoaInfoForm, emergencyContact: text })}
                  placeholder="e.g., (203) 555-9999 or emergency@sheltonhoa.org"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Upcoming Events Text</Text>
                <TextInput
                  style={[styles.textInput, { height: 100, textAlignVertical: 'top' }]}
                  value={hoaInfoForm.eventText}
                  onChangeText={(text) => setHoaInfoForm({ ...hoaInfoForm, eventText: text })}
                  placeholder={"e.g.,\n📅 Board Meeting - Next Tuesday at 7:00 PM\n🏠 Community Cleanup - This Saturday 9:00 AM"}
                  placeholderTextColor="#9ca3af"
                  multiline
                />
              </View>
              
              <TouchableOpacity
                style={[styles.adminFeeButton, { backgroundColor: '#8b5cf6', marginTop: 20 }]}
                onPress={handleSaveHoaInfo}
              >
                <Ionicons name="save" size={16} color="#ffffff" />
                <Text style={styles.adminFeeButtonText}>Save HOA Information</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.adminFeeButton, { backgroundColor: '#2563eb', marginTop: 12 }]}
                onPress={() => {
                  setShowShareQrModal(true);
                  animateIn('shareQr');
                }}
              >
                <Ionicons name="qr-code-outline" size={16} color="#ffffff" />
                <Text style={styles.adminFeeButtonText}>Open Share Links & QR Codes</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      
      case 'residents':
        return (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Residents</Text>
            </View>
            
            {/* Role Statistics */}
            <View style={styles.roleStatsContainer}>
              <View style={styles.roleStatsRow}>
                <View style={styles.roleStatCard}>
                  <View style={styles.roleStatIcon}>
                    <Ionicons name="people" size={18} color="#10b981" />
                  </View>
                  <Text style={styles.roleStatNumber}>
                    {residentRoleCounts.homeowners}
                  </Text>
                  <Text style={styles.roleStatLabel}>Homeowner</Text>
                </View>
                
                <View style={styles.roleStatCard}>
                  <View style={styles.roleStatIcon}>
                    <Ionicons name="home" size={18} color="#3b82f6" />
                  </View>
                  <Text style={styles.roleStatNumber}>
                    {residentRoleCounts.renters}
                  </Text>
                  <Text style={styles.roleStatLabel}>Renters</Text>
                </View>
                
                <View style={styles.roleStatCard}>
                  <View style={styles.roleStatIcon}>
                    <Ionicons name="shield" size={18} color="#f59e0b" />
                  </View>
                  <Text style={styles.roleStatNumber}>
                    {residents.filter(r => r.isBoardMember).length}
                  </Text>
                  <Text style={styles.roleStatLabel}>Board Members</Text>
                </View>
                
                <View style={styles.roleStatCard}>
                  <View style={styles.roleStatIcon}>
                    <Ionicons name="ban" size={18} color="#ef4444" />
                  </View>
                  <Text style={styles.roleStatNumber}>
                    {residents.filter(r => r.isBlocked).length}
                  </Text>
                  <Text style={styles.roleStatLabel}>Blocked</Text>
                </View>
              </View>
            </View>

            {/* Residents Grid */}
            {residents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people" size={48} color="#9ca3af" />
                <Text style={styles.emptyStateText}>No residents found</Text>
                <Text style={styles.emptyStateSubtext}>
                  Residents will appear here once they register in the system
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.feesGridSortRow}>
                  <Text style={styles.feesGridSortLabel}>Sort:</Text>
                  <TouchableOpacity
                    style={[styles.feesGridSortOption, residentsGridSortOrder === 'alphabet' && styles.feesGridSortOptionActive]}
                    onPress={() => setResidentsGridSortOrder('alphabet')}
                  >
                    <Ionicons name="reorder-three" size={16} color={residentsGridSortOrder === 'alphabet' ? '#ffffff' : '#6b7280'} />
                    <Text style={[styles.feesGridSortOptionText, residentsGridSortOrder === 'alphabet' && styles.feesGridSortOptionTextActive]}>Alphabet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.feesGridSortOption, residentsGridSortOrder === 'blocked' && styles.feesGridSortOptionActive]}
                    onPress={() => setResidentsGridSortOrder('blocked')}
                  >
                    <Ionicons name="ban" size={16} color={residentsGridSortOrder === 'blocked' ? '#ffffff' : '#ef4444'} />
                    <Text style={[styles.feesGridSortOptionText, residentsGridSortOrder === 'blocked' && styles.feesGridSortOptionTextActive]}>Blocked</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.feesGridSortOption, residentsGridSortOrder === 'board' && styles.feesGridSortOptionActive]}
                    onPress={() => setResidentsGridSortOrder('board')}
                  >
                    <Ionicons name="shield" size={16} color={residentsGridSortOrder === 'board' ? '#ffffff' : '#f59e0b'} />
                    <Text style={[styles.feesGridSortOptionText, residentsGridSortOrder === 'board' && styles.feesGridSortOptionTextActive]}>Board</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.feesGridSortOption, residentsGridSortOrder === 'homeowner' && styles.feesGridSortOptionActive]}
                    onPress={() => setResidentsGridSortOrder('homeowner')}
                  >
                    <Ionicons name="people" size={16} color={residentsGridSortOrder === 'homeowner' ? '#ffffff' : '#10b981'} />
                    <Text style={[styles.feesGridSortOptionText, residentsGridSortOrder === 'homeowner' && styles.feesGridSortOptionTextActive]}>Homeowner</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.feesGridSortOption, residentsGridSortOrder === 'renter' && styles.feesGridSortOptionActive]}
                    onPress={() => setResidentsGridSortOrder('renter')}
                  >
                    <Ionicons name="home" size={16} color={residentsGridSortOrder === 'renter' ? '#ffffff' : '#3b82f6'} />
                    <Text style={[styles.feesGridSortOptionText, residentsGridSortOrder === 'renter' && styles.feesGridSortOptionTextActive]}>Renter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.feesGridSortOption, residentsGridSortOrder === 'developer' && styles.feesGridSortOptionActive]}
                    onPress={() => setResidentsGridSortOrder('developer')}
                  >
                    <Ionicons name="code-slash" size={16} color={residentsGridSortOrder === 'developer' ? '#ffffff' : '#2563eb'} />
                    <Text style={[styles.feesGridSortOptionText, residentsGridSortOrder === 'developer' && styles.feesGridSortOptionTextActive]}>Developer</Text>
                  </TouchableOpacity>
                </View>
                {sortedResidents.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="people" size={48} color="#9ca3af" />
                    <Text style={styles.emptyStateText}>No residents match this filter</Text>
                  </View>
                ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {sortedResidents.map((item: any) => {
                  // Determine primary role (Developer replaces Resident for devs)
                  let primaryRole = 'Resident';
                  let roleIcon = 'person';
                  let roleColor = '#6b7280';
                  
                  if (item.isBlocked) {
                    primaryRole = 'Blocked';
                    roleIcon = 'ban';
                    roleColor = '#ef4444';
                  } else if (item.isDev) {
                    primaryRole = 'Developer';
                    roleIcon = 'code-slash';
                    roleColor = '#2563eb';
                  } else if (item.isBoardMember) {
                    primaryRole = 'Board Member';
                    roleIcon = 'shield';
                    roleColor = '#f59e0b';
                  } else if (item.isRenter) {
                    primaryRole = 'Renter';
                    roleIcon = 'home';
                    roleColor = '#3b82f6';
                  } else if (item.isResident) {
                    primaryRole = 'Homeowner';
                    roleIcon = 'people';
                    roleColor = '#10b981';
                  }

                  return (
                    <View key={item._id} style={{ width: '50%', padding: 8 }}>
                      <Animated.View 
                        style={[
                          styles.residentGridCard,
                          {
                            opacity: fadeAnim,
                            transform: [{
                              translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                              })
                            }]
                          }
                        ]}
                      >
                        <View style={styles.residentGridCardContent}>
                          {/* Main Info Row - Avatar Left, Details Right */}
                          <View style={styles.residentGridMainInfo}>
                            <ProfileImage 
                              source={item.profileImage} 
                              size={40}
                              initials={`${item.firstName.charAt(0)}${item.lastName.charAt(0)}`}
                              style={{ marginRight: 6 }}
                            />
                            
                            <View style={styles.residentGridDetails}>
                              {/* Name and Role Row */}
                              <View style={styles.residentGridNameRow}>
                                <Text style={styles.residentGridName} numberOfLines={2}>
                                  {item.firstName} {item.lastName}
                                </Text>
                                <View style={styles.residentGridRoleBadgesContainer}>
                                  <View style={[styles.residentGridRoleBadge, { backgroundColor: roleColor + '20' }]}>
                                    <Ionicons name={roleIcon as any} size={Platform.OS === 'web' ? 12 : 13} color={roleColor} />
                                    <Text style={[styles.residentGridRoleText, { color: roleColor }]} numberOfLines={1}>
                                      {primaryRole}
                                    </Text>
                                  </View>
                                  {/* Additional indicators for board members (not for devs - dev shows Developer only) */}
                                  {!item.isDev && item.isBoardMember && item.isResident && (
                                    <View style={[styles.residentGridRoleBadge, { backgroundColor: '#10b98120' }]}>
                                      <Ionicons name="people" size={Platform.OS === 'web' ? 10 : 11} color="#10b981" />
                                      <Text style={[styles.residentGridRoleText, { color: '#10b981' }]} numberOfLines={1}>
                                        Homeowners
                                      </Text>
                                    </View>
                                  )}
                                  {!item.isDev && item.isBoardMember && item.isRenter && (
                                    <View style={[styles.residentGridRoleBadge, { backgroundColor: '#3b82f620' }]}>
                                      <Ionicons name="home" size={Platform.OS === 'web' ? 10 : 11} color="#3b82f6" />
                                      <Text style={[styles.residentGridRoleText, { color: '#3b82f6' }]} numberOfLines={1}>
                                        Renter
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              
                              {/* Email */}
                              <Text style={styles.residentGridEmail} numberOfLines={1}>
                                {item.email}
                              </Text>
                              
                              {/* Phone */}
                              {item.phone && (
                                <Text style={styles.residentGridEmail} numberOfLines={1}>
                                  {item.phone}
                                </Text>
                              )}
                              
                              {/* Address */}
                              {item.address && (
                                <Text style={styles.residentGridAddress} numberOfLines={1}>
                                  {item.address}{item.unitNumber && `, Unit ${item.unitNumber}`}
                                </Text>
                              )}
                              
                            </View>
                          </View>
                          
                          {/* Action Buttons */}
                          <View style={styles.residentGridActions}>
                            <View style={styles.residentGridActionsRow}>
                              {item.isBlocked ? (
                                <TouchableOpacity
                                  style={[styles.residentGridActionButton, styles.unblockButton]}
                                  onPress={() => handleUnblockResident(item)}
                                >
                                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                                  <Text style={styles.residentGridActionText}>Unblock</Text>
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity
                                  style={[styles.residentGridActionButton, styles.blockButton]}
                                  onPress={() => handleBlockResident(item)}
                                >
                                  <Ionicons name="ban" size={14} color="#ef4444" />
                                  <Text style={styles.residentGridActionText}>Block</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={[styles.residentGridActionButton, styles.removeButton]}
                                onPress={() => handleRemoveResident(item)}
                              >
                                <Ionicons name="trash" size={14} color="#dc2626" />
                                <Text style={[styles.residentGridActionText, { color: '#dc2626' }]}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </Animated.View>
                    </View>
                  );
                })}
              </View>
                )}
              </>
            )}
          </View>
        );
      
      case 'board':
        return (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Board Members</Text>
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: '#eab308' }]}
                  onPress={() => {
                    animateButtonPress();
                    handleAddBoardMember();
                  }}
                >
                  <Ionicons name="add" size={20} color="#ffffff" />
                  <Text style={styles.addButtonText}>Add Member</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
            {boardMembers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people" size={48} color="#9ca3af" />
                <Text style={styles.emptyStateText}>No board members found</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {boardMembers.map((item: any, index: number) => {
                  // Determine role icon and color
                  let roleIcon = 'person';
                  let roleColor = '#6b7280';
                  
                  if (item.position) {
                    if (item.position.toLowerCase().includes('president')) {
                      roleIcon = 'star';
                      roleColor = '#f59e0b';
                    } else if (item.position.toLowerCase().includes('vice')) {
                      roleIcon = 'star-half';
                      roleColor = '#8b5cf6';
                    } else if (item.position.toLowerCase().includes('treasurer')) {
                      roleIcon = 'wallet';
                      roleColor = '#10b981';
                    } else if (item.position.toLowerCase().includes('secretary')) {
                      roleIcon = 'document-text';
                      roleColor = '#3b82f6';
                    } else {
                      roleIcon = 'people';
                      roleColor = '#6b7280';
                    }
                  }

                  return (
                    <View key={item._id} style={{ width: '50%', padding: 8 }}>
                      <Animated.View 
                        style={[
                          styles.residentGridCard,
                          {
                            opacity: fadeAnim,
                            transform: [{
                              translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                              })
                            }]
                          }
                        ]}
                      >
                        <View style={styles.residentGridCardContent}>
                          {/* Main Info Row - Avatar Left, Details Right */}
                          <View style={styles.residentGridMainInfo}>
                            <ProfileImage 
                              source={item.image} 
                              size={40}
                              initials={item.name.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2)}
                              style={{ marginRight: 6 }}
                            />
                            
                            <View style={styles.residentGridDetails}>
                              {/* Name and Role Row */}
                              <View style={styles.residentGridNameRow}>
                                <Text style={styles.residentGridName} numberOfLines={1}>
                                  {item.name}
                                </Text>
                                <View style={[styles.residentGridRoleBadge, { backgroundColor: roleColor + '20' }]}>
                                  <Ionicons name={roleIcon as any} size={12} color={roleColor} />
                                  <Text style={[styles.residentGridRoleText, { color: roleColor }]} numberOfLines={1}>
                                    {item.position || 'Board Member'}
                                  </Text>
                                </View>
                              </View>
                              
                              {/* Email */}
                              <Text style={styles.residentGridEmail} numberOfLines={1}>
                                {item.email}
                              </Text>
                              
                              {/* Phone */}
                              {item.phone && (
                                <Text style={styles.residentGridAddress} numberOfLines={1}>
                                  {item.phone}
                                </Text>
                              )}
                              
                              {/* Term End */}
                              {item.termEnd && (
                                <Text style={styles.residentGridAddress} numberOfLines={1}>
                                  Term: {item.termEnd}
                                </Text>
                              )}
                            </View>
                          </View>
                          
                          {/* Action Buttons */}
                          <View style={styles.residentGridActions}>
                            <View style={styles.boardActionButtons}>
                              <TouchableOpacity
                                style={[styles.boardActionButton, styles.editButton]}
                                onPress={() => handleEditBoardMember(item)}
                              >
                                <Ionicons name="create" size={14} color="#2563eb" />
                                <Text style={styles.residentGridActionText}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.boardActionButton, styles.blockButton]}
                                onPress={() => handleDeleteItem(item, 'board')}
                              >
                                <Ionicons name="trash" size={14} color="#ef4444" />
                                <Text style={styles.residentGridActionText}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </Animated.View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      
      case 'covenants':
        return (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Covenants & Rules</Text>
              <View style={styles.covenantButtonsContainer}>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: '#2563eb' }]}
                    onPress={async () => {
                      try {
                        const result = await DocumentPicker.getDocumentAsync({
                          type: 'application/pdf',
                          copyToCacheDirectory: true,
                        });
                        
                        if (result.canceled) {
                          return;
                        }
                        
                        const file = result.assets[0];
                        if (!file) {
                          Alert.alert('Error', 'No file selected.');
                          return;
                        }
                        
                        // Generate upload URL
                        const uploadUrl = await generateUploadUrl();
                        
                        // Read file and upload
                        const fileResponse = await fetch(file.uri);
                        const blob = await fileResponse.blob();
                        
                        // Upload file to Convex storage
                        const uploadResponse = await fetch(uploadUrl, {
                          method: 'POST',
                          headers: { 'Content-Type': file.mimeType || 'application/pdf' },
                          body: blob,
                        });
                        
                        if (!uploadResponse.ok) {
                          throw new Error('Upload failed');
                        }
                        
                        const { storageId } = await uploadResponse.json();
                        
                        // Update CC&Rs PDF
                        await updateCcrsPdf({ ccrsPdfStorageId: storageId });
                        
                        Alert.alert('Success', 'CC&Rs PDF uploaded successfully!');
                      } catch (error: any) {
                        console.error('Error uploading CC&Rs PDF:', error);
                        Alert.alert('Error', error?.message || 'Failed to upload CC&Rs PDF. Please try again.');
                      }
                    }}
                  >
                    <Ionicons name="document-attach" size={20} color="#ffffff" />
                    <Text style={styles.addButtonText}>Upload CC&Rs</Text>
                  </TouchableOpacity>
                </Animated.View>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: '#22c55e' }]}
                    onPress={() => {
                      animateButtonPress();
                      setIsEditingCovenant(false);
                      setSelectedItem(null);
                      resetCovenantAttachmentState();
                      setCovenantForm({
                        title: '',
                        description: '',
                        category: 'General',
                        lastUpdated: new Date().toLocaleDateString('en-US'),
                        fileStorageId: '',
                      });
                      setShowCovenantModal(true);
                      animateIn('covenant');
                    }}
                  >
                    <Ionicons name="add" size={20} color="#ffffff" />
                    <Text style={styles.addButtonText}>Add Covenant</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
            {covenants.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text" size={48} color="#9ca3af" />
                <Text style={styles.emptyStateText}>No covenants found</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {covenants.map((item: any, index: number) => {
                  // Determine covenant icon and color based on category
                  let covenantIcon = 'document-text';
                  let covenantColor = '#6b7280';
                  
                  if (item.category === 'Architecture') {
                    covenantIcon = 'home';
                    covenantColor = '#8b5cf6';
                  } else if (item.category === 'Landscaping') {
                    covenantIcon = 'leaf';
                    covenantColor = '#10b981';
                  } else if (item.category === 'Minutes') {
                    covenantIcon = 'clipboard';
                    covenantColor = '#06b6d4';
                  } else if (item.category === 'Caveats') {
                    covenantIcon = 'warning';
                    covenantColor = '#f59e0b';
                  } else if (item.category === 'General') {
                    covenantIcon = 'document-text';
                    covenantColor = '#6b7280';
                  } else {
                    covenantIcon = 'document-text';
                    covenantColor = '#6b7280';
                  }

                  return (
                    <View key={item._id} style={{ width: '50%', padding: 8 }}>
                      <Animated.View 
                        style={[
                          styles.residentGridCard,
                          {
                            opacity: fadeAnim,
                            transform: [{
                              translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                              })
                            }]
                          }
                        ]}
                      >
                        <View style={styles.residentGridCardContent}>
                          {/* Main Info Row - Icon Left, Details Right */}
                          <View style={styles.residentGridMainInfo}>
                            <View style={styles.residentGridAvatar}>
                              <View style={[styles.postAvatarPlaceholder, { backgroundColor: covenantColor + '20' }]}>
                                <Ionicons name={covenantIcon as any} size={20} color={covenantColor} />
                              </View>
                            </View>
                            
                            <View style={styles.residentGridDetails}>
                              {/* Title and Category Row */}
                              <View style={styles.residentGridNameRow}>
                                <Text style={styles.residentGridName} numberOfLines={2}>
                                  {item.title}
                                </Text>
                                <View style={[styles.residentGridRoleBadge, { backgroundColor: covenantColor + '20' }]}>
                                  <Ionicons name={covenantIcon as any} size={12} color={covenantColor} />
                                  <Text style={[styles.residentGridRoleText, { color: covenantColor }]} numberOfLines={1}>
                                    {item.category}
                                  </Text>
                                </View>
                              </View>
                              
                              {/* Last Updated */}
                              {item.lastUpdated && (
                                <Text style={styles.residentGridEmail} numberOfLines={1}>
                                  Updated: {item.lastUpdated}
                                </Text>
                              )}
                              
                              {/* Description */}
                              <Text style={styles.residentGridAddress} numberOfLines={2}>
                                {item.description}
                              </Text>
                            </View>
                          </View>
                          
                          {/* Action Buttons */}
                          <View style={styles.residentGridActions}>
                            <View style={styles.boardActionButtons}>
                              <TouchableOpacity
                                style={[styles.boardActionButton, styles.editButton]}
                                onPress={() => handleEditCovenant(item)}
                              >
                                <Ionicons name="create" size={14} color="#2563eb" />
                                <Text style={styles.residentGridActionText}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.boardActionButton, styles.blockButton]}
                                onPress={() => handleDeleteItem(item, 'covenant')}
                              >
                                <Ionicons name="trash" size={14} color="#ef4444" />
                                <Text style={styles.residentGridActionText}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </Animated.View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      
      case 'Community':
        return (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Community Posts</Text>
            </View>
            
            {/* Posts Sub-tabs */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.communitySubTabsContainer}
              contentContainerStyle={styles.communitySubTabsContent}
            >
              <TouchableOpacity
                style={[styles.communitySubTab, postsSubTab === 'complaints' && styles.activeCommunitySubTab]}
                onPress={() => setPostsSubTab('complaints')}
              >
                <Ionicons name="warning" size={18} color={postsSubTab === 'complaints' ? '#3b82f6' : '#6b7280'} />
                <Text style={[styles.communitySubTabText, postsSubTab === 'complaints' && styles.activeCommunitySubTabText]}>
                  Complaints ({communityPosts.filter((p: any) => p.category === 'Complaint').length})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.communitySubTab, postsSubTab === 'posts' && styles.activeCommunitySubTab]}
                onPress={() => setPostsSubTab('posts')}
              >
                <Ionicons name="chatbubbles" size={18} color={postsSubTab === 'posts' ? '#3b82f6' : '#6b7280'} />
                <Text style={[styles.communitySubTabText, postsSubTab === 'posts' && styles.activeCommunitySubTabText]}>
                  Posts ({communityPosts.filter((p: any) => p.category !== 'Complaint').length})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.communitySubTab, postsSubTab === 'comments' && styles.activeCommunitySubTab]}
                onPress={() => setPostsSubTab('comments')}
              >
                <Ionicons name="chatbox" size={18} color={postsSubTab === 'comments' ? '#3b82f6' : '#6b7280'} />
                <Text style={[styles.communitySubTabText, postsSubTab === 'comments' && styles.activeCommunitySubTabText]}>
                  Comments ({comments.length})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.communitySubTab, postsSubTab === 'polls' && styles.activeCommunitySubTab]}
                onPress={() => setPostsSubTab('polls')}
              >
                <Ionicons name="bar-chart" size={18} color={postsSubTab === 'polls' ? '#3b82f6' : '#6b7280'} />
                <Text style={[styles.communitySubTabText, postsSubTab === 'polls' && styles.activeCommunitySubTabText]}>
                  Polls ({polls.length})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.communitySubTab, postsSubTab === 'pets' && styles.activeCommunitySubTab]}
                onPress={() => setPostsSubTab('pets')}
              >
                <Ionicons name="paw" size={18} color={postsSubTab === 'pets' ? '#3b82f6' : '#6b7280'} />
                <Text style={[styles.communitySubTabText, postsSubTab === 'pets' && styles.activeCommunitySubTabText]}>
                  Pets ({totalPetsCount})
                </Text>
              </TouchableOpacity>
            </ScrollView>
            
            {postsSubTab === 'posts' && (
              (() => {
                const filteredPosts = communityPosts.filter((p: any) => p.category !== 'Complaint');
                return filteredPosts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="document-text" size={48} color="#9ca3af" />
                    <Text style={styles.emptyStateText}>No posts found</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {filteredPosts.map((item: any) => (
                      <View key={item._id} style={{ width: '50%', padding: 8 }}>
                        <Animated.View 
                          style={[
                            styles.residentGridCard,
                            {
                              opacity: fadeAnim,
                              transform: [{
                                translateY: fadeAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [50, 0],
                                })
                              }]
                            }
                          ]}
                        >
                          <View style={styles.residentGridCardContent}>
                            {/* Main Info Row - Icon Left, Details Right */}
                            <View style={styles.residentGridMainInfo}>
                              <ProfileImage 
                                source={item.authorProfileImage} 
                                size={48}
                                style={{ marginRight: 12 }}
                              />
                              
                              <View style={styles.residentGridDetails}>
                                {/* Title */}
                                <Text style={styles.postTitleText}>
                                  {item.title}
                                </Text>
                                
                                {/* Date */}
                                <Text style={styles.postDateText}>
                                  {formatDate(item.createdAt)}
                                </Text>
                                
                                {/* Author */}
                                <Text style={styles.residentGridEmail} numberOfLines={1}>
                                  By: {item.author}
                                </Text>
                                
                                {/* Content */}
                                <Text style={styles.postContentText}>
                                  {item.content}
                                </Text>
                              </View>
                            </View>
                            
                            {/* Action Button */}
                            <View style={styles.residentGridActions}>
                              <TouchableOpacity
                                style={[styles.residentGridActionButton, styles.blockButton]}
                                onPress={() => handleDeleteItem(item, 'post')}
                              >
                                <Ionicons name="trash" size={16} color="#ef4444" />
                                <Text style={styles.residentGridActionText}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </Animated.View>
                      </View>
                    ))}
                  </View>
                );
              })()
            )}
            
            {postsSubTab === 'comments' && (
              comments.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubble" size={48} color="#9ca3af" />
                  <Text style={styles.emptyStateText}>No comments found</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {comments.map((item: any) => (
                    <View key={item._id} style={{ width: '50%', padding: 8 }}>
                      <Animated.View 
                        style={[
                          styles.residentGridCard,
                          {
                            opacity: fadeAnim,
                            transform: [{
                              translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                              })
                            }]
                          }
                        ]}
                      >
                        <View style={styles.residentGridCardContent}>
                          {/* Main Info Row - Icon Left, Details Right */}
                          <View style={styles.residentGridMainInfo}>
                            <ProfileImage 
                              source={item.authorProfileImage} 
                              size={48}
                              style={{ marginRight: 12 }}
                            />
                            
                            <View style={styles.residentGridDetails}>
                              {/* Post Title */}
                              <Text style={styles.postTitleText}>
                                {item.postTitle}
                              </Text>
                              
                              {/* Date */}
                              <Text style={styles.postDateText}>
                                {formatDate(item.createdAt)}
                              </Text>
                              
                              {/* Author */}
                              <Text style={styles.residentGridEmail} numberOfLines={1}>
                                By: {item.author}
                              </Text>
                              
                              {/* Comment Content */}
                              <Text style={styles.postContentText}>
                                {item.content}
                              </Text>
                            </View>
                          </View>
                          
                          {/* Action Button */}
                          <View style={styles.residentGridActions}>
                            <TouchableOpacity
                              style={[styles.residentGridActionButton, styles.blockButton]}
                              onPress={() => handleDeleteItem(item, 'comment')}
                            >
                              <Ionicons name="trash" size={16} color="#ef4444" />
                              <Text style={styles.residentGridActionText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </Animated.View>
                    </View>
                  ))}
                </View>
              )
            )}
            
            {postsSubTab === 'polls' && (
              <>
                <View style={styles.sectionHeader} pointerEvents="box-none">
                  <Text style={styles.sectionTitle}>Community Polls</Text>
                  <Animated.View style={{ transform: [{ scale: buttonScale }] }} pointerEvents="box-none">
                    <Pressable
                      style={({ pressed }) => [
                        styles.adminFeeButton,
                        styles.createPollButton,
                        { backgroundColor: '#3b82f6' },
                        pressed && styles.adminFeeButtonPressed
                      ]}
                      onPress={() => {
                        animateButtonPress();
                        setShowPollModal(true);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="add" size={16} color="#ffffff" />
                      <Text style={[styles.adminFeeButtonText, styles.createPollButtonText]}>Create Poll</Text>
                    </Pressable>
                  </Animated.View>
                </View>
                
                {/* Polls List */}
                {polls.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="bar-chart-outline" size={48} color="#9ca3af" />
                    <Text style={styles.emptyStateText}>No polls found</Text>
                    <Text style={styles.emptyStateSubtext}>Create your first community poll!</Text>
                  </View>
                ) : (
                  polls.map((poll: any, index: number) => (
                    <Animated.View 
                      key={poll._id} 
                      style={[
                        styles.postCard,
                        {
                          opacity: fadeAnim,
                          transform: [{
                            translateY: fadeAnim.interpolate({
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
                              <Text style={styles.authorName}>{poll.title}</Text>
                              <Text style={styles.postTime}>
                                {new Date(poll.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.categoryBadge}>
                            <Ionicons 
                              name={poll.isActive ? "checkmark-circle" : "close-circle"} 
                              size={12} 
                              color={poll.isActive ? "#10b981" : "#ef4444"} 
                            />
                            <Text style={[styles.categoryText, { color: poll.isActive ? "#10b981" : "#ef4444" }]}>
                              {poll.isActive ? "Active" : "Inactive"}
                            </Text>
                          </View>
                        </View>
                        
                        {poll.description && (
                          <Text style={styles.postContent}>{poll.description}</Text>
                        )}
                        
                        {/* Poll Options */}
                        <View style={styles.pollOptionsContainer}>
                          {poll.options.map((option: string, index: number) => {
                            const isWinningOption = !poll.isActive && poll.winningOption && poll.winningOption.tiedIndices?.includes(index);
                            const isTied = isWinningOption && poll.winningOption?.isTied;
                            return (
                              <View key={index} style={[
                                styles.pollOption,
                                isWinningOption && styles.pollWinningOption
                              ]}>
                                <View style={styles.pollOptionContent}>
                                  <Text style={[
                                    styles.pollOptionText,
                                    isWinningOption && styles.pollWinningOptionText
                                  ]}>
                                    {option}
                                  </Text>
                                  <Text style={[
                                    styles.pollVoteCount,
                                    isWinningOption && styles.pollWinningVoteCount
                                  ]}>
                                    {poll.optionVotes?.[index] || 0} votes
                                    {isWinningOption && ` (${poll.winningOption.percentage.toFixed(1)}%)`}
                                  </Text>
                                </View>
                                {isWinningOption && (
                                  <View style={styles.winningBadge}>
                                    <Ionicons name="trophy" size={16} color="#ffffff" />
                                    <Text style={styles.winningBadgeText}>
                                      {isTied ? 'Tied' : 'Most Voted'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                        
                        <View style={styles.postFooter}>
                          <View style={styles.boardActionButtons}>
                            <TouchableOpacity
                              style={[styles.boardActionButton, styles.editButton]}
                              onPress={() => handleEditPoll(poll)}
                            >
                              <Ionicons name="create" size={16} color="#2563eb" />
                              <Text style={styles.residentGridActionText}>Edit</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                              style={[styles.boardActionButton, poll.isActive ? styles.deactivateButton : styles.activateButton]}
                              onPress={() => handleTogglePollActive(poll)}
                            >
                              <Ionicons 
                                name={poll.isActive ? "pause-circle" : "play-circle"} 
                                size={16} 
                                color={poll.isActive ? "#f59e0b" : "#10b981"} 
                              />
                              <Text style={[styles.residentGridActionText, { color: poll.isActive ? "#f59e0b" : "#10b981" }]}>
                                {poll.isActive ? "Deactivate" : "Activate"}
                              </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={[styles.boardActionButton, styles.blockButton]}
                              onPress={() => handleDeletePoll(poll)}
                            >
                              <Ionicons name="trash" size={16} color="#ef4444" />
                              <Text style={styles.residentGridActionText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </Animated.View>
                    ))
                  )}
              </>
            )}
            
            {postsSubTab === 'pets' && (
              petsGrouped.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="paw-outline" size={48} color="#9ca3af" />
                  <Text style={styles.emptyStateText}>No pet registrations found</Text>
                </View>
              ) : (
                <View style={[styles.petsGridContainer, (isMobileDevice || screenWidth < 640) && styles.petsGridContainerSingleColumn]}>
                  {petsGrouped.map((group: any) => (
                    <View key={group.residentId} style={[
                      styles.petCardWrapper,
                      Platform.OS === 'web' && screenWidth >= 1024 && !(isMobileDevice || screenWidth < 640) && styles.petCardWrapperDesktop,
                      (isMobileDevice || screenWidth < 640) && styles.petCardWrapperSingleColumn
                    ]}>
                      <Animated.View 
                        style={[
                          styles.petGridCard,
                          {
                            opacity: fadeAnim,
                            transform: [{
                              translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                              })
                            }]
                          }
                        ]}
                      >
                        <View style={styles.petGridCardContent}>
                          {/* Owner & Address - Top */}
                          <View style={styles.petCardTextContent}>
                            <Text style={styles.petCardOwner} numberOfLines={1}>
                              Owner: {group.residentName || 'Unknown'}
                            </Text>
                            <Text style={styles.petCardAddress} numberOfLines={2}>
                              {group.residentAddress || ''}
                            </Text>
                          </View>
                          {/* Pets in group - images and names with delete */}
                          <View style={styles.adminPetsInGroupContainer}>
                            {group.pets.map((pet: any) => (
                              <View key={pet._id} style={styles.adminPetInGroupItem}>
                                <View style={[styles.petCardImageContainer, styles.adminPetThumbnail]}>
                                  <View style={[styles.petImageAvatar, styles.adminPetAvatarSmall]}>
                                    <PetImage storageId={pet.image} />
                                  </View>
                                </View>
                                <View style={styles.adminPetInfoRow}>
                                  <Text style={styles.petCardName} numberOfLines={1}>{pet.name}</Text>
                                  <Text style={styles.petCardDate} numberOfLines={1}>{formatDate(pet.createdAt)}</Text>
                                </View>
                                <TouchableOpacity
                                  style={[styles.petCardActionButton, styles.blockButton]}
                                  onPress={() => handleDeleteItem(pet, 'pet')}
                                >
                                  <Ionicons name="trash" size={18} color="#ef4444" />
                                  <Text style={styles.petCardActionText}>Delete</Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        </View>
                      </Animated.View>
                    </View>
                  ))}
                </View>
              )
            )}
            
            {postsSubTab === 'complaints' && (
              (() => {
                const filteredComplaints = communityPosts.filter((p: any) => p.category === 'Complaint');
                return filteredComplaints.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="warning-outline" size={48} color="#9ca3af" />
                    <Text style={styles.emptyStateText}>No complaints found</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {filteredComplaints.map((item: any) => (
                      <View key={item._id} style={{ width: '50%', padding: 8 }}>
                        <Animated.View 
                          style={[
                            styles.residentGridCard,
                            {
                              opacity: fadeAnim,
                              transform: [{
                                translateY: fadeAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [50, 0],
                                })
                              }]
                            }
                          ]}
                        >
                          <View style={styles.residentGridCardContent}>
                            {/* Main Info Row - Icon Left, Details Right */}
                            <View style={styles.residentGridMainInfo}>
                              <ProfileImage 
                                source={item.authorProfileImage} 
                                size={48}
                                style={{ marginRight: 12 }}
                              />
                              
                              <View style={styles.residentGridDetails}>
                                {/* Title */}
                                <Text style={styles.postTitleText}>
                                  {item.title}
                                </Text>
                                
                                {/* Date */}
                                <Text style={styles.postDateText}>
                                  {formatDate(item.createdAt)}
                                </Text>
                                
                                {/* Author */}
                                <Text style={styles.residentGridEmail} numberOfLines={1}>
                                  By: {item.author}
                                </Text>
                                
                                {/* Content */}
                                <Text style={styles.postContentText}>
                                  {item.content}
                                </Text>
                              </View>
                            </View>
                            
                            {/* Action Button */}
                            <View style={styles.residentGridActions}>
                              <TouchableOpacity
                                style={[styles.residentGridActionButton, styles.blockButton]}
                                onPress={() => handleDeleteItem(item, 'post')}
                              >
                                <Ionicons name="trash" size={16} color="#ef4444" />
                                <Text style={styles.residentGridActionText}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </Animated.View>
                      </View>
                    ))}
                  </View>
                );
              })()
            )}
          </View>
        );
      
      case 'fees':
        return (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Fees Management</Text>
            </View>
            
            <View style={[styles.feesSubTabContent, Platform.OS !== 'web' && styles.feesSubTabContentMobile]}>
              <View style={[styles.adminFeeButtonsContainer, { gap: duesButtonLayout.gap }]}>
                <Animated.View style={[{ transform: [{ scale: buttonScale }] }, duesButtonWrapperStyle] as any}>
                  <TouchableOpacity
                    style={[styles.adminFeeButton, { paddingHorizontal: duesButtonLayout.paddingH, paddingVertical: duesButtonLayout.paddingV }]}
                    onPress={() => {
                      animateButtonPress();
                      setShowYearFeeModal(true);
                      animateIn('yearFee');
                    }}
                  >
                    <Ionicons name="calendar" size={16} color="#ffffff" />
                    <Text style={[styles.adminFeeButtonText, { fontSize: duesButtonLayout.fontSize }]}>Add Year Fees</Text>
                  </TouchableOpacity>
                </Animated.View>
                <Animated.View style={[{ transform: [{ scale: buttonScale }] }, duesButtonWrapperStyle] as any}>
                  <TouchableOpacity
                    style={[styles.adminFeeButton, styles.addFineButton, { paddingHorizontal: duesButtonLayout.paddingH, paddingVertical: duesButtonLayout.paddingV }]}
                    onPress={() => {
                      animateButtonPress();
                      setShowAddFineModal(true);
                      animateIn('addFine');
                    }}
                  >
                    <Ionicons name="warning" size={16} color="#ffffff" />
                    <Text style={[styles.adminFeeButtonText, { fontSize: duesButtonLayout.fontSize }]}>Add Fine</Text>
                  </TouchableOpacity>
                </Animated.View>
                <Animated.View style={[{ transform: [{ scale: buttonScale }] }, duesButtonWrapperStyle] as any}>
                  <TouchableOpacity
                    style={[styles.adminFeeButton, { backgroundColor: '#059669', paddingHorizontal: duesButtonLayout.paddingH, paddingVertical: duesButtonLayout.paddingV }]}
                    onPress={() => {
                      animateButtonPress();
                      setShowRecordPaymentModal(true);
                      animateIn('recordPayment');
                    }}
                  >
                    <Ionicons name="cash" size={16} color="#ffffff" />
                    <Text style={[styles.adminFeeButtonText, { fontSize: duesButtonLayout.fontSize }]}>Record Payment</Text>
                  </TouchableOpacity>
                </Animated.View>
                <Animated.View style={[{ transform: [{ scale: buttonScale }] }, duesButtonWrapperStyle] as any}>
                  <TouchableOpacity
                    style={[styles.adminFeeButton, { backgroundColor: '#3b82f6', paddingHorizontal: duesButtonLayout.paddingH, paddingVertical: duesButtonLayout.paddingV }]}
                    onPress={() => {
                      animateButtonPress();
                      setTransactionsLimit(50);
                      setShowTransactionsModal(true);
                      animateIn('transactions');
                    }}
                  >
                    <Ionicons name="receipt-outline" size={16} color="#ffffff" />
                    <Text style={[styles.adminFeeButtonText, { fontSize: duesButtonLayout.fontSize }]}>View Transactions</Text>
                  </TouchableOpacity>
                </Animated.View>
                {unpaidAnnualFees.length > 0 && (
                  <Animated.View style={[{ transform: [{ scale: buttonScale }] }, duesButtonWrapperStyle] as any}>
                    <TouchableOpacity
                      style={[styles.adminFeeButton, { backgroundColor: '#8b5cf6', paddingHorizontal: duesButtonLayout.paddingH, paddingVertical: duesButtonLayout.paddingV }]}
                      onPress={() => {
                        animateButtonPress();
                        const currentYear = new Date().getFullYear();
                        const currentAmount = unpaidAnnualFees[0]?.amount || 0;
                        setUpdateDuesForm({
                          selectedFeeId: '',
                          newAmount: currentAmount.toString(),
                        });
                        setShowUpdateDuesModal(true);
                        animateIn('updateDues');
                      }}
                    >
                      <Ionicons name="create-outline" size={16} color="#ffffff" />
                      <Text style={[styles.adminFeeButtonText, { fontSize: duesButtonLayout.fontSize }]}>Update All Dues</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}
                <Animated.View style={[{ transform: [{ scale: buttonScale }] }, duesButtonWrapperStyle] as any}>
                  <TouchableOpacity
                    style={[styles.adminFeeButton, { backgroundColor: '#f59e0b', paddingHorizontal: duesButtonLayout.paddingH, paddingVertical: duesButtonLayout.paddingV }]}
                    onPress={() => {
                      animateButtonPress();
                      setShowPastDueModal(true);
                      animateIn('pastDue');
                    }}
                  >
                    <Ionicons name="add-circle" size={16} color="#ffffff" />
                    <Text style={[styles.adminFeeButtonText, { fontSize: duesButtonLayout.fontSize }]}>Add Past Due</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            
               {/* Fee Statistics */}
               <View style={styles.feeStatsContainer}>
                 <View style={styles.feeStatsSection}>
                   {/* Fees Row */}
                   <View style={styles.feeStatsRow}>
                     <View style={styles.feeStatCard}>
                       <Text style={styles.feeStatLabel}>Total Fees</Text>
                       <Text style={styles.feeStatValue}>{feeStats.total}</Text>
                     </View>
                     <View style={styles.feeStatCard}>
                       <Text style={styles.feeStatLabel}>Paid Fees</Text>
                       <Text style={[styles.feeStatValue, { color: '#10b981' }]}>
                         {feeStats.paid}
                       </Text>
                     </View>
                     <View style={styles.feeStatCard}>
                       <Text style={styles.feeStatLabel}>Unpaid Fees</Text>
                       <Text style={[styles.feeStatValue, { color: '#f59e0b' }]}>
                         {feeStats.unpaid}
                       </Text>
                     </View>
                   </View>

                   {/* Fines Row */}
                   <View style={styles.feeStatsRow}>
                     <View style={styles.feeStatCard}>
                       <Text style={styles.feeStatLabel}>Total Fines</Text>
                       <Text style={styles.feeStatValue}>{fineStats.total}</Text>
                     </View>
                     <View style={styles.feeStatCard}>
                       <Text style={styles.feeStatLabel}>Paid Fines</Text>
                       <Text style={[styles.feeStatValue, { color: '#10b981' }]}>
                         {fineStats.paid}
                       </Text>
                     </View>
                     <View style={styles.feeStatCard}>
                       <Text style={styles.feeStatLabel}>Unpaid Fines</Text>
                       <Text style={[styles.feeStatValue, { color: '#dc2626' }]}>
                         {fineStats.unpaid}
                       </Text>
                     </View>
                   </View>
                 </View>
               </View>

            {/* Pending Venmo Payments Section */}
            {pendingVenmoPayments.length > 0 && (
              <View style={styles.pendingPaymentsSection}>
                <View style={styles.pendingPaymentsHeader}>
                  <View style={styles.pendingPaymentsHeaderLeft}>
                    <Ionicons name="cash" size={20} color="#f59e0b" />
                    <Text style={styles.pendingPaymentsTitle}>
                      Pending Venmo Payments ({filteredPendingPayments.length})
                    </Text>
                  </View>
                </View>
                
                {/* Search Input */}
                <View style={styles.paymentSearchContainer}>
                  <Ionicons name="search" size={20} color="#6b7280" style={styles.paymentSearchIcon} />
                  <TextInput
                    style={styles.paymentSearchInput}
                    placeholder="Search by name, address, fee type, transaction ID..."
                    value={paymentSearchQuery}
                    onChangeText={setPaymentSearchQuery}
                    placeholderTextColor="#9ca3af"
                  />
                  {paymentSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setPaymentSearchQuery('')}
                      style={styles.paymentSearchClear}
                    >
                      <Ionicons name="close-circle" size={20} color="#6b7280" />
                    </TouchableOpacity>
                  )}
                </View>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {filteredPendingPayments.map((payment: any) => {
                    const resident = residentsMap.get(payment.userId);
                    const paymentDate = new Date(payment.createdAt).toLocaleDateString();
                    
                    return (
                      <View key={payment._id} style={styles.compactPaymentCard}>
                        <View style={styles.compactPaymentHeader}>
                          <Text style={styles.compactPaymentName}>
                            {resident ? `${resident.firstName} ${resident.lastName}` : 'Unknown'}
                          </Text>
                          <Text style={styles.compactPaymentAmount}>
                            ${payment.amount.toFixed(2)}
                          </Text>
                        </View>
                        <Text style={styles.compactPaymentFee}>{payment.feeType}</Text>
                        {resident && (
                          <Text style={styles.compactPaymentAddress} numberOfLines={1}>
                            {resident.address}{resident.unitNumber ? ` #${resident.unitNumber}` : ''}
                          </Text>
                        )}
                        <Text style={styles.compactPaymentVenmo}>
                          @{payment.venmoUsername}
                        </Text>
                        <Text style={styles.compactPaymentDate}>
                          {paymentDate}
                        </Text>
                        {(payment.transactionId || payment.venmoTransactionId) && (
                          <Text style={styles.compactPaymentTransactionId} numberOfLines={2}>
                            ID: {payment.transactionId || payment.venmoTransactionId}
                          </Text>
                        )}
                        
                        {/* Receipt Image Button */}
                        {payment.receiptImage && (
                          <TouchableOpacity
                            style={styles.viewReceiptButton}
                            onPress={() => {
                              setSelectedReceiptImage(payment.receiptImage);
                              setShowReceiptViewer(true);
                            }}
                          >
                            <Ionicons name="image-outline" size={14} color="#2563eb" />
                            <Text style={styles.viewReceiptText}>View Receipt</Text>
                          </TouchableOpacity>
                        )}
                        
                        <View style={styles.compactPaymentActions}>
                          <TouchableOpacity
                            style={styles.compactRejectButton}
                            onPress={() => {
                              setSelectedPaymentForVerification(payment);
                              setVerificationNotes('');
                              setAdjustedPaymentAmount(payment.amount.toString());
                              setShowVerificationModal(true);
                            }}
                          >
                            <Ionicons name="close-circle" size={14} color="#ef4444" />
                            <Text style={styles.compactButtonText}>Reject</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.compactVerifyButton}
                            onPress={() => {
                              setSelectedPaymentForVerification(payment);
                              setVerificationNotes('');
                              setAdjustedPaymentAmount(payment.amount.toString());
                              setShowVerificationModal(true);
                            }}
                          >
                            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                            <Text style={styles.compactButtonText}>Verify</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            
            {/* Fees and Fines Status Grid */}
            <View style={isMobileDevice || screenWidth < 768 ? styles.feesGridContainerMobile : {}}>
              {sortedHomeownersGroupedByAddress.length > 0 && (
                <View style={styles.feesGridSortRow}>
                  <Text style={styles.feesGridSortLabel}>Sort:</Text>
                  <TouchableOpacity
                    style={[styles.feesGridSortOption, feesGridSortOrder === 'alphabet' && styles.feesGridSortOptionActive]}
                    onPress={() => setFeesGridSortOrder('alphabet')}
                  >
                    <Ionicons name="reorder-three" size={16} color={feesGridSortOrder === 'alphabet' ? '#ffffff' : '#6b7280'} />
                    <Text style={[styles.feesGridSortOptionText, feesGridSortOrder === 'alphabet' && styles.feesGridSortOptionTextActive]}>Alphabet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.feesGridSortOption, feesGridSortOrder === 'paid' && styles.feesGridSortOptionActive]}
                    onPress={() => setFeesGridSortOrder('paid')}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={feesGridSortOrder === 'paid' ? '#ffffff' : '#10b981'} />
                    <Text style={[styles.feesGridSortOptionText, feesGridSortOrder === 'paid' && styles.feesGridSortOptionTextActive]}>Paid</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.feesGridSortOption, feesGridSortOrder === 'pending' && styles.feesGridSortOptionActive]}
                    onPress={() => setFeesGridSortOrder('pending')}
                  >
                    <Ionicons name="time" size={16} color={feesGridSortOrder === 'pending' ? '#ffffff' : '#f59e0b'} />
                    <Text style={[styles.feesGridSortOptionText, feesGridSortOrder === 'pending' && styles.feesGridSortOptionTextActive]}>Pending</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.feesGridSortOption, feesGridSortOrder === 'clear' && styles.feesGridSortOptionActive]}
                    onPress={() => setFeesGridSortOrder('clear')}
                  >
                    <Ionicons name="card" size={16} color={feesGridSortOrder === 'clear' ? '#ffffff' : '#6b7280'} />
                    <Text style={[styles.feesGridSortOptionText, feesGridSortOrder === 'clear' && styles.feesGridSortOptionTextActive]}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}
              {sortedHomeownersGroupedByAddress.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="card" size={48} color="#9ca3af" />
                  <Text style={styles.emptyStateText}>No homeowners found</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Homeowners will appear here once they are registered in the system
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {sortedHomeownersGroupedByAddress.map((addressGroup: any) => {
                    const {
                      homeowners,
                      fees: homeownerFees,
                      fines: homeownerFines,
                      payments: homeownerPayments,
                      latestPayment,
                      allFeesPaid,
                      totalFeeAmount,
                      totalPaidAmount,
                      isPartiallyPaid,
                      outstandingBalance,
                      totalAssessed,
                    } = addressGroup;
                    const paymentMethod = latestPayment?.paymentMethod;
                    // Responsive breakpoints: sm (< 640px), md (640-1023px), lg (1024-1279px), xl (>= 1280px)
                    const isSingleColumn = isMobileDevice || screenWidth < 640;
                    const numColumns = isSingleColumn 
                      ? 1 
                      : screenWidth >= 1280 
                        ? 4  // xl: 4 columns
                        : screenWidth >= 1024 
                          ? 3  // lg: 3 columns
                          : 2; // md: 2 columns
                    const itemWidth = isSingleColumn ? ('100%' as const) : (`${100 / numColumns}%` as const);
                    
                    // Create display name for multiple residents
                    // Format: "John & Jane" for 2, "John, Jane & Bob" for 3+, or one per line
                    const residentsDisplay = homeowners.length === 1
                      ? `${homeowners[0].firstName} ${homeowners[0].lastName}`
                      : homeowners.length === 2
                      ? homeowners.map((h: any) => `${h.firstName} ${h.lastName}`).join(' & ')
                      : homeowners.map((h: any, idx: number) => {
                          if (idx === homeowners.length - 1) {
                            return `& ${h.firstName} ${h.lastName}`;
                          }
                          return `${h.firstName} ${h.lastName}`;
                        }).join(', ');
                    
                    // Get profile images for display (limit to 2 to keep costs low)
                    // Note: profileImage is a storage ID, ProfileImage component handles resolution
                    const profileImagesToShow = homeowners.slice(0, 2).map((h: any) => ({
                      imageUrl: h.profileImage, // Use profileImage (storage ID) directly
                      initials: `${h.firstName.charAt(0)}${h.lastName.charAt(0)}`
                    }));
                    
                    return (
                      <Pressable
                      key={addressGroup.addressKey}
                      style={({ pressed }) => ({
                        width: itemWidth as any,
                        padding: isSingleColumn ? 0 : 8,
                        minWidth: 0,
                        opacity: pressed ? 0.86 : 1,
                        transform: [{ scale: pressed ? 0.972 : 1 }],
                      })}
                      onPress={() => {
                        setSelectedHomeownerGroup(addressGroup);
                        setShowHomeownerRecordsModal(true);
                      }}
                      android_ripple={{
                        color: 'rgba(37, 99, 235, 0.07)',
                        borderless: false,
                      }}
                    
                      >
                    <Animated.View 
                      style={[
                        styles.gridCard,
                        isSingleColumn && {
                          marginHorizontal: 16,
                          marginVertical: 12,
                          borderRadius: 12,
                          borderTopWidth: 0,
                          borderBottomWidth: 0,
                          borderWidth: 1,
                          borderColor: '#e5e7eb',
                          maxWidth: '100%',
                          alignSelf: 'center',
                          width: screenWidth < 400 ? screenWidth - 32 : Math.min(screenWidth - 40, 600),
                        },
                        !isSingleColumn && {
                          width: '100%', // Fill the container on desktop
                        },
                        {
                          opacity: fadeAnim,
                          transform: [{
                            translateY: fadeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [50, 0],
                            })
                          }]
                        }
                      ]}
                    >
                      <View style={[
                        styles.gridCardContent,
                        isSingleColumn && {
                          padding: 16,
                        }
                      ]}>
                        <View style={[
                          styles.gridProfileSection,
                          isSingleColumn && {
                            marginBottom: 16,
                          }
                        ]}>
                          {/* Multiple profile images for households with 2+ residents */}
                          {homeowners.length > 1 ? (
                            <View style={styles.multipleProfileImagesContainer}>
                              {profileImagesToShow.map((profile: any, index: number) => (
                                <ProfileImage
                                  key={index}
                                  source={profile.imageUrl}
                                  size={48}
                                  initials={profile.initials}
                                  style={[
                                    styles.multipleProfileImage,
                                    index > 0 && styles.multipleProfileImageOverlap
                                  ]}
                                />
                              ))}
                            </View>
                          ) : (
                            <ProfileImage 
                              source={profileImagesToShow[0]?.imageUrl} 
                              size={56}
                              initials={profileImagesToShow[0]?.initials}
                              style={{ marginRight: 8 }}
                            />
                          )}
                          <View style={styles.gridProfileInfo}>
                            <Text style={[
                              styles.gridName,
                              isSingleColumn && {
                                fontSize: 16,
                                marginBottom: 4,
                              },
                              homeowners.length > 2 && {
                                fontSize: isSingleColumn ? 14 : 13,
                                lineHeight: isSingleColumn ? 20 : 18,
                              }
                            ]} numberOfLines={homeowners.length === 1 ? 1 : homeowners.length === 2 ? 2 : 4}>
                              {residentsDisplay}
                            </Text>
                            <Text style={[
                              styles.gridRole,
                              isSingleColumn && {
                                fontSize: 13,
                                marginBottom: 4,
                              }
                            ]} numberOfLines={1}>
                              {homeowners.length === 1 
                                ? (homeowners[0].userType === 'board-member' ? 'Board Member' : 'Homeowner')
                                : `${homeowners.length} Residents`}
                            </Text>
                            <Text style={[
                              styles.gridAddress,
                              isSingleColumn && {
                                fontSize: 12,
                              }
                            ]} numberOfLines={2}>
                              {addressGroup.address} {addressGroup.unitNumber && `Unit ${addressGroup.unitNumber}`}
                            </Text>
                          </View>
                        </View>
                        
                        {/* Outstanding balance (fees + fines, vs verified payments) */}
                        {homeownerFees.length > 0 || homeownerFines.length > 0 ? (
                          <View style={[
                            styles.gridFeeSection,
                            isSingleColumn && {
                              paddingTop: 12,
                              marginTop: 12,
                            }
                          ]}>
                            <Text style={[
                              styles.gridFeeAmount,
                              isSingleColumn && {
                                fontSize: 20,
                                marginBottom: 4,
                              }
                            ]}>
                              ${outstandingBalance.toFixed(2)}
                            </Text>
                            <Text style={[
                              styles.gridFeeLabel,
                              isSingleColumn && {
                                fontSize: 12,
                                marginBottom: 8,
                              }
                            ]}>
                              {homeownerFees.length > 0 && homeownerFines.length > 0
                                ? `Fees (${homeownerFees.length}) & fines (${homeownerFines.length})`
                                : homeownerFees.length > 0
                                  ? homeownerFees.length === 1
                                    ? 'Fee'
                                    : `Fees (${homeownerFees.length})`
                                  : `Fines (${homeownerFines.length})`}
                            </Text>
                            {isPartiallyPaid && (
                              <Text style={[
                                styles.gridPartialPaymentText,
                                isSingleColumn && {
                                  fontSize: 11,
                                  marginBottom: 4,
                                }
                              ]}>
                                Verified: ${totalPaidAmount.toFixed(2)} of ${totalAssessed.toFixed(2)} assessed
                              </Text>
                            )}
                            <View style={[
                              styles.gridStatusBadge,
                              allFeesPaid
                                ? styles.gridPaidBadge 
                                : isPartiallyPaid
                                ? styles.gridPartialPaidBadge
                                : styles.gridPendingBadge,
                              isSingleColumn && {
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                              }
                            ]}>
                              <Ionicons 
                                name={allFeesPaid ? "checkmark-circle" : isPartiallyPaid ? "hourglass" : "time"} 
                                size={isSingleColumn ? 16 : 14} 
                                color={allFeesPaid ? "#10b981" : isPartiallyPaid ? "#f59e0b" : "#f59e0b"} 
                              />
                              <Text style={[
                                styles.gridStatusText,
                                { 
                                  color: allFeesPaid ? "#10b981" : isPartiallyPaid ? "#f59e0b" : "#f59e0b" 
                                },
                                isSingleColumn && {
                                  fontSize: 12,
                                }
                              ]}>
                                {allFeesPaid ? 'Paid' : isPartiallyPaid ? 'Partially Paid' : 'Pending'}
                              </Text>
                            </View>
                            
                            {/* Show payment method if paid or partially paid */}
                            {(allFeesPaid || isPartiallyPaid) && paymentMethod && (
                              <View style={[
                                styles.paymentMethodBadge,
                                isSingleColumn && { marginTop: 6 }
                              ]}>
                                <Ionicons 
                                  name={paymentMethod === 'Venmo' ? 'logo-venmo' : paymentMethod === 'Check' ? 'document-text' : 'cash'} 
                                  size={isSingleColumn ? 12 : 10} 
                                  color="#6b7280" 
                                />
                                <Text style={styles.paymentMethodBadgeText}>
                                  via {paymentMethod}
                                </Text>
                              </View>
                            )}

                          </View>
                        ) : (
                          <View style={[
                            styles.gridFeeSection,
                            isSingleColumn && {
                              paddingTop: 12,
                              marginTop: 12,
                            }
                          ]}>
                            <Text style={[
                              styles.gridFeeAmount,
                              isSingleColumn && {
                                fontSize: 20,
                                marginBottom: 4,
                              }
                            ]}>$0</Text>
                            <Text style={[
                              styles.gridFeeLabel,
                              isSingleColumn && {
                                fontSize: 12,
                                marginBottom: 8,
                              }
                            ]}>No Fees</Text>
                            <View style={[
                              styles.gridStatusBadge, 
                              styles.gridNoFeeBadge,
                              isSingleColumn && {
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                              }
                            ]}>
                              <Ionicons name="card" size={isSingleColumn ? 16 : 14} color="#6b7280" />
                              <Text style={[
                                styles.gridStatusText, 
                                { color: "#6b7280" },
                                isSingleColumn && {
                                  fontSize: 12,
                                }
                              ]}>
                                Clear
                              </Text>
                            </View>
                          </View>
                        )}
                        
                        {/* Show fines for this homeowner */}
                        {homeownerFines.length > 0 && (
                          <View style={styles.gridFinesSection}>
                            <View style={styles.gridFinesHeader}>
                              <Ionicons name="warning" size={14} color="#dc2626" />
                              <Text style={styles.gridFinesLabel}>Fines ({homeownerFines.length})</Text>
                            </View>
                            <View style={styles.gridFinesList}>
                              {homeownerFines.map((fine: any, index: number) => {
                                const paidTowardFine = (homeownerPayments as any[])
                                  .filter(
                                    (p: any) =>
                                      p.fineId === fine._id && p.verificationStatus === 'Verified',
                                  )
                                  .reduce((s: number, p: any) => s + p.amount, 0);
                                const remainingFine = Math.max(0, fine.amount - paidTowardFine);
                                const isPartialPayment = paidTowardFine > 0 && remainingFine >= 0.01;
                                const isFinePaidUp = remainingFine < 0.01;
                                const displayStatus = isFinePaidUp
                                  ? 'Paid'
                                  : isPartialPayment
                                    ? 'Partially Paid'
                                    : 'Pending';
                                const statusColor = isFinePaidUp
                                  ? '#10b981'
                                  : isPartialPayment
                                    ? '#f59e0b'
                                    : '#dc2626';
                                const statusIcon = isFinePaidUp
                                  ? 'checkmark-circle'
                                  : isPartialPayment
                                    ? 'hourglass'
                                    : 'warning';
                                
                                return (
                                  <View key={fine._id} style={[
                                    styles.gridFineItem,
                                    index === homeownerFines.length - 1 && styles.gridFineItemLast
                                  ]}>
                                    <View style={styles.gridFineLeft}>
                                      <Text style={styles.gridFineTitle} numberOfLines={2}>
                                        {fine.violation}
                                      </Text>
                                      <Text style={styles.gridFineDate} numberOfLines={1}>
                                        Issued: {fine.dateIssued}
                                      </Text>
                                    </View>
                                    <View style={styles.gridFineRight}>
                                      <Text style={styles.gridFineAmount}>${fine.amount}</Text>
                                      {isPartialPayment && (
                                        <Text style={styles.gridFinePartialPaymentText}>
                                          Paid: ${paidTowardFine.toFixed(2)} of ${fine.amount.toFixed(2)}
                                        </Text>
                                      )}
                                      <View style={[
                                        styles.gridFineStatusBadge,
                                        isFinePaidUp ? styles.gridFineStatusPaid :
                                        isPartialPayment ? styles.gridFineStatusPartial :
                                        styles.gridFineStatusPending
                                      ]}>
                                        <Ionicons 
                                          name={statusIcon as any} 
                                          size={10} 
                                          color={statusColor} 
                                        />
                                        <Text style={[
                                          styles.gridFineStatusText,
                                          { color: statusColor }
                                        ]}>
                                          {displayStatus}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        )}
                      </View>
                      {/* Tap to view full record */}
                      <View style={styles.gridCardTapHint}>
                          <Ionicons name="chevron-forward" size={13} color="#64748b" />
                          <Text style={styles.gridCardTapHintText}>View full record</Text>
                        </View>
                    </Animated.View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
              </View>
          </View>
        );
      
      default:
        return null;
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
          showsVerticalScrollIndicator={false}
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
          {/* Header with ImageBackground */}
          <View style={[styles.headerContainerIOS, { width: screenWidth }]}>
            <ImageBackground
              source={require('../../assets/hoa-4k.jpg')}
              style={styles.header}
              imageStyle={[styles.headerImage, { width: screenWidth }]}
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
                <View style={styles.titleContainer}>
                  <Text style={styles.headerTitle}>Admin Dashboard</Text>
                </View>
                <Text style={styles.headerSubtitle}>
                  Manage community content and residents
                </Text>
                <View style={styles.indicatorsContainer}>
                  <DeveloperIndicator />
                  <BoardMemberIndicator />
                </View>
              </View>
            </View>
            </ImageBackground>
          </View>

          {/* Custom Tab Bar - Only when screen is wide enough */}
          {showDesktopNav && (
            <CustomTabBar />
          )}

        {/* Folder Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={Platform.OS === 'web'}
          scrollEnabled={true}
          bounces={true}
          alwaysBounceHorizontal={true}
          style={styles.folderTabs}
          contentContainerStyle={styles.folderTabsContent}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[
              styles.folderTab, 
              activeTab === 'SheltonHOA' && styles.activeFolderTab,
              activeTab === 'SheltonHOA' && { borderColor: '#ef4444' }
            ]}
            onPress={() => setActiveTab('SheltonHOA')}
          >
            <Ionicons name="business" size={20} color={activeTab === 'SheltonHOA' ? '#ef4444' : '#6b7280'} />
            <Text style={[styles.folderTabText, activeTab === 'SheltonHOA' && styles.activeFolderTabText, activeTab === 'SheltonHOA' && { color: '#ef4444' }]}>
              SheltonHOA
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.folderTab, 
              activeTab === 'residents' && styles.activeFolderTab,
              activeTab === 'residents' && { borderColor: '#f97316' }
            ]}
            onPress={() => setActiveTab('residents')}
          >
            <Ionicons name="people" size={20} color={activeTab === 'residents' ? '#f97316' : '#6b7280'} />
            <Text style={[styles.folderTabText, activeTab === 'residents' && styles.activeFolderTabText, activeTab === 'residents' && { color: '#f97316' }]}>
              Residents
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.folderTab, 
              activeTab === 'board' && styles.activeFolderTab,
              activeTab === 'board' && { borderColor: '#eab308' }
            ]}
            onPress={() => setActiveTab('board')}
          >
            <Ionicons name="shield" size={20} color={activeTab === 'board' ? '#eab308' : '#6b7280'} />
            <Text style={[styles.folderTabText, activeTab === 'board' && styles.activeFolderTabText, activeTab === 'board' && { color: '#eab308' }]}>
              Board
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.folderTab, 
              activeTab === 'covenants' && styles.activeFolderTab,
              activeTab === 'covenants' && { borderColor: '#22c55e' }
            ]}
            onPress={() => setActiveTab('covenants')}
          >
            <Ionicons name="document-text" size={20} color={activeTab === 'covenants' ? '#22c55e' : '#6b7280'} />
            <Text style={[styles.folderTabText, activeTab === 'covenants' && styles.activeFolderTabText, activeTab === 'covenants' && { color: '#22c55e' }]}>
              Covenants
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.folderTab, 
              activeTab === 'Community' && styles.activeFolderTab,
              activeTab === 'Community' && { borderColor: '#3b82f6' }
            ]}
            onPress={() => setActiveTab('Community')}
          >
            <Ionicons name="chatbubbles" size={20} color={activeTab === 'Community' ? '#3b82f6' : '#6b7280'} />
            <Text style={[styles.folderTabText, activeTab === 'Community' && styles.activeFolderTabText, activeTab === 'Community' && { color: '#3b82f6' }]}>
              Community
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.folderTab, 
              activeTab === 'fees' && styles.activeFolderTab,
              activeTab === 'fees' && { borderColor: '#ec4899' }
            ]}
            onPress={() => setActiveTab('fees')}
          >
            <Ionicons name="card" size={20} color={activeTab === 'fees' ? '#ec4899' : '#6b7280'} />
              <Text style={[styles.folderTabText, activeTab === 'fees' && styles.activeFolderTabText, activeTab === 'fees' && { color: '#ec4899' }]}>
                Fees & Payments
              </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Content Area */}
        <View style={styles.contentArea}>
          {renderTabContent()}
        </View>

        {/* Share QR Links Modal */}
        <Modal
          visible={showShareQrModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => animateOut('shareQr', () => setShowShareQrModal(false))}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.formModalContent,
              {
                opacity: shareQrModalOpacity,
                transform: [{ translateY: shareQrModalTranslateY }],
                maxHeight: Platform.OS === 'web' ? '90%' : Dimensions.get('window').height * 0.85,
                maxWidth: Platform.OS === 'web' ? 680 : '95%',
              }
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Share Links and QR Codes</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => animateOut('shareQr', () => setShowShareQrModal(false))}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalForm}
                contentContainerStyle={styles.modalFormContent}
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.shareQrSubtitle}>
                  Tap any URL to copy it. Share the link directly or have residents scan the QR code.
                </Text>

                {shareLinkItems.map((item) => (
                  <View key={item.key} style={styles.shareQrCard}>
                    <TouchableOpacity
                      style={styles.shareQrCardHeader}
                      onPress={() =>
                        setExpandedShareQrKey((prev) => (prev === item.key ? null : item.key))
                      }
                    >
                      <View style={styles.shareQrCardTitleRow}>
                        <Ionicons
                          name={expandedShareQrKey === item.key ? 'chevron-down' : 'chevron-forward'}
                          size={16}
                          color="#4b5563"
                        />
                        <Text style={styles.shareQrCardTitle}>{item.label}</Text>
                      </View>
                    </TouchableOpacity>

                    {expandedShareQrKey === item.key && (
                      <TouchableOpacity
                        style={styles.shareQrCodeWrap}
                        onPress={() => handleCopyQrImage(item)}
                      >
                        <QRCode
                          getRef={(ref) => {
                            if (ref) shareQrRefs.current[item.key] = ref;
                          }}
                          value={item.url}
                          size={190}
                          backgroundColor="#ffffff"
                          color="#111827"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Block Modal */}
        <Modal
          visible={showBlockModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => animateOut('block', () => setShowBlockModal(false))}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.modalContent,
              {
                opacity: blockModalOpacity,
                transform: [{ translateY: blockModalTranslateY }],
              }
            ]}>
              <View style={styles.modalBodyPadding}>
              <Text style={styles.modalTitle}>Block Resident</Text>
              <Text style={styles.modalSubtitle}>
                Blocking {selectedItem?.firstName} {selectedItem?.lastName}
              </Text>
              
              <Text style={styles.inputLabel}>Reason for Blocking *</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Enter reason for blocking this resident..."
                value={blockReason}
                onChangeText={setBlockReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => animateOut('block', () => setShowBlockModal(false))}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={confirmBlockResident}
                >
                  <Text style={styles.confirmButtonText}>Block Resident</Text>
                </TouchableOpacity>
              </View>
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Remove Resident Modal */}
        <Modal
          visible={showRemoveModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => animateOut('remove', () => setShowRemoveModal(false))}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.modalContent,
              {
                opacity: removeModalOpacity,
                transform: [{ translateY: removeModalTranslateY }],
              }
            ]}>
              <View style={styles.modalBodyPadding}>
                <Text style={styles.modalTitle}>Remove Resident</Text>
                <Text style={styles.modalSubtitle}>
                  Are you sure you want to remove {selectedItem?.firstName} {selectedItem?.lastName}? This action cannot be undone.
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => animateOut('remove', () => setShowRemoveModal(false))}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmButton, styles.removeConfirmButton]}
                    onPress={confirmRemoveResident}
                  >
                    <Text style={styles.confirmButtonText}>Remove Resident</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Delete Modal */}
        <Modal
          visible={showDeleteModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => animateOut('delete', () => setShowDeleteModal(false))}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.modalContent,
              {
                opacity: deleteModalOpacity,
                transform: [{ translateY: deleteModalTranslateY }],
              }
            ]}>
              <View style={styles.modalBodyPadding}>
              <Text style={styles.modalTitle}>Delete Item</Text>
              <Text style={styles.modalSubtitle}>
                Are you sure you want to delete this {selectedItem?.type}?
              </Text>
              
              <Text style={styles.warningText}>
                This action cannot be undone.
              </Text>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => animateOut('delete', () => setShowDeleteModal(false))}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={confirmDeleteItem}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* ── Homeowner Full Records Modal ── */}
        <HomeownerRecordsModal
          visible={showHomeownerRecordsModal}
          onClose={() => {
            setShowHomeownerRecordsModal(false);
            setSelectedHomeownerGroup(null);
          }}
          addressGroup={selectedHomeownerGroup}
        />

        {/* Board Member Modal */}
        <Modal
          visible={showBoardMemberModal}
          transparent={true}
          animationType="none"
          onRequestClose={handleCancelBoardMember}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.boardMemberModalContent,
              {
                opacity: boardMemberModalOpacity,
                transform: [{ translateY: boardMemberModalTranslateY }],
              }
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditingBoardMember ? 'Edit Board Member' : 'Add Board Member'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleCancelBoardMember}
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
                  <Text style={styles.inputLabel}>Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter full name"
                    value={boardMemberForm.name}
                    onChangeText={(text) => setBoardMemberForm(prev => ({ ...prev, name: text }))}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Profile Picture (Optional)</Text>
                  <View style={styles.imageSection}>
                    <View style={styles.imageContainer}>
                      {boardMemberImage ? (
                        <View style={styles.imageWrapper}>
                          <Image 
                            source={{ uri: boardMemberImage }} 
                            style={styles.previewImage}
                            resizeMode="cover"
                          />
                          <TouchableOpacity 
                            style={styles.removeImageButton}
                            onPress={() => setBoardMemberImage(null)}
                          >
                            <Ionicons name="close" size={16} color="#ffffff" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <Ionicons name="person" size={40} color="#9ca3af" />
                        </View>
                      )}
                    </View>
                    <View style={styles.imageButtons}>
                      <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                        <Ionicons name="image" size={20} color="#2563eb" />
                        <Text style={styles.imageButtonText}>Choose Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
                        <Ionicons name="camera" size={20} color="#2563eb" />
                        <Text style={styles.imageButtonText}>Take Photo</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Position *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., President, Vice President, Treasurer"
                    value={boardMemberForm.position}
                    onChangeText={(text) => setBoardMemberForm(prev => ({ ...prev, position: text }))}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter email address"
                    value={boardMemberForm.email}
                    onChangeText={(text) => setBoardMemberForm(prev => ({ ...prev, email: text }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter phone number"
                    value={boardMemberForm.phone}
                    onChangeText={(text) => setBoardMemberForm(prev => ({ ...prev, phone: text }))}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Bio (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Enter a brief bio or description"
                    value={boardMemberForm.bio}
                    onChangeText={(text) => setBoardMemberForm(prev => ({ ...prev, bio: text }))}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Term End (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., December 2024"
                    value={boardMemberForm.termEnd}
                    onChangeText={(text) => setBoardMemberForm(prev => ({ ...prev, termEnd: text }))}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelBoardMember}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleSaveBoardMember}
                  >
                    <Text style={styles.confirmButtonText}>
                      {isEditingBoardMember ? 'Update' : 'Add'} Member
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Year Fee Modal */}
        <Modal
          visible={showYearFeeModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => animateOut('yearFee', () => setShowYearFeeModal(false))}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.formModalContent,
              {
                opacity: yearFeeModalOpacity,
                transform: [{ translateY: yearFeeModalTranslateY }],
              }
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Year Fees</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => animateOut('yearFee', () => setShowYearFeeModal(false))}
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
                  <Text style={styles.inputLabel}>Year *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter year (e.g., 2024)"
                    value={yearFeeForm.year}
                    onChangeText={(text) => setYearFeeForm(prev => ({ ...prev, year: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount ($) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter fee amount"
                    value={yearFeeForm.amount}
                    onChangeText={(text) => setYearFeeForm(prev => ({ ...prev, amount: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Enter fee description"
                    value={yearFeeForm.description}
                    onChangeText={(text) => setYearFeeForm(prev => ({ ...prev, description: text }))}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => animateOut('yearFee', () => setShowYearFeeModal(false))}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleAddYearFees}
                  >
                    <Text style={styles.confirmButtonText}>Add Year Fees</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Add Fine Modal */}
        <Modal
          visible={showAddFineModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => animateOut('addFine', () => setShowAddFineModal(false))}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.formModalContent,
              {
                opacity: addFineModalOpacity,
                transform: [{ translateY: addFineModalTranslateY }],
              }
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Fine to Property</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => animateOut('addFine', () => setShowAddFineModal(false))}
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
                  <Text style={styles.inputLabel}>Select Property Address *</Text>
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search by address or homeowner name..."
                    value={fineSearchQuery}
                    onChangeText={setFineSearchQuery}
                  />
                  <ScrollView style={styles.addressSelector} nestedScrollEnabled>
                    {getUniqueAddresses()
                      .filter(address => {
                        const query = fineSearchQuery.toLowerCase();
                        return query === '' ||
                          address.address.toLowerCase().includes(query) ||
                          address.homeownerName.toLowerCase().includes(query);
                      })
                      .map((address, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.addressOption,
                          fineForm.selectedAddress === address.address && styles.addressOptionSelected
                        ]}
                        onPress={() => setFineForm(prev => ({ ...prev, selectedAddress: address.address }))}
                      >
                        <Text style={[
                          styles.addressOptionText,
                          fineForm.selectedAddress === address.address && styles.addressOptionTextSelected
                        ]}>
                          {address.address}
                        </Text>
                        <Text style={[
                          styles.addressOptionSubtext,
                          fineForm.selectedAddress === address.address && styles.addressOptionSubtextSelected
                        ]}>
                          {address.homeownerName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Fine Amount ($) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter fine amount"
                    value={fineForm.amount}
                    onChangeText={(text) => setFineForm(prev => ({ ...prev, amount: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Reason for Fine *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter reason for fine"
                    value={fineForm.reason}
                    onChangeText={(text) => setFineForm(prev => ({ ...prev, reason: text }))}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Enter additional details"
                    value={fineForm.description}
                    onChangeText={(text) => setFineForm(prev => ({ ...prev, description: text }))}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>


                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => animateOut('addFine', () => setShowAddFineModal(false))}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleAddFine}
                  >
                    <Text style={styles.confirmButtonText}>Add Fine</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Update Dues Modal */}
        <Modal
          visible={showUpdateDuesModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => animateOut('updateDues', () => setShowUpdateDuesModal(false))}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.formModalContent,
              {
                opacity: updateDuesModalOpacity,
                transform: [{ translateY: updateDuesModalTranslateY }],
              }
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Update All Dues Amount</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => animateOut('updateDues', () => setShowUpdateDuesModal(false))}
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
                  <Text style={styles.inputLabel}>New Dues Amount ($) *</Text>
                  <Text style={styles.inputDescription}>
                    This will update the dues amount for all {unpaidAnnualFees.length} homeowners with unpaid annual fees.
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter new amount for all homeowners"
                    value={updateDuesForm.newAmount}
                    onChangeText={(text) => setUpdateDuesForm(prev => ({ ...prev, newAmount: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => animateOut('updateDues', () => setShowUpdateDuesModal(false))}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleUpdateDues}
                  >
                    <Text style={styles.confirmButtonText}>Update Amount</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Add Past Due Modal */}
        <Modal
          visible={showPastDueModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => animateOut('pastDue', () => setShowPastDueModal(false))}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.formModalContent,
              {
                opacity: pastDueModalOpacity,
                transform: [{ translateY: pastDueModalTranslateY }],
              }
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Past Due Amount</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => animateOut('pastDue', () => setShowPastDueModal(false))}
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
                  <Text style={styles.inputLabel}>Select Homeowner *</Text>
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search by name or address..."
                    value={pastDueSearchQuery}
                    onChangeText={setPastDueSearchQuery}
                  />
                  <ScrollView style={styles.addressSelector} nestedScrollEnabled>
                    {homeownersList
                      .filter(resident => {
                        const query = pastDueSearchQuery.toLowerCase();
                        return query === '' ||
                          resident.firstName.toLowerCase().includes(query) ||
                          resident.lastName.toLowerCase().includes(query) ||
                          resident.address.toLowerCase().includes(query);
                      })
                      .map((resident: any) => (
                      <TouchableOpacity
                        key={resident._id}
                        style={[
                          styles.addressOption,
                          pastDueForm.selectedResidentId === resident._id && styles.addressOptionSelected
                        ]}
                        onPress={() => setPastDueForm(prev => ({ ...prev, selectedResidentId: resident._id }))}
                      >
                        <Text style={[
                          styles.addressOptionText,
                          pastDueForm.selectedResidentId === resident._id && styles.addressOptionTextSelected
                        ]}>
                          {resident.firstName} {resident.lastName}
                        </Text>
                        <Text style={[
                          styles.addressOptionSubtext,
                          pastDueForm.selectedResidentId === resident._id && styles.addressOptionSubtextSelected
                        ]}>
                          {resident.address} {resident.unitNumber && `Unit ${resident.unitNumber}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Past Due Amount ($) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter past due amount"
                    value={pastDueForm.amount}
                    onChangeText={(text) => setPastDueForm(prev => ({ ...prev, amount: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter description"
                    value={pastDueForm.description}
                    onChangeText={(text) => setPastDueForm(prev => ({ ...prev, description: text }))}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Original Due Date *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    value={pastDueForm.dueDate}
                    onChangeText={(text) => setPastDueForm(prev => ({ ...prev, dueDate: text }))}
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => animateOut('pastDue', () => setShowPastDueModal(false))}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleAddPastDue}
                  >
                    <Text style={styles.confirmButtonText}>Add Past Due</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Record Payment Modal */}
        <Modal
          visible={showRecordPaymentModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => animateOut('recordPayment', () => setShowRecordPaymentModal(false))}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.formModalContent,
              {
                opacity: recordPaymentModalOpacity,
                transform: [{ translateY: recordPaymentModalTranslateY }],
              }
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Record Payment</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => animateOut('recordPayment', () => setShowRecordPaymentModal(false))}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                style={styles.modalForm} 
                contentContainerStyle={styles.modalFormContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Homeowner Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Select Homeowner *</Text>
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search by name or address..."
                    value={paymentSearchQuery}
                    onChangeText={setPaymentSearchQuery}
                  />
                  <ScrollView style={styles.addressSelector} nestedScrollEnabled>
                    {homeownersPaymentStatus
                      .filter(homeowner => {
                        const query = paymentSearchQuery.toLowerCase();
                        return query === '' ||
                          homeowner.firstName.toLowerCase().includes(query) ||
                          homeowner.lastName.toLowerCase().includes(query) ||
                          homeowner.address.toLowerCase().includes(query);
                      })
                      .map((homeowner: any) => (
                      <TouchableOpacity
                        key={homeowner._id}
                        style={[
                          styles.addressOption,
                          paymentForm.homeownerId === homeowner._id && styles.addressOptionSelected
                        ]}
                        onPress={() => setPaymentForm(prev => ({
                          ...prev,
                          homeownerId: homeowner._id,
                          homeownerName: `${homeowner.firstName} ${homeowner.lastName}`,
                        }))}
                      >
                        <Text style={[
                          styles.addressOptionText,
                          paymentForm.homeownerId === homeowner._id && styles.addressOptionTextSelected
                        ]}>
                          {homeowner.firstName} {homeowner.lastName}
                        </Text>
                        <Text style={[
                          styles.addressOptionSubtext,
                          paymentForm.homeownerId === homeowner._id && styles.addressOptionSubtextSelected
                        ]}>
                          {homeowner.address}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Amount */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount ($) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={paymentForm.amount}
                    onChangeText={(text) => setPaymentForm(prev => ({ ...prev, amount: text }))}
                    placeholder="Enter amount"
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Payment Method */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Method *</Text>
                  <View style={styles.paymentMethodContainer}>
                    <TouchableOpacity
                      style={[
                        styles.paymentMethodOption,
                        paymentForm.paymentMethod === 'Check' && styles.paymentMethodSelected
                      ]}
                      onPress={() => setPaymentForm(prev => ({ ...prev, paymentMethod: 'Check' }))}
                    >
                      <Ionicons name="document-text" size={20} color={paymentForm.paymentMethod === 'Check' ? '#ffffff' : '#6b7280'} />
                      <Text style={[
                        styles.paymentMethodText,
                        paymentForm.paymentMethod === 'Check' && styles.paymentMethodTextSelected
                      ]}>Check</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.paymentMethodOption,
                        paymentForm.paymentMethod === 'Cash' && styles.paymentMethodSelected
                      ]}
                      onPress={() => setPaymentForm(prev => ({ ...prev, paymentMethod: 'Cash' }))}
                    >
                      <Ionicons name="cash" size={20} color={paymentForm.paymentMethod === 'Cash' ? '#ffffff' : '#6b7280'} />
                      <Text style={[
                        styles.paymentMethodText,
                        paymentForm.paymentMethod === 'Cash' && styles.paymentMethodTextSelected
                      ]}>Cash</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.paymentMethodOption,
                        paymentForm.paymentMethod === 'Venmo' && styles.paymentMethodSelected
                      ]}
                      onPress={() => setPaymentForm(prev => ({ ...prev, paymentMethod: 'Venmo' }))}
                    >
                      <Ionicons name="logo-venmo" size={20} color={paymentForm.paymentMethod === 'Venmo' ? '#ffffff' : '#6b7280'} />
                      <Text style={[
                        styles.paymentMethodText,
                        paymentForm.paymentMethod === 'Venmo' && styles.paymentMethodTextSelected
                      ]}>Venmo</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Check Number (only show for check payments) */}
                {paymentForm.paymentMethod === 'Check' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Check Number (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={paymentForm.checkNumber}
                      onChangeText={(text) => setPaymentForm(prev => ({ ...prev, checkNumber: text }))}
                      placeholder="Enter check number"
                    />
                  </View>
                )}

                {/* Venmo Username (only show for Venmo payments) */}
                {paymentForm.paymentMethod === 'Venmo' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Venmo Username (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={paymentForm.venmoUsername}
                      onChangeText={(text) => setPaymentForm(prev => ({ ...prev, venmoUsername: text }))}
                      placeholder="Enter Venmo username"
                    />
                  </View>
                )}

                {/* Venmo Transaction ID (only show for Venmo payments) */}
                {paymentForm.paymentMethod === 'Venmo' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Venmo Transaction ID (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={paymentForm.venmoTransactionId}
                      onChangeText={(text) => setPaymentForm(prev => ({ ...prev, venmoTransactionId: text }))}
                      placeholder="Enter transaction ID"
                    />
                  </View>
                )}

                {/* Payment Date */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Date *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={paymentForm.paymentDate}
                    onChangeText={(text) => setPaymentForm(prev => ({ ...prev, paymentDate: text }))}
                    placeholder="YYYY-MM-DD"
                  />
                </View>

                {/* Notes */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Notes (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={paymentForm.notes}
                    onChangeText={(text) => setPaymentForm(prev => ({ ...prev, notes: text }))}
                    placeholder="Additional notes..."
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => animateOut('recordPayment', () => setShowRecordPaymentModal(false))}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleRecordPayment}
                  >
                    <Text style={styles.confirmButtonText}>Record Payment</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Transactions History Modal */}
        <Modal
          visible={showTransactionsModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => {
            setTransactionsSearchQuery('');
            setTransactionsLimit(50);
            animateOut('transactions', () => setShowTransactionsModal(false));
          }}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.formModalContent,
              {
                opacity: transactionsModalOpacity,
                transform: [{ translateY: transactionsModalTranslateY }],
                maxHeight: Platform.OS === 'web' ? '90%' : Dimensions.get('window').height * 0.85,
                height: Platform.OS === 'ios' ? Dimensions.get('window').height * 0.85 : undefined,
              }
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Transaction History</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setTransactionsSearchQuery('');
                    setTransactionsLimit(50);
                    animateOut('transactions', () => setShowTransactionsModal(false));
                  }}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              
              {/* Search Input */}
              <View style={styles.paymentSearchContainer}>
                <Ionicons name="search" size={20} color="#6b7280" style={styles.paymentSearchIcon} />
                <TextInput
                  style={styles.paymentSearchInput}
                  placeholder="Search by name, transaction ID, amount, date, payment method..."
                  value={transactionsSearchQuery}
                  onChangeText={setTransactionsSearchQuery}
                  placeholderTextColor="#9ca3af"
                />
                {transactionsSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setTransactionsSearchQuery('')}
                    style={styles.paymentSearchClear}
                  >
                    <Ionicons name="close-circle" size={20} color="#6b7280" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Transactions List */}
              <View style={{ flex: 1 }}>
                <ScrollView 
                  style={styles.transactionsList}
                  contentContainerStyle={styles.transactionsListContent}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                {filteredTransactions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="receipt-outline" size={48} color="#9ca3af" />
                    <Text style={styles.emptyStateText}>
                      {transactionsSearchQuery ? 'No transactions found' : 'No transactions yet'}
                    </Text>
                    {transactionsSearchQuery && (
                      <Text style={styles.emptyStateSubtext}>
                        Try adjusting your search query
                      </Text>
                    )}
                  </View>
                ) : (
                  <>
                    {filteredTransactions.map((payment: any) => {
                    const resident = residentsMap.get(payment.userId);
                    const paymentDate = payment.paymentDate || new Date(payment.createdAt).toISOString().split('T')[0];
                    const formattedDate = new Date(payment.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });
                    const formattedTime = new Date(payment.createdAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    
                    // Status badge colors
                    const statusColor = payment.status === 'Paid' ? '#10b981' : 
                                       payment.status === 'Pending' ? '#f59e0b' : '#dc2626';
                    const verificationColor = payment.verificationStatus === 'Verified' ? '#10b981' :
                                              payment.verificationStatus === 'Rejected' ? '#dc2626' : '#6b7280';
                    
                    return (
                      <View key={payment._id} style={styles.transactionCard}>
                        <View style={styles.transactionHeader}>
                          <View style={styles.transactionHeaderLeft}>
                            <View style={[styles.transactionStatusBadge, { backgroundColor: statusColor + '20' }]}>
                              <Ionicons 
                                name={payment.status === 'Paid' ? 'checkmark-circle' : payment.status === 'Pending' ? 'time' : 'close-circle'} 
                                size={14} 
                                color={statusColor} 
                              />
                              <Text style={[styles.transactionStatusText, { color: statusColor }]}>
                                {payment.status}
                              </Text>
                            </View>
                            {payment.verificationStatus && (
                              <View style={[styles.transactionVerificationBadge, { backgroundColor: verificationColor + '20' }]}>
                                <Ionicons 
                                  name={payment.verificationStatus === 'Verified' ? 'shield-checkmark' : payment.verificationStatus === 'Rejected' ? 'close-circle' : 'shield-outline'} 
                                  size={12} 
                                  color={verificationColor} 
                                />
                                <Text style={[styles.transactionVerificationText, { color: verificationColor }]}>
                                  {payment.verificationStatus}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.transactionAmount}>
                            ${payment.amount.toFixed(2)}
                          </Text>
                        </View>
                        
                        <View style={styles.transactionDetails}>
                          <View style={styles.transactionDetailRow}>
                            <Ionicons name="person" size={14} color="#6b7280" />
                            <Text style={styles.transactionDetailText}>
                              {resident ? `${resident.firstName} ${resident.lastName}` : 'Unknown'}
                            </Text>
                          </View>
                          
                          {resident && (
                            <View style={styles.transactionDetailRow}>
                              <Ionicons name="home" size={14} color="#6b7280" />
                              <Text style={styles.transactionDetailText}>
                                {resident.address}{resident.unitNumber ? ` #${resident.unitNumber}` : ''}
                              </Text>
                            </View>
                          )}
                          
                          <View style={styles.transactionDetailRow}>
                            <Ionicons name="card" size={14} color="#6b7280" />
                            <Text style={styles.transactionDetailText}>
                              {payment.feeType}
                            </Text>
                          </View>
                          
                          <View style={styles.transactionDetailRow}>
                            <Ionicons 
                              name={payment.paymentMethod === 'Venmo' ? 'logo-venmo' : payment.paymentMethod === 'Check' ? 'document-text' : 'cash'} 
                              size={14} 
                              color="#6b7280" 
                            />
                            <Text style={styles.transactionDetailText}>
                              {payment.paymentMethod}
                              {payment.checkNumber && ` • Check #${payment.checkNumber}`}
                              {payment.venmoUsername && ` • @${payment.venmoUsername}`}
                            </Text>
                          </View>
                          
                          {(payment.transactionId || payment.venmoTransactionId) && (
                            <View style={styles.transactionDetailRow}>
                              <Ionicons name="receipt" size={14} color="#6b7280" />
                              <Text style={styles.transactionDetailText} numberOfLines={1}>
                                ID: {payment.transactionId || payment.venmoTransactionId}
                              </Text>
                            </View>
                          )}
                          
                          <View style={styles.transactionDetailRow}>
                            <Ionicons name="calendar" size={14} color="#6b7280" />
                            <Text style={styles.transactionDetailText}>
                              {formattedDate} at {formattedTime}
                            </Text>
                          </View>
                          
                          {payment.adminNotes && (
                            <View style={styles.transactionDetailRow}>
                              <Ionicons name="document-text" size={14} color="#6b7280" />
                              <Text style={styles.transactionDetailText}>
                                Notes: {payment.adminNotes}
                              </Text>
                            </View>
                          )}
                        </View>
                        
                        {/* Correction Button for Verified Payments */}
                        {payment.verificationStatus === 'Verified' && (
                          <TouchableOpacity
                            style={styles.correctAmountButton}
                            onPress={() => {
                              setSelectedPaymentForCorrection(payment);
                              setCorrectedAmount(payment.amount.toString());
                              setCorrectionNotes('');
                              setShowCorrectionModal(true);
                            }}
                          >
                            <Ionicons name="create-outline" size={16} color="#2563eb" />
                            <Text style={styles.correctAmountButtonText}>Correct Amount</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                    })}
                    
                    {/* Footer: Load More or All loaded - always show when there are transactions and no search */}
                    {!transactionsSearchQuery.trim() && recentPayments.length > 0 && (
                      <View style={styles.loadMoreContainer}>
                        {recentPayments.length >= transactionsLimit ? (
                          <TouchableOpacity
                            style={styles.loadMoreButton}
                            onPress={() => setTransactionsLimit(prev => prev + 50)}
                          >
                            <Ionicons name="chevron-down" size={18} color="#2563eb" />
                            <Text style={styles.loadMoreButtonText}>Load More</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.loadMoreAllText}>All transactions loaded</Text>
                        )}
                      </View>
                    )}
                  </>
                )}
                </ScrollView>
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* Payment Correction Modal */}
        <Modal
          visible={showCorrectionModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowCorrectionModal(false)}
        >
          {Platform.OS === 'web' ? (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Correct Payment Amount</Text>
                <TouchableOpacity onPress={() => {
                  setShowCorrectionModal(false);
                  setSelectedPaymentForCorrection(null);
                  setCorrectedAmount('');
                  setCorrectionNotes('');
                }}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {selectedPaymentForCorrection && (
                <ScrollView style={styles.modalScrollView}>
                  <View style={styles.verificationPaymentInfo}>
                    <Text style={styles.verificationPaymentLabel}>Resident:</Text>
                    <Text style={styles.verificationPaymentValue}>
                      {(() => {
                        const resident = residentsMap.get(selectedPaymentForCorrection.userId);
                        return resident ? `${resident.firstName} ${resident.lastName}` : 'Unknown';
                      })()}
                    </Text>
                  </View>
                  <View style={styles.verificationPaymentInfo}>
                    <Text style={styles.verificationPaymentLabel}>Current Amount:</Text>
                    <Text style={styles.verificationPaymentValue}>
                      ${selectedPaymentForCorrection.amount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.verificationPaymentInfo}>
                    <Text style={styles.verificationPaymentLabel}>Fee Type:</Text>
                    <Text style={styles.verificationPaymentValue}>
                      {selectedPaymentForCorrection.feeType}
                    </Text>
                  </View>
                  
                  {/* Corrected Amount Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Corrected Amount *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter correct amount"
                      value={correctedAmount}
                      onChangeText={(text) => {
                        // Allow only numbers and decimal point
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        // Ensure only one decimal point
                        const parts = cleaned.split('.');
                        const formatted = parts.length > 2 
                          ? parts[0] + '.' + parts.slice(1).join('')
                          : cleaned;
                        setCorrectedAmount(formatted);
                      }}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#9ca3af"
                    />
                    <Text style={styles.inputDescription}>
                      Original amount: ${selectedPaymentForCorrection.amount.toFixed(2)}
                    </Text>
                  </View>

                  {/* Fee Amount Comparison */}
                  {(() => {
                    const feeId = selectedPaymentForCorrection.feeId;
                    const fineId = selectedPaymentForCorrection.fineId;
                    let feeAmount: number | null = null;
                    let feeName: string | null = null;
                    
                    if (feeId && allFeesFromDatabase) {
                      const fee = allFeesFromDatabase.find((f: any) => f._id === feeId);
                      if (fee) {
                        feeAmount = fee.amount;
                        feeName = fee.name;
                      }
                    } else if (fineId && allFinesFromDatabase) {
                      const fine = allFinesFromDatabase.find((f: any) => f._id === fineId);
                      if (fine) {
                        feeAmount = fine.amount;
                        feeName = fine.violation;
                      }
                    }
                    
                    const correctedAmountNum = parseFloat(correctedAmount) || 0;
                    const isPartialPayment = feeAmount !== null && correctedAmountNum > 0 && correctedAmountNum < feeAmount;
                    const isFullPayment = feeAmount !== null && correctedAmountNum >= feeAmount;
                    
                    return feeAmount !== null ? (
                      <View style={styles.inputGroup}>
                        <View style={styles.verificationPaymentInfo}>
                          <Text style={styles.verificationPaymentLabel}>Fee Amount:</Text>
                          <Text style={styles.verificationPaymentValue}>
                            ${feeAmount.toFixed(2)} ({feeName})
                          </Text>
                        </View>
                        {correctedAmountNum > 0 && (
                          <View style={[
                            styles.paymentComparisonContainer,
                            isPartialPayment && styles.partialPaymentWarning,
                            isFullPayment && styles.fullPaymentSuccess
                          ]}>
                            {isPartialPayment && (
                              <>
                                <Ionicons name="warning" size={20} color="#f59e0b" />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.paymentComparisonText}>
                                    Partial payment. Fee will remain Pending.
                                  </Text>
                                  <Text style={styles.paymentComparisonSubtext}>
                                    Remaining: ${(feeAmount - correctedAmountNum).toFixed(2)}
                                  </Text>
                                </View>
                              </>
                            )}
                            {isFullPayment && (
                              <>
                                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.paymentComparisonText}>
                                    Full payment. Fee will be marked as Paid.
                                  </Text>
                                  {correctedAmountNum > feeAmount && (
                                    <Text style={styles.paymentComparisonSubtext}>
                                      Overpayment: ${(correctedAmountNum - feeAmount).toFixed(2)} (will be ignored)
                                    </Text>
                                  )}
                                </View>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    ) : null;
                  })()}
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Correction Notes (Optional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      placeholder="Add notes about this correction..."
                      value={correctionNotes}
                      onChangeText={setCorrectionNotes}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.verificationActions}>
                    <TouchableOpacity
                      style={[styles.rejectButton, { backgroundColor: '#6b7280' }]}
                      onPress={() => {
                        setShowCorrectionModal(false);
                        setSelectedPaymentForCorrection(null);
                        setCorrectedAmount('');
                        setCorrectionNotes('');
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#ffffff" />
                      <Text style={styles.rejectButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.verifyButton, { backgroundColor: '#2563eb' }]}
                      onPress={async () => {
                        try {
                          // Validate corrected amount
                          const correctedAmountNum = parseFloat(correctedAmount);
                          if (isNaN(correctedAmountNum) || correctedAmountNum <= 0) {
                            Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than 0.');
                            return;
                          }

                          const result = await correctPaymentAmount({
                            paymentId: selectedPaymentForCorrection._id,
                            correctedAmount: correctedAmountNum,
                            adminNotes: correctionNotes.trim() || undefined,
                          });

                          Alert.alert('Success', result.message || 'Payment amount corrected successfully!');
                          setShowCorrectionModal(false);
                          setSelectedPaymentForCorrection(null);
                          setCorrectedAmount('');
                          setCorrectionNotes('');
                          await handleRefresh();
                        } catch (error) {
                          console.error('Correction error:', error);
                          Alert.alert('Error', 'Failed to correct payment amount.');
                        }
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                      <Text style={styles.verifyButtonText}>Correct Amount</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Correct Payment Amount</Text>
                <TouchableOpacity onPress={() => {
                  setShowCorrectionModal(false);
                  setSelectedPaymentForCorrection(null);
                  setCorrectedAmount('');
                  setCorrectionNotes('');
                }}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {selectedPaymentForCorrection && (
                <ScrollView style={styles.modalScrollView}>
                  <View style={styles.verificationPaymentInfo}>
                    <Text style={styles.verificationPaymentLabel}>Resident:</Text>
                    <Text style={styles.verificationPaymentValue}>
                      {(() => {
                        const resident = residentsMap.get(selectedPaymentForCorrection.userId);
                        return resident ? `${resident.firstName} ${resident.lastName}` : 'Unknown';
                      })()}
                    </Text>
                  </View>
                  <View style={styles.verificationPaymentInfo}>
                    <Text style={styles.verificationPaymentLabel}>Current Amount:</Text>
                    <Text style={styles.verificationPaymentValue}>
                      ${selectedPaymentForCorrection.amount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.verificationPaymentInfo}>
                    <Text style={styles.verificationPaymentLabel}>Fee Type:</Text>
                    <Text style={styles.verificationPaymentValue}>
                      {selectedPaymentForCorrection.feeType}
                    </Text>
                  </View>
                  
                  {/* Corrected Amount Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Corrected Amount *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter correct amount"
                      value={correctedAmount}
                      onChangeText={(text) => {
                        // Allow only numbers and decimal point
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        // Ensure only one decimal point
                        const parts = cleaned.split('.');
                        const formatted = parts.length > 2 
                          ? parts[0] + '.' + parts.slice(1).join('')
                          : cleaned;
                        setCorrectedAmount(formatted);
                      }}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#9ca3af"
                    />
                    <Text style={styles.inputDescription}>
                      Original amount: ${selectedPaymentForCorrection.amount.toFixed(2)}
                    </Text>
                  </View>

                  {/* Fee Amount Comparison */}
                  {(() => {
                    const feeId = selectedPaymentForCorrection.feeId;
                    const fineId = selectedPaymentForCorrection.fineId;
                    let feeAmount: number | null = null;
                    let feeName: string | null = null;
                    
                    if (feeId && allFeesFromDatabase) {
                      const fee = allFeesFromDatabase.find((f: any) => f._id === feeId);
                      if (fee) {
                        feeAmount = fee.amount;
                        feeName = fee.name;
                      }
                    } else if (fineId && allFinesFromDatabase) {
                      const fine = allFinesFromDatabase.find((f: any) => f._id === fineId);
                      if (fine) {
                        feeAmount = fine.amount;
                        feeName = fine.violation;
                      }
                    }
                    
                    const correctedAmountNum = parseFloat(correctedAmount) || 0;
                    const isPartialPayment = feeAmount !== null && correctedAmountNum > 0 && correctedAmountNum < feeAmount;
                    const isFullPayment = feeAmount !== null && correctedAmountNum >= feeAmount;
                    
                    return feeAmount !== null ? (
                      <View style={styles.inputGroup}>
                        <View style={styles.verificationPaymentInfo}>
                          <Text style={styles.verificationPaymentLabel}>Fee Amount:</Text>
                          <Text style={styles.verificationPaymentValue}>
                            ${feeAmount.toFixed(2)} ({feeName})
                          </Text>
                        </View>
                        {correctedAmountNum > 0 && (
                          <View style={[
                            styles.paymentComparisonContainer,
                            isPartialPayment && styles.partialPaymentWarning,
                            isFullPayment && styles.fullPaymentSuccess
                          ]}>
                            {isPartialPayment && (
                              <>
                                <Ionicons name="warning" size={20} color="#f59e0b" />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.paymentComparisonText}>
                                    Partial payment. Fee will remain Pending.
                                  </Text>
                                  <Text style={styles.paymentComparisonSubtext}>
                                    Remaining: ${(feeAmount - correctedAmountNum).toFixed(2)}
                                  </Text>
                                </View>
                              </>
                            )}
                            {isFullPayment && (
                              <>
                                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.paymentComparisonText}>
                                    Full payment. Fee will be marked as Paid.
                                  </Text>
                                  {correctedAmountNum > feeAmount && (
                                    <Text style={styles.paymentComparisonSubtext}>
                                      Overpayment: ${(correctedAmountNum - feeAmount).toFixed(2)} (will be ignored)
                                    </Text>
                                  )}
                                </View>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    ) : null;
                  })()}
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Correction Notes (Optional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      placeholder="Add notes about this correction..."
                      value={correctionNotes}
                      onChangeText={setCorrectionNotes}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.verificationActions}>
                    <TouchableOpacity
                      style={[styles.rejectButton, { backgroundColor: '#6b7280' }]}
                      onPress={() => {
                        setShowCorrectionModal(false);
                        setSelectedPaymentForCorrection(null);
                        setCorrectedAmount('');
                        setCorrectionNotes('');
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#ffffff" />
                      <Text style={styles.rejectButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.verifyButton, { backgroundColor: '#2563eb' }]}
                      onPress={async () => {
                        try {
                          // Validate corrected amount
                          const correctedAmountNum = parseFloat(correctedAmount);
                          if (isNaN(correctedAmountNum) || correctedAmountNum <= 0) {
                            Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than 0.');
                            return;
                          }

                          const result = await correctPaymentAmount({
                            paymentId: selectedPaymentForCorrection._id,
                            correctedAmount: correctedAmountNum,
                            adminNotes: correctionNotes.trim() || undefined,
                          });

                          Alert.alert('Success', result.message || 'Payment amount corrected successfully!');
                          setShowCorrectionModal(false);
                          setSelectedPaymentForCorrection(null);
                          setCorrectedAmount('');
                          setCorrectionNotes('');
                          await handleRefresh();
                        } catch (error) {
                          console.error('Correction error:', error);
                          Alert.alert('Error', 'Failed to correct payment amount.');
                        }
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                      <Text style={styles.verifyButtonText}>Correct Amount</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        )}
        </Modal>

        {/* Covenant Modal */}
        <Modal
          visible={showCovenantModal}
          transparent={true}
          animationType="none"
          onRequestClose={handleCancelCovenant}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <Animated.View style={[
              styles.boardMemberModalContent,
              {
                opacity: covenantModalOpacity,
                transform: [{ translateY: covenantModalTranslateY }],
              }
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditingCovenant ? 'Edit Covenant' : 'Add Covenant'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleCancelCovenant}
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
                  <Text style={styles.inputLabel}>Title *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter covenant title"
                    value={covenantForm.title}
                    onChangeText={(text) => setCovenantForm(prev => ({ ...prev, title: text }))}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Category *</Text>
                  <TouchableOpacity
                    style={styles.categoryPicker}
                    onPress={() => {
                      if (showCategoryDropdown) {
                        setShowCategoryDropdown(false);
                        animateCategoryDropdownOut();
                      } else {
                        setShowCategoryDropdown(true);
                        animateCategoryDropdownIn();
                      }
                    }}
                  >
                    <Text style={styles.categoryPickerText}>{covenantForm.category}</Text>
                    <Ionicons 
                      name={showCategoryDropdown ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#6b7280" 
                    />
                  </TouchableOpacity>
                  
                  {showCategoryDropdown && (
                    <Animated.View 
                      style={[
                        styles.categoryDropdown,
                        {
                          opacity: categoryDropdownOpacity,
                          transform: [{ scale: categoryDropdownScale }]
                        }
                      ]}
                    >
                      {['Architecture', 'Landscaping', 'Minutes', 'Caveats', 'General'].map((category, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.categoryOption,
                            covenantForm.category === category && styles.categoryOptionSelected
                          ]}
                          onPress={() => {
                            setCovenantForm(prev => ({ ...prev, category: category as any }));
                            setShowCategoryDropdown(false);
                            animateCategoryDropdownOut();
                          }}
                        >
                          <Text style={[
                            styles.categoryOptionText,
                            covenantForm.category === category && styles.categoryOptionTextSelected
                          ]}>
                            {category}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </Animated.View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description *</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Enter covenant description"
                    value={covenantForm.description}
                    onChangeText={(text) => setCovenantForm(prev => ({ ...prev, description: text }))}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Last Updated</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter last updated date"
                    value={covenantForm.lastUpdated}
                    onChangeText={(text) => setCovenantForm(prev => ({ ...prev, lastUpdated: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Attachment (optional)</Text>
                  <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, lineHeight: 15 }}>
                    Documents: PDF, Word (.doc, .docx), max 10MB. Photos: compressed (WebP or JPEG) for smaller
                    storage.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <TouchableOpacity
                      style={[styles.filePickerButton, { flex: 1, paddingVertical: 12 }]}
                      onPress={handleCovenantPickDocument}
                      disabled={covenantUploading}
                    >
                      <Ionicons name="document-attach" size={18} color="#2563eb" />
                      <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: '600' }}>Document</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.filePickerButton, { flex: 1, paddingVertical: 12 }]}
                      onPress={handleCovenantPickImage}
                      disabled={covenantUploading}
                    >
                      <Ionicons name="image" size={18} color="#2563eb" />
                      <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: '600' }}>Photo</Text>
                    </TouchableOpacity>
                  </View>
                  {covenantSelectedDoc && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      <Text style={{ flex: 1, fontSize: 13, color: '#374151' }} numberOfLines={1}>
                        {covenantSelectedDoc.name}
                      </Text>
                    </View>
                  )}
                  {covenantSelectedImageUri && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      <Text style={{ fontSize: 13, color: '#374151' }}>Photo selected (will be compressed)</Text>
                    </View>
                  )}
                  {isEditingCovenant &&
                    selectedItem &&
                    !covenantSelectedDoc &&
                    !covenantSelectedImageUri &&
                    !covenantClearAttachment &&
                    (selectedItem.fileStorageId || selectedItem.pdfUrl) && (
                      <Text style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                        Current:{' '}
                        {selectedItem.fileStorageId
                          ? 'File attached (storage)'
                          : 'Legacy PDF link (URL only)'}
                      </Text>
                    )}
                  {covenantClearAttachment && (
                    <Text style={{ fontSize: 12, color: '#b45309', marginBottom: 6 }}>
                      Attachment will be removed when you save.
                    </Text>
                  )}
                  {(covenantSelectedDoc ||
                    covenantSelectedImageUri ||
                    covenantForm.fileStorageId ||
                    (isEditingCovenant && selectedItem?.pdfUrl) ||
                    (isEditingCovenant && selectedItem?.fileStorageId)) && (
                    <TouchableOpacity
                      onPress={() => {
                        setCovenantSelectedDoc(null);
                        setCovenantSelectedImageUri(null);
                        setCovenantClearAttachment(true);
                      }}
                      disabled={covenantUploading}
                    >
                      <Text style={{ fontSize: 13, color: '#ef4444', fontWeight: '600' }}>
                        Remove attachment
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelCovenant}
                    disabled={covenantUploading}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, covenantUploading && { opacity: 0.7 }]}
                    onPress={isEditingCovenant ? handleUpdateCovenant : handleAddCovenant}
                    disabled={covenantUploading}
                  >
                    {covenantUploading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.confirmButtonText}>
                        {isEditingCovenant ? 'Update Covenant' : 'Add Covenant'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
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
          <View style={styles.modalOverlay} pointerEvents="auto">
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
                  {isEditingPoll ? 'Edit Poll' : 'Create Poll'}
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
                    style={styles.confirmButton}
                    onPress={isEditingPoll ? handleUpdatePoll : handleCreatePoll}
                  >
                    <Text style={styles.confirmButtonText}>
                      {isEditingPoll ? 'Update Poll' : 'Create Poll'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
          
          {/* Additional content to ensure scrollable content */}
          <View style={styles.spacer} />
        </ScrollView>
      </View>

      {/* Payment Verification Modal */}
      <Modal
        visible={showVerificationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowVerificationModal(false)}
      >
        {Platform.OS === 'web' ? (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedPaymentForVerification ? 'Verify Payment' : ''}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowVerificationModal(false);
                setAdjustedPaymentAmount('');
                setVerificationNotes('');
              }}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {selectedPaymentForVerification && (
              <ScrollView style={styles.modalScrollView}>
                <View style={styles.verificationPaymentInfo}>
                  <Text style={styles.verificationPaymentLabel}>Resident:</Text>
                  <Text style={styles.verificationPaymentValue}>
                    {(() => {
                      const resident = residentsMap.get(selectedPaymentForVerification.userId);
                      return resident ? `${resident.firstName} ${resident.lastName}` : 'Unknown';
                    })()}
                  </Text>
                </View>
                <View style={styles.verificationPaymentInfo}>
                  <Text style={styles.verificationPaymentLabel}>Fee Type:</Text>
                  <Text style={styles.verificationPaymentValue}>
                    {selectedPaymentForVerification.feeType}
                  </Text>
                </View>
                <View style={styles.verificationPaymentInfo}>
                  <Text style={styles.verificationPaymentLabel}>Transaction ID:</Text>
                  <Text style={styles.verificationPaymentValue}>
                    {selectedPaymentForVerification.venmoTransactionId || selectedPaymentForVerification.transactionId}
                  </Text>
                </View>
                
                {/* Payment Amount Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Amount *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter actual amount paid"
                    value={adjustedPaymentAmount}
                    onChangeText={(text) => {
                      // Allow only numbers and decimal point
                      const cleaned = text.replace(/[^0-9.]/g, '');
                      // Ensure only one decimal point
                      const parts = cleaned.split('.');
                      const formatted = parts.length > 2 
                        ? parts[0] + '.' + parts.slice(1).join('')
                        : cleaned;
                      setAdjustedPaymentAmount(formatted);
                    }}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#9ca3af"
                  />
                  <Text style={styles.inputDescription}>
                    Original amount: ${selectedPaymentForVerification.amount.toFixed(2)}
                  </Text>
                </View>

                {/* Fee Amount Comparison */}
                {(() => {
                  const feeId = selectedPaymentForVerification.feeId;
                  const fineId = selectedPaymentForVerification.fineId;
                  let feeAmount: number | null = null;
                  let feeName: string | null = null;
                  
                  if (feeId && allFeesFromDatabase) {
                    const fee = allFeesFromDatabase.find((f: any) => f._id === feeId);
                    if (fee) {
                      feeAmount = fee.amount;
                      feeName = fee.name;
                    }
                  } else if (fineId && allFinesFromDatabase) {
                    const fine = allFinesFromDatabase.find((f: any) => f._id === fineId);
                    if (fine) {
                      feeAmount = fine.amount;
                      feeName = fine.violation;
                    }
                  }
                  
                  const adjustedAmount = parseFloat(adjustedPaymentAmount) || 0;
                  const isPartialPayment = feeAmount !== null && adjustedAmount > 0 && adjustedAmount < feeAmount;
                  const isFullPayment = feeAmount !== null && adjustedAmount >= feeAmount;
                  
                  return feeAmount !== null ? (
                    <View style={styles.inputGroup}>
                      <View style={styles.verificationPaymentInfo}>
                        <Text style={styles.verificationPaymentLabel}>Fee Amount:</Text>
                        <Text style={styles.verificationPaymentValue}>
                          ${feeAmount.toFixed(2)} ({feeName})
                        </Text>
                      </View>
                      {adjustedAmount > 0 && (
                        <View style={[
                          styles.paymentComparisonContainer,
                          isPartialPayment && styles.partialPaymentWarning,
                          isFullPayment && styles.fullPaymentSuccess
                        ]}>
                          {isPartialPayment && (
                            <>
                              <Ionicons name="warning" size={20} color="#f59e0b" />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.paymentComparisonText}>
                                  Partial payment. Fee will remain Pending.
                                </Text>
                                <Text style={styles.paymentComparisonSubtext}>
                                  Remaining: ${(feeAmount - adjustedAmount).toFixed(2)}
                                </Text>
                              </View>
                            </>
                          )}
                          {isFullPayment && (
                            <>
                              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.paymentComparisonText}>
                                  Full payment. Fee will be marked as Paid.
                                </Text>
                                {adjustedAmount > feeAmount && (
                                  <Text style={styles.paymentComparisonSubtext}>
                                    Overpayment: ${(adjustedAmount - feeAmount).toFixed(2)} (will be ignored)
                                  </Text>
                                )}
                              </View>
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  ) : null;
                })()}
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Admin Notes (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Add notes about verification decision..."
                    value={verificationNotes}
                    onChangeText={setVerificationNotes}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.verificationActions}>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={async () => {
                      try {
                        await verifyVenmoPayment({
                          paymentId: selectedPaymentForVerification._id,
                          status: "Overdue",
                          verificationStatus: "Rejected",
                          adminNotes: verificationNotes.trim() || undefined,
                        });
                        Alert.alert('Success', 'Payment rejected.');
                        setShowVerificationModal(false);
                        setSelectedPaymentForVerification(null);
                        setVerificationNotes('');
                        setAdjustedPaymentAmount('');
                        await handleRefresh();
                      } catch (error) {
                        Alert.alert('Error', 'Failed to reject payment.');
                      }
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color="#ffffff" />
                    <Text style={styles.rejectButtonText}>Reject Payment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.verifyButton}
                    onPress={async () => {
                      try {
                        // Validate adjusted amount
                        const adjustedAmount = parseFloat(adjustedPaymentAmount);
                        if (isNaN(adjustedAmount) || adjustedAmount <= 0) {
                          Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than 0.');
                          return;
                        }

                        // Get fee amount for comparison
                        const feeId = selectedPaymentForVerification.feeId;
                        const fineId = selectedPaymentForVerification.fineId;
                        let feeAmount: number | null = null;
                        
                        if (feeId && allFeesFromDatabase) {
                          const fee = allFeesFromDatabase.find((f: any) => f._id === feeId);
                          if (fee) {
                            feeAmount = fee.amount;
                          }
                        } else if (fineId && allFinesFromDatabase) {
                          const fine = allFinesFromDatabase.find((f: any) => f._id === fineId);
                          if (fine) {
                            feeAmount = fine.amount;
                          }
                        }

                        // Determine if this is a partial payment
                        const isPartial = feeAmount !== null && adjustedAmount < feeAmount;
                        const finalStatus = isPartial ? "Pending" : "Paid";
                        
                        // Build admin notes
                        let finalAdminNotes = verificationNotes.trim();
                        if (isPartial && feeAmount !== null) {
                          const remaining = feeAmount - adjustedAmount;
                          finalAdminNotes = finalAdminNotes 
                            ? `${finalAdminNotes}\n\nPartial payment: $${adjustedAmount.toFixed(2)} of $${feeAmount.toFixed(2)}. Remaining: $${remaining.toFixed(2)}.`
                            : `Partial payment: $${adjustedAmount.toFixed(2)} of $${feeAmount.toFixed(2)}. Remaining: $${remaining.toFixed(2)}.`;
                        }

                        await verifyVenmoPayment({
                          paymentId: selectedPaymentForVerification._id,
                          status: finalStatus,
                          verificationStatus: "Verified",
                          adjustedAmount: adjustedAmount,
                          adminNotes: finalAdminNotes || undefined,
                        });
                        
                        const successMessage = isPartial 
                          ? `Payment verified (partial). Fee remains Pending.`
                          : 'Payment verified successfully!';
                        Alert.alert('Success', successMessage);
                        setShowVerificationModal(false);
                        setSelectedPaymentForVerification(null);
                        setVerificationNotes('');
                        setAdjustedPaymentAmount('');
                        await handleRefresh();
                      } catch (error) {
                        console.error('Verification error:', error);
                        Alert.alert('Error', 'Failed to verify payment.');
                      }
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                    <Text style={styles.verifyButtonText}>Verify Payment</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedPaymentForVerification ? 'Verify Payment' : ''}
                </Text>
                <TouchableOpacity onPress={() => {
                  setShowVerificationModal(false);
                  setAdjustedPaymentAmount('');
                  setVerificationNotes('');
                }}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {selectedPaymentForVerification && (
                <ScrollView style={styles.modalScrollView}>
                  <View style={styles.verificationPaymentInfo}>
                    <Text style={styles.verificationPaymentLabel}>Resident:</Text>
                    <Text style={styles.verificationPaymentValue}>
                      {(() => {
                        const resident = residentsMap.get(selectedPaymentForVerification.userId);
                        return resident ? `${resident.firstName} ${resident.lastName}` : 'Unknown';
                      })()}
                    </Text>
                  </View>
                  <View style={styles.verificationPaymentInfo}>
                    <Text style={styles.verificationPaymentLabel}>Fee Type:</Text>
                    <Text style={styles.verificationPaymentValue}>
                      {selectedPaymentForVerification.feeType}
                    </Text>
                  </View>
                  <View style={styles.verificationPaymentInfo}>
                    <Text style={styles.verificationPaymentLabel}>Transaction ID:</Text>
                    <Text style={styles.verificationPaymentValue}>
                      {selectedPaymentForVerification.venmoTransactionId || selectedPaymentForVerification.transactionId}
                    </Text>
                  </View>
                  
                  {/* Payment Amount Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Amount *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter actual amount paid"
                      value={adjustedPaymentAmount}
                      onChangeText={(text) => {
                        // Allow only numbers and decimal point
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        // Ensure only one decimal point
                        const parts = cleaned.split('.');
                        const formatted = parts.length > 2 
                          ? parts[0] + '.' + parts.slice(1).join('')
                          : cleaned;
                        setAdjustedPaymentAmount(formatted);
                      }}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#9ca3af"
                    />
                    <Text style={styles.inputDescription}>
                      Original amount: ${selectedPaymentForVerification.amount.toFixed(2)}
                    </Text>
                  </View>

                  {/* Fee Amount Comparison */}
                  {(() => {
                    const feeId = selectedPaymentForVerification.feeId;
                    const fineId = selectedPaymentForVerification.fineId;
                    let feeAmount: number | null = null;
                    let feeName: string | null = null;
                    
                    if (feeId && allFeesFromDatabase) {
                      const fee = allFeesFromDatabase.find((f: any) => f._id === feeId);
                      if (fee) {
                        feeAmount = fee.amount;
                        feeName = fee.name;
                      }
                    } else if (fineId && allFinesFromDatabase) {
                      const fine = allFinesFromDatabase.find((f: any) => f._id === fineId);
                      if (fine) {
                        feeAmount = fine.amount;
                        feeName = fine.violation;
                      }
                    }
                    
                    const adjustedAmount = parseFloat(adjustedPaymentAmount) || 0;
                    const isPartialPayment = feeAmount !== null && adjustedAmount > 0 && adjustedAmount < feeAmount;
                    const isFullPayment = feeAmount !== null && adjustedAmount >= feeAmount;
                    
                    return feeAmount !== null ? (
                      <View style={styles.inputGroup}>
                        <View style={styles.verificationPaymentInfo}>
                          <Text style={styles.verificationPaymentLabel}>Fee Amount:</Text>
                          <Text style={styles.verificationPaymentValue}>
                            ${feeAmount.toFixed(2)} ({feeName})
                          </Text>
                        </View>
                        {adjustedAmount > 0 && (
                          <View style={[
                            styles.paymentComparisonContainer,
                            isPartialPayment && styles.partialPaymentWarning,
                            isFullPayment && styles.fullPaymentSuccess
                          ]}>
                            {isPartialPayment && (
                              <>
                                <Ionicons name="warning" size={20} color="#f59e0b" />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.paymentComparisonText}>
                                    Partial payment. Fee will remain Pending.
                                  </Text>
                                  <Text style={styles.paymentComparisonSubtext}>
                                    Remaining: ${(feeAmount - adjustedAmount).toFixed(2)}
                                  </Text>
                                </View>
                              </>
                            )}
                            {isFullPayment && (
                              <>
                                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.paymentComparisonText}>
                                    Full payment. Fee will be marked as Paid.
                                  </Text>
                                  {adjustedAmount > feeAmount && (
                                    <Text style={styles.paymentComparisonSubtext}>
                                      Overpayment: ${(adjustedAmount - feeAmount).toFixed(2)} (will be ignored)
                                    </Text>
                                  )}
                                </View>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    ) : null;
                  })()}
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Admin Notes (Optional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      placeholder="Add notes about verification decision..."
                      value={verificationNotes}
                      onChangeText={setVerificationNotes}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.verificationActions}>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={async () => {
                        try {
                          await verifyVenmoPayment({
                            paymentId: selectedPaymentForVerification._id,
                            status: "Overdue",
                            verificationStatus: "Rejected",
                            adminNotes: verificationNotes.trim() || undefined,
                          });
                          Alert.alert('Success', 'Payment rejected.');
                          setShowVerificationModal(false);
                          setSelectedPaymentForVerification(null);
                          setVerificationNotes('');
                          setAdjustedPaymentAmount('');
                          await handleRefresh();
                        } catch (error) {
                          Alert.alert('Error', 'Failed to reject payment.');
                        }
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#ffffff" />
                      <Text style={styles.rejectButtonText}>Reject Payment</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.verifyButton}
                      onPress={async () => {
                        try {
                          // Validate adjusted amount
                          const adjustedAmount = parseFloat(adjustedPaymentAmount);
                          if (isNaN(adjustedAmount) || adjustedAmount <= 0) {
                            Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than 0.');
                            return;
                          }

                          // Get fee amount for comparison
                          const feeId = selectedPaymentForVerification.feeId;
                          const fineId = selectedPaymentForVerification.fineId;
                          let feeAmount: number | null = null;
                          
                          if (feeId && allFeesFromDatabase) {
                            const fee = allFeesFromDatabase.find((f: any) => f._id === feeId);
                            if (fee) {
                              feeAmount = fee.amount;
                            }
                          } else if (fineId && allFinesFromDatabase) {
                            const fine = allFinesFromDatabase.find((f: any) => f._id === fineId);
                            if (fine) {
                              feeAmount = fine.amount;
                            }
                          }

                          // Determine if this is a partial payment
                          const isPartial = feeAmount !== null && adjustedAmount < feeAmount;
                          const finalStatus = isPartial ? "Pending" : "Paid";
                          
                          // Build admin notes
                          let finalAdminNotes = verificationNotes.trim();
                          if (isPartial && feeAmount !== null) {
                            const remaining = feeAmount - adjustedAmount;
                            finalAdminNotes = finalAdminNotes 
                              ? `${finalAdminNotes}\n\nPartial payment: $${adjustedAmount.toFixed(2)} of $${feeAmount.toFixed(2)}. Remaining: $${remaining.toFixed(2)}.`
                              : `Partial payment: $${adjustedAmount.toFixed(2)} of $${feeAmount.toFixed(2)}. Remaining: $${remaining.toFixed(2)}.`;
                          }

                          await verifyVenmoPayment({
                            paymentId: selectedPaymentForVerification._id,
                            status: finalStatus,
                            verificationStatus: "Verified",
                            adjustedAmount: adjustedAmount,
                            adminNotes: finalAdminNotes || undefined,
                          });
                          
                          const successMessage = isPartial 
                            ? `Payment verified (partial). Fee remains Pending.`
                            : 'Payment verified successfully!';
                          Alert.alert('Success', successMessage);
                          setShowVerificationModal(false);
                          setSelectedPaymentForVerification(null);
                          setVerificationNotes('');
                          setAdjustedPaymentAmount('');
                          await handleRefresh();
                        } catch (error) {
                          console.error('Verification error:', error);
                          Alert.alert('Error', 'Failed to verify payment.');
                        }
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                      <Text style={styles.verifyButtonText}>Verify Payment</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        )}
      </Modal>

      {/* Receipt Image Viewer Modal */}
      <Modal
        visible={showReceiptViewer}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReceiptViewer(false)}
      >
        <View style={styles.receiptViewerOverlay}>
          <View style={styles.receiptViewerHeader}>
            <Text style={styles.receiptViewerTitle}>Receipt Screenshot</Text>
            <TouchableOpacity onPress={() => setShowReceiptViewer(false)}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          {selectedReceiptImage && (
            <View style={styles.receiptViewerContent}>
              <OptimizedImage
                source={selectedReceiptImage?.startsWith('http') ? selectedReceiptImage : undefined}
                storageId={selectedReceiptImage?.startsWith('http') ? undefined : selectedReceiptImage}
                style={styles.receiptViewerImage}
                contentFit="contain"
              />
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
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
  webScrollContent: {
    ...(Platform.OS === 'web' && {
      minHeight: '100vh' as any,
      flexGrow: 1,
      paddingBottom: 100 as any,
    }),
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
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
  headerImage: {
    borderRadius: 0,
    resizeMode: 'stretch',
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
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.9,
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  folderTabs: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 60,
    marginTop: 15,
    paddingBottom: 0,
    ...(Platform.OS === 'web' && {
      overflowX: 'auto' as any,
      overflowY: 'hidden' as any,
      WebkitOverflowScrolling: 'touch' as any,
    }),
  },
  folderTabsContent: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 4,
    paddingRight: 40,
    alignItems: 'center',
    minHeight: 45,
    flexGrow: 0,
    ...(Platform.OS === 'web' && {
      minWidth: 'max-content' as any,
    }),
  },
  folderTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6, // Reduced from 8
    marginRight: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 100, // Reduced minimum width for better fit
    flexShrink: 0, // Prevent tabs from shrinking
  },
  activeFolderTab: {
    backgroundColor: '#ffffff',
  },
  folderTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 6,
  },
  // Sub-tab styles for posts section
  subTabsContainer: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 150, // Limit height
    paddingBottom: 3,
    paddingTop: 3,
    //marginBottom: Platform.OS === 'web' ? 0 : 12, // Add spacing on mobile to prevent overlap
  },
  subTabsContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8, 
    marginRight: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeSubTab: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 6,
  },
  activeSubTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  activeFeesSubTab: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  activeFeesSubTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  // Community sub-tabs styles (separate for consistency)
  communitySubTabsContainer: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 60,
    paddingBottom: 3,
    paddingTop: 3,
  },
  communitySubTabsContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  communitySubTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeCommunitySubTab: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  communitySubTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 6,
  },
  activeCommunitySubTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  // Fees sub-tabs styles (separate for consistency)
  feesSubTabsContainer: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 150,
    paddingBottom: 3,
    paddingTop: 3,
  },
  feesSubTabsContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  feesSubTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeFeesSubTabStyle: {
    backgroundColor: '#eff6ff',
    borderColor: '#ec4899',
  },
  feesSubTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 6,
  },
  activeFeesSubTabTextStyle: {
    color: '#ec4899',
    fontWeight: '600',
  },
  activeFolderTabText: {
    color: '#ec4899',
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
    padding: 20,
    paddingTop: 0, // Reduce top padding to match CommunityScreen
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rowContent: {
    flex: 1,
  },
  residentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileImageContainer: {
    width: 40,
    height: 40,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  residentInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  rowSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  rowDetail: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  rowDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  badges: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  boardMemberBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blockedBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  rowActions: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    marginRight: 12,
  },
  modalBodyPadding: {
    padding: Platform.OS === 'web' ? 24 : 20,
    paddingHorizontal: Platform.OS === 'web' ? 24 : 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#374151',
    marginBottom: 20,
  },
  warningText: {
    fontSize: 14,
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Board member modal styles
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 4,
  },
  modalForm: {
    maxHeight: 400,
    padding: 20,
  },
  modalFormContent: {
    paddingBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#374151',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  hoaInfoContainer: {
    padding: 20,
  },
  shareQrSubtitle: {
    fontSize: 13,
    color: '#1d4ed8',
    marginTop: 8,
    marginBottom: 12,
    lineHeight: 18,
  },
  shareQrCard: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  shareQrCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareQrCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  shareQrCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    flexShrink: 1,
  },
  shareQrCodeWrap: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    backgroundColor: '#f9fafb',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionHeaderTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    minWidth: 0, // Allow button to shrink if needed
  },
  covenantButtonsContainer: {
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-end',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#eff6ff',
    marginRight: 8,
  },
  tabContent: {
    flex: 1,
  },
  // Board member display styles
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberInfo: {
    flex: 1,
  },
  bioText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Image upload styles
  imageSection: {
    alignItems: 'center',
  },
  imageContainer: {
    marginBottom: 12,
  },
  imageWrapper: {
    position: 'relative',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#e5e7eb',
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
  // Form modal styles
  formModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: Platform.OS === 'web' ? '90%' : '95%',
    maxHeight: Platform.OS === 'web' ? '80%' : Dimensions.get('window').height * 0.85,
    maxWidth: Platform.OS === 'web' ? 600 : '95%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  alertBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  highBadge: {
    backgroundColor: '#ef4444',
  },
  mediumBadge: {
    backgroundColor: '#f59e0b',
  },
  lowBadge: {
    backgroundColor: '#10b981',
  },
  emergencyBadge: {
    backgroundColor: '#dc2626',
  },
  alertBadge: {
    backgroundColor: '#f59e0b',
  },
  infoBadge: {
    backgroundColor: '#3b82f6',
  },
  activeBadge: {
    backgroundColor: '#10b981',
  },
  // Radio button styles
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  radioButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  radioButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  radioButtonTextActive: {
    color: '#ffffff',
  },
  // Checkbox styles
  checkboxButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  checkboxButtonActive: {
    // Add any active state styling if needed
  },
  checkboxText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  checkboxTextActive: {
    color: '#2563eb',
  },
  // Fee management styles
  feeStatsContainer: {
    marginBottom: 14,
    marginTop: 14,
  },
  feeStatsSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feeStatsSectionTitle: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  feeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  feeStatCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flex: 1,
  },
  feeStatLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  feeStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  feeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  feeAmount: {
    alignItems: 'center',
  },
  feeAmountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  feeLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  paymentStatusContainer: {
    alignItems: 'center',
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  paidBadge: {
    backgroundColor: '#d1fae5',
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  paidText: {
    color: '#065f46',
  },
  pendingText: {
    color: '#92400e',
  },
  profileImageText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  rowDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  // Enhanced fee management styles
  feeHeader: {
    flex: 1,
  },
  feeDueDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  feeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    margin: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  feesGridSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  feesGridSortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginRight: 4,
  },
  feesGridSortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  feesGridSortOptionActive: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  feesGridSortOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  feesGridSortOptionTextActive: {
    color: '#ffffff',
  },
  // Fees grid container for mobile/ narrow desktop
  feesGridContainerMobile: {
    // No negative margin needed - cards have their own margins
  },
  // Grid layout styles
  gridCard: {
    backgroundColor: '#ffffff',
    // Default desktop styles
    ...(Platform.OS === 'web' 
      ? { 
          flex: 1,
          margin: 6, 
          borderRadius: 12,
          width: '100%', // Fill the container width
        }
      : {
          flex: 1,
        }
    ),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gridCardContent: {
    padding: 12,
  },
  gridProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  multipleProfileImagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    height: 56, // Match single profile image height
    justifyContent: 'center',
  },
  multipleProfileImage: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  multipleProfileImageOverlap: {
    marginLeft: -12, // Overlap by 12px to show both images
  },
  gridProfileInfo: {
    flex: 1,
  },
  gridName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
    lineHeight: 18,
  },
  gridRole: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 1,
  },
  gridAddress: {
    fontSize: 10,
    color: '#9ca3af',
    lineHeight: 12,
  },
  gridFeeSection: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
  },
  gridFeeAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  gridFeeLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 6,
  },
  gridStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gridPaidBadge: {
    backgroundColor: '#d1fae5',
  },
  gridPartialPaidBadge: {
    backgroundColor: '#fef3c7',
  },
  gridNoFeeBadge: {
    backgroundColor: '#f3f4f6',
  },
  gridPendingBadge: {
    backgroundColor: '#fef3c7',
  },
  gridStatusText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  gridPartialPaymentText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '500',
    marginBottom: 4,
  },
  paymentMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  paymentMethodBadgeText: {
    fontSize: 10,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  // Admin fee management buttons
  feesSubTabContent: {
    marginTop: 0,
  },
  feesSubTabContentMobile: {
    marginTop: Platform.OS !== 'web' ? 12 : 0,
    paddingTop: Platform.OS !== 'web' ? 4 : 0,
  },
  adminFeeButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    paddingHorizontal: Platform.OS === 'web' ? 20 : 16,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  adminFeeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ec4899',
    borderRadius: 8,
    gap: 6,
    minHeight: 44,
    alignSelf: 'stretch',
    zIndex: 10,
    elevation: 10,
  },
  createPollButton: {
    paddingHorizontal: 16,
    flexShrink: 0,
  },
  adminFeeButtonPressed: {
    opacity: 0.7,
  },
  addFineButton: {
    backgroundColor: '#dc2626',
  },
  adminFeeButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    flexShrink: 1,
  },
  createPollButtonText: {
    flexShrink: 0,
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  paymentMethodSelected: {
    backgroundColor: '#059669',
  },
  paymentMethodText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  paymentMethodTextSelected: {
    color: '#ffffff',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalSearchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
    backgroundColor: '#f9fafb',
  },
  // Address selector styles for fine modal
  addressSelector: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  addressOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  addressOptionSelected: {
    backgroundColor: '#dbeafe',
    borderBottomColor: '#3b82f6',
  },
  addressOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  addressOptionTextSelected: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  addressOptionSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  addressOptionSubtextSelected: {
    color: '#3b82f6',
  },
  // Category picker styles
  categoryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  categoryPickerText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  categoryDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: 200,
    overflow: 'hidden',
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  categoryOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '400',
  },
  categoryOptionTextSelected: {
    color: '#2563eb',
    fontWeight: '500',
  },
  // Fee and fine list styles
  feesList: {
    maxHeight: 300,
  },
  feeItem: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fineItem: {
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  feeItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  feeItemAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  feeItemDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  feeItemDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  section: {
    marginBottom: 24,
  },
  // Grid fines section styles
  gridFeesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  gridFeesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridFeesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 4,
  },
  gridFeesList: {
    gap: 6,
  },
  gridFeeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  gridFeeItemLast: {
    borderBottomWidth: 0,
  },
  gridFeeLeft: {
    flex: 1,
    marginRight: 8,
  },
  gridFeeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  gridFeeDue: {
    fontSize: 11,
    color: '#9ca3af',
  },
  gridFeeRight: {
    alignItems: 'flex-end',
  },
  gridFeeItemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  gridFeeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  gridFeeStatusPaid: {
    backgroundColor: '#d1fae5',
  },
  gridFeeStatusPending: {
    backgroundColor: '#fef3c7',
  },
  gridFeeStatusText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  gridFinesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fafafa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  gridFinesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridFinesLabel: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  gridFinesList: {
    gap: 8,
  },
  gridFineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 50,
  },
  gridFineItemLast: {
    marginBottom: 0,
  },
  gridFineLeft: {
    flex: 1,
    marginRight: 8,
  },
  gridFineTitle: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 13,
  },
  gridFineDate: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '400',
    lineHeight: 11,
  },
  gridFineRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 65,
  },
  gridFineAmount: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '700',
    marginBottom: 4,
  },
  gridFineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 60,
    justifyContent: 'center',
  },
  gridFineStatusPaid: {
    backgroundColor: '#d1fae5',
  },
  gridFineStatusPartial: {
    backgroundColor: '#fef3c7',
  },
  gridFineStatusPending: {
    backgroundColor: '#fef2f2',
  },
  gridFineStatusText: {
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridFinePartialPaymentText: {
    fontSize: 9,
    color: '#f59e0b',
    fontWeight: '500',
    marginBottom: 2,
  },
  // Role statistics styles
  roleStatsContainer: {
    marginBottom: 16,
  },
  roleStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  roleStatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  roleStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  roleStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  // Resident card styles
  residentCard: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  residentCardContent: {
    padding: 12,
  },
  residentMainInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  residentAvatar: {
    marginRight: 12,
  },
  residentAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  residentAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  residentAvatarText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  residentDetails: {
    flex: 1,
  },
  residentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  residentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 10,
  },
  primaryRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  primaryRoleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  residentEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  residentAddress: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
  },
  secondaryRoles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  secondaryRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 3,
  },
  secondaryRoleText: {
    fontSize: 10,
    fontWeight: '500',
  },
  residentActions: {
    alignItems: 'flex-end',
  },
  unblockButton: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  blockButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  removeButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  removeConfirmButton: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
    color: '#374151',
  },
  // Grid-specific resident card styles
  residentGridCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  residentGridCardContent: {
    padding: 8,
    flex: 1,
  },
  residentGridMainInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    flex: 1,
  },
  residentGridDetails: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  residentGridNameRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: Platform.OS === 'web' ? 'flex-start' : 'stretch',
    justifyContent: Platform.OS === 'web' ? 'space-between' : 'flex-start',
    marginBottom: 3,
    flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap',
  },
  residentGridName: {
    fontSize: Platform.OS === 'web' ? 13 : 14,
    fontWeight: '600',
    color: '#1f2937',
    flex: Platform.OS === 'web' ? 1 : undefined,
    marginRight: Platform.OS === 'web' ? 8 : 0,
    marginBottom: Platform.OS === 'web' ? 0 : 4,
    lineHeight: Platform.OS === 'web' ? 15 : 18,
  },
  residentGridRoleBadgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Platform.OS === 'web' ? 4 : 3,
    marginTop: 0,
    alignSelf: Platform.OS === 'web' ? 'flex-start' : 'flex-start',
  },
  residentGridRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Platform.OS === 'web' ? 6 : 5,
    paddingVertical: Platform.OS === 'web' ? 2 : 3,
    borderRadius: Platform.OS === 'web' ? 6 : 8,
    gap: Platform.OS === 'web' ? 3 : 2,
    alignSelf: 'flex-start',
    marginBottom: Platform.OS !== 'web' ? 2 : 0, // Add bottom margin on mobile for wrapped badges
  },
  residentGridRoleText: {
    fontSize: Platform.OS === 'web' ? 9 : 10,
    fontWeight: '600',
    lineHeight: Platform.OS === 'web' ? 12 : 14,
  },
  residentGridEmail: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 1,
    lineHeight: 12,
  },
  residentGridAddress: {
    fontSize: 9,
    color: '#9ca3af',
    marginBottom: 3,
    lineHeight: 11,
  },
  residentGridAvatar: {
    marginRight: 6,
  },
  postAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  postAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postTitleText: {
    fontSize: Platform.OS === 'web' ? 13 : 14,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: Platform.OS === 'web' ? 18 : 20,
    marginBottom: 4,
  },
  postDateText: {
    fontSize: Platform.OS === 'web' ? 10 : 11,
    color: '#9ca3af',
    marginBottom: 6,
    lineHeight: Platform.OS === 'web' ? 14 : 16,
  },
  postContentText: {
    fontSize: Platform.OS === 'web' ? 12 : 13,
    color: '#374151',
    lineHeight: Platform.OS === 'web' ? 18 : 20,
    marginTop: 4,
    marginBottom: 8,
    flexShrink: 1,
  },
  residentGridActions: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  residentGridActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  residentGridActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  residentGridActionText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#374151',
  },
  // Board-specific action button styles
  boardActionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  boardActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  activateButton: {
    backgroundColor: '#dcfce7',
  },
  deactivateButton: {
    backgroundColor: '#fef3c7',
  },
  // Pet image styles
  petImageAvatar: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#e5e7eb',
    alignSelf: 'center',
  },
  petCardImage: {
    width: '100%',
    height: '100%',
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
  petCardImageContainer: {
    alignItems: 'center',
    marginBottom: 14,
  },
  petCardTextContent: {
    alignItems: 'center',
    marginBottom: 14,
    minHeight: 80,
  },
  petCardNameRow: {
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  petCardName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  petCardDate: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8,
  },
  petCardOwner: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 6,
    fontWeight: '500',
  },
  petCardAddress: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  // Pet grid layout styles
  petsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 8,
  },
  petsGridContainerSingleColumn: {
    paddingHorizontal: 16,
  },
  petCardWrapper: {
    width: '47%',
    minWidth: 200,
  },
  petCardWrapperSingleColumn: {
    width: '100%',
    minWidth: 0,
  },
  petCardWrapperDesktop: {
    width: '30%',
  },
  petCardImageContainerSingleColumn: {
    marginBottom: 16,
  },
  petImageAvatarSingleColumn: {
    width: 160,
    height: 160,
  },
  petGridCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  petGridCardContent: {
    padding: 16,
  },
  petCardActions: {
    marginTop: 12,
    alignItems: 'center',
  },
  petCardActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  petCardActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  adminPetsInGroupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  adminPetInGroupItem: {
    alignItems: 'center',
    minWidth: 100,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  adminPetThumbnail: {
    marginBottom: 8,
  },
  adminPetAvatarSmall: {
    width: 80,
    height: 80,
  },
  adminPetInfoRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  // Poll styles
  pollOptionsContainer: {
    marginVertical: 12,
  },
  pollOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#e5e7eb',
  },
  pollOptionText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
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
  pollOptionContent: {
    flex: 1,
  },
  winningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  winningBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
    marginLeft: 4,
  },
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
  // Post card styles (for poll display)
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
    borderLeftColor: '#2563eb',
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
  postContent: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  actionText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  // Payment verification styles
  paymentList: {
    padding: 8,
  },
  paymentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentResidentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  paymentFeeType: {
    fontSize: 14,
    color: '#6b7280',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  paymentDetails: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  paymentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentDetailText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 8,
    flex: 1,
  },
  paymentCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  // Compact payment styles for Fees tab
  pendingPaymentsSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    margin: Platform.OS === 'web' ? 16 : 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fef3c7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pendingPaymentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingPaymentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#78350f',
    marginLeft: 8,
  },
  compactPaymentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 180,
    maxWidth: 250,
    width: Platform.OS === 'web' ? 220 : Dimensions.get('window').width * 0.75,
    borderWidth: 1,
    borderColor: '#fef3c7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  compactPaymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  compactPaymentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  compactPaymentAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  compactPaymentFee: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  compactPaymentVenmo: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  compactPaymentDate: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 4,
  },
  compactPaymentTransactionId: {
    fontSize: 10,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  compactPaymentActions: {
    flexDirection: 'row',
    gap: 6,
  },
  compactRejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  compactVerifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  compactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  spacer: {
    height: 50,
  },
  // Modern Residents Management Styles
  residentsHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  residentsHeaderContainerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
  },
  residentsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  residentsHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  residentsHeaderText: {
    flex: 1,
  },
  residentsHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  residentsHeaderTitleMobile: {
    fontSize: 18,
  },
  residentsHeaderSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  residentsHeaderSubtitleMobile: {
    fontSize: 13,
  },
  addPastDueHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ec4899',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
  },
  addPastDueHeaderButtonMobile: {
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addPastDueHeaderButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  addPastDueHeaderButtonIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ec4899',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
    flexShrink: 0,
  },
  addPastDueHeaderButtonTextIntegrated: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  residentsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 0,
    gap: 16,
  },
  residentsSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  residentsSectionHeaderTextContainer: {
    flex: 1,
  },
  residentsSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  residentsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  residentsSectionBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  residentsSectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ec4899',
  },
  residentsSectionDesktop: {
    marginBottom: 32,
    paddingBottom: 0,
  },
  residentsSectionMobile: {
    marginBottom: 24,
    paddingBottom: 0,
  },
  residentsListContainer: {
    gap: 12,
  },
  // Table/Chart layout for better scalability
  residentsTableScrollView: {
    flex: 1,
  },
  residentsTableScrollContent: {
    minWidth: 800,
  },
  residentsTableContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    minWidth: 800,
  },
  residentsTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  residentsTableHeaderCell: {
    paddingHorizontal: 8,
  },
  residentsTableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  residentsTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  residentsTableRowEven: {
    backgroundColor: '#fafafa',
  },
  residentsTableCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  residentsTableCellName: {
    flex: 2,
    minWidth: 180,
  },
  residentsTableCellAddress: {
    flex: 2,
    minWidth: 150,
  },
  residentsTableCellStatus: {
    flex: 1.2,
    minWidth: 100,
  },
  residentsTableCellPaymentMethod: {
    flex: 1.2,
    minWidth: 110,
  },
  residentsTablePaymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  residentsTablePaymentMethodText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  residentsTableCellAmount: {
    flex: 1,
    minWidth: 90,
    alignItems: 'flex-end',
  },
  residentsTableCellAction: {
    flex: 0.6,
    minWidth: 60,
    alignItems: 'center',
  },
  residentsTableNameContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  residentsTableProfileImage: {
    marginRight: 0,
  },
  residentsTableNameText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  residentsTableName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  residentsTableBadge: {
    backgroundColor: '#6b7280',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  residentsTableBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  residentsTableAddress: {
    fontSize: 13,
    color: '#6b7280',
  },
  residentsTableStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  residentsTableStatusText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  residentsTableAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  residentsTableActionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  residentsModernCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  residentsCardDesktop: {
    padding: 20,
  },
  residentsCardMobile: {
    padding: 16,
  },
  residentsCardWithOutstanding: {
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  residentsCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  residentsCardContentMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  residentsCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  residentsCardLeftMobile: {
    marginRight: 0,
    marginBottom: 12,
  },
  residentsCardIcon: {
    marginRight: 16,
  },
  residentsCardProfileImage: {
    marginRight: 16,
  },
  residentsCardInfo: {
    flex: 1,
  },
  residentsCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  residentsCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  residentsCardDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  residentsCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  residentsCardDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  residentsCardAddress: {
    fontSize: 13,
    color: '#6b7280',
  },
  residentsCardFeeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  residentsCardFeeStatusText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '600',
  },
  // Accordion styles
  residentsAccordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    cursor: 'pointer',
  },
  residentsAccordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  residentsAccordionHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  residentsAccordionHeaderRight: {
    marginLeft: 12,
  },
  residentsAccordionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 4,
  },
  residentsAccordionSummary: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  residentsAccordionProfileImage: {
    marginRight: 12,
  },
  residentsAccordionContent: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  residentsAccordionSectionContent: {
    paddingTop: 20,
  },
  residentsSectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  residentsSectionSubtitleAmount: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
  },
  updateAllDuesContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  updateAllDuesDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  updateAllDuesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  updateAllDuesButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  updateAllDuesHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ec4899',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
    flexShrink: 0,
  },
  updateAllDuesHeaderButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  residentsCardRight: {
    alignItems: 'flex-end',
    gap: 12,
  },
  residentsCardRightMobile: {
    alignItems: 'flex-start',
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  residentsCardAmountContainer: {
    alignItems: 'flex-end',
  },
  residentsCardAmountContainerMobile: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  residentsCardAmountLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  residentsCardAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563eb',
  },
  residentsUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    gap: 6,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  residentsUpdateButtonMobile: {
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  residentsUpdateButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  paymentSearchIcon: {
    marginRight: 8,
  },
  paymentSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    paddingVertical: 10,
  },
  paymentSearchClear: {
    marginLeft: 8,
  },
  transactionsList: {
    flex: 1,
    marginTop: 8,
  },
  transactionsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loadMoreContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    gap: 8,
    minWidth: 140,
  },
  loadMoreButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  loadMoreAllText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  transactionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transactionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  transactionStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  transactionStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  transactionVerificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  transactionVerificationText: {
    fontSize: 10,
    fontWeight: '500',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  transactionDetails: {
    gap: 8,
  },
  transactionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transactionDetailText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  pendingPaymentsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactPaymentAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 4,
  },
  viewReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 8,
    gap: 6,
  },
  viewReceiptText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 20 : 10,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 500 : '95%',
    maxHeight: Platform.OS === 'web' ? '80%' : '90%',
    marginHorizontal: Platform.OS === 'web' ? 0 : 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalScrollView: {
    padding: Platform.OS === 'web' ? 20 : 16,
  },
  verificationPaymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  verificationPaymentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  verificationPaymentValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  verificationActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: Platform.OS === 'web' ? 14 : 16,
    minHeight: Platform.OS === 'web' ? undefined : 44,
    borderRadius: 8,
    gap: 8,
  },
  rejectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: Platform.OS === 'web' ? 14 : 16,
    minHeight: Platform.OS === 'web' ? undefined : 44,
    borderRadius: 8,
    gap: 8,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentComparisonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  partialPaymentWarning: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  fullPaymentSuccess: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  paymentComparisonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  paymentComparisonSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    width: '100%',
  },
  correctAmountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingVertical: Platform.OS === 'web' ? 8 : 12,
    paddingHorizontal: 12,
    minHeight: Platform.OS === 'web' ? undefined : 44,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  correctAmountButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  receiptViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptViewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    zIndex: 1,
  },
  receiptViewerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  receiptViewerContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  receiptViewerImage: {
    width: '100%',
    height: '100%',
    maxWidth: 800,
    maxHeight: 800,
  },
  residentsAddPastDueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  residentsAddPastDueButtonMobile: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    justifyContent: 'center',
  },
  residentsAddPastDueButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  residentsOutstandingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  residentsOutstandingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  residentsEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  residentsEmptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
  },
  residentsEmptyStateSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Legacy styles kept for backward compatibility
  feeListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  feeListItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  feeListItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  feeListItemDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  feeListItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  updateButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  residentListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  residentListItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  residentListItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  residentListItemAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  residentListItemFees: {
    fontSize: 12,
    color: '#9ca3af',
  },
  addPastDueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  addPastDueButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  gridCardTapHint: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 4,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gridCardTapHintText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },

});

export default AdminScreen;
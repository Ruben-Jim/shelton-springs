import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ImageBackground,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { useStorageUrl } from '../hooks/useStorageUrl';
import { Linking, ActivityIndicator } from 'react-native';
import BoardMemberIndicator from '../components/BoardMemberIndicator';
import DeveloperIndicator from '../components/DeveloperIndicator';
import CustomTabBar from '../components/CustomTabBar';
import MobileTabBar from '../components/MobileTabBar';
import MessagingButton from '../components/MessagingButton';
import { useMessaging } from '../context/MessagingContext';

const CovenantsScreen = () => {
  const { user } = useAuth();
  const { setShowOverlay } = useMessaging();
  const isBoardMember = user?.isBoardMember && user?.isActive;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hoaInfo = useQuery(api.hoaInfo.get);
  const ccrsPdfUrl = useStorageUrl(hoaInfo?.ccrsPdfStorageId || null);

  // State for dynamic responsive behavior (only for web/desktop)
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  // Dynamic responsive check - show mobile nav when screen is too narrow for desktop nav
  // On mobile, always show mobile nav regardless of screen size
  const isMobileDevice = Platform.OS === 'ios' || Platform.OS === 'android';
  const showMobileNav = isMobileDevice || screenWidth < 1024; // Always mobile on mobile devices, responsive on web
  const showDesktopNav = !isMobileDevice && screenWidth >= 1024; // Only desktop nav on web when wide enough

  // ScrollView ref for better control
  const scrollViewRef = useRef<ScrollView>(null);

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
        }
      }, 100);
      
      return () => {
        document.body.style.cursor = 'default';
      };
    }
  }, [screenWidth, showMobileNav, showDesktopNav]);

  const categories = ['Architecture', 'Landscaping', 'Minutes', 'Caveats', 'General'];
  const [covenantsLimit, setCovenantsLimit] = useState(50);
  const covenantsData = useQuery(api.covenants.getPaginated, { limit: covenantsLimit, offset: 0 });
  const covenants = covenantsData?.items ?? [];

  const filteredCovenants = covenants.filter((covenant: any) => {
    const matchesSearch = covenant.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         covenant.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || covenant.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Architecture':
        return 'home';
      case 'Landscaping':
        return 'leaf';
      case 'Minutes':
        return 'clipboard';
      case 'Caveats':
        return 'warning';
      case 'General':
        return 'document-text';
      default:
        return 'document-text';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Architecture':
        return '#3b82f6';
      case 'Landscaping':
        return '#10b981';
      case 'Minutes':
        return '#06b6d4';
      case 'Caveats':
        return '#f59e0b';
      case 'General':
        return '#6b7280';
      default:
        return '#6b7280';
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
        <View style={styles.headerContainerIOS}>
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
              <View style={styles.titleContainer}>
                <Text style={styles.headerTitle}>Covenants & Rules</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Community guidelines and regulations
              </Text>
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
        </View>

        {/* Custom Tab Bar - Only when screen is wide enough */}
        {showDesktopNav && (
          <CustomTabBar />
        )}
      
      {/* CC&Rs PDF View Button */}
      {ccrsPdfUrl && (
        <View style={styles.ccrsContainer}>
          <TouchableOpacity
            style={styles.ccrsButton}
            onPress={() => {
              if (ccrsPdfUrl) {
                Linking.openURL(ccrsPdfUrl).catch((err) => {
                  console.error('Error opening CC&Rs PDF:', err);
                  Alert.alert('Error', 'Unable to open PDF. Please try again.');
                });
              }
            }}
          >
            <Ionicons name="document-text" size={20} color="#2563eb" />
            <Text style={styles.ccrsButtonText}>View CC&Rs PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search covenants..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.categoryContainer}>
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
              style={[
                styles.categoryButton,
                !selectedCategory && styles.categoryButtonActive
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[
                styles.categoryButtonText,
                !selectedCategory && styles.categoryButtonTextActive
              ]}>
                All
              </Text>
            </TouchableOpacity>
            
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonActive
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.categoryButtonText,
                  selectedCategory === category && styles.categoryButtonTextActive
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Covenants List */}
      <View style={styles.covenantsContainer}>
        {filteredCovenants.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyStateText}>No covenants found</Text>
            <Text style={styles.emptyStateSubtext}>
              Try adjusting your search or filter criteria
            </Text>
          </View>
        ) : (
          filteredCovenants.map((covenant: any) => (
            <View key={covenant._id} style={styles.covenantCard}>
              <View style={styles.covenantHeader}>
                <View style={styles.covenantIcon}>
                  <Ionicons 
                    name={getCategoryIcon(covenant.category) as any} 
                    size={24} 
                    color={getCategoryColor(covenant.category)} 
                  />
                </View>
                <View style={styles.covenantInfo}>
                  <Text style={styles.covenantTitle}>{covenant.title}</Text>
                  <Text style={styles.covenantCategory}>{covenant.category}</Text>
                </View>
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => Alert.alert('Covenant Details', covenant.description)}
                >
                  {/* <Ionicons name="ellipsis-vertical" size={20} color="#6b7280" /> */}
                </TouchableOpacity>
              </View>
              
              <Text style={styles.covenantDescription} numberOfLines={3}>
                {covenant.description}
              </Text>
              
              <View style={styles.covenantFooter}>
                <Text style={styles.covenantDate}>
                  Last updated: {formatDate(covenant.lastUpdated)}
                </Text>
                {covenant.pdfUrl && (
                  <TouchableOpacity style={styles.pdfButton}>
                    <Ionicons name="document" size={16} color="#2563eb" />
                    <Text style={styles.pdfButtonText}>View PDF</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>About Covenants</Text>
        <Text style={styles.infoText}>
        <Text style={styles.infoText}>
          Please be aware that the summaries provided above are brief highlights of the community regulations;
          for a complete and authoritative understanding of all rules, rights, and obligations,
          you should refer to the full descriptions contained within the official Shelton Springs CC&R PDF.
        </Text>
        </Text>
        <Text style={styles.infoText}>
          Covenants, Conditions, and Restrictions (CC&Rs) are the rules and regulations that govern our community. 
          All residents are required to follow these guidelines to maintain the quality and appearance of our neighborhood.
        </Text>
        <Text style={styles.infoText}>
          If you have questions about any covenant or need to request approval for modifications, 
          please contact the architectural committee or HOA board.
        </Text>
      </View>
      </ScrollView>
      </View>
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
  scrollContainer: {
    flex: 1,
  },
  webScrollContainer: {
    ...(Platform.OS === 'web' && {
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
    gap: 12,
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
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
  searchContainer: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#374151',
  },
  categoryContainer: {
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
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
    backgroundColor: '#22c55e',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#ffffff',
  },
  covenantsContainer: {
    padding: 15,
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
  covenantCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  covenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  covenantIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  covenantInfo: {
    flex: 1,
  },
  covenantTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  covenantCategory: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  moreButton: {
    padding: 4,
  },
  covenantDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  covenantFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  covenantDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
  },
  pdfButtonText: {
    fontSize: 12,
    color: '#2563eb',
    marginLeft: 4,
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: '#ffffff',
    margin: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  ccrsContainer: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  ccrsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    gap: 8,
  },
  ccrsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});

export default CovenantsScreen; 
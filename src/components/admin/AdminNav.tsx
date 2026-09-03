import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ADMIN_MOBILE_MORE_TABS,
  ADMIN_MOBILE_PRIMARY_TABS,
  ADMIN_NAV_GROUPS,
  findAdminNavItem,
} from './adminNavConfig';
import { AdminNavBadges, AdminTabId } from './types';

/** Bottom admin tab bar content height (icon + label + padding). */
export const ADMIN_MOBILE_TAB_BAR_HEIGHT = 52;

type AdminNavProps = {
  activeTab: AdminTabId;
  onTabChange: (tab: AdminTabId) => void;
  badges?: AdminNavBadges;
  variant: 'sidebar' | 'horizontal' | 'mobile-bar';
  onMorePress?: () => void;
  onNavigateHome?: () => void;
};

function NavBadge({ count, inline }: { count: number; inline?: boolean }) {
  if (!count || count <= 0) return null;
  return (
    <View style={[styles.badge, inline && styles.badgeInline]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

function getBadgeCount(item: { badgeKey?: keyof AdminNavBadges }, badges?: AdminNavBadges) {
  if (!item.badgeKey || !badges) return 0;
  return badges[item.badgeKey] ?? 0;
}

export default function AdminNav({
  activeTab,
  onTabChange,
  badges,
  variant,
  onMorePress,
  onNavigateHome,
}: AdminNavProps) {
  const horizontalScrollRef = useRef<ScrollView>(null);

  // Mouse-drag scrolling for the horizontal nav on web (mobile/tablet resolution)
  useEffect(() => {
    if (Platform.OS !== 'web' || variant !== 'horizontal') return;
    const node = (horizontalScrollRef.current as any)?.getScrollableNode?.();
    if (!node) return;

    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      startX = e.pageX;
      startScrollLeft = node.scrollLeft;
      node.style.cursor = 'grabbing';
      node.style.userSelect = 'none';
    };
    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;
      node.style.cursor = 'grab';
      node.style.userSelect = 'auto';
    };
    const onMouseLeave = () => {
      if (!isDown) return;
      isDown = false;
      node.style.cursor = 'grab';
      node.style.userSelect = 'auto';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      node.scrollLeft = startScrollLeft - (e.pageX - startX);
    };

    node.style.cursor = 'grab';
    node.addEventListener('mousedown', onMouseDown);
    node.addEventListener('mouseleave', onMouseLeave);
    node.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      node.removeEventListener('mousedown', onMouseDown);
      node.removeEventListener('mouseleave', onMouseLeave);
      node.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [variant]);

  if (variant === 'sidebar') {
    return (
      <View style={styles.sidebar}>
        <View style={styles.sidebarBrand}>
          <Ionicons name="settings" size={20} color="#2563eb" />
          <Text style={styles.sidebarBrandText}>Admin</Text>
        </View>
        <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
          {ADMIN_NAV_GROUPS.map((group) => (
            <View key={group.title || 'overview'} style={styles.sidebarGroup}>
              {group.title ? <Text style={styles.sidebarGroupTitle}>{group.title}</Text> : null}
              {group.items.map((item) => {
                const active = activeTab === item.id;
                const badgeCount = getBadgeCount(item, badges);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.sidebarItem, active && styles.sidebarItemActive]}
                    onPress={() => onTabChange(item.id)}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color={active ? '#2563eb' : '#6b7280'}
                    />
                    <Text style={[styles.sidebarItemText, active && styles.sidebarItemTextActive]}>
                      {item.label}
                    </Text>
                    <NavBadge count={badgeCount} inline />
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
        {onNavigateHome ? (
          <View style={styles.sidebarFooterWrap}>
            <TouchableOpacity style={styles.sidebarFooter} onPress={onNavigateHome}>
              <Ionicons name="arrow-back-outline" size={18} color="#4b5563" />
              <Text style={styles.sidebarFooterText}>Leave Admin Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  if (variant === 'mobile-bar') {
    const moreActive = ADMIN_MOBILE_MORE_TABS.includes(activeTab);
    return (
      <View style={styles.mobileBar}>
        {ADMIN_MOBILE_PRIMARY_TABS.map((tabId) => {
          const item = findAdminNavItem(tabId)!;
          const active = activeTab === tabId;
          const badgeCount = getBadgeCount(item, badges);
          return (
            <TouchableOpacity
              key={tabId}
              style={[styles.mobileBarItem, active && styles.mobileBarItemActive]}
              onPress={() => onTabChange(tabId)}
            >
              <View style={styles.mobileBarIconWrap}>
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={active ? '#2563eb' : '#6b7280'}
                />
                <NavBadge count={badgeCount} />
              </View>
              <Text style={[styles.mobileBarLabel, active && styles.mobileBarLabelActive]} numberOfLines={1}>
                {item.shortLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.mobileBarItem, moreActive && styles.mobileBarItemActive]}
          onPress={onMorePress}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={moreActive ? '#2563eb' : '#6b7280'} />
          <Text style={[styles.mobileBarLabel, moreActive && styles.mobileBarLabelActive]}>More</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // horizontal fallback (tablet / mobile-web)
  return (
    <ScrollView
      ref={horizontalScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.horizontalNav}
      contentContainerStyle={styles.horizontalNavContent}
    >
      {ADMIN_NAV_GROUPS.flatMap((group) => group.items).map((item) => {
        const active = activeTab === item.id;
        const badgeCount = getBadgeCount(item, badges);
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.horizontalTab, active && styles.horizontalTabActive]}
            onPress={() => onTabChange(item.id)}
          >
            <Ionicons name={item.icon as any} size={18} color={active ? '#2563eb' : '#6b7280'} />
            <Text style={[styles.horizontalTabText, active && styles.horizontalTabTextActive]}>
              {item.shortLabel}
            </Text>
            <NavBadge count={badgeCount} inline />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function AdminMobileMoreSheet({
  visible,
  activeTab,
  onTabChange,
  onClose,
  badges,
}: {
  visible: boolean;
  activeTab: AdminTabId;
  onTabChange: (tab: AdminTabId) => void;
  onClose: () => void;
  badges?: AdminNavBadges;
}) {
  if (!visible) return null;
  return (
    <View style={styles.moreSheetOverlay}>
      <TouchableOpacity style={styles.moreSheetBackdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.moreSheet}>
        <Text style={styles.moreSheetTitle}>More admin sections</Text>
        {ADMIN_MOBILE_MORE_TABS.map((tabId) => {
          const item = findAdminNavItem(tabId)!;
          const active = activeTab === tabId;
          const badgeCount = getBadgeCount(item, badges);
          return (
            <TouchableOpacity
              key={tabId}
              style={[styles.moreSheetItem, active && styles.moreSheetItemActive]}
              onPress={() => {
                onTabChange(tabId);
                onClose();
              }}
            >
              <Ionicons name={item.icon as any} size={20} color={active ? '#2563eb' : '#6b7280'} />
              <Text style={[styles.moreSheetItemText, active && styles.moreSheetItemTextActive]}>
                {item.label}
              </Text>
              <NavBadge count={badgeCount} inline />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 248,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    paddingTop: 16,
    paddingBottom: 12,
    alignSelf: 'stretch',
    flexDirection: 'column',
    ...(Platform.OS === 'web' && {
      overflow: 'auto' as any,
    }),
  },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 10,
  },
  sidebarBrandText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarFooterWrap: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  sidebarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
  },
  sidebarFooterText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4b5563',
  },
  sidebarGroup: {
    marginBottom: 8,
  },
  sidebarGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
  },
  sidebarItemActive: {
    backgroundColor: '#eff6ff',
  },
  sidebarItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#4b5563',
  },
  sidebarItemTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  horizontalNav: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 52,
  },
  horizontalNavContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  horizontalTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  horizontalTabActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  horizontalTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  horizontalTabTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  mobileBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingBottom: Platform.OS === 'ios' ? 4 : 0,
    ...(Platform.OS === 'web' && {
      borderTopWidth: 0,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    }),
  },
  mobileBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  mobileBarItemActive: {
    backgroundColor: '#f8fafc',
  },
  mobileBarIconWrap: {
    position: 'relative',
    marginBottom: 2,
  },
  mobileBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  mobileBarLabelActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -6,
    right: -10,
  },
  badgeInline: {
    position: 'relative',
    top: 0,
    right: 0,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  moreSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  moreSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  moreSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 24,
  },
  moreSheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  moreSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  moreSheetItemActive: {
    backgroundColor: '#eff6ff',
  },
  moreSheetItemText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  moreSheetItemTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
});

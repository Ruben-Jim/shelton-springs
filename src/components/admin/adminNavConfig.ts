import { AdminNavBadges, AdminTabId } from './types';

export type AdminNavItem = {
  id: AdminTabId;
  label: string;
  shortLabel: string;
  icon: string;
  badgeKey?: keyof AdminNavBadges;
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: '',
    items: [{ id: 'overview', label: 'Overview', shortLabel: 'Home', icon: 'grid' }],
  },
  {
    title: 'People',
    items: [
      { id: 'residents', label: 'Residents', shortLabel: 'Residents', icon: 'people', badgeKey: 'residents' },
      { id: 'board', label: 'Board', shortLabel: 'Board', icon: 'shield' },
      { id: 'communications', label: 'Send Notice', shortLabel: 'Notice', icon: 'mail' },
    ],
  },
  {
    title: 'Content',
    items: [
      { id: 'covenants', label: 'Covenants', shortLabel: 'Rules', icon: 'document-text' },
      {
        id: 'Community',
        label: 'Community',
        shortLabel: 'Community',
        icon: 'chatbubbles',
        badgeKey: 'community',
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        id: 'fees',
        label: 'Fees & Payments',
        shortLabel: 'Fees',
        icon: 'card',
        badgeKey: 'pendingPayments',
      },
    ],
  },
  {
    title: 'Settings',
    items: [{ id: 'SheltonHOA', label: 'HOA Information', shortLabel: 'Settings', icon: 'business' }],
  },
];

export const ADMIN_MOBILE_PRIMARY_TABS: AdminTabId[] = ['overview', 'residents', 'Community', 'fees'];

export const ADMIN_MOBILE_MORE_TABS: AdminTabId[] = ['board', 'communications', 'covenants', 'SheltonHOA'];

export function findAdminNavItem(tabId: AdminTabId): AdminNavItem | undefined {
  for (const group of ADMIN_NAV_GROUPS) {
    const item = group.items.find((entry) => entry.id === tabId);
    if (item) return item;
  }
  return undefined;
}

export type AdminTabId =
  | 'overview'
  | 'SheltonHOA'
  | 'residents'
  | 'board'
  | 'covenants'
  | 'Community'
  | 'fees';

export type CommunitySubTab = 'damage' | 'complaints' | 'posts' | 'comments' | 'polls' | 'pets';

export type AdminNavBadgeKey =
  | 'residents'
  | 'board'
  | 'community'
  | 'complaints'
  | 'pendingPayments'
  | 'pendingDamage';

export type AdminNavBadges = Partial<Record<AdminNavBadgeKey, number>>;

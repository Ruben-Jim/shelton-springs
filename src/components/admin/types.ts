export type AdminTabId =
  | 'overview'
  | 'SheltonHOA'
  | 'residents'
  | 'board'
  | 'communications'
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
  | 'pendingDamage'
  | 'pendingComments';

export type AdminNavBadges = Partial<Record<AdminNavBadgeKey, number>>;

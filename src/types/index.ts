export interface BoardMember {
  id: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  image?: string;
  termEnd: string;
}

export interface Covenant {
  id: string;
  title: string;
  description: string;
  category: string;
  lastUpdated: string;
  pdfUrl?: string;
  /** Convex storage ID for attached document or optimized image */
  fileStorageId?: string;
}

export interface Fee {
  id: string;
  name: string;
  amount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Annually' | 'One-time';
  dueDate: string;
  description: string;
  isLate: boolean;
}

export interface Fine {
  id: string;
  violation: string;
  amount: number;
  dateIssued: string;
  dueDate: string;
  status: 'Pending' | 'Partial' | 'Paid' | 'Overdue';
  description: string;
  residentId?: string;
}

export interface CommunityPost {
  id: string;
  author: string;
  title: string;
  content: string;
  timestamp: string;
  category: string;
  likes: number;
  comments: Comment[];
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface EmergencyNotification {
  id: string;
  title: string;
  content: string;
  type: 'Emergency' | 'Alert' | 'Info';
  priority: 'High' | 'Medium' | 'Low';
  timestamp: string;
  isActive: boolean;
  category: string;
}

export interface HOAInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  officeHours: string;
  emergencyContact: string;
}

// New authentication types
export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address: string;
  unitNumber?: string;
  isResident: boolean;
  isBoardMember: boolean;
  isRenter: boolean;
  isDev?: boolean;
  isActive: boolean;
  isBlocked: boolean;
  blockReason?: string;
  password?: string;
  profileImage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
} 
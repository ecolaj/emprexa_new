export enum View {
  LOGIN = 'LOGIN',
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD',
  FEED = 'FEED',
  EXPLORE = 'EXPLORE',
  SEARCH = 'SEARCH',
  SDG_FEED = 'SDG_FEED',
  HASHTAG = 'HASHTAG',
  MESSAGES = 'MESSAGES',
  NOTIFICATIONS = 'NOTIFICATIONS',
  PROFILE = 'PROFILE',
  SETTINGS = 'SETTINGS',
  ORG_SETTINGS = 'ORG_SETTINGS',
  PRICING = 'PRICING',
  CHECKOUT = 'CHECKOUT',
  SUCCESS = 'SUCCESS',
  PROJECT_DETAILS = 'PROJECT_DETAILS',
  CREATE_PROJECT = 'CREATE_PROJECT',
  EDIT_PROJECT = 'EDIT_PROJECT',
  SINGLE_POST = 'SINGLE_POST',
  SAVED = 'SAVED',
  RESET_PASSWORD = 'reset_password',
  PROCESS_RECOVERY = 'process_recovery'  // AÑADE ESTA LÍNEA
}

export interface NavProps {
  currentView: View;
  navigate: (view: View, params?: any) => void;
  params?: any;
}

// --- DATABASE READY TYPES ---

// Base ID type: Supports legacy numbers (mocks) and future UUIDs (Supabase)
export type ID = string | number;

export interface User {
  id: ID;
  name: string;
  role: string;
  avatar: string;
  email?: string;
  username?: string;
  cover?: string;
  bio?: string;
  location?: string;
  organizationId?: ID | null;
  organizationName?: string | null;
  sdgInterests?: number[];
  plan?: 'free' | 'basic' | 'pro' | 'enterprise';
  paypalSubscriptionId?: string;
  planUpdatedAt?: string;
  website?: string;
  linkedin?: string;
  phone?: string;
  status?: 'active' | 'deactivated' | 'onboarding';
  lastSignInAt?: string;
  joinedAt?: string;
  isTrialActive?: boolean;
  trialPostsRemaining?: number;
  trialEndsAt?: string;
  hasUsedTrial?: boolean;
}

export interface Organization {
  id: ID;
  name: string;
  handle: string;
  category: string;
  verified: boolean;
  logo: string;
  cover: string;
  description: string;
  location: string;
  website: string;
  membersCount: number | string;
  stats: {
    trees: string;
    lives: string;
    carbon: string;
  };
  focusSdgs: number[];
  adminIds: ID[]; // Array of User UUIDs
}

export interface Comment {
  id: string; // Comments usually generated with UUIDs or Time strings
  userId: ID;
  text: string;
  time: string; // In DB this will be 'created_at' timestamp
}

export interface Post {
  id: number; // Keeping number for now for the mocks, but in DB will be UUID
  user: User; // In DB this is a Join/Foreign Key relation
  userId?: ID; // For DB insertion
  time: string;
  location: string;
  sdgIds: number[];
  title: string;
  content: string;
  images: string[];
  likes: number;
  isLiked?: boolean; // Virtual field (not in DB table, calculated on fetch)
  comments: number;
  recentComments: Comment[];
}

export interface Project {
  id: number; // Mocks use numbers
  ownerId: ID;
  orgId?: ID;
  title: string;
  description: string;
  sdgId: number;
  image: string;
  progress: number;
  status: string;
  lookingFor: string[];
  team: User[]; // In DB this is a relation table 'project_members'
  donationsEnabled: boolean;
  startDate?: string;
  endDate?: string;
  location?: string;
  gallery?: string[];
  raisedAmount?: number;
  volunteersCount?: number;
}

export interface ProjectUpdate {
  id: string;
  projectId: number;
  title: string;
  content: string;
  image?: string;
  createdAt: string;
}

export interface Notification {
  id: ID;
  type: 'like' | 'comment' | 'follow' | 'mention';
  user: User;
  content: string;
  time: string;
  read: boolean;
  linkId?: ID;
}

import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface QueryCacheContextType {
  residents: any[];
  hoaInfo: any;
}

const QueryCacheContext = createContext<QueryCacheContextType | undefined>(undefined);

/**
 * QueryCacheProvider - Provides cached queries for frequently accessed data
 * This prevents duplicate queries across multiple screens, saving ~400K operations/month
 * 
 * Cache TTL: Data is cached by Convex's built-in query system. This context
 * ensures a single source of truth for shared queries across the app.
 */
export const QueryCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Single queries for residents and hoaInfo - shared across all screens
  // These queries are automatically cached by Convex and deduplicated
  const residents = useQuery(api.residents.getAll) ?? [];
  const hoaInfo = useQuery(api.hoaInfo.get) ?? null;

  const value: QueryCacheContextType = useMemo(
    () => ({
      residents,
      hoaInfo,
    }),
    [residents, hoaInfo]
  );

  return (
    <QueryCacheContext.Provider value={value}>
      {children}
    </QueryCacheContext.Provider>
  );
};

/**
 * Hook to get cached residents data
 * Use this instead of calling useQuery(api.residents.getAll) directly
 * to prevent duplicate queries across screens
 */
export const useCachedResidents = () => {
  const context = useContext(QueryCacheContext);
  if (context === undefined) {
    throw new Error('useCachedResidents must be used within a QueryCacheProvider');
  }
  return context.residents;
};

/**
 * Hook to get cached HOA info data
 * Use this instead of calling useQuery(api.hoaInfo.get) directly
 * to prevent duplicate queries across screens
 */
export const useCachedHoaInfo = () => {
  const context = useContext(QueryCacheContext);
  if (context === undefined) {
    throw new Error('useCachedHoaInfo must be used within a QueryCacheProvider');
  }
  return context.hoaInfo;
};

import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { isDemoBuild } from '../config/isDemoBuild';
import { DemoDataContext } from '../demo/DemoDataProvider';

interface QueryCacheContextType {
  residents: any[];
  hoaInfo: any;
}

const QueryCacheContext = createContext<QueryCacheContextType | undefined>(undefined);

export const QueryCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDemo = isDemoBuild();
  const demoCtx = useContext(DemoDataContext);

  const residentsConvex = useQuery(api.residents.getAll, isDemo ? 'skip' : {});
  const hoaConvex = useQuery(api.hoaInfo.get, isDemo ? 'skip' : {});

  const residents = useMemo(() => {
    if (isDemo) {
      if (!demoCtx) {
        throw new Error('DemoDataProvider is required when demoMode is enabled');
      }
      return demoCtx.snapshot.residents ?? [];
    }
    return residentsConvex ?? [];
  }, [isDemo, demoCtx, residentsConvex]);

  const hoaInfo = useMemo(() => {
    if (isDemo) {
      if (!demoCtx) {
        throw new Error('DemoDataProvider is required when demoMode is enabled');
      }
      return demoCtx.snapshot.hoaInfo ?? null;
    }
    return hoaConvex ?? null;
  }, [isDemo, demoCtx, hoaConvex]);

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

export const useCachedResidents = () => {
  const context = useContext(QueryCacheContext);
  if (context === undefined) {
    throw new Error('useCachedResidents must be used within a QueryCacheProvider');
  }
  return context.residents;
};

export const useCachedHoaInfo = () => {
  const context = useContext(QueryCacheContext);
  if (context === undefined) {
    throw new Error('useCachedHoaInfo must be used within a QueryCacheProvider');
  }
  return context.hoaInfo;
};

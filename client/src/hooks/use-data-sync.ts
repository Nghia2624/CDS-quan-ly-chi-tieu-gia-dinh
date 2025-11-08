import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import React from 'react';

export function useDataSync(): {
  isRefreshing: boolean;
  lastSync: Date | null;
  refreshAllData: () => Promise<void>;
  getSyncStatus: () => any;
  checkDataStaleness: () => Promise<boolean>;
} {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Check sync status
  const getSyncStatus = useCallback(async () => {
    return await apiService.getSyncStatus();
  }, []);

  // Force refresh all data - silent sync with retry logic
  const refreshAllData = useCallback(async (retryCount = 0) => {
    if (isRefreshing) return; // Prevent multiple simultaneous syncs
    
    setIsRefreshing(true);
    try {
      // Use new sync API
      const result = await apiService.forceSync() as any;
      
      if (result.success) {
        // Force refetch all critical queries
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['expenses'] }),
          queryClient.invalidateQueries({ queryKey: ['expenses', 'all'] }),
          queryClient.invalidateQueries({ queryKey: ['stats'] }),
          queryClient.invalidateQueries({ queryKey: ['family-members'] }),
          queryClient.invalidateQueries({ queryKey: ['chat-sessions'] }),
          queryClient.invalidateQueries({ queryKey: ['chat-messages'] })
        ]);
        
        // Force refetch all data immediately
        await queryClient.refetchQueries();
        
        setLastSync(new Date());
        console.log('Data sync completed successfully - all queries refreshed');
        // Silent sync - no toast notification
      } else {
        throw new Error(result.message || 'Sync failed');
      }
    } catch (error: any) {
      console.warn('Sync error:', error.message);
      
      // Retry logic for network errors
      if (retryCount < 3 && (error.message.includes('network') || error.message.includes('fetch'))) {
        console.log(`Retrying sync in 2 seconds... (attempt ${retryCount + 1}/3)`);
        setTimeout(() => {
          refreshAllData(retryCount + 1);
        }, 2000);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient, isRefreshing]);

  // Auto-sync when component mounts (only once)
  useEffect(() => {
    const checkSync = async () => {
      try {
        const syncStatus = await getSyncStatus() as any;
        if (!syncStatus.isSynced) {
          refreshAllData();
        }
      } catch (error) {
        console.warn('Initial sync check failed:', error);
      }
    };
    checkSync();
  }, []); // Remove dependencies to run only once

  // Check for data staleness
  const checkDataStaleness = useCallback(async () => {
    try {
      const syncStatus = await getSyncStatus() as any;
      if (!syncStatus.lastExpenseSync) return true;

      const lastSyncTime = new Date(syncStatus.lastExpenseSync);
      const now = new Date();
      const diffInMinutes = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60);

      // Consider data stale after 30 minutes (increased from 15)
      return diffInMinutes > 30;
    } catch (error) {
      console.warn('Data staleness check failed:', error);
      return false; // Don't sync if check fails
    }
  }, [getSyncStatus]);

  // Real-time sync monitoring - disabled to avoid rate limiting
  // useEffect(() => {
  //   const syncInterval = setInterval(async () => {
  //     try {
  //       const syncStatus = await apiService.getSyncStatus() as any;
  //       if (syncStatus.hasChanges) {
  //         console.log('Data changes detected, syncing...');
  //         // Silent sync - no notification
  //         refreshAllData();
  //       }
  //     } catch (error) {
  //       console.error('Sync monitoring failed:', error);
  //     }
  //   }, 5 * 60 * 1000); // Check every 5 minutes to avoid rate limiting

  //   return () => clearInterval(syncInterval);
  // }, [refreshAllData]);

  // Additional sync on window focus
  useEffect(() => {
    const handleFocus = () => {
      refreshAllData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshAllData]);

  return {
    isRefreshing,
    lastSync,
    refreshAllData,
    getSyncStatus,
    checkDataStaleness: async () => await checkDataStaleness()
  };
}

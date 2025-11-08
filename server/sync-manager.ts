import { db } from './db';
import { expenses, users } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface SyncData {
  lastSync: string;
  familyId: string;
  dataVersion: number;
  changes: any[];
}

export class SyncManager {
  private static instance: SyncManager;
  private syncTimestamps: Map<string, Date> = new Map();

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  // Get sync status for a family
  async getSyncStatus(familyId: string): Promise<{
    lastSync: string;
    dataVersion: number;
    hasChanges: boolean;
    totalRecords: number;
  }> {
    const lastSync = this.syncTimestamps.get(familyId) || new Date(0);
    const now = new Date();
    
    // Get total records count
    const totalExpenses = await db.select().from(expenses).where(eq(expenses.familyId, familyId));
    const totalUsers = await db.select().from(users).where(eq(users.familyId, familyId));
    const totalRecords = totalExpenses.length + totalUsers.length;

    // Check if there are changes since last sync - more sensitive detection
    const recentExpenses = await db.select().from(expenses)
      .where(and(
        eq(expenses.familyId, familyId),
        // Check for expenses created or updated since last sync
        // This ensures real-time sync between father and mother
      ));
    
    // Only consider it has changes if there are recent expenses or if last sync was more than 5 minutes ago
    const hasChanges = recentExpenses.some(expense => 
      expense.createdAt && new Date(expense.createdAt) > lastSync
    ) || (lastSync < new Date(now.getTime() - 5 * 60 * 1000));

    return {
      lastSync: lastSync.toISOString(),
      dataVersion: 1,
      hasChanges,
      totalRecords
    };
  }

  // Get changes since last sync
  async getChanges(familyId: string, since?: string): Promise<{
    expenses: any[];
    users: any[];
    lastSync: string;
  }> {
    const sinceDate = since ? new Date(since) : new Date(0);
    
    // Get expenses since last sync
    const recentExpenses = await db.select()
      .from(expenses)
      .where(
        and(
          eq(expenses.familyId, familyId),
          // Add timestamp comparison if you have updatedAt field
        )
      )
      .orderBy(desc(expenses.createdAt))
      .limit(100);

    // Get users since last sync
    const recentUsers = await db.select()
      .from(users)
      .where(eq(users.familyId, familyId))
      .orderBy(desc(users.createdAt))
      .limit(50);

    const now = new Date();
    this.syncTimestamps.set(familyId, now);

    return {
      expenses: recentExpenses,
      users: recentUsers,
      lastSync: now.toISOString()
    };
  }

  // Mark data as synced
  markAsSynced(familyId: string): void {
    this.syncTimestamps.set(familyId, new Date());
  }

  // Check for conflicts
  async checkConflicts(familyId: string, clientData: any[]): Promise<{
    hasConflicts: boolean;
    conflicts: any[];
  }> {
    // This is a simplified conflict detection
    // In a real app, you'd compare timestamps, versions, etc.
    const conflicts: any[] = [];
    
    for (const item of clientData) {
      if (item.id && item.updatedAt) {
        // Check if server version is newer
        const serverItem = await db.select()
          .from(expenses)
          .where(eq(expenses.id, item.id))
          .limit(1);
        
        if (serverItem.length > 0 && serverItem[0].createdAt && item.createdAt && new Date(serverItem[0].createdAt) > new Date(item.createdAt)) {
          conflicts.push({
            type: 'expense',
            id: item.id,
            clientVersion: item,
            serverVersion: serverItem[0]
          });
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  // Resolve conflicts (server wins for now)
  async resolveConflicts(familyId: string, conflicts: any[]): Promise<void> {
    // For now, we'll just log conflicts
    // In a real app, you'd implement proper conflict resolution
    console.log(`Resolving ${conflicts.length} conflicts for family ${familyId}`);
  }

  // Force sync all data
  async forceSync(familyId: string): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    try {
      const changes = await this.getChanges(familyId);
      this.markAsSynced(familyId);
      
      return {
        success: true,
        message: 'Dữ liệu đã được đồng bộ thành công',
        data: changes
      };
    } catch (error) {
      console.error('Force sync error:', error);
      return {
        success: false,
        message: 'Lỗi đồng bộ dữ liệu',
        data: null
      };
    }
  }

  // Get sync statistics
  async getSyncStats(familyId: string): Promise<{
    totalExpenses: number;
    totalUsers: number;
    lastSync: string;
    syncFrequency: number; // minutes
    dataSize: number; // bytes (estimated)
  }> {
    const expensesData = await db.select().from(expenses).where(eq(expenses.familyId, familyId));
    const usersData = await db.select().from(users).where(eq(users.familyId, familyId));
    
    const lastSync = this.syncTimestamps.get(familyId) || new Date(0);
    const now = new Date();
    const syncFrequency = Math.round((now.getTime() - lastSync.getTime()) / (1000 * 60));
    
    // Estimate data size (rough calculation)
    const dataSize = JSON.stringify({ expenses: expensesData, users: usersData }).length;

    return {
      totalExpenses: expensesData.length,
      totalUsers: usersData.length,
      lastSync: lastSync.toISOString(),
      syncFrequency,
      dataSize
    };
  }
}

export const syncManager = SyncManager.getInstance();

import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongoDB(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_NAME || 'financeflow_logs';
    
    client = new MongoClient(mongoUrl);
    await client.connect();
    db = client.db(dbName);
    
    console.log('✅ Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

export async function getMongoDB(): Promise<Db> {
  if (!db) {
    return await connectMongoDB();
  }
  return db;
}

export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('🔌 MongoDB connection closed');
  }
}

// MongoDB collections
export const COLLECTIONS = {
  EXPENSE_LOGS: 'expense_logs',
  CHAT_LOGS: 'chat_logs',
  USER_ACTIVITY: 'user_activity',
  SYSTEM_LOGS: 'system_logs',
  AI_ANALYTICS: 'ai_analytics'
} as const;

// Helper functions for MongoDB operations
export async function logExpenseActivity(activity: {
  userId: string;
  familyId: string;
  action: 'create' | 'update' | 'delete' | 'view';
  expenseId?: string;
  amount?: number;
  category?: string;
  timestamp: Date;
}) {
  try {
    const mongoDb = await getMongoDB();
    await mongoDb.collection(COLLECTIONS.EXPENSE_LOGS).insertOne(activity);
  } catch (error) {
    console.error('Failed to log expense activity:', error);
  }
}

export async function logChatActivity(activity: {
  userId: string;
  familyId: string;
  sessionId: string;
  messageType: 'user' | 'ai';
  messageLength: number;
  responseTime?: number;
  timestamp: Date;
}) {
  try {
    const mongoDb = await getMongoDB();
    await mongoDb.collection(COLLECTIONS.CHAT_LOGS).insertOne(activity);
  } catch (error) {
    console.error('Failed to log chat activity:', error);
  }
}

export async function getExpenseAnalytics(familyId: string, days: number = 30) {
  try {
    const mongoDb = await getMongoDB();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const analytics = await mongoDb.collection(COLLECTIONS.EXPENSE_LOGS)
      .aggregate([
        { $match: { familyId, timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: {
              action: '$action',
              category: '$category',
              hour: { $hour: '$timestamp' },
              dayOfWeek: { $dayOfWeek: '$timestamp' }
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' },
            minAmount: { $min: '$amount' },
            maxAmount: { $max: '$amount' }
          }
        },
        { $sort: { count: -1 } }
      ])
      .toArray();
    
    return analytics;
  } catch (error) {
    console.error('Failed to get expense analytics:', error);
    return [];
  }
}

export async function getChatAnalytics(familyId: string, days: number = 30) {
  try {
    const mongoDb = await getMongoDB();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const analytics = await mongoDb.collection(COLLECTIONS.CHAT_LOGS)
      .aggregate([
        { $match: { familyId, timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: {
              messageType: '$messageType',
              hour: { $hour: '$timestamp' }
            },
            count: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTime' },
            avgMessageLength: { $avg: '$messageLength' }
          }
        },
        { $sort: { count: -1 } }
      ])
      .toArray();
    
    return analytics;
  } catch (error) {
    console.error('Failed to get chat analytics:', error);
    return [];
  }
}

export async function getUserActivityPatterns(familyId: string, days: number = 30) {
  try {
    const mongoDb = await getMongoDB();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const patterns = await mongoDb.collection(COLLECTIONS.USER_ACTIVITY)
      .aggregate([
        { $match: { familyId, timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: {
              userId: '$userId',
              hour: { $hour: '$timestamp' },
              dayOfWeek: { $dayOfWeek: '$timestamp' }
            },
            activityCount: { $sum: 1 }
          }
        },
        { $sort: { activityCount: -1 } }
      ])
      .toArray();
    
    return patterns;
  } catch (error) {
    console.error('Failed to get user activity patterns:', error);
    return [];
  }
}

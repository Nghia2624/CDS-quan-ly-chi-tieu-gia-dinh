import { 
  users, 
  expenses, 
  chatMessages,
  type User, 
  type InsertUser,
  type Expense,
  type InsertExpense,
  type ChatMessage,
  type InsertChatMessage
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Expense operations
  createExpense(expense: InsertExpense & { userId: string; familyId?: string; aiConfidence?: number }): Promise<Expense>;
  getExpenses(familyId: string, limit?: number): Promise<Expense[]>;
  getExpensesByCategory(familyId: string, category: string): Promise<Expense[]>;
  getExpenseStats(familyId: string): Promise<{
    totalAmount: number;
    categoryStats: { category: string; amount: number; count: number }[];
    monthlyStats: { month: string; amount: number }[];
  }>;
  
  // Chat operations
  createChatMessage(message: InsertChatMessage & { userId: string; familyId?: string; messageType: string; response?: string }): Promise<ChatMessage>;
  getChatHistory(familyId: string, limit?: number): Promise<ChatMessage[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Generate family ID for first family member, or use existing
    const familyId = `family_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        familyId,
      })
      .returning();
    return user;
  }

  // Expense operations
  async createExpense(expense: InsertExpense & { userId: string; familyId?: string; aiConfidence?: number }): Promise<Expense> {
    const expenseData = {
      ...expense,
      amount: expense.amount.toString(), // Convert number to string for decimal field
    };
    
    const [newExpense] = await db
      .insert(expenses)
      .values([expenseData])
      .returning();
    return newExpense;
  }

  async getExpenses(familyId: string, limit: number = 50): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(eq(expenses.familyId, familyId))
      .orderBy(desc(expenses.createdAt))
      .limit(limit);
  }

  async getExpensesByCategory(familyId: string, category: string): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(and(
        eq(expenses.familyId, familyId),
        eq(expenses.category, category)
      ))
      .orderBy(desc(expenses.createdAt));
  }

  async getExpenseStats(familyId: string): Promise<{
    totalAmount: number;
    categoryStats: { category: string; amount: number; count: number }[];
    monthlyStats: { month: string; amount: number }[];
  }> {
    // This is a simplified version - in production you'd use more complex SQL aggregations
    const allExpenses = await this.getExpenses(familyId, 1000);
    
    const totalAmount = allExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    
    const categoryMap = new Map<string, { amount: number; count: number }>();
    const monthlyMap = new Map<string, number>();
    
    allExpenses.forEach(expense => {
      const category = expense.category || 'Khác';
      const amount = parseFloat(expense.amount);
      const month = expense.createdAt?.toISOString().slice(0, 7) || '';
      
      // Category stats
      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category)!;
        categoryMap.set(category, {
          amount: existing.amount + amount,
          count: existing.count + 1
        });
      } else {
        categoryMap.set(category, { amount, count: 1 });
      }
      
      // Monthly stats
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + amount);
    });
    
    const categoryStats = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count
    }));
    
    const monthlyStats = Array.from(monthlyMap.entries()).map(([month, amount]) => ({
      month,
      amount
    }));
    
    return { totalAmount, categoryStats, monthlyStats };
  }

  // Chat operations
  async createChatMessage(message: InsertChatMessage & { userId: string; familyId?: string; messageType: string; response?: string }): Promise<ChatMessage> {
    const [newMessage] = await db
      .insert(chatMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  async getChatHistory(familyId: string, limit: number = 50): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.familyId, familyId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();

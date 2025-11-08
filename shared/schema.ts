import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for family members
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // father, mother, child, other
  familyId: varchar("family_id"),
  monthlyBudget: decimal("monthly_budget", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // User who created the expense (parent for child expenses)
  childId: varchar("child_id"), // If set, this expense belongs to the child, even if created by parent
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category"),
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
  isManualCategory: boolean("is_manual_category").default(false),
  familyId: varchar("family_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chat sessions
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  familyId: varchar("family_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat messages with AI
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id").notNull(),
  message: text("message").notNull(),
  response: text("response"),
  messageType: text("message_type").notNull(), // user, ai
  familyId: varchar("family_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Savings Goals (Mục tiêu tiết kiệm)
export const savingsGoals = pgTable("savings_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  familyId: varchar("family_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 12, scale: 2 }).default("0"),
  targetDate: timestamp("target_date"),
  category: text("category"), // xe, học phí, nhà cửa, du lịch, khẩn cấp, khác
  priority: text("priority").default("medium"), // high, medium, low
  status: text("status").default("active"), // active, completed, paused, cancelled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Expense Predictions (Dự báo chi tiêu)
export const expensePredictions = pgTable("expense_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull(),
  predictedAmount: decimal("predicted_amount", { precision: 12, scale: 2 }).notNull(),
  predictedMonth: integer("predicted_month").notNull(),
  predictedYear: integer("predicted_year").notNull(),
  category: text("category"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  algorithm: text("algorithm"), // linear, exponential, ai
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  phone: true,
  password: true,
  fullName: true,
  role: true,
}).extend({
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().min(10, "Số điện thoại phải có ít nhất 10 ký tự"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  fullName: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự"),
  role: z.enum(["father", "mother", "child", "other"], {
    errorMap: () => ({ message: "Vai trò không hợp lệ" })
  }),
});

export const insertExpenseSchema = createInsertSchema(expenses).pick({
  description: true,
  amount: true,
  category: true,
}).extend({
  description: z.string().min(1, "Mô tả không được để trống"),
  amount: z.number().positive("Số tiền phải lớn hơn 0"),
  category: z.string().optional(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  title: true,
}).extend({
  title: z.string().min(1, "Tiêu đề không được để trống"),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  message: true,
  sessionId: true,
}).extend({
  message: z.string().min(1, "Tin nhắn không được để trống"),
  sessionId: z.string().min(1, "Session ID không được để trống"),
});

export const insertSavingsGoalSchema = createInsertSchema(savingsGoals).pick({
  title: true,
  description: true,
  targetAmount: true,
  targetDate: true,
  category: true,
  priority: true,
}).extend({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  targetAmount: z.number().positive("Số tiền mục tiêu phải lớn hơn 0"),
  targetDate: z.string().optional().or(z.date().optional()),
  category: z.enum(["xe", "học phí", "nhà cửa", "du lịch", "khẩn cấp", "khác"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type ExpensePrediction = typeof expensePredictions.$inferSelect;

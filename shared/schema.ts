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
  createdAt: timestamp("created_at").defaultNow(),
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category"),
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
  isManualCategory: boolean("is_manual_category").default(false),
  familyId: varchar("family_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chat messages with AI
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  message: text("message").notNull(),
  response: text("response"),
  messageType: text("message_type").notNull(), // user, ai
  familyId: varchar("family_id"),
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

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  message: true,
}).extend({
  message: z.string().min(1, "Tin nhắn không được để trống"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

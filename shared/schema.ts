import { pgTable, text, serial, integer, jsonb, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type UserRole = 'admin' | 'user' | 'readonly';

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  password: text("password"),
  passwordHash: text("password_hash"),
  apiKey: text("api_key"),
  role: varchar("role", { length: 20 }).notNull().default('user'),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const endpointCategories = pgTable("endpoint_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const apiEndpoints = pgTable("api_endpoints", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  method: text("method").notNull(),
  summary: text("summary"),
  description: text("description"),
  parameters: jsonb("parameters"),
  responses: jsonb("responses"),
  categoryId: integer("category_id").references(() => endpointCategories.id),
});

export const savedRequests = pgTable("saved_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  endpointId: integer("endpoint_id").references(() => apiEndpoints.id),
  parameters: jsonb("parameters"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  passwordHash: true,
  apiKey: true,
});

export const insertEndpointCategorySchema = createInsertSchema(endpointCategories).pick({
  name: true,
  description: true,
});

export const insertApiEndpointSchema = createInsertSchema(apiEndpoints).pick({
  path: true,
  method: true,
  summary: true,
  description: true,
  parameters: true,
  responses: true,
  categoryId: true,
});

export const insertSavedRequestSchema = createInsertSchema(savedRequests).pick({
  name: true,
  endpointId: true,
  parameters: true,
  userId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertEndpointCategory = z.infer<typeof insertEndpointCategorySchema>;
export type EndpointCategory = typeof endpointCategories.$inferSelect;

export type InsertApiEndpoint = z.infer<typeof insertApiEndpointSchema>;
export type ApiEndpoint = typeof apiEndpoints.$inferSelect;

export type InsertSavedRequest = z.infer<typeof insertSavedRequestSchema>;
export type SavedRequest = typeof savedRequests.$inferSelect;

import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Marble visualizations table for storing user-uploaded images and their transformations
 */
export const marbleVisualizations = mysqlTable("marble_visualizations", {
  id: int("id").autoincrement().primaryKey(),
  /** Session ID for anonymous users or user ID for logged-in users */
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  /** Original uploaded image URL in S3 */
  originalImageUrl: text("originalImageUrl").notNull(),
  /** Bardiglio transformed image URL in S3 */
  bardiglioImageUrl: text("bardiglioImageUrl"),
  /** Venatino transformed image URL in S3 */
  venatinoImageUrl: text("venatinoImageUrl"),
  /** Processing status */
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  /** Error message if processing failed */
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MarbleVisualization = typeof marbleVisualizations.$inferSelect;
export type InsertMarbleVisualization = typeof marbleVisualizations.$inferInsert;

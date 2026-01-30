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
  /** Custom marble transformed image URL in S3 */
  customMarbleImageUrl: text("customMarbleImageUrl"),
  /** Surface highlight overlay image URL in S3 */
  highlightImageUrl: text("highlightImageUrl"),
  /** Processing status */
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  /** Error message if processing failed */
  errorMessage: text("errorMessage"),
  /** JSON string containing surface detection results from AI analysis */
  surfaceDetection: text("surfaceDetection"),
  /** JSON string containing user-uploaded material samples and their analysis */
  materialSamples: text("materialSamples"),
  /** JSON string containing selected surfaces for transformation (walls, floors, ceilings) */
  selectedSurfaces: text("selectedSurfaces"),
  /** ID of the custom marble used for transformation (if any) */
  customMarbleId: int("customMarbleId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MarbleVisualization = typeof marbleVisualizations.$inferSelect;
export type InsertMarbleVisualization = typeof marbleVisualizations.$inferInsert;

/**
 * Custom marbles table for storing user-uploaded marble options
 */
export const customMarbles = mysqlTable("custom_marbles", {
  id: int("id").autoincrement().primaryKey(),
  /** Session ID or user ID who created this marble */
  ownerId: varchar("ownerId", { length: 128 }).notNull(),
  /** Name of the marble (e.g., "Carrara", "Calacatta Gold") */
  name: varchar("name", { length: 255 }).notNull(),
  /** Origin/quarry location (e.g., "Carrara, Italy") */
  origin: varchar("origin", { length: 255 }),
  /** Base color of the marble */
  baseColor: varchar("baseColor", { length: 100 }),
  /** Description of veining pattern */
  veiningPattern: text("veiningPattern"),
  /** Full description of the marble */
  description: text("description"),
  /** 300 DPI high-resolution marble image URL in S3 */
  imageUrl: text("imageUrl"),
  /** Google Drive link to marble image collection */
  googleDriveLink: text("googleDriveLink"),
  /** Thumbnail image URL for preview */
  thumbnailUrl: text("thumbnailUrl"),
  /** JSON string containing AI analysis of the marble characteristics */
  marbleAnalysis: text("marbleAnalysis"),
  /** Whether this marble is available for public use */
  isPublic: mysqlEnum("isPublic", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomMarble = typeof customMarbles.$inferSelect;
export type InsertCustomMarble = typeof customMarbles.$inferInsert;

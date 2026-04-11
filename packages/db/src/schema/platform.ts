import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./users";

export const seaceProviderSession = pgTable("seace_provider_session", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  encryptedCredentials: text("encrypted_credentials").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiUsageQuota = pgTable("ai_usage_quota", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  monthlyCreditLimit: integer("monthly_credit_limit").notNull().default(100),
  creditsUsed: integer("credits_used").notNull().default(0),
  resetAt: timestamp("reset_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiGuestQuota = pgTable("ai_guest_quota", {
  guestId: text("guest_id").primaryKey(),
  monthlyCreditLimit: integer("monthly_credit_limit").notNull().default(2),
  creditsUsed: integer("credits_used").notNull().default(0),
  resetAt: timestamp("reset_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiUsageEvent = pgTable("ai_usage_event", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  guestId: text("guest_id"),
  endpoint: text("endpoint").notNull(),
  model: text("model"),
  creditsConsumed: integer("credits_consumed").notNull().default(1),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

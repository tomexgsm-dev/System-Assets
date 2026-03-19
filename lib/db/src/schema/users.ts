import { pgTable, text, serial, timestamp, integer, jsonb, date } from "drizzle-orm/pg-core";

export interface StylePreferences {
  colors: string[];
  font: string;
  layout: "minimal" | "modern" | "classic" | "bold" | "elegant";
  mood: string;
}

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  publishCount: integer("publish_count").notNull().default(0),
  dailyGenCount:   integer("daily_gen_count").notNull().default(0),
  monthlyGenCount: integer("monthly_gen_count").notNull().default(0),
  lastGenDate:     date("last_gen_date"),
  dailyPubCount:   integer("daily_pub_count").notNull().default(0),
  monthlyPubCount: integer("monthly_pub_count").notNull().default(0),
  lastPubDate:     date("last_pub_date"),
  stylePreferences: jsonb("style_preferences").$type<StylePreferences>().default({} as StylePreferences),
  promptHistory: jsonb("prompt_history").$type<Array<{ prompt: string; date: string }>>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

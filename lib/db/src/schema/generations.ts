import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const generationsTable = pgTable("generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  prompt: text("prompt").notNull(),
  html: text("html").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({ id: true, createdAt: true });
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;

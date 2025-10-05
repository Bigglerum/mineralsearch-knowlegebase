import { pgTable, text, serial, integer, jsonb, timestamp, varchar, boolean, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  password: text("password"),
  apiKey: text("api_key"),
  role: varchar("role", { length: 20 }).notNull().default('user'),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const minerals = pgTable("minerals", {
  id: serial("id").primaryKey(),
  mindatId: integer("mindat_id").unique(),
  name: text("name").notNull(),
  formula: text("formula"),
  imaFormula: text("ima_formula"),
  imaSymbol: text("ima_symbol"),
  imaStatus: text("ima_status"),
  crystalSystem: text("crystal_system"),
  hardnessMin: real("hardness_min"),
  hardnessMax: real("hardness_max"),
  specificGravityMin: real("specific_gravity_min"),
  specificGravityMax: real("specific_gravity_max"),
  colour: text("colour"),
  diaphaneity: text("diaphaneity"),
  lustre: text("lustre"),
  streak: text("streak"),
  fracture: text("fracture"),
  cleavage: text("cleavage"),
  tenacity: text("tenacity"),
  strunzClass: text("strunz_class"),
  elements: text("elements").array(),
  imageUrl: text("image_url"),
  description: text("description"),
  occurrence: text("occurrence"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("mineral_name_idx").on(table.name),
  mindatIdIdx: index("mineral_mindat_id_idx").on(table.mindatId),
}));

export const strunzClassifications = pgTable("strunz_classifications", {
  id: serial("id").primaryKey(),
  classCode: text("class_code").notNull().unique(),
  className: text("class_name").notNull(),
  division: text("division"),
  subDivision: text("sub_division"),
  group: text("group"),
  description: text("description"),
  parentCode: text("parent_code"),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  classCodeIdx: index("strunz_class_code_idx").on(table.classCode),
}));

export const localities = pgTable("localities", {
  id: serial("id").primaryKey(),
  mindatId: integer("mindat_id").unique(),
  name: text("name").notNull(),
  country: text("country"),
  region: text("region"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  description: text("description"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("locality_name_idx").on(table.name),
  mindatIdIdx: index("locality_mindat_id_idx").on(table.mindatId),
}));

export const syncJobs = pgTable("sync_jobs", {
  id: serial("id").primaryKey(),
  jobType: varchar("job_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  recordsProcessed: integer("records_processed").default(0),
  recordsFailed: integer("records_failed").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  mineralId: integer("mineral_id").references(() => minerals.id),
  localityId: integer("locality_id").references(() => localities.id),
  createdAt: timestamp("created_at").defaultNow(),
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMineralSchema = createInsertSchema(minerals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStrunzClassificationSchema = createInsertSchema(strunzClassifications).omit({
  id: true,
  createdAt: true,
});

export const insertLocalitySchema = createInsertSchema(localities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSyncJobSchema = createInsertSchema(syncJobs).omit({
  id: true,
  createdAt: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});

export const insertEndpointCategorySchema = createInsertSchema(endpointCategories).omit({
  id: true,
});

export const insertApiEndpointSchema = createInsertSchema(apiEndpoints).omit({
  id: true,
});

export const insertSavedRequestSchema = createInsertSchema(savedRequests).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertMineral = z.infer<typeof insertMineralSchema>;
export type Mineral = typeof minerals.$inferSelect;

export type InsertStrunzClassification = z.infer<typeof insertStrunzClassificationSchema>;
export type StrunzClassification = typeof strunzClassifications.$inferSelect;

export type InsertLocality = z.infer<typeof insertLocalitySchema>;
export type Locality = typeof localities.$inferSelect;

export type InsertSyncJob = z.infer<typeof insertSyncJobSchema>;
export type SyncJob = typeof syncJobs.$inferSelect;

export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;

export type InsertEndpointCategory = z.infer<typeof insertEndpointCategorySchema>;
export type EndpointCategory = typeof endpointCategories.$inferSelect;

export type InsertApiEndpoint = z.infer<typeof insertApiEndpointSchema>;
export type ApiEndpoint = typeof apiEndpoints.$inferSelect;

export type InsertSavedRequest = z.infer<typeof insertSavedRequestSchema>;
export type SavedRequest = typeof savedRequests.$inferSelect;

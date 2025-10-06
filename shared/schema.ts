import { pgTable, text, serial, integer, jsonb, timestamp, varchar, boolean, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  password: text("password"),
  role: varchar("role", { length: 20 }).notNull().default('user'),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const mineralNameIndex = pgTable("mineral_name_index", {
  id: serial("id").primaryKey(),
  canonicalName: text("canonical_name").notNull().unique(),
  imaApproved: boolean("ima_approved").notNull().default(false),
  mindatId: integer("mindat_id").unique(),
  aliases: text("aliases").array(),
  varietyOf: text("variety_of"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  canonicalNameIdx: index("mineral_name_canonical_idx").on(table.canonicalName),
}));

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  priority: integer("priority").notNull().default(50),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mindatMinerals = pgTable("mindat_minerals", {
  id: serial("id").primaryKey(),
  mindatId: integer("mindat_id").notNull().unique(),
  name: text("name").notNull(),
  guid: text("guid"),
  longId: text("long_id"),
  entryType: integer("entry_type"),
  updtTime: timestamp("updt_time"),
  
  imaFormula: text("ima_formula"),
  mindatFormula: text("mindat_formula"),
  imaStatus: text("ima_status"),
  imaSymbol: text("ima_symbol"),
  imaNotes: text("ima_notes"),
  imaYear: integer("ima_year"),
  
  crystalSystem: text("crystal_system"),
  spaceGroup: text("space_group"),
  unitCellA: real("unit_cell_a"),
  unitCellB: real("unit_cell_b"),
  unitCellC: real("unit_cell_c"),
  unitCellAlpha: real("unit_cell_alpha"),
  unitCellBeta: real("unit_cell_beta"),
  unitCellGamma: real("unit_cell_gamma"),
  
  hardnessMin: real("hardness_min"),
  hardnessMax: real("hardness_max"),
  densityMin: real("density_min"),
  densityMax: real("density_max"),
  specificGravityMin: real("specific_gravity_min"),
  specificGravityMax: real("specific_gravity_max"),
  
  colour: text("colour"),
  color: text("color"),
  diaphaneity: text("diaphaneity"),
  lustre: text("lustre"),
  lustreType: text("lustre_type"),
  streak: text("streak"),
  fracture: text("fracture"),
  fractureType: text("fracture_type"),
  cleavage: text("cleavage"),
  cleavageType: text("cleavage_type"),
  tenacity: text("tenacity"),
  habit: text("habit"),
  
  optical2vMin: real("optical_2v_min"),
  optical2vMax: real("optical_2v_max"),
  opticalSign: text("optical_sign"),
  opticalType: text("optical_type"),
  biMin: real("bi_min"),
  biMax: real("bi_max"),
  riMin: real("ri_min"),
  riMax: real("ri_max"),
  riAlpha: real("ri_alpha"),
  riBeta: real("ri_beta"),
  riGamma: real("ri_gamma"),
  riOmega: real("ri_omega"),
  riEpsilon: real("ri_epsilon"),
  pleochroism: text("pleochroism"),
  
  strunzClass: text("strunz_class"),
  danaClass: text("dana_class"),
  heyClass: text("hey_class"),
  
  elements: text("elements").array(),
  elementsInc: text("elements_inc").array(),
  elementsExc: text("elements_exc").array(),
  
  groupId: integer("group_id"),
  varietyOf: integer("variety_of"),
  meteoriteCode: text("meteorite_code"),
  meteoriteCodeExists: boolean("meteorite_code_exists"),
  
  typeLocalitiesData: jsonb("type_localities_data"),
  localityData: jsonb("locality_data"),
  
  description: text("description"),
  occurrence: text("occurrence"),
  formationEnvironment: text("formation_environment"),
  geologyNotes: text("geology_notes"),
  
  imageUrl: text("image_url"),
  imageCount: integer("image_count"),
  alternateImages: jsonb("alternate_images"),
  
  luminescence: text("luminescence"),
  fluorescence: text("fluorescence"),
  magnetism: text("magnetism"),
  radioactivity: text("radioactivity"),
  arsenicContent: text("arsenic_content"),
  
  solubility: text("solubility"),
  fusibility: text("fusibility"),
  
  polytypeOf: text("polytype_of"),
  structuralGroupName: text("structural_group_name"),
  
  localityCount: integer("locality_count"),
  licenseInfo: text("license_info"),
  
  nonUtf: boolean("non_utf").default(false),
  
  fieldHashes: jsonb("field_hashes"),
  dataHash: text("data_hash"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("mindat_mineral_name_idx").on(table.name),
  mindatIdIdx: index("mindat_mineral_mindat_id_idx").on(table.mindatId),
  syncIdx: index("mindat_mineral_sync_idx").on(table.mindatId, table.updatedAt),
  imaStatusIdx: index("mindat_mineral_ima_status_idx").on(table.imaStatus),
  crystalSystemIdx: index("mindat_mineral_crystal_system_idx").on(table.crystalSystem),
  updtTimeIdx: index("mindat_mineral_updt_time_idx").on(table.updtTime),
}));

export const rruffMinerals = pgTable("rruff_minerals", {
  id: serial("id").primaryKey(),
  mineralName: text("mineral_name").notNull(),
  mineralNameHtml: text("mineral_name_html"),
  imaChemistry: text("ima_chemistry"),
  chemistryElements: text("chemistry_elements"),
  yearFirstPublished: integer("year_first_published"),
  imaStatus: text("ima_status"),
  structuralGroupname: text("structural_groupname"),
  crystalSystems: text("crystal_systems"),
  valenceElements: text("valence_elements"),
  imaSymbol: text("ima_symbol").notNull().unique(),
  mindatId: integer("mindat_id"),
  enrichmentStatus: varchar("enrichment_status", { length: 20 }).default('not_enriched'),
  enrichedAt: timestamp("enriched_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  mineralNameIdx: index("rruff_mineral_name_idx").on(table.mineralName),
  structuralGroupIdx: index("rruff_structural_group_idx").on(table.structuralGroupname),
  imaStatusIdx: index("rruff_ima_status_idx").on(table.imaStatus),
  enrichmentIdx: index("rruff_enrichment_idx").on(table.enrichmentStatus),
  mindatIdIdx: index("rruff_mindat_id_idx").on(table.mindatId),
}));

export const ionicChemistry = pgTable("ionic_chemistry", {
  id: serial("id").primaryKey(),
  mineralName: text("mineral_name").notNull(),
  formula: text("formula"),
  
  cations: jsonb("cations"),
  anions: jsonb("anions"),
  silicates: jsonb("silicates"),
  hydroxyl: text("hydroxyl"),
  hydrate: text("hydrate"),
  elements: text("elements"),
  
  cationsRaw: text("cations_raw"),
  anionsRaw: text("anions_raw"),
  silicatesRaw: text("silicates_raw"),
  
  dataSourceId: integer("data_source_id").references(() => dataSources.id),
  sourceFile: text("source_file"),
  isUtf8Supplement: boolean("is_utf8_supplement").default(false),
  
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  mineralNameIdx: index("ionic_chem_mineral_name_idx").on(table.mineralName),
  dataSourceIdx: index("ionic_chem_data_source_idx").on(table.dataSourceId),
}));

export const dataConflicts = pgTable("data_conflicts", {
  id: serial("id").primaryKey(),
  mineralName: text("mineral_name").notNull(),
  fieldName: text("field_name").notNull(),
  sourceAId: integer("source_a_id").references(() => dataSources.id),
  sourceBId: integer("source_b_id").references(() => dataSources.id),
  valueA: text("value_a"),
  valueB: text("value_b"),
  severity: varchar("severity", { length: 20 }).notNull().default('medium'),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  mineralNameIdx: index("data_conflict_mineral_name_idx").on(table.mineralName),
  statusIdx: index("data_conflict_status_idx").on(table.status),
  severityIdx: index("data_conflict_severity_idx").on(table.severity),
  unresolvedIdx: index("data_conflict_unresolved_idx").on(table.status, table.severity),
}));

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

export const insertMineralNameIndexSchema = createInsertSchema(mineralNameIndex).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataSourceSchema = createInsertSchema(dataSources).omit({
  id: true,
  createdAt: true,
});

export const insertMindatMineralSchema = createInsertSchema(mindatMinerals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRruffMineralSchema = createInsertSchema(rruffMinerals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIonicChemistrySchema = createInsertSchema(ionicChemistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataConflictSchema = createInsertSchema(dataConflicts).omit({
  id: true,
  createdAt: true,
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

export type InsertMineralNameIndex = z.infer<typeof insertMineralNameIndexSchema>;
export type MineralNameIndex = typeof mineralNameIndex.$inferSelect;

export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSources.$inferSelect;

export type InsertMindatMineral = z.infer<typeof insertMindatMineralSchema>;
export type MindatMineral = typeof mindatMinerals.$inferSelect;

export type InsertRruffMineral = z.infer<typeof insertRruffMineralSchema>;
export type RruffMineral = typeof rruffMinerals.$inferSelect;

export type InsertIonicChemistry = z.infer<typeof insertIonicChemistrySchema>;
export type IonicChemistry = typeof ionicChemistry.$inferSelect;

export type InsertDataConflict = z.infer<typeof insertDataConflictSchema>;
export type DataConflict = typeof dataConflicts.$inferSelect;

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

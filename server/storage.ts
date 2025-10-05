import {
  users,
  minerals,
  localities,
  strunzClassifications,
  syncJobs,
  favorites,
  type User,
  type InsertUser,
  type Mineral,
  type InsertMineral,
  type Locality,
  type InsertLocality,
  type StrunzClassification,
  type InsertStrunzClassification,
  type SyncJob,
  type InsertSyncJob,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  searchMinerals(params: {
    name?: string;
    formula?: string;
    elements?: string[];
    crystalSystem?: string;
    limit?: number;
    offset?: number;
  }): Promise<Mineral[]>;
  getMineralById(id: number): Promise<Mineral | undefined>;
  getMineralByMindatId(mindatId: number): Promise<Mineral | undefined>;
  createMineral(mineral: InsertMineral): Promise<Mineral>;
  updateMineral(id: number, mineral: Partial<InsertMineral>): Promise<Mineral | undefined>;

  searchLocalities(params: {
    name?: string;
    country?: string;
    limit?: number;
    offset?: number;
  }): Promise<Locality[]>;
  getLocalityById(id: number): Promise<Locality | undefined>;
  createLocality(locality: InsertLocality): Promise<Locality>;

  getStrunzClassifications(): Promise<StrunzClassification[]>;
  getStrunzClassificationByCode(code: string): Promise<StrunzClassification | undefined>;
  createStrunzClassification(classification: InsertStrunzClassification): Promise<StrunzClassification>;

  createSyncJob(job: InsertSyncJob): Promise<SyncJob>;
  updateSyncJob(id: number, job: Partial<InsertSyncJob>): Promise<SyncJob | undefined>;
  getRecentSyncJobs(limit: number): Promise<SyncJob[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private minerals: Map<number, Mineral>;
  private localities: Map<number, Locality>;
  private strunzClassifications: Map<number, StrunzClassification>;
  private syncJobs: Map<number, SyncJob>;

  private userIdCounter: number;
  private mineralIdCounter: number;
  private localityIdCounter: number;
  private strunzIdCounter: number;
  private syncJobIdCounter: number;

  constructor() {
    this.users = new Map();
    this.minerals = new Map();
    this.localities = new Map();
    this.strunzClassifications = new Map();
    this.syncJobs = new Map();

    this.userIdCounter = 1;
    this.mineralIdCounter = 1;
    this.localityIdCounter = 1;
    this.strunzIdCounter = 1;
    this.syncJobIdCounter = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = {
      id,
      username: insertUser.username,
      email: insertUser.email ?? null,
      password: insertUser.password ?? null,
      apiKey: insertUser.apiKey ?? null,
      role: insertUser.role || 'user',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async searchMinerals(params: {
    name?: string;
    formula?: string;
    elements?: string[];
    crystalSystem?: string;
    limit?: number;
    offset?: number;
  }): Promise<Mineral[]> {
    let results = Array.from(this.minerals.values());

    if (params.name) {
      const searchTerm = params.name.toLowerCase();
      results = results.filter((m) =>
        m.name.toLowerCase().includes(searchTerm)
      );
    }

    if (params.formula) {
      const searchTerm = params.formula.toLowerCase();
      results = results.filter(
        (m) =>
          m.formula?.toLowerCase().includes(searchTerm) ||
          m.imaFormula?.toLowerCase().includes(searchTerm)
      );
    }

    if (params.elements && params.elements.length > 0) {
      results = results.filter((m) =>
        params.elements!.some((el) => m.elements?.includes(el))
      );
    }

    if (params.crystalSystem) {
      results = results.filter(
        (m) => m.crystalSystem === params.crystalSystem
      );
    }

    const offset = params.offset || 0;
    const limit = params.limit || 20;
    
    return results.slice(offset, offset + limit);
  }

  async getMineralById(id: number): Promise<Mineral | undefined> {
    return this.minerals.get(id);
  }

  async getMineralByMindatId(mindatId: number): Promise<Mineral | undefined> {
    return Array.from(this.minerals.values()).find(
      (m) => m.mindatId === mindatId
    );
  }

  async createMineral(insertMineral: InsertMineral): Promise<Mineral> {
    const id = this.mineralIdCounter++;
    const mineral: Mineral = {
      id,
      mindatId: insertMineral.mindatId ?? null,
      name: insertMineral.name,
      formula: insertMineral.formula ?? null,
      imaFormula: insertMineral.imaFormula ?? null,
      imaSymbol: insertMineral.imaSymbol ?? null,
      imaStatus: insertMineral.imaStatus ?? null,
      crystalSystem: insertMineral.crystalSystem ?? null,
      hardnessMin: insertMineral.hardnessMin ?? null,
      hardnessMax: insertMineral.hardnessMax ?? null,
      specificGravityMin: insertMineral.specificGravityMin ?? null,
      specificGravityMax: insertMineral.specificGravityMax ?? null,
      colour: insertMineral.colour ?? null,
      diaphaneity: insertMineral.diaphaneity ?? null,
      lustre: insertMineral.lustre ?? null,
      streak: insertMineral.streak ?? null,
      fracture: insertMineral.fracture ?? null,
      cleavage: insertMineral.cleavage ?? null,
      tenacity: insertMineral.tenacity ?? null,
      strunzClass: insertMineral.strunzClass ?? null,
      elements: insertMineral.elements ?? null,
      imageUrl: insertMineral.imageUrl ?? null,
      description: insertMineral.description ?? null,
      occurrence: insertMineral.occurrence ?? null,
      rawData: insertMineral.rawData ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.minerals.set(id, mineral);
    return mineral;
  }

  async updateMineral(
    id: number,
    updates: Partial<InsertMineral>
  ): Promise<Mineral | undefined> {
    const mineral = this.minerals.get(id);
    if (!mineral) return undefined;

    const updated: Mineral = {
      ...mineral,
      ...updates,
      updatedAt: new Date(),
    };
    this.minerals.set(id, updated);
    return updated;
  }

  async searchLocalities(params: {
    name?: string;
    country?: string;
    limit?: number;
    offset?: number;
  }): Promise<Locality[]> {
    let results = Array.from(this.localities.values());

    if (params.name) {
      const searchTerm = params.name.toLowerCase();
      results = results.filter((l) =>
        l.name.toLowerCase().includes(searchTerm)
      );
    }

    if (params.country) {
      results = results.filter(
        (l) => l.country?.toLowerCase() === params.country?.toLowerCase()
      );
    }

    const offset = params.offset || 0;
    const limit = params.limit || 20;
    
    return results.slice(offset, offset + limit);
  }

  async getLocalityById(id: number): Promise<Locality | undefined> {
    return this.localities.get(id);
  }

  async createLocality(insertLocality: InsertLocality): Promise<Locality> {
    const id = this.localityIdCounter++;
    const locality: Locality = {
      id,
      mindatId: insertLocality.mindatId ?? null,
      name: insertLocality.name,
      country: insertLocality.country ?? null,
      region: insertLocality.region ?? null,
      latitude: insertLocality.latitude ?? null,
      longitude: insertLocality.longitude ?? null,
      description: insertLocality.description ?? null,
      rawData: insertLocality.rawData ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.localities.set(id, locality);
    return locality;
  }

  async getStrunzClassifications(): Promise<StrunzClassification[]> {
    return Array.from(this.strunzClassifications.values());
  }

  async getStrunzClassificationByCode(
    code: string
  ): Promise<StrunzClassification | undefined> {
    return Array.from(this.strunzClassifications.values()).find(
      (c) => c.classCode === code
    );
  }

  async createStrunzClassification(
    insertClassification: InsertStrunzClassification
  ): Promise<StrunzClassification> {
    const id = this.strunzIdCounter++;
    const classification: StrunzClassification = {
      id,
      classCode: insertClassification.classCode,
      className: insertClassification.className,
      division: insertClassification.division ?? null,
      subDivision: insertClassification.subDivision ?? null,
      group: insertClassification.group ?? null,
      description: insertClassification.description ?? null,
      parentCode: insertClassification.parentCode ?? null,
      level: insertClassification.level ?? 1,
      createdAt: new Date(),
    };
    this.strunzClassifications.set(id, classification);
    return classification;
  }

  async createSyncJob(insertJob: InsertSyncJob): Promise<SyncJob> {
    const id = this.syncJobIdCounter++;
    const job: SyncJob = {
      id,
      jobType: insertJob.jobType,
      status: insertJob.status ?? 'pending',
      recordsProcessed: insertJob.recordsProcessed ?? null,
      recordsFailed: insertJob.recordsFailed ?? null,
      errorMessage: insertJob.errorMessage ?? null,
      startedAt: insertJob.startedAt ?? null,
      completedAt: insertJob.completedAt ?? null,
      createdAt: new Date(),
    };
    this.syncJobs.set(id, job);
    return job;
  }

  async updateSyncJob(
    id: number,
    updates: Partial<InsertSyncJob>
  ): Promise<SyncJob | undefined> {
    const job = this.syncJobs.get(id);
    if (!job) return undefined;

    const updated: SyncJob = {
      ...job,
      ...updates,
    };
    this.syncJobs.set(id, updated);
    return updated;
  }

  async getRecentSyncJobs(limit: number): Promise<SyncJob[]> {
    const jobs = Array.from(this.syncJobs.values());
    return jobs
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }
}

export const storage = new MemStorage();

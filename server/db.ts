import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  marbleVisualizations, 
  InsertMarbleVisualization, 
  MarbleVisualization,
  customMarbles,
  InsertCustomMarble,
  CustomMarble
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Marble Visualization Helpers

export async function createMarbleVisualization(data: InsertMarbleVisualization): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(marbleVisualizations).values(data);
  return result[0].insertId;
}

export async function getMarbleVisualizationById(id: number): Promise<MarbleVisualization | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(marbleVisualizations).where(eq(marbleVisualizations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMarbleVisualizationsBySession(sessionId: string): Promise<MarbleVisualization[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(marbleVisualizations).where(eq(marbleVisualizations.sessionId, sessionId));
}

export async function updateMarbleVisualization(
  id: number,
  data: Partial<Pick<MarbleVisualization, 
    'bardiglioImageUrl' | 
    'venatinoImageUrl' | 
    'customMarbleImageUrl' |
    'highlightImageUrl' |
    'status' | 
    'errorMessage' | 
    'surfaceDetection' | 
    'materialSamples' | 
    'selectedSurfaces' |
    'customMarbleId'
  >>
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(marbleVisualizations).set(data).where(eq(marbleVisualizations.id, id));
}

// Custom Marble Helpers

export async function createCustomMarble(data: InsertCustomMarble): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(customMarbles).values(data);
  return result[0].insertId;
}

export async function getCustomMarbleById(id: number): Promise<CustomMarble | undefined> {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(customMarbles).where(eq(customMarbles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCustomMarblesByOwner(ownerId: string): Promise<CustomMarble[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(customMarbles).where(eq(customMarbles.ownerId, ownerId));
}

export async function updateCustomMarble(
  id: number,
  data: Partial<Pick<CustomMarble, 
    'name' | 
    'origin' | 
    'baseColor' |
    'veiningPattern' |
    'description' | 
    'imageUrl' | 
    'googleDriveLink' | 
    'thumbnailUrl' | 
    'marbleAnalysis' |
    'isPublic'
  >>
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(customMarbles).set(data).where(eq(customMarbles.id, id));
}

export async function deleteCustomMarble(id: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(customMarbles).where(eq(customMarbles.id, id));
}

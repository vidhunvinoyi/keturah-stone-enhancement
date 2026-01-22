import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  createMarbleVisualization: vi.fn().mockResolvedValue(1),
  getMarbleVisualizationById: vi.fn().mockResolvedValue({
    id: 1,
    sessionId: "test-session-123",
    originalImageUrl: "https://example.com/original.jpg",
    bardiglioImageUrl: null,
    venatinoImageUrl: null,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
    errorMessage: null,
  }),
  getMarbleVisualizationsBySession: vi.fn().mockResolvedValue([
    {
      id: 1,
      sessionId: "test-session-123",
      originalImageUrl: "https://example.com/original.jpg",
      bardiglioImageUrl: null,
      venatinoImageUrl: null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      errorMessage: null,
    },
  ]),
  updateMarbleVisualization: vi.fn().mockResolvedValue(undefined),
}));

// Mock the storage functions
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "uploads/test-session-123/1234567890-original.jpg",
    url: "https://s3.example.com/uploads/test-session-123/1234567890-original.jpg",
  }),
}));

// Mock the image generation functions
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({
    url: "https://s3.example.com/generated/marble-transformed.jpg",
  }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("visualization.upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads an image and creates a visualization record", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Create a simple base64 encoded test image (1x1 pixel PNG)
    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const result = await caller.visualization.upload({
      imageBase64: testImageBase64,
      mimeType: "image/png",
    });

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("sessionId");
    expect(result).toHaveProperty("originalImageUrl");
    expect(result.status).toBe("pending");
    expect(typeof result.id).toBe("number");
    expect(typeof result.sessionId).toBe("string");
  });

  it("uses provided sessionId if given", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const customSessionId = "custom-session-id-123";

    const result = await caller.visualization.upload({
      imageBase64: testImageBase64,
      mimeType: "image/png",
      sessionId: customSessionId,
    });

    expect(result.sessionId).toBe(customSessionId);
  });
});

describe("visualization.get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves a visualization by ID", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.visualization.get({ id: 1 });

    expect(result).toHaveProperty("id", 1);
    expect(result).toHaveProperty("sessionId", "test-session-123");
    expect(result).toHaveProperty("originalImageUrl");
    expect(result).toHaveProperty("status", "pending");
  });
});

describe("visualization.getBySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves all visualizations for a session", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.visualization.getBySession({ sessionId: "test-session-123" });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("sessionId", "test-session-123");
  });
});

describe("visualization.process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes an image with bardiglio marble", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.visualization.process({
      visualizationId: 1,
      marbleType: "bardiglio",
    });

    expect(result).toHaveProperty("id", 1);
    expect(result).toHaveProperty("marbleType", "bardiglio");
    expect(result).toHaveProperty("imageUrl");
    expect(result.status).toBe("completed");
  });

  it("processes an image with venatino marble", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.visualization.process({
      visualizationId: 1,
      marbleType: "venatino",
    });

    expect(result).toHaveProperty("id", 1);
    expect(result).toHaveProperty("marbleType", "venatino");
    expect(result).toHaveProperty("imageUrl");
    expect(result.status).toBe("completed");
  });

  it("returns cached result if already processed for marble type", async () => {
    // Mock a visualization that already has bardiglio processed
    const { getMarbleVisualizationById } = await import("./db");
    vi.mocked(getMarbleVisualizationById).mockResolvedValueOnce({
      id: 1,
      sessionId: "test-session-123",
      originalImageUrl: "https://example.com/original.jpg",
      bardiglioImageUrl: "https://example.com/bardiglio-cached.jpg",
      venatinoImageUrl: null,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
      errorMessage: null,
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.visualization.process({
      visualizationId: 1,
      marbleType: "bardiglio",
    });

    expect(result.imageUrl).toBe("https://example.com/bardiglio-cached.jpg");
    expect(result.status).toBe("completed");
  });

  it("throws error when visualization not found", async () => {
    const { getMarbleVisualizationById } = await import("./db");
    vi.mocked(getMarbleVisualizationById).mockResolvedValueOnce(null);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.visualization.process({
        visualizationId: 999,
        marbleType: "bardiglio",
      })
    ).rejects.toThrow("Visualization not found");
  });
});

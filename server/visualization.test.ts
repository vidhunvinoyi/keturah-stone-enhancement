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
    surfaceDetection: null,
    materialSamples: null,
    selectedSurfaces: null,
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
      surfaceDetection: null,
      materialSamples: null,
      selectedSurfaces: null,
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

// Mock the LLM functions for surface detection
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            walls: {
              detected: true,
              confidence: 85,
              material: "travertine",
              description: "Beige travertine walls with natural veining",
            },
            floors: {
              detected: true,
              confidence: 90,
              material: "marble",
              description: "Polished marble flooring",
            },
            ceilings: {
              detected: true,
              confidence: 60,
              material: "paint",
              description: "White painted ceiling",
            },
            overallAnalysis: "Luxury interior with stone surfaces suitable for marble replacement",
            canAutoDetect: true,
          }),
        },
      },
    ],
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

describe("visualization.detectSurfaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects surfaces in an uploaded image", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.visualization.detectSurfaces({
      visualizationId: 1,
    });

    expect(result).toHaveProperty("id", 1);
    expect(result).toHaveProperty("detection");
    expect(result.detection).toHaveProperty("walls");
    expect(result.detection).toHaveProperty("floors");
    expect(result.detection).toHaveProperty("ceilings");
    expect(result.detection.walls.detected).toBe(true);
    expect(result.detection.walls.confidence).toBe(85);
    expect(result.detection.walls.material).toBe("travertine");
    expect(result.detection.canAutoDetect).toBe(true);
    expect(result.status).toBe("detected");
  });

  it("throws error when visualization not found", async () => {
    const { getMarbleVisualizationById } = await import("./db");
    vi.mocked(getMarbleVisualizationById).mockResolvedValueOnce(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.visualization.detectSurfaces({
        visualizationId: 999,
      })
    ).rejects.toThrow("Visualization not found");
  });
});

describe("visualization.uploadMaterialSample", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset LLM mock for material sample analysis
    const llmModule = await import("./_core/llm");
    vi.mocked(llmModule.invokeLLM).mockResolvedValue({
      id: "test-id",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              materialType: "travertine",
              colorPalette: ["beige", "cream", "tan"],
              patterns: "Natural veining with subtle color variations",
              characteristics: "Porous texture with filled holes, matte finish",
            }),
          },
          finish_reason: "stop",
        },
      ],
    });
  });

  it("uploads and analyzes a material sample", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const testSampleBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const result = await caller.visualization.uploadMaterialSample({
      visualizationId: 1,
      sampleBase64: testSampleBase64,
      mimeType: "image/png",
      surfaceType: "walls",
    });

    expect(result).toHaveProperty("id", 1);
    expect(result).toHaveProperty("sample");
    expect(result.sample).toHaveProperty("surfaceType", "walls");
    expect(result.sample).toHaveProperty("sampleUrl");
    expect(result.sample).toHaveProperty("analysis");
    expect(result.sample.analysis).toHaveProperty("materialType");
    expect(result.status).toBe("sample_uploaded");
  });

  it("throws error when visualization not found", async () => {
    const { getMarbleVisualizationById } = await import("./db");
    vi.mocked(getMarbleVisualizationById).mockResolvedValueOnce(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.visualization.uploadMaterialSample({
        visualizationId: 999,
        sampleBase64: "test",
        mimeType: "image/png",
        surfaceType: "walls",
      })
    ).rejects.toThrow("Visualization not found");
  });
});

describe("visualization.processSelective", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes selected surfaces with bardiglio marble", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.visualization.processSelective({
      visualizationId: 1,
      marbleType: "bardiglio",
      surfaces: {
        walls: true,
        floors: true,
        ceilings: false,
      },
      useMaterialSample: false,
    });

    expect(result).toHaveProperty("id", 1);
    expect(result).toHaveProperty("marbleType", "bardiglio");
    expect(result).toHaveProperty("imageUrl");
    expect(result).toHaveProperty("surfaces");
    expect(result.surfaces.walls).toBe(true);
    expect(result.surfaces.floors).toBe(true);
    expect(result.surfaces.ceilings).toBe(false);
    expect(result.status).toBe("completed");
  });

  it("processes only walls with venatino marble", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.visualization.processSelective({
      visualizationId: 1,
      marbleType: "venatino",
      surfaces: {
        walls: true,
        floors: false,
        ceilings: false,
      },
      useMaterialSample: false,
    });

    expect(result).toHaveProperty("marbleType", "venatino");
    expect(result.surfaces.walls).toBe(true);
    expect(result.surfaces.floors).toBe(false);
    expect(result.status).toBe("completed");
  });

  it("throws error when no surfaces selected", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.visualization.processSelective({
        visualizationId: 1,
        marbleType: "bardiglio",
        surfaces: {
          walls: false,
          floors: false,
          ceilings: false,
        },
        useMaterialSample: false,
      })
    ).rejects.toThrow("Please select at least one surface to transform");
  });

  it("throws error when visualization not found", async () => {
    const { getMarbleVisualizationById } = await import("./db");
    vi.mocked(getMarbleVisualizationById).mockResolvedValueOnce(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.visualization.processSelective({
        visualizationId: 999,
        marbleType: "bardiglio",
        surfaces: { walls: true, floors: true, ceilings: false },
        useMaterialSample: false,
      })
    ).rejects.toThrow("Visualization not found");
  });

  it("uses material samples when available", async () => {
    const { getMarbleVisualizationById } = await import("./db");
    vi.mocked(getMarbleVisualizationById).mockResolvedValueOnce({
      id: 1,
      sessionId: "test-session-123",
      originalImageUrl: "https://example.com/original.jpg",
      bardiglioImageUrl: null,
      venatinoImageUrl: null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      errorMessage: null,
      surfaceDetection: null,
      materialSamples: JSON.stringify([
        {
          surfaceType: "walls",
          sampleUrl: "https://example.com/sample.jpg",
          analysis: {
            materialType: "travertine",
            colorPalette: ["beige"],
            patterns: "Natural veining",
            characteristics: "Porous texture",
          },
        },
      ]),
      selectedSurfaces: null,
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.visualization.processSelective({
      visualizationId: 1,
      marbleType: "bardiglio",
      surfaces: { walls: true, floors: false, ceilings: false },
      useMaterialSample: true,
    });

    expect(result.status).toBe("completed");
    expect(result).toHaveProperty("imageUrl");
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

describe("visualization.process (backward compatibility)", () => {
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
      surfaceDetection: null,
      materialSamples: null,
      selectedSurfaces: null,
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
    vi.mocked(getMarbleVisualizationById).mockResolvedValueOnce(undefined);

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

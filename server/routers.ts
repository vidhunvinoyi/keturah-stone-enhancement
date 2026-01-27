import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { 
  createMarbleVisualization, 
  getMarbleVisualizationById, 
  getMarbleVisualizationsBySession,
  updateMarbleVisualization,
  createCustomMarble,
  getCustomMarbleById,
  getCustomMarblesByOwner,
  getAllCustomMarbles,
  updateCustomMarble,
  deleteCustomMarble
} from "./db";
import { nanoid } from "nanoid";

// Surface types that can be detected and replaced
const SURFACE_TYPES = ["walls", "floors", "ceilings"] as const;
type SurfaceType = typeof SURFACE_TYPES[number];

// Surface detection result schema
const surfaceDetectionSchema = {
  name: "surface_detection",
  strict: true,
  schema: {
    type: "object",
    properties: {
      walls: {
        type: "object",
        properties: {
          detected: { type: "boolean", description: "Whether walls are detected in the image" },
          confidence: { type: "number", description: "Confidence score 0-100" },
          material: { type: "string", description: "Detected material type (e.g., marble, travertine, paint, tile)" },
          description: { type: "string", description: "Brief description of the wall surfaces" },
        },
        required: ["detected", "confidence", "material", "description"],
        additionalProperties: false,
      },
      floors: {
        type: "object",
        properties: {
          detected: { type: "boolean", description: "Whether floors are detected in the image" },
          confidence: { type: "number", description: "Confidence score 0-100" },
          material: { type: "string", description: "Detected material type (e.g., marble, travertine, wood, tile)" },
          description: { type: "string", description: "Brief description of the floor surfaces" },
        },
        required: ["detected", "confidence", "material", "description"],
        additionalProperties: false,
      },
      ceilings: {
        type: "object",
        properties: {
          detected: { type: "boolean", description: "Whether ceilings are detected in the image" },
          confidence: { type: "number", description: "Confidence score 0-100" },
          material: { type: "string", description: "Detected material type (e.g., marble, paint, wood, plaster)" },
          description: { type: "string", description: "Brief description of the ceiling surfaces" },
        },
        required: ["detected", "confidence", "material", "description"],
        additionalProperties: false,
      },
      overallAnalysis: {
        type: "string",
        description: "Overall analysis of the room and its surfaces",
      },
      canAutoDetect: {
        type: "boolean",
        description: "Whether the AI can confidently detect and replace materials automatically",
      },
    },
    required: ["walls", "floors", "ceilings", "overallAnalysis", "canAutoDetect"],
    additionalProperties: false,
  },
};

// Marble analysis schema for custom marble uploads
const marbleAnalysisSchema = {
  name: "marble_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      baseColor: { type: "string", description: "Primary base color of the marble" },
      veiningColors: { 
        type: "array", 
        items: { type: "string" },
        description: "Colors present in the veining" 
      },
      veiningPattern: { type: "string", description: "Description of the veining pattern (e.g., bold dramatic, delicate subtle, linear, swirling)" },
      texture: { type: "string", description: "Surface texture description" },
      characteristics: { type: "string", description: "Key visual characteristics for replacement" },
      suggestedApplications: { 
        type: "array", 
        items: { type: "string" },
        description: "Best surfaces for this marble (walls, floors, ceilings)" 
      },
    },
    required: ["baseColor", "veiningColors", "veiningPattern", "texture", "characteristics", "suggestedApplications"],
    additionalProperties: false,
  },
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Custom Marble Router
  customMarble: router({
    // Create a new custom marble with 300 DPI image upload
    create: publicProcedure
      .input(z.object({
        name: z.string().min(1, "Marble name is required"),
        origin: z.string().optional(),
        baseColor: z.string().optional(),
        veiningPattern: z.string().optional(),
        description: z.string().optional(),
        imageBase64: z.string().min(1, "Marble image is required"),
        mimeType: z.string().default("image/jpeg"),
        googleDriveLink: z.string().url().optional().or(z.literal("")),
        ownerId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const ownerId = input.ownerId || nanoid();
        
        // Upload the 300 DPI marble image to S3
        const buffer = Buffer.from(input.imageBase64, "base64");
        const fileKey = `marbles/${ownerId}/${Date.now()}-${input.name.toLowerCase().replace(/\s+/g, '-')}.${input.mimeType.split('/')[1] || 'jpg'}`;
        const { url: imageUrl } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Use AI to analyze the marble characteristics
        const analysisResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert marble and stone analyst. Analyze the provided marble image and identify its key visual characteristics that will be used for material replacement in interior renders. Focus on:
1. Base color and undertones
2. Veining colors and patterns
3. Texture and surface qualities
4. Best applications (walls, floors, ceilings)`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this marble sample image for "${input.name}"${input.origin ? ` from ${input.origin}` : ''}. Provide detailed characteristics for use in AI-powered material replacement.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: marbleAnalysisSchema,
          },
        });

        const analysisContent = analysisResult.choices[0]?.message?.content;
        let marbleAnalysis = null;
        if (analysisContent && typeof analysisContent === "string") {
          marbleAnalysis = JSON.parse(analysisContent);
        }

        // Create the custom marble record
        const id = await createCustomMarble({
          ownerId,
          name: input.name,
          origin: input.origin || null,
          baseColor: marbleAnalysis?.baseColor || input.baseColor || null,
          veiningPattern: marbleAnalysis?.veiningPattern || input.veiningPattern || null,
          description: input.description || null,
          imageUrl,
          googleDriveLink: input.googleDriveLink || null,
          marbleAnalysis: marbleAnalysis ? JSON.stringify(marbleAnalysis) : null,
          isPublic: "false",
        });

        return {
          id,
          ownerId,
          name: input.name,
          imageUrl,
          googleDriveLink: input.googleDriveLink || null,
          analysis: marbleAnalysis,
          status: "created" as const,
        };
      }),

    // Get a custom marble by ID
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const marble = await getCustomMarbleById(input.id);
        if (!marble) {
          throw new Error("Custom marble not found");
        }
        return {
          ...marble,
          analysis: marble.marbleAnalysis ? JSON.parse(marble.marbleAnalysis) : null,
        };
      }),

    // Get all custom marbles for an owner
    getByOwner: publicProcedure
      .input(z.object({ ownerId: z.string() }))
      .query(async ({ input }) => {
        const marbles = await getCustomMarblesByOwner(input.ownerId);
        return marbles.map(marble => ({
          ...marble,
          analysis: marble.marbleAnalysis ? JSON.parse(marble.marbleAnalysis) : null,
        }));
      }),

    // List all custom marbles (for library page)
    list: publicProcedure
      .query(async () => {
        const marbles = await getAllCustomMarbles();
        return marbles.map(marble => ({
          ...marble,
          analysis: marble.marbleAnalysis ? JSON.parse(marble.marbleAnalysis) : null,
        }));
      }),

    // Update a custom marble
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        origin: z.string().optional(),
        baseColor: z.string().optional(),
        veiningPattern: z.string().optional(),
        description: z.string().optional(),
        googleDriveLink: z.string().url().optional().or(z.literal("")),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        
        // Filter out undefined values
        const filteredData = Object.fromEntries(
          Object.entries(updateData).filter(([_, v]) => v !== undefined)
        ) as Parameters<typeof updateCustomMarble>[1];
        
        await updateCustomMarble(id, filteredData);
        
        return {
          id,
          status: "updated" as const,
        };
      }),

    // Delete a custom marble
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCustomMarble(input.id);
        return {
          id: input.id,
          status: "deleted" as const,
        };
      }),
  }),

  // Marble Visualization Router
  visualization: router({
    // Upload an image and create a visualization record
    upload: publicProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Generate session ID if not provided
        const sessionId = input.sessionId || nanoid();
        
        // Decode base64 and upload to S3
        const buffer = Buffer.from(input.imageBase64, "base64");
        const fileKey = `uploads/${sessionId}/${Date.now()}-original.${input.mimeType.split('/')[1] || 'jpg'}`;
        const { url: originalImageUrl } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Create visualization record
        const id = await createMarbleVisualization({
          sessionId,
          originalImageUrl,
          status: "pending",
        });
        
        return {
          id,
          sessionId,
          originalImageUrl,
          status: "pending" as const,
        };
      }),

    // Detect surfaces in the uploaded image using AI vision
    detectSurfaces: publicProcedure
      .input(z.object({
        visualizationId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const visualization = await getMarbleVisualizationById(input.visualizationId);
        if (!visualization) {
          throw new Error("Visualization not found");
        }

        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert interior design AI that analyzes room images to detect surfaces (walls, floors, ceilings) and identify their materials. Analyze the provided image carefully and identify:
1. Walls - their material (marble, travertine, paint, tile, stone, etc.)
2. Floors - their material (marble, travertine, wood, tile, carpet, etc.)
3. Ceilings - their material (paint, plaster, wood, marble, etc.)

For each surface, provide:
- Whether it's visible/detected in the image
- Confidence score (0-100) of your detection
- The material type you've identified
- A brief description

Also assess whether you can confidently auto-detect and replace materials, or if the user should provide a material sample for better accuracy.`,
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this room image and detect all surfaces (walls, floors, ceilings) along with their materials. Provide detailed information about each surface.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: visualization.originalImageUrl,
                      detail: "high",
                    },
                  },
                ],
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: surfaceDetectionSchema,
            },
          });

          const content = result.choices[0]?.message?.content;
          if (!content || typeof content !== "string") {
            throw new Error("Failed to get surface detection response");
          }

          const detectionResult = JSON.parse(content);

          // Update visualization with detection results
          await updateMarbleVisualization(input.visualizationId, {
            surfaceDetection: JSON.stringify(detectionResult),
          });

          return {
            id: visualization.id,
            detection: detectionResult,
            status: "detected" as const,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Surface detection error:", errorMessage);
          throw new Error(`Surface detection failed: ${errorMessage}`);
        }
      }),

    // Upload a material sample for manual matching
    uploadMaterialSample: publicProcedure
      .input(z.object({
        visualizationId: z.number(),
        sampleBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
        surfaceType: z.enum(["walls", "floors", "ceilings"]),
      }))
      .mutation(async ({ input }) => {
        const visualization = await getMarbleVisualizationById(input.visualizationId);
        if (!visualization) {
          throw new Error("Visualization not found");
        }

        // Upload the sample to S3
        const buffer = Buffer.from(input.sampleBase64, "base64");
        const fileKey = `samples/${visualization.sessionId}/${Date.now()}-${input.surfaceType}-sample.${input.mimeType.split('/')[1] || 'jpg'}`;
        const { url: sampleUrl } = await storagePut(fileKey, buffer, input.mimeType);

        // Use AI to analyze the material sample
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert material analyst. Analyze the provided material sample image and identify:
1. The type of material (marble, travertine, granite, tile, etc.)
2. The color palette and patterns
3. Key visual characteristics that can be used to identify this material in other images`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `This is a material sample for the ${input.surfaceType}. Analyze it and describe its characteristics so we can identify similar materials in the room image.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: sampleUrl,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "material_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  materialType: { type: "string", description: "Type of material identified" },
                  colorPalette: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Main colors in the material" 
                  },
                  patterns: { type: "string", description: "Description of patterns and veining" },
                  characteristics: { type: "string", description: "Key visual characteristics" },
                },
                required: ["materialType", "colorPalette", "patterns", "characteristics"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          throw new Error("Failed to analyze material sample");
        }

        const materialAnalysis = JSON.parse(content);

        // Store the sample info
        const sampleInfo = {
          surfaceType: input.surfaceType,
          sampleUrl,
          analysis: materialAnalysis,
        };

        // Update visualization with material sample
        const existingSamples = visualization.materialSamples 
          ? JSON.parse(visualization.materialSamples) 
          : [];
        existingSamples.push(sampleInfo);

        await updateMarbleVisualization(input.visualizationId, {
          materialSamples: JSON.stringify(existingSamples),
        });

        return {
          id: visualization.id,
          sample: sampleInfo,
          status: "sample_uploaded" as const,
        };
      }),

    // Process with custom marble
    processWithCustomMarble: publicProcedure
      .input(z.object({
        visualizationId: z.number(),
        customMarbleId: z.number(),
        surfaces: z.object({
          walls: z.boolean().default(true),
          floors: z.boolean().default(true),
          ceilings: z.boolean().default(false),
        }),
        useMaterialSample: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const visualization = await getMarbleVisualizationById(input.visualizationId);
        if (!visualization) {
          throw new Error("Visualization not found");
        }

        const customMarble = await getCustomMarbleById(input.customMarbleId);
        if (!customMarble) {
          throw new Error("Custom marble not found");
        }

        // Update status to processing
        await updateMarbleVisualization(input.visualizationId, { status: "processing" });

        try {
          // Build the surface-specific prompt
          const selectedSurfaces: string[] = [];
          if (input.surfaces.walls) selectedSurfaces.push("walls");
          if (input.surfaces.floors) selectedSurfaces.push("floors");
          if (input.surfaces.ceilings) selectedSurfaces.push("ceilings");

          if (selectedSurfaces.length === 0) {
            throw new Error("Please select at least one surface to transform");
          }

          const surfaceList = selectedSurfaces.join(", ");

          // Parse marble analysis for detailed characteristics
          const marbleAnalysis = customMarble.marbleAnalysis 
            ? JSON.parse(customMarble.marbleAnalysis) 
            : null;

          // Get material sample info if using manual matching
          let materialContext = "";
          if (input.useMaterialSample && visualization.materialSamples) {
            const samples = JSON.parse(visualization.materialSamples);
            if (samples.length > 0) {
              materialContext = `\n\nThe user has provided material samples to help identify surfaces. Focus on replacing materials that match these characteristics:\n${samples.map((s: { surfaceType: string; analysis: { materialType: string; characteristics: string } }) => 
                `- ${s.surfaceType}: ${s.analysis.materialType} with ${s.analysis.characteristics}`
              ).join("\n")}`;
            }
          }

          // Build detailed marble description
          let marbleDescription = `${customMarble.name}`;
          if (customMarble.origin) {
            marbleDescription += ` from ${customMarble.origin}`;
          }
          if (marbleAnalysis) {
            marbleDescription += ` - ${marbleAnalysis.baseColor} base color with ${marbleAnalysis.veiningPattern} veining in ${marbleAnalysis.veiningColors?.join(', ') || 'contrasting'} tones. ${marbleAnalysis.characteristics}`;
          } else if (customMarble.baseColor && customMarble.veiningPattern) {
            marbleDescription += ` - ${customMarble.baseColor} base with ${customMarble.veiningPattern} veining`;
          }

          const prompt = `Transform this interior image by replacing the stone, marble, or travertine surfaces ONLY on the following: ${surfaceList}.

Replace these surfaces with ${marbleDescription}.

REFERENCE: Use the provided marble sample image as the exact reference for the marble appearance, color, and veining pattern.

IMPORTANT INSTRUCTIONS:
- ONLY modify the ${surfaceList} - leave all other surfaces unchanged
- Match the marble appearance EXACTLY to the reference marble image provided
- Maintain the exact same composition, lighting, shadows, reflections, and perspective
- Preserve all furniture, fixtures, decorations, and architectural details
- The result should be photorealistic with natural marble texture and veining
- Match the scale and direction of the marble veining appropriately for each surface${materialContext}`;

          const result = await generateImage({
            prompt,
            originalImages: [
              {
                url: visualization.originalImageUrl,
                mimeType: "image/jpeg",
              },
              {
                url: customMarble.imageUrl,
                mimeType: "image/jpeg",
              },
            ],
          });

          if (!result.url) {
            throw new Error("Image generation failed - no URL returned");
          }

          // Update the visualization record with the processed image
          await updateMarbleVisualization(input.visualizationId, {
            customMarbleImageUrl: result.url,
            customMarbleId: input.customMarbleId,
            status: "completed",
          });

          return {
            id: visualization.id,
            imageUrl: result.url,
            customMarble: {
              id: customMarble.id,
              name: customMarble.name,
              imageUrl: customMarble.imageUrl,
            },
            surfaces: input.surfaces,
            status: "completed" as const,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          await updateMarbleVisualization(input.visualizationId, { 
            status: "failed", 
            errorMessage 
          });
          throw error;
        }
      }),

    // Process the uploaded image with selective surface marble replacement
    processSelective: publicProcedure
      .input(z.object({
        visualizationId: z.number(),
        marbleType: z.enum(["bardiglio", "venatino"]),
        surfaces: z.object({
          walls: z.boolean().default(true),
          floors: z.boolean().default(true),
          ceilings: z.boolean().default(false),
        }),
        useMaterialSample: z.boolean().default(false),
        // Custom boundary coordinates for precise surface selection
        customBoundaries: z.array(z.object({
          id: z.string(),
          type: z.enum(["walls", "floors", "ceilings"]),
          points: z.array(z.object({
            x: z.number(),
            y: z.number(),
          })),
          visible: z.boolean(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const visualization = await getMarbleVisualizationById(input.visualizationId);
        if (!visualization) {
          throw new Error("Visualization not found");
        }

        // Update status to processing
        await updateMarbleVisualization(input.visualizationId, { status: "processing" });

        try {
          // Build the surface-specific prompt
          const selectedSurfaces: string[] = [];
          if (input.surfaces.walls) selectedSurfaces.push("walls");
          if (input.surfaces.floors) selectedSurfaces.push("floors");
          if (input.surfaces.ceilings) selectedSurfaces.push("ceilings");

          if (selectedSurfaces.length === 0) {
            throw new Error("Please select at least one surface to transform");
          }

          const surfaceList = selectedSurfaces.join(", ");

          // Get material sample info if using manual matching
          let materialContext = "";
          if (input.useMaterialSample && visualization.materialSamples) {
            const samples = JSON.parse(visualization.materialSamples);
            if (samples.length > 0) {
              materialContext = `\n\nThe user has provided material samples to help identify surfaces. Focus on replacing materials that match these characteristics:\n${samples.map((s: { surfaceType: string; analysis: { materialType: string; characteristics: string } }) => 
                `- ${s.surfaceType}: ${s.analysis.materialType} with ${s.analysis.characteristics}`
              ).join("\n")}`;
            }
          }

          // Generate marble replacement prompt based on type and selected surfaces
          const marbleDescriptions = {
            bardiglio: "Bardiglio marble from Carrara, Italy - a sophisticated gray-blue base color with elegant white veining patterns",
            venatino: "Venatino marble from Carrara, Italy - a pristine white base with delicate gray-green veining patterns",
          };

          // Add custom boundary context if provided
          let boundaryContext = "";
          if (input.customBoundaries && input.customBoundaries.length > 0) {
            const visibleBoundaries = input.customBoundaries.filter(b => b.visible);
            if (visibleBoundaries.length > 0) {
              boundaryContext = `\n\nThe user has manually defined specific regions for each surface type. Focus the marble replacement precisely within these user-defined boundaries:\n${visibleBoundaries.map(b => 
                `- ${b.type}: User-defined polygon region with ${b.points.length} vertices`
              ).join("\n")}`;
            }
          }

          const prompt = `Transform this interior image by replacing the stone, marble, or travertine surfaces ONLY on the following: ${surfaceList}.

Replace these surfaces with ${marbleDescriptions[input.marbleType]}.

IMPORTANT INSTRUCTIONS:
- ONLY modify the ${surfaceList} - leave all other surfaces unchanged
- Maintain the exact same composition, lighting, shadows, reflections, and perspective
- Preserve all furniture, fixtures, decorations, and architectural details
- The result should be photorealistic with natural marble texture and veining
- Match the scale and direction of the marble veining appropriately for each surface${materialContext}${boundaryContext}`;

          const result = await generateImage({
            prompt,
            originalImages: [{
              url: visualization.originalImageUrl,
              mimeType: "image/jpeg",
            }],
          });

          if (!result.url) {
            throw new Error("Image generation failed - no URL returned");
          }

          // Update the visualization record with the processed image
          const updateData = input.marbleType === "bardiglio" 
            ? { bardiglioImageUrl: result.url, status: "completed" as const }
            : { venatinoImageUrl: result.url, status: "completed" as const };
          
          await updateMarbleVisualization(input.visualizationId, updateData);

          return {
            id: visualization.id,
            imageUrl: result.url,
            marbleType: input.marbleType,
            surfaces: input.surfaces,
            status: "completed" as const,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          await updateMarbleVisualization(input.visualizationId, { 
            status: "failed", 
            errorMessage 
          });
          throw error;
        }
      }),

    // Original process endpoint (kept for backward compatibility)
    process: publicProcedure
      .input(z.object({
        visualizationId: z.number(),
        marbleType: z.enum(["bardiglio", "venatino"]),
      }))
      .mutation(async ({ input }) => {
        const visualization = await getMarbleVisualizationById(input.visualizationId);
        if (!visualization) {
          throw new Error("Visualization not found");
        }

        // Check if already processed for this marble type
        if (input.marbleType === "bardiglio" && visualization.bardiglioImageUrl) {
          return {
            id: visualization.id,
            imageUrl: visualization.bardiglioImageUrl,
            marbleType: input.marbleType,
            status: "completed" as const,
          };
        }
        if (input.marbleType === "venatino" && visualization.venatinoImageUrl) {
          return {
            id: visualization.id,
            imageUrl: visualization.venatinoImageUrl,
            marbleType: input.marbleType,
            status: "completed" as const,
          };
        }

        // Update status to processing
        await updateMarbleVisualization(input.visualizationId, { status: "processing" });

        try {
          // Generate marble replacement prompt based on type
          const marblePrompts = {
            bardiglio: `Transform this interior image by replacing any visible stone, marble, or travertine surfaces with Bardiglio marble from Carrara, Italy. Bardiglio marble has a sophisticated gray-blue base color with elegant white veining patterns. Maintain the exact same composition, lighting, shadows, reflections, and perspective. Only change the marble material while preserving all other elements including furniture, fixtures, and architectural details. The result should be photorealistic with natural marble texture and veining.`,
            venatino: `Transform this interior image by replacing any visible stone, marble, or travertine surfaces with Venatino marble from Carrara, Italy. Venatino marble has a pristine white base with delicate gray-green veining patterns. Maintain the exact same composition, lighting, shadows, reflections, and perspective. Only change the marble material while preserving all other elements including furniture, fixtures, and architectural details. The result should be photorealistic with natural marble texture and veining.`,
          };

          const result = await generateImage({
            prompt: marblePrompts[input.marbleType],
            originalImages: [{
              url: visualization.originalImageUrl,
              mimeType: "image/jpeg",
            }],
          });

          if (!result.url) {
            throw new Error("Image generation failed - no URL returned");
          }

          // Update the visualization record with the processed image
          const updateData = input.marbleType === "bardiglio" 
            ? { bardiglioImageUrl: result.url, status: "completed" as const }
            : { venatinoImageUrl: result.url, status: "completed" as const };
          
          await updateMarbleVisualization(input.visualizationId, updateData);

          return {
            id: visualization.id,
            imageUrl: result.url,
            marbleType: input.marbleType,
            status: "completed" as const,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          await updateMarbleVisualization(input.visualizationId, { 
            status: "failed", 
            errorMessage 
          });
          throw error;
        }
      }),

    // Generate surface highlight overlay image
    generateHighlight: publicProcedure
      .input(z.object({
        visualizationId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const visualization = await getMarbleVisualizationById(input.visualizationId);
        if (!visualization) {
          throw new Error("Visualization not found");
        }

        // Check if we have surface detection data
        if (!visualization.surfaceDetection) {
          throw new Error("Surface detection must be run first");
        }

        const detection = JSON.parse(visualization.surfaceDetection);

        try {
          // Generate a highlighted version of the image showing detected surfaces
          const highlightPrompt = `Create a visual overlay on this interior image that highlights the detected surfaces with semi-transparent color overlays:

- WALLS: Apply a semi-transparent BLUE overlay (rgba(59, 130, 246, 0.4)) to all wall surfaces${detection.walls.detected ? ` - Detected with ${detection.walls.confidence}% confidence: ${detection.walls.description}` : ' - Not detected'}
- FLOORS: Apply a semi-transparent GREEN overlay (rgba(34, 197, 94, 0.4)) to all floor surfaces${detection.floors.detected ? ` - Detected with ${detection.floors.confidence}% confidence: ${detection.floors.description}` : ' - Not detected'}
- CEILINGS: Apply a semi-transparent YELLOW/AMBER overlay (rgba(245, 158, 11, 0.4)) to all ceiling surfaces${detection.ceilings.detected ? ` - Detected with ${detection.ceilings.confidence}% confidence: ${detection.ceilings.description}` : ' - Not detected'}

IMPORTANT INSTRUCTIONS:
- Keep the original image clearly visible beneath the overlays
- The overlays should be semi-transparent so the original surfaces are still visible
- Only highlight surfaces that were detected (confidence > 50%)
- Maintain all other elements (furniture, fixtures, decorations) without any overlay
- The result should clearly show which areas will be transformed with marble`;

          const result = await generateImage({
            prompt: highlightPrompt,
            originalImages: [{
              url: visualization.originalImageUrl,
              mimeType: "image/jpeg",
            }],
          });

          if (!result.url) {
            throw new Error("Highlight generation failed - no URL returned");
          }

          // Store the highlight image URL
          await updateMarbleVisualization(input.visualizationId, {
            highlightImageUrl: result.url,
          });

          return {
            id: visualization.id,
            highlightImageUrl: result.url,
            detection: detection,
            status: "highlighted" as const,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Highlight generation error:", errorMessage);
          throw new Error(`Highlight generation failed: ${errorMessage}`);
        }
      }),

    // Get visualization by ID
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getMarbleVisualizationById(input.id);
      }),

    // Get all visualizations for a session
    getBySession: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        return await getMarbleVisualizationsBySession(input.sessionId);
      }),
  }),
});

export type AppRouter = typeof appRouter;

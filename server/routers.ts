import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { 
  createMarbleVisualization, 
  getMarbleVisualizationById, 
  getMarbleVisualizationsBySession,
  updateMarbleVisualization 
} from "./db";
import { nanoid } from "nanoid";

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

    // Process the uploaded image with marble replacement
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

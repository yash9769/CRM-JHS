import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const stickyNoteSchema = z.object({
  title: z.string().optional().nullable(),
  content: z.string().default(""),
  color: z.string().optional().nullable(),
  isPinned: z.boolean().optional(),
  isMinimized: z.boolean().optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
});

const updateStickyNoteSchema = stickyNoteSchema.partial();

export default async function stickyNoteRoutes(app: FastifyInstance) {
  // GET /api/v1/sticky-notes - Get user's sticky notes (support isPinned filter)
  app.get("/api/v1/sticky-notes", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as { isPinned?: string };
    const tenantId = req.authUser.tenantId;
    const userId = req.authUser.id;

    const notes = await prisma.stickyNote.findMany({
      where: {
        tenantId,
        userId,
        ...(q.isPinned === "true" ? { isPinned: true } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    return { data: notes };
  });

  // POST /api/v1/sticky-notes - Create a new sticky note
  app.post("/api/v1/sticky-notes", { preHandler: app.authenticate }, async (req, reply) => {
    const body = stickyNoteSchema.parse(req.body || {});
    const tenantId = req.authUser.tenantId;
    const userId = req.authUser.id;

    const note = await prisma.stickyNote.create({
      data: {
        tenantId,
        userId,
        title: body.title || "Note",
        content: body.content || "",
        color: body.color || "yellow",
        isPinned: body.isPinned ?? false,
        isMinimized: body.isMinimized ?? false,
        positionX: body.positionX ?? 0,
        positionY: body.positionY ?? 0,
      },
    });

    return reply.code(201).send({ data: note });
  });

  // PATCH /api/v1/sticky-notes/:id - Update sticky note
  app.patch("/api/v1/sticky-notes/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateStickyNoteSchema.parse(req.body);
    const tenantId = req.authUser.tenantId;
    const userId = req.authUser.id;

    const existing = await prisma.stickyNote.findFirst({
      where: { id, tenantId, userId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "Sticky note not found" });
    }

    const updated = await prisma.stickyNote.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.isPinned !== undefined ? { isPinned: body.isPinned } : {}),
        ...(body.isMinimized !== undefined ? { isMinimized: body.isMinimized } : {}),
        ...(body.positionX !== undefined ? { positionX: body.positionX } : {}),
        ...(body.positionY !== undefined ? { positionY: body.positionY } : {}),
      },
    });

    return { data: updated };
  });

  // DELETE /api/v1/sticky-notes/:id - Delete sticky note
  app.delete("/api/v1/sticky-notes/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.authUser.tenantId;
    const userId = req.authUser.id;

    const existing = await prisma.stickyNote.findFirst({
      where: { id, tenantId, userId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "Sticky note not found" });
    }

    await prisma.stickyNote.delete({ where: { id } });

    return { success: true };
  });
}

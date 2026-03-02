import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type NotebookRow = {
  id: string;
  conceptId: string;
  conceptName: string;
  conceptType: string;
  context: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function ensureNotebookTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS saved_concepts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      concept_id TEXT NOT NULL,
      concept_name TEXT NOT NULL,
      concept_type TEXT NOT NULL,
      context TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, concept_id)
    );
  `);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await ensureNotebookTable();

    if (req.method === "GET") {
      const rows = await prisma.$queryRawUnsafe<NotebookRow[]>(
        `
          SELECT
            id,
            concept_id as "conceptId",
            concept_name as "conceptName",
            concept_type as "conceptType",
            context,
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM saved_concepts
          WHERE user_id = $1
          ORDER BY updated_at DESC
        `,
        session.user.id
      );

      return res.status(200).json({ concepts: rows });
    }

    if (req.method === "POST") {
      const {
        conceptId,
        conceptName,
        conceptType = "UNKNOWN",
        context = null,
      } = req.body ?? {};

      if (!conceptId || !conceptName) {
        return res.status(400).json({ error: "Missing conceptId or conceptName" });
      }

      const id = randomUUID();
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO saved_concepts (id, user_id, concept_id, concept_name, concept_type, context)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, concept_id)
          DO UPDATE SET
            concept_name = EXCLUDED.concept_name,
            concept_type = EXCLUDED.concept_type,
            context = EXCLUDED.context,
            updated_at = NOW()
        `,
        id,
        session.user.id,
        conceptId,
        conceptName,
        conceptType,
        context
      );

      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const conceptId = req.body?.conceptId;
      if (!conceptId) {
        return res.status(400).json({ error: "Missing conceptId" });
      }

      await prisma.$executeRawUnsafe(
        `DELETE FROM saved_concepts WHERE user_id = $1 AND concept_id = $2`,
        session.user.id,
        conceptId
      );

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Notebook concepts API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

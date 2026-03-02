import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SUPPORTED_LANGUAGES = ["fr", "es", "de"];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { targetLanguage } = req.body;

  if (!targetLanguage || !SUPPORTED_LANGUAGES.includes(targetLanguage)) {
    return res
      .status(400)
      .json({ error: "Invalid language. Supported: " + SUPPORTED_LANGUAGES.join(", ") });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { targetLanguage },
    });

    return res.json({ success: true, targetLanguage });
  } catch (err) {
    console.error("Failed to update language:", err);
    return res.status(500).json({ error: "Failed to update language" });
  }
}

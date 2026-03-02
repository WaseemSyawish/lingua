import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Returns a short-lived Azure Speech token so the client can
 * use the Speech SDK without exposing the subscription key.
 * Token is valid for 10 minutes.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    return res.status(503).json({ error: "Speech service not configured" });
  }

  try {
    const tokenResponse = await fetch(
      `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": speechKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!tokenResponse.ok) {
      throw new Error(`Azure returned ${tokenResponse.status}`);
    }

    const token = await tokenResponse.text();

    // Short cache — token is valid 10 min, cache for 9
    res.setHeader("Cache-Control", "private, max-age=540");
    return res.status(200).json({ token, region: speechRegion });
  } catch (err: any) {
    console.error("Speech token error:", err);
    return res.status(500).json({ error: "Failed to fetch speech token" });
  }
}

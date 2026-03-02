// Award XP to existing users based on their activity
const mod = await import('../src/generated/prisma/client.ts');
const { PrismaClient } = mod;
import { PrismaPg } from '@prisma/adapter-pg';
const xpMod = await import('../src/lib/xp-constants.ts');
const { calculateLevel } = xpMod;

const url = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: url });
const p = new PrismaClient({ adapter });

const users = await p.user.findMany({
  include: {
    sessions: true,
    conceptMasteries: true,
  },
});

for (const user of users) {
  const sessionCount = user.sessions.length;
  const masteryCount = user.conceptMasteries.length;
  
  // Award: 60 XP per session + 10 XP per mastery + 50 XP base welcome bonus
  const sessionXp = sessionCount * 60;
  const masteryXp = masteryCount * 10;
  const bonusXp = 50;
  const totalXp = sessionXp + masteryXp + bonusXp;
  const newLevel = calculateLevel(totalXp);
  
  console.log(`User: ${user.name} — ${sessionCount} sessions, ${masteryCount} masteries`);
  console.log(`  Awarding: ${sessionXp} (sessions) + ${masteryXp} (mastery) + ${bonusXp} (bonus) = ${totalXp} XP → Level ${newLevel}`);
  
  await p.$transaction([
    p.user.update({
      where: { id: user.id },
      data: { xp: totalXp, xpLevel: newLevel },
    }),
    p.xpTransaction.create({
      data: {
        userId: user.id,
        amount: totalXp,
        source: "retroactive_award",
        description: `Retroactive XP for ${sessionCount} sessions and ${masteryCount} concept masteries`,
      },
    }),
  ]);
  
  console.log(`  ✓ Updated successfully`);
}

await p.$disconnect();
console.log("Done!");

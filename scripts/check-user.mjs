// Run with: npx tsx scripts/check-user.mjs
const mod = await import('../src/generated/prisma/client.ts');
const { PrismaClient } = mod;
import { PrismaPg } from '@prisma/adapter-pg';

const url = process.env.DATABASE_URL;
let p;
if (url && url.startsWith("prisma+postgres://")) {
  p = new PrismaClient({ accelerateUrl: url });
} else {
  const adapter = new PrismaPg({ connectionString: url });
  p = new PrismaClient({ adapter });
}
const users = await p.user.findMany({
  select: { id: true, name: true, xp: true, xpLevel: true, currentCEFRLevel: true }
});
console.log(JSON.stringify(users, null, 2));

const sessions = await p.conversationSession.count();
const masteries = await p.conceptMastery.count();
console.log(`Total sessions: ${sessions}, Total masteries: ${masteries}`);

await p.$disconnect();

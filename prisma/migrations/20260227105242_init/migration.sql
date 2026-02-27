-- CreateEnum
CREATE TYPE "CEFRLevel" AS ENUM ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('PLACEMENT', 'LESSON', 'FREE_CONVERSATION', 'REVIEW');

-- CreateEnum
CREATE TYPE "ConceptType" AS ENUM ('GRAMMAR', 'VOCABULARY', 'PRONUNCIATION', 'CULTURE', 'PRAGMATICS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "nativeLanguage" TEXT NOT NULL DEFAULT 'en',
    "targetLanguage" TEXT NOT NULL DEFAULT 'fr',
    "currentCEFRLevel" "CEFRLevel" NOT NULL DEFAULT 'A0',
    "placementCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentLevel" "CEFRLevel" NOT NULL DEFAULT 'A0',
    "comprehensionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vocabularyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grammarScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fluencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "placementCompletedAt" TIMESTAMP(3),
    "lastAssessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "aiModel" TEXT NOT NULL DEFAULT 'claude-haiku-4-20250414',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "focusConcepts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_masteries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "conceptType" "ConceptType" NOT NULL,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "practiceCount" INTEGER NOT NULL DEFAULT 0,
    "lastPracticed" TIMESTAMP(3),

    CONSTRAINT "concept_masteries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_histories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromLevel" "CEFRLevel" NOT NULL,
    "toLevel" "CEFRLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "level_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_summaries" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "topicsCovered" TEXT NOT NULL DEFAULT '',
    "vocabularyIntroduced" TEXT NOT NULL DEFAULT '',
    "grammarPracticed" TEXT NOT NULL DEFAULT '',
    "errorsObserved" TEXT NOT NULL DEFAULT '',
    "overallNotes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "session_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_profiles_userId_key" ON "skill_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_sessions_userId_sessionNumber_key" ON "conversation_sessions"("userId", "sessionNumber");

-- CreateIndex
CREATE INDEX "conversation_messages_sessionId_createdAt_idx" ON "conversation_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "concept_masteries_userId_idx" ON "concept_masteries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "concept_masteries_userId_conceptId_key" ON "concept_masteries"("userId", "conceptId");

-- CreateIndex
CREATE INDEX "level_histories_userId_idx" ON "level_histories"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_summaries_sessionId_key" ON "session_summaries"("sessionId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_profiles" ADD CONSTRAINT "skill_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_masteries" ADD CONSTRAINT "concept_masteries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_histories" ADD CONSTRAINT "level_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

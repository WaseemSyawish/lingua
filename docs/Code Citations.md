# Code Citations

## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete:
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: Apache-2.0
https://github.com/theatre-js/theatre/blob/ec4ad14839265b40565ec76e22f736cecaee2be1/packages/app/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/ryanmacdonaldio/pm/blob/70b37933e70e500b5fe13ff9abd2032cf3eb401a/libs/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/Seth-McKilla/xbeach-ui/blob/db21b9e8d6ad309139840007a7b27a8cc5866ad8/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/ckstn0777/Ah-Baegopa-Client/blob/406dd63c1919ab5be7040cbe62f06b5d18ff2b48/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


## License: unknown
https://github.com/timsu/aipa/blob/34ff9da8ddc5699724263fc18bdac9c59c4498a6/prisma/schema.prisma

```
Research complete. Now I have all the technical details needed to produce the full plan. Here it is:

---

## Plan: AI Language Tutor — "Lingua" V1

**TL;DR:** A conversational AI language tutor built on Next.js 15 (Pages Router), Prisma + Railway PostgreSQL, Anthropic Claude API, NextAuth v4, Tailwind CSS, and Motion. The tutor teaches French through natural conversation grounded in CEFR levels and Krashen's i+1 hypothesis. V1 is text-only. The architecture separates the curriculum (stored as structured JSON/TS constants), user skill profiles (PostgreSQL via Prisma), and conversation memory (hybrid: recent messages verbatim + older sessions summarized). The AI extracts mastery data via a structured JSON call at session end AND inline lightweight tagging during conversation. Streaming responses use SSE via Pages Router API routes piping the Anthropic SDK stream directly to the client.

---

### 1. Architecture Answers

**1.1 — Database Schema**

Seven core models: `User`, `ConversationSession`, `ConversationMessage`, `SkillProfile`, `ConceptMastery`, `LevelHistory`, `SessionSummary`.

- **User** — id, email, passwordHash (nullable for OAuth), name, nativeLanguage, targetLanguage (default "fr"), currentCEFRLevel (enum: A0–C2, default A0), placementCompleted (bool), createdAt, updatedAt. Relations: sessions[], skillProfile, levelHistory[], conceptMasteries[].

- **SkillProfile** — id, userId (unique 1:1), listeningLevel, readingLevel, writingLevel, speakingLevel (all enum A0–C2), overallConfidence (float 0–1), placementNotes (text — raw AI assessment from placement), lastAssessedAt. This is the AI's live read of the user.

- **ConversationSession** — id, userId, sessionNumber (auto-increment per user), cefrLevelAtStart, cefrLevelAtEnd, startedAt, endedAt, sessionType (enum: PLACEMENT, LESSON, FREE_CONVERSATION, REVIEW), topicFocus (nullable string), aiModel (string — "haiku" or "sonnet"), tokenCount (int — for cost tracking). Relations: messages[], summary.

- **ConversationMessage** — id, sessionId, role (enum: USER, ASSISTANT, SYSTEM), content (text), tokenCount (int, nullable), createdAt. Ordered by createdAt. No nesting — flat message log.

- **ConceptMastery** — id, userId, conceptId (string — maps to curriculum constant, e.g. "grammar.passe_compose"), conceptType (enum: GRAMMAR, VOCABULARY, PRONUNCIATION, CULTURE), confidenceScore (float 0–1), timesUsedCorrectly, timesUsedIncorrectly, lastSeenAt, lastCorrectAt, nextReviewAt (for spaced repetition scheduling), streakSessions (int — consecutive sessions with correct unprompted use). Unique constraint on [userId, conceptId].

- **LevelHistory** — id, userId, fromLevel, toLevel (both enum), advancedAt (datetime), evidenceSummary (text — AI's reasoning for why advancement was granted).

- **SessionSummary** — id, sessionId (unique 1:1), userId, keyTopicsCovered (string[]), errorsIdentified (JSON — array of {concept, userSaid, correction, severity}), conceptsToReview (string[]), progressNotes (text), overallSessionQuality (float 0–1), generatedByModel (string).

**1.2 — Conversation Memory Architecture**

**Hybrid approach:**

- **Current session**: All messages sent verbatim to Anthropic in the `messages` array. At Haiku's 200K context window, even long sessions fit easily.
- **Cross-session memory**: At session end, Sonnet generates a `SessionSummary` (stored in DB). When a new session begins, the system prompt includes: (a) the user's `SkillProfile`, (b) the last 3 session summaries, (c) all `ConceptMastery` records with confidence < 0.7 (things to revisit), and (d) any `ConceptMastery` records due for spaced repetition review (nextReviewAt <= now).
- **Context budget**: System prompt + memory context targets ~2,000 tokens max. Curriculum instructions are kept lean by only including the current level's curriculum slice, not all levels.

**1.3 — System Prompt Architecture**

**Modular, composed at request time.** Three layers concatenated into one system prompt:

1. **Base persona** (~400 tokens) — The tutor's personality, teaching philosophy, error correction style, affective filter rules. Constant across all levels.
2. **Level-specific curriculum slice** (~600 tokens) — Grammar targets, vocabulary clusters, task types, and constraints for the user's current CEFR level. Pulled from a TypeScript curriculum constants file. Only the current level is injected.
3. **User context block** (~800 tokens) — SkillProfile summary, recent session summaries, concepts due for review, known weak areas, known strengths. Generated dynamically from DB queries.

This totals ~1,800 tokens for the system prompt — well within budget. The prompt is never manually written per level — it's composed programmatically from structured data.

**1.4 — Mastery Tracking Implementation**

**Dual extraction:**

- **End-of-session analysis (Sonnet)**: When the user ends a session (or after 15+ exchanges), the full conversation is sent to Claude Sonnet with a structured output prompt requesting JSON: concepts used correctly, concepts used incorrectly, confidence adjustments, topics covered, errors to surface. This JSON is parsed and used to update `ConceptMastery` records, `SessionSummary`, and potentially `SkillProfile`.
- **No inline extraction during conversation** (V1 simplification): Haiku focuses purely on being a good tutor during the conversation. Extraction happens only at session end. This keeps per-message latency low and avoids complex parsing mid-conversation.

**Spaced repetition scheduling**: After each session analysis, `nextReviewAt` is updated using a simplified SM-2 algorithm: if confidence > 0.8, interval doubles; if confidence 0.5–0.8, interval stays; if confidence < 0.5, interval resets to 1 day.

**Level advancement trigger**: After session analysis, a check runs: if ALL core concepts for the current CEFR level have confidence >= 0.75 across at least 3 separate sessions, AND the SkillProfile shows all four skills at or above the current level, the system flags the user for advancement. The next session's system prompt instructs the tutor to conversationally communicate progress and begin introducing next-level material.

**1.5 — Streaming Responses**

Pages Router API route using SSE:

- Client sends POST to `/api/chat` with `{ sessionId, message }`.
- API route saves the user message to DB, constructs the full messages array + system prompt, calls `client.messages.stream()` from the Anthropic SDK.
- Each `text` event is written to the response via `res.write(`data: ${JSON.stringify({ text })}\n\n`)`.
- On stream completion, the full assistant message is saved to DB.
- Client uses `EventSource` or `fetch` with a ReadableStream reader to consume the SSE.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`.

**1.6 — Onboarding Flow**

1. **Landing page** → value proposition, single CTA: "Start Learning"
2. **Sign up** → email/password or Google OAuth via NextAuth
3. **Language selection** → "What language do you want to learn?" (French only in V1, but UI supports future expansion)
4. **Placement conversation** → The tutor (Sonnet, for higher quality assessment) has a warm 5–10 exchange conversation in English, asking about prior experience, testing passive knowledge naturally. System prompt instructs Sonnet to assess and output a structured placement result.
5. **Profile creation** → Placement result parsed → `SkillProfile` created, `currentCEFRLevel` set.
6. **Dashboard** → Shows current level, "Continue Learning" button, session history.
7. **First real session** → Haiku takes over. System prompt loaded with the user's level curriculum slice and placement notes. Conversation begins.

---

### 2. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CEFRLevel {
  A0
  A1
  A2
  B1
  B2
  C1
  C2
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum SessionType {
  PLACEMENT
  LESSON
  FREE_CONVERSATION
  REVIEW
}

enum ConceptType {
  GRAMMAR
  VOCABULARY
  PRONUNCIATION
  CULTURE
  PRAGMATICS
}

model User {
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String?
  name               String
  image              String?
  nativeLanguage     String              @default("en")
  targetLanguage     String              @default("fr")
  currentCEFRLevel   CEFRLevel           @default(A0)
  placementCompleted Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  accounts           Account[]
  sessions           ConversationSession[]
  skillProfile       SkillProfile?
  conceptMasteries   ConceptMastery[]
  levelHistory       LevelHistory[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model 
```


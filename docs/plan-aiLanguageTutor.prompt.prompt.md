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

model SkillProfile {
  id               String    @id @default(cuid())
  userId           String    @unique
  listeningLevel   CEFRLevel @default(A0)
  readingLevel     CEFRLevel @default(A0)
  writingLevel     CEFRLevel @default(A0)
  speakingLevel    CEFRLevel @default(A0)
  overallConfidence Float    @default(0)
  placementNotes   String?   @db.Text
  lastAssessedAt   DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("skill_profiles")
}

model ConversationSession {
  id              String      @id @default(cuid())
  userId          String
  sessionNumber   Int
  cefrLevelAtStart CEFRLevel
  cefrLevelAtEnd  CEFRLevel?
  startedAt       DateTime    @default(now())
  endedAt         DateTime?
  sessionType     SessionType
  topicFocus      String?
  aiModel         String      @default("haiku")
  tokenCount      Int         @default(0)

  user     User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages ConversationMessage[]
  summary  SessionSummary?

  @@unique([userId, sessionNumber])
  @@map("conversation_sessions")
}

model ConversationMessage {
  id        String      @id @default(cuid())
  sessionId String
  role      MessageRole
  content   String      @db.Text
  tokenCount Int?
  createdAt DateTime    @default(now())

  session ConversationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@map("conversation_messages")
}

model ConceptMastery {
  id                  String      @id @default(cuid())
  userId              String
  conceptId           String
  conceptType         ConceptType
  confidenceScore     Float       @default(0)
  timesUsedCorrectly  Int         @default(0)
  timesUsedIncorrectly Int        @default(0)
  lastSeenAt          DateTime?
  lastCorrectAt       DateTime?
  nextReviewAt        DateTime?
  streakSessions      Int         @default(0)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, conceptId])
  @@index([userId, nextReviewAt])
  @@map("concept_masteries")
}

model LevelHistory {
  id              String    @id @default(cuid())
  userId          String
  fromLevel       CEFRLevel
  toLevel         CEFRLevel
  advancedAt      DateTime  @default(now())
  evidenceSummary String    @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("level_histories")
}

model SessionSummary {
  id                   String   @id @default(cuid())
  sessionId            String   @unique
  userId               String
  keyTopicsCovered     String[]
  errorsIdentified     Json     @default("[]")
  conceptsToReview     String[]
  progressNotes        String   @db.Text
  overallSessionQuality Float   @default(0)
  generatedByModel     String

  session ConversationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("session_summaries")
}
```

---

### 3. System Prompt Architecture

**Layer 1 — Base Persona (constant):**

```
You are Lingua, an AI French language tutor. You teach through natural, warm conversation — never quizzes, never drills, never multiple choice.

Core principles you ALWAYS follow:
- You are patient, encouraging, and genuinely interested in the learner
- Mistakes are learning moments. NEVER penalize, judge, or show disappointment
- Correct errors by naturally weaving the correct form into your next response. Do NOT interrupt the learner's thought to correct
- Your goal is communication and fluency, not perfection
- You follow Krashen's i+1: every response is calibrated just above the learner's current level
- You practice interleaving: mix topics and grammar concepts across the conversation rather than drilling one thing
- You prioritize retrieval practice: encourage the learner to PRODUCE language, not just recognize it
- At A0/A1, you speak primarily English with French woven in contextually. At A2, English reduces. At B1+, you speak mostly French. At B2+, entirely French unless the learner is genuinely lost
- You NEVER give grammar lectures unless the learner explicitly asks. Grammar emerges from conversation
- You are a tutor, not a textbook. Be human. Use humor when appropriate. Reference things from previous sessions when provided in your context

When ending a session, provide a warm summary: what went well, 2-3 patterns you noticed the learner should be aware of, and encouragement. Keep it conversational, not clinical.
```

**Layer 2 — Level-specific curriculum slice (example for A1):**

```
CURRENT LEARNER LEVEL: A1

YOUR TEACHING TARGETS FOR THIS LEVEL:
- Vocabulary clusters: greetings & politeness, numbers 1-100, family members, basic food & drink, days/months/time, colors, common objects, weather, basic emotions
- Grammar targets: present tense of être/avoir/aller/-er verbs, articles (le/la/les/un/une/des), basic negation (ne...pas), basic questions (est-ce que, intonation), possessive adjectives (mon/ma/mes), gender agreement basics, il y a, c'est vs il est
- Conversation tasks: self-introduction, ordering food, describing family, asking basic questions, telling time, describing weather, expressing simple likes/dislikes
- Writing: simple sentences (5-10 words), fill-in responses to your questions
- Reading: you may share short passages (2-3 sentences) and discuss them

LANGUAGE BALANCE: Predominantly English with generous French woven in. Introduce new French vocabulary by using it in context with immediate English support. Encourage the learner to try using French words/phrases but never pressure.

MASTERY EVIDENCE (what you're looking for before this learner is ready for A2):
- Can introduce themselves and answer basic personal questions in French with minimal English fallback
- Uses present tense of core verbs (être, avoir, aller, common -er verbs) correctly >70% of the time
- Demonstrates gender agreement awareness (not perfection, awareness)
- Can form basic questions and negations
- Vocabulary: actively uses 40+ words from the target clusters unprompted
```

**Layer 2 example for A0:**

```
CURRENT LEARNER LEVEL: A0 (Complete Beginner — Zero French)

CRITICAL INSTRUCTION: This learner has NO French knowledge. You speak ENTIRELY in English. You introduce French ONLY as isolated words woven naturally into English conversation, with immediate translation.

Example of correct A0 teaching:
"So you had coffee this morning — in French, coffee is 'café'. Easy one, right? 'Un café' — that 'un' just means 'a'. What else did you have for breakfast?"

YOU MUST NOT:
- Ask the learner to form French sentences
- Introduce grammar terminology
- Explain conjugation
- Give any writing tasks
- Speak extended French

YOUR ONLY GOALS:
- Build comfort and remove fear of the language
- Introduce 5-10 French words per session, always in natural English context
- Let the learner hear French sounds in a safe, low-pressure way
- Build rapport and understand the learner as a person

Vocabulary to introduce naturally (spread across sessions, not all at once):
Greetings: bonjour, salut, merci, s'il vous plaît, au revoir
Daily life: café, matin (morning), soir (evening), eau (water), pain (bread)
Responses: oui, non, ça va (it's going), très bien (very good)
```

**Layer 3 — User context block (dynamically generated, example):**

```
USER PROFILE:
- Name: Ari
- Native language: English (also speaks Kurdish, Arabic)
- Learning French, currently A1 (4 sessions completed)
- Placement notes: "Strong vocabulary recognition from film exposure. Passive A1 but limited active production. Confident personality, comfortable making mistakes."

RECENT SESSION SUMMARIES:
- Session 3 (2 days ago): Practiced food vocabulary and ordering. Used "je voudrais" correctly 3x. Consistently forgot gender articles (said "le eau" instead of "l'eau"). Good engagement.
- Session 4 (yesterday): Self-introduction practice. Successfully used être conjugation (je suis, il est). Still struggling with avoir (said "je suis 22 ans" — corrected to "j'ai 22 ans"). Introduced days of the week — retained lundi, mardi, mercredi.

CONCEPTS DUE FOR REVIEW (spaced repetition):
- avoir conjugation (confidence: 0.35 — needs reinforcement)
- gender of water-related nouns (confidence: 0.4)
- days of the week (confidence: 0.55 — quiz naturally to reinforce)

KNOWN STRENGTHS:
- être conjugation (confidence: 0.82)
- food vocabulary (confidence: 0.78)
- Greetings and politeness (confidence: 0.91)
```

---

### 4. CEFR-Mapped French Curriculum (A0–C2)

#### A0 — Pre-beginner / Zero Exposure

**Vocabulary** (introduced over 3–5 sessions, 5–10 words per session):
- Greetings: bonjour, bonsoir, salut, au revoir, merci, s'il vous plaît, de rien
- Daily nouns: café, eau, pain, matin, soir, maison, école
- Responses: oui, non, ça va, très bien, d'accord
- Numbers: 1–10 only
- Identity: je, nom (name), comment

**Grammar**: NONE explicitly. Zero grammar instruction. Only implicit patterns from exposure ("un café" — the learner absorbs "un" by hearing it repeatedly).

**Listening**: Tutor uses individual French words in English sentences. The learner hears French phonemes in a safe context.

**Reading**: None.

**Speaking**: The learner may repeat individual words if they choose. Never required.

**Writing**: None.

**Mastery evidence for A0→A1**: Learner can recognize and produce 20+ basic French words. Shows comfort hearing French. Voluntarily tries to use French words. Shows no anxiety or resistance. At least 3 sessions completed.

---

#### A1 — Breakthrough / Beginner

**Vocabulary clusters** (introduced organically across 15–25 sessions):
1. Self & identity: je m'appelle, j'ai X ans, je suis, j'habite à
2. Family: mère, père, frère, sœur, fils, fille, mari, femme, enfant, famille
3. Numbers: 1–100, ordinals (premier, deuxième)
4. Time: heure, minute, jours de la semaine, mois, aujourd'hui, demain, hier
5. Food & drink: petit-déjeuner, déjeuner, dîner, poulet, riz, salade, fruit, lait, jus, bière, vin
6. Colors: rouge, bleu, vert, blanc, noir, jaune, gris
7. Common objects: livre, stylo, table, chaise, téléphone, ordinateur, porte, fenêtre
8. Weather: il fait chaud/froid/beau, il pleut, il neige, le soleil
9. Places: ville, rue, magasin, restaurant, gare, aéroport, hôpital, hôtel
10. Emotions: content, triste, fatigué, heureux, en colère, j'ai peur
11. Actions (common verbs): manger, boire, dormir, travailler, parler, écouter, regarder, aimer, vouloir, pouvoir

**Grammar concepts** (sequence matters — introduced in this order):
1. Subject pronouns (je, tu, il/elle, nous, vous, ils/elles)
2. Être — present tense, all persons
3. Avoir — present tense, all persons
4. Articles: le/la/les, un/une/des — gender concept introduced gently
5. Regular -er verbs present tense (parler, manger, aimer, travailler, habiter)
6. Basic negation: ne...pas
7. Basic question formation: est-ce que + intonation questions
8. Possessive adjectives: mon/ma/mes, ton/ta/tes, son/sa/ses
9. Aller — present + aller + infinitive for near future
10. Il y a (there is / there are)
11. C'est vs Il/Elle est
12. Faire — present tense (il fait beau, je fais du sport)
13. Vouloir, pouvoir — present tense (je voudrais for politeness)

**Listening tasks**: Understand the tutor's short French sentences with context clues. Respond to simple French questions.

**Reading tasks**: 2–3 sentence passages introduced by the tutor. Simple descriptions, short dialogues.

**Speaking (text production) tasks**: Answer questions in French (short phrases). Self-introduction. Ordering food. Describing family. Saying what they like/dislike.

**Writing tasks**: Construct simple sentences (SVO). Answer questions in writing. Fill in responses.

**Mastery evidence for A1→A2**:
- Produces self-introduction fluently in French
- Conjugates être, avoir, aller, and 5+ -er verbs in present tense correctly >70%
- Forms negation and questions correctly >60%
- Uses correct articles >50% of the time
- Actively produces 80+ vocabulary words across target clusters
- Demonstrated across 5+ sessions with interleaved topics

---

#### A2 — Waystage / Elementary

**Vocabulary clusters**:
1. Daily routines: se réveiller, se lever, se doucher, s'habiller, se coucher (reflexive verbs)
2. Health & body: tête, bras, jambe, dos, malade, médicament, médecin, j'ai mal à
3. Shopping: combien, cher, bon marché, taille, acheter, vendre, payer, l'argent, carte
4. Transportation: voiture, bus, train, avion, vélo, métro, conduire, arrêt
5. House & rooms: cuisine, salon, chambre, salle de bain, jardin, étage, meubles
6. Hobbies: sport, musique, cinéma, lecture, voyage, jouer, nager, courir, dessiner
7. Work & study: travail, bureau, cours, examen, professeur, étudiant, réunion
8. Directions: à gauche, à droite, tout droit, en face de, à côté de, entre, devant, derrière
9. Comparisons vocabulary: plus, moins, aussi, mieux, meilleur, pire

**Grammar concepts**:
1. Passé composé with avoir (j'ai mangé, il a parlé) — regular verbs
2. Passé composé with être (je suis allé, elle est partie) — DR MRS VANDERTRAMP
3. Passé composé agreement rules (elle est allée)
4. Imparfait — formation and basic usage (descriptions, habitual past)
5. Passé composé vs imparfait — when to use each (the hardest A2 concept)
6. Reflexive verbs — present tense (se lever, s'appeler, se coucher)
7. Direct and indirect object pronouns: le, la, les, lui, leur (introduction)
8. Comparative and superlative (plus grand que, le plus grand)
9. Prepositions of place (à, en, au, aux with countries/cities)
10. Y and en (replacing places and quantities — introduction)
11. Futur proche review + introduction to futur simple (basic forms)
12. Imperative mood (mange!, allons-y!, écoutez!)
13. Partitif articles (du, de la, des, de l' — with food context)

**Listening tasks**: Follow the tutor's paragraphs in French with occasional English. Understand short stories told by the tutor. Answer comprehension questions.

**Reading tasks**: Paragraphs (5–10 sentences). Short narratives. Simple email/letter format.

**Speaking tasks**: Describe past events. Give directions. Compare things. Express opinions. Narrate daily routines. Discuss plans.

**Writing tasks**: Short paragraphs (3–5 sentences). Describe a picture or scene. Write about past weekend. Express preferences with reasons.

**Mastery evidence for A2→B1**:
- Uses passé composé and imparfait with >65% accuracy, showing understanding of the distinction
- Can narrate past events coherently
- Uses reflexive verbs in daily routine descriptions
- Produces paragraphs with connected sentences (not just isolated phrases)
- Vocabulary: 300+ active words, handles all target clusters
- Can sustain a 10-exchange French conversation with minimal English
- Demonstrated across 8+ sessions

---

#### B1 — Threshold / Intermediate

**Vocabulary clusters**:
1. Emotions & opinions (nuanced): déçu, soulagé, inquiet, fier, impressionné, il me semble que, à mon avis, je trouve que
2. News & current events: actualité, gouvernement, élection, économie, environnement, société
3. Work life (advanced): CV, entretien, salaire, collègue, projet, délai, compétence
4. Education: matière, diplôme, licence, master, recherche, mémoire
5. Abstract concepts: liberté, égalité, justice, progrès, responsabilité, avenir
6. Connectors & discourse markers: cependant, néanmoins, en revanche, par conséquent, d'ailleurs, malgré, bien que, afin de

**Grammar concepts**:
1. Subjonctif présent — formation + key triggers (il faut que, je veux que, bien que, pour que, avant que)
2. Conditionnel présent — formation + usage (politeness, hypotheticals, si clauses type 1 & 2)
3. Si clauses: si + présent → futur; si + imparfait → conditionnel
4. Plus-que-parfait — formation + usage in narrative (j'avais déjà mangé quand...)
5. Relative pronouns: qui, que, où, dont
6. Pronoun placement in compound tenses (je l'ai vu, elle s'est levée)
7. Passive voice (introduction — la maison a été construite)
8. Gerund/present participle (en + -ant: en marchant, en parlant)
9. Adverbial pronouns y and en (mastery level)
10. Double pronoun order (je le lui ai donné)

**Listening tasks**: Follow complex tutor narratives with embedded clauses. Discuss hypothetical scenarios. Understand implicit meaning.

**Reading tasks**: Full paragraphs with complex structure. News-style passages. Opinion texts. Short fiction excerpts.

**Speaking tasks**: Defend opinions. Narrate complex past events. Discuss hypotheticals. Explain causes and consequences. Summarize.

**Writing tasks**: Structured paragraphs with introduction/body/conclusion. Express and defend an opinion. Narrate a complex event. Write formal vs informal register.

**Mastery evidence for B1→B2**:
- Uses subjunctive correctly in common triggers >60%
- Produces conditional + si clauses accurately
- Can defend an opinion with reasons and examples in French
- Uses relative pronouns to build complex sentences
- Shows comfort with all past tenses (PC, imparfait, PQP) in sustained narrative
- Sustains full conversation in French with English <5% of utterances
- 500+ active vocabulary including abstract concepts
- Demonstrated across 10+ sessions

---

#### B2 — Vantage / Upper Intermediate

**Vocabulary clusters**:
1. Idiomatic expressions: avoir le cafard, poser un lapin, tomber dans les pommes, en avoir marre, être au courant
2. Professional French: contrat, négociation, stratégie, bilan, rapport, faire le point
3. Cultural references: patrimoine, laïcité, francophonie, banlieue, hexagone
4. Science & tech vocabulary: données, algorithme, intelligence artificielle, changement climatique
5. Formal register: je vous prie de, veuillez, j'ai l'honneur de
6. Nuanced connectors: quoique, quand bien même, d'autant plus que, en l'occurrence, toujours est-il

**Grammar concepts**:
1. Subjonctif — all remaining triggers + subjunctive vs indicative distinction
2. Conditionnel passé (j'aurais voulu, il aurait dû) + si clauses type 3 (si + PQP → conditionnel passé)
3. Futur antérieur (quand j'aurai fini...)
4. Passive voice — all tenses
5. Reported speech (discours indirect) — tense shifting rules
6. Subjunctive past (subjonctif passé)
7. Literary tenses awareness (passé simple — recognition, not production)
8. Nominalisation (analyser → l'analyse)
9. Advanced pronoun combinations and exceptions
10. Register shifting — formal vs informal in same content

**Listening tasks**: Follow nuanced arguments. Detect tone, humor, sarcasm. Engage with tutor using fully native-speed French.

**Reading tasks**: Newspaper articles. Literary excerpts. Argumentative essays. Technical texts in familiar fields.

**Speaking tasks**: Debate. Present structured arguments. Explain complex processes. Negotiate. Paraphrase.

**Writing tasks**: Essay format. Formal correspondence. Structured argumentation. Summary of complex text.

**Mastery evidence for B2→C1**:
- Uses conditional past for complex hypotheticals
- Produces accurate reported speech with tense shifts
- Demonstrates register awareness (formal/informal switching)
- Can debate topics with nuanced vocabulary
- Sustained error rate <15% for core grammar across sessions
- Fully French conversation — no English ever needed
- 800+ active vocabulary across all registers

---

#### C1 — Effective Operational Proficiency

**Vocabulary clusters**:
1. Precise emotional vocabulary: atterré, ébahi, navré, émerveillé, consterné
2. Academic discourse: hypothèse, méthodologie, paradigme, corpus, en somme, à cet égard
3. Stylistic devices: litote, euphémisme, ironie, métaphore (used in conversation)
4. Regional/familiar language awareness: verlan, slang, colloquialisms (understanding, not necessarily production)
5. Philosophical vocabulary: éthique, morale, déterminisme, existentialisme

**Grammar concepts**:
1. Subjunctive in all tenses (including imparfait du subjonctif — at least recognition)
2. Nominalisation mastery
3. Advanced discourse structuring
4. Stylistic inversion
5. Literary tenses: passé simple, imparfait du subjonctif (recognition + limited production)
6. Implicit meaning construction — saying things indirectly
7. Advanced concession structures (quand bien même, pour autant que)

**Listening**: Understand implicit meaning, cultural subtext, humor, register nuance.

**Reading**: Literary texts. Academic articles. Legal/administrative documents.

**Speaking**: Fluent debate. Impromptu presentation. Nuanced negotiation. Storytelling with style.

**Writing**: Academic essay. Creative writing. Formal report. Stylistically varied writing.

**Mastery evidence for C1→C2**: Near-native accuracy. Can handle any topic without preparation. Demonstrates stylistic range. Error rate <5% in core grammar. Shows awareness of cultural and pragmatic nuance.

---

#### C2 — Mastery

At C2 the curriculum becomes open-ended. The tutor behaves as a native conversation partner across any domain. Focus areas:

- Stylistic refinement
- Cultural and literary depth
- Precision in rare/formal constructions
- Regional variation awareness
- Professional/academic French at native level
- Creative expression
- Near-zero tolerance for systematic errors

**Mastery evidence**: C2 is the ceiling. The tutor shifts to maintenance and enrichment mode. Conversations are native-level across all domains.

---

### 5. File/Folder Structure

```
lingua/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── public/
│   ├── favicon.ico
│   └── images/
├── src/
│   ├── pages/
│   │   ├── _app.tsx
│   │   ├── _document.tsx
│   │   ├── index.tsx                    # Landing page
│   │   ├── auth/
│   │   │   ├── signin.tsx
│   │   │   └── signup.tsx
│   │   ├── dashboard.tsx                # Main dashboard after login
│   │   ├── chat.tsx                     # Conversation interface
│   │   ├── progress.tsx                 # Progress overview + stats-for-nerds
│   │   ├── history.tsx                  # Session history list
│   │   ├── session/
│   │   │   └── [id].tsx                 # View a past session's messages
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth].ts
│   │       ├── chat/
│   │       │   ├── stream.ts            # SSE streaming endpoint
│   │       │   ├── end-session.ts       # End session + trigger analysis
│   │       │   └── history.ts           # Fetch session messages
│   │       ├── sessions/
│   │       │   ├── index.ts             # List/create sessions
│   │       │   └── [id].ts              # Get specific session
│   │       ├── placement/
│   │       │   ├── stream.ts            # Placement conversation streaming
│   │       │   └── complete.ts          # Finalize placement, create SkillProfile
│   │       ├── progress/
│   │       │   └── index.ts             # Fetch user progress data
│   │       └── user/
│   │           └── profile.ts           # User profile read/update
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.tsx
│   │   │   ├── Navbar.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── chat/
│   │   │   ├── ChatInterface.tsx        # Main chat container
│   │   │   ├── MessageBubble.tsx        # Single message rendering
│   │   │   ├── ChatInput.tsx            # Input field + send button
│   │   │   ├── TypingIndicator.tsx      # Animated "tutor is typing"
│   │   │   └── SessionEndSummary.tsx    # End-of-session summary card
│   │   ├── progress/
│   │   │   ├── LevelBadge.tsx           # Current CEFR level display
│   │   │   ├── SkillBreakdown.tsx       # 4-skill radar or bars
│   │   │   ├── ProgressSummary.tsx      # Human-readable progress
│   │   │   └── StatsForNerds.tsx        # Detailed accuracy data
│   │   ├── placement/
│   │   │   └── PlacementChat.tsx        # Placement-specific chat UI
│   │   ├── auth/
│   │   │   ├── SignInForm.tsx
│   │   │   └── SignUpForm.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       └── LoadingSpinner.tsx
│   ├── lib/
│   │   ├── prisma.ts                    # Prisma client singleton
│   │   ├── anthropic.ts                 # Anthropic client singleton
│   │   ├── auth.ts                      # NextAuth config export
│   │   └── utils.ts                     # General helpers
│   ├── services/
│   │   ├── prompt-builder.ts            # Composes system prompt from 3 layers
│   │   ├── session-analyzer.ts          # Sends session to Sonnet for analysis
│   │   ├── mastery-tracker.ts           # Updates ConceptMastery records from analysis
│   │   ├── spaced-repetition.ts         # SM-2 scheduling logic
│   │   ├── level-assessor.ts            # Checks if user qualifies for advancement
│   │   └── conversation-memory.ts       # Builds context block from DB
│   ├── curriculum/
│   │   ├── index.ts                     # Exports getCurriculumForLevel()
│   │   ├── types.ts                     # TypeScript types for curriculum structures
│   │   ├── levels/
│   │   │   ├── a0.ts
│   │   │   ├── a1.ts
│   │   │   ├── a2.ts
│   │   │   ├── b1.ts
│   │   │   ├── b2.ts
│   │   │   ├── c1.ts
│   │   │   └── c2.ts
│   │   └── prompts/
│   │       ├── base-persona.ts          # Layer 1 — constant persona text
│   │       └── level-templates.ts       # Layer 2 — template for level-specific slice
│   ├── hooks/
│   │   ├── useChat.ts                   # SSE connection + message state
│   │   ├── useSession.ts                # Current session management
│   │   └── useProgress.ts              # Progress data fetching
│   ├── types/
│   │   ├── index.ts                     # Shared TypeScript types
│   │   ├── chat.ts                      # Chat-related types
│   │   └── curriculum.ts                # Curriculum types (re-exported)
│   └── styles/
│       └── globals.css                  # Tailwind imports + custom styles
├── .env.local                           # Environment variables
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

### 6. Development Order

**Phase 1 — Foundation (Days 1–3)**
1. Initialize Next.js 15 project with TypeScript, Tailwind, Pages Router
2. Set up Prisma schema, connect to Railway PostgreSQL, run initial migration
3. Implement NextAuth with credentials + Google OAuth
4. Create `lib/prisma.ts` singleton, `lib/anthropic.ts` singleton
5. Build basic `Layout`, `Navbar`, and UI components
6. Build sign-in/sign-up pages — test auth flow end to end

**Phase 2 — Chat Infrastructure (Days 4–6)**
7. Build the streaming API route (`/api/chat/stream.ts`) — hardcode a simple system prompt, get streaming working end to end
8. Build `ChatInterface`, `MessageBubble`, `ChatInput` components
9. Build `useChat` hook consuming SSE stream
10. Implement session creation (`/api/sessions`) — create session on first message, store all messages to DB
11. Test: can sign in, start a session, send messages, get streamed AI responses, messages persist in DB

**Phase 3 — Curriculum & Prompt System (Days 7–9)**
12. Build all curriculum files (`curriculum/levels/a0.ts` through `c2.ts`) as structured TypeScript constants following the curriculum in this plan
13. Build `base-persona.ts` and `level-templates.ts`
14. Build `prompt-builder.ts` — takes user profile + level + memory and outputs the complete system prompt
15. Build `conversation-memory.ts` — queries DB for recent session summaries and due concepts
16. Wire prompt builder into the streaming endpoint — system prompt is now dynamic per user

**Phase 4 — Placement Flow (Days 10–12)**
17. Build placement API routes (`/api/placement/stream.ts`, `/api/placement/complete.ts`)
18. Build `PlacementChat` component — same chat UI but placement-specific system prompt + Sonnet model
19. Placement completion: Sonnet returns structured JSON assessment → parse → create `SkillProfile` → set `currentCEFRLevel` → mark `placementCompleted`
20. Build the onboarding flow: language selection → placement chat → dashboard redirect

**Phase 5 — Session Analysis & Mastery Tracking (Days 13–16)**
21. Build `session-analyzer.ts` — sends full session to Sonnet with a structured output prompt, receives JSON analysis
22. Build `/api/chat/end-session.ts` — triggers analysis, saves `SessionSummary`
23. Build `mastery-tracker.ts` — updates `ConceptMastery` records from analysis JSON
24. Build `spaced-repetition.ts` — SM-2 interval calculator
25. Build `level-assessor.ts` — checks if all concepts at current level meet threshold
26. Wire end-of-session flow: user clicks "End Session" → analysis runs → summary shown → DB updated

**Phase 6 — Progress & History UI (Days 17–19)**
27. Build `progress.tsx` page with `ProgressSummary`, `SkillBreakdown`, `LevelBadge`
28. Build `StatsForNerds` component (expandable detail view)
29. Build `history.tsx` — list of past sessions
30. Build `session/[id].tsx` — view past conversation messages
31. Build `dashboard.tsx` — current level, quick stats, "Continue Learning" button, recent sessions

**Phase 7 — Polish & Edge Cases (Days 20–22)**
32. Handle session timeout/abandonment (auto-end after 30 min of inactivity)
33. Token counting and cost tracking (store per message and per session)
34. Rate limiting awareness (5 req/min on Anthropic free tier — queue messages, show "thinking" state)
35. Error handling: API failures, network drops, graceful degradation
36. Mobile responsive design pass
37. Landing page (`index.tsx`) — clean, compelling, one CTA

**Phase 8 — Testing & Deploy (Days 23–25)**
38. End-to-end test: new user → sign up → placement → first session → session end → progress visible → second session remembers context
39. Vercel deployment — env vars, build config, `postinstall: prisma generate`
40. Performance check — streaming latency, DB query times, system prompt token count

---

### Verification Checklist

- **Auth**: Sign up with email, sign in, sign out, sign in with Google — all work
- **Placement**: New user goes through 5–10 exchange placement conversation → CEFR level is assigned → SkillProfile exists in DB
- **Conversation**: Start session → messages stream word by word → conversation is pedagogically appropriate for the user's level → language balance matches level (A0 = all English + French words; B1 = mostly French)
- **Memory**: End session → start new session → tutor references previous session content and due review concepts
- **Mastery**: After 3+ sessions, check `ConceptMastery` table — scores are updating, `nextReviewAt` is being calculated
- **Progress UI**: Dashboard shows current level, progress page shows skill breakdown and human-readable summary
- **History**: Can view list of past sessions and read back any session's messages
- **Deploy**: Vercel deployment succeeds, Railway DB connects, streaming works in production

---

### Key Decisions

- **Pages Router over App Router**: User's explicit preference for familiarity. SSE streaming works fine in Pages Router API routes.
- **Haiku for conversation, Sonnet for analysis**: Cost optimization — Haiku is 3x cheaper and faster for the conversational loop. Sonnet only fires at session end and placement (higher accuracy needed for assessment).
- **No inline mastery extraction during conversation**: Simplifies V1. Haiku stays focused on teaching. All assessment happens at session end via Sonnet. This avoids complex mid-conversation JSON parsing and keeps latency low.
- **SM-2 simplified for spaced repetition**: Full SM-2 is overkill for V1. Three-tier interval logic (double if strong, hold if medium, reset if weak) is sufficient and easy to tune later.
- **Curriculum as TypeScript constants, not DB records**: The curriculum is static content that changes rarely. Storing it as `.ts` files means it's type-safe, version-controlled, fast to load, and doesn't require DB migrations to update vocabulary lists.
- **`motion` package over `framer-motion`**: `framer-motion` is now a wrapper for `motion`. Use `motion` directly with `import { motion } from "motion/react"`.
- **NextAuth v4, not v5**: v5 targets App Router. v4 is the stable, documented choice for Pages Router.
- **Session summaries for cross-session memory, not full message replay**: Sending all historical messages would blow the context window quickly and waste tokens. Summaries are generated by Sonnet (high quality) and cost ~100 tokens per session summary to include in context.

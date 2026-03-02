import { CEFRLevel } from "@/generated/prisma/enums";
import { LevelCurriculum } from "../types";

/* ─── German Curriculum: A0 through C2 ─── */

const a0: LevelCurriculum = {
  level: CEFRLevel.A0,
  label: "Pre-beginner",
  description: "Zero German exposure. Building comfort and first contact with the language.",
  languageBalance: "Entirely English. German only as isolated words with immediate translations.",
  vocabularyClusters: [
    { name: "Greetings", conceptId: "vocab.greetings_basic", words: ["hallo", "tschüss", "guten Morgen", "guten Tag", "gute Nacht", "danke", "bitte", "ja", "nein"] },
    { name: "Daily nouns", conceptId: "vocab.daily_nouns_basic", words: ["Kaffee", "Wasser", "Brot", "Morgen", "Nacht", "Haus", "Schule"] },
    { name: "Responses", conceptId: "vocab.responses_basic", words: ["ja", "nein", "gut", "sehr gut", "okay", "genau"] },
    { name: "Numbers", conceptId: "vocab.numbers_1_10", words: ["eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn"] },
    { name: "Identity", conceptId: "vocab.identity_basic", words: ["ich", "Name", "wie", "heißen"] },
  ],
  grammarConcepts: [],
  listeningTasks: ["Hear individual German words in English sentences"],
  readingTasks: [],
  speakingTasks: ["May repeat individual words voluntarily"],
  writingTasks: [],
  masteryEvidence: ["Recognizes 20+ basic German words", "Shows comfort hearing German"],
  conceptIds: ["vocab.greetings_basic", "vocab.daily_nouns_basic", "vocab.responses_basic", "vocab.numbers_1_10", "vocab.identity_basic"],
};

const a1: LevelCurriculum = {
  level: CEFRLevel.A1,
  label: "Beginner",
  description: "Can understand and use familiar everyday expressions and basic phrases.",
  languageBalance: "Predominantly English with generous German woven in.",
  vocabularyClusters: [
    { name: "Self & identity", conceptId: "vocab.self_identity", words: ["ich heiße", "ich bin X Jahre alt", "ich bin", "ich wohne in", "ich komme aus"] },
    { name: "Family", conceptId: "vocab.family", words: ["Mutter", "Vater", "Bruder", "Schwester", "Sohn", "Tochter", "Mann", "Frau", "Kind", "Familie", "Großvater", "Großmutter"] },
    { name: "Numbers", conceptId: "vocab.numbers_1_100", words: ["elf", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig", "hundert"] },
    { name: "Time", conceptId: "vocab.time_days_months", words: ["Uhr", "Minute", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag", "Januar", "Februar", "heute", "morgen", "gestern"] },
    { name: "Food & drink", conceptId: "vocab.food_drink", words: ["Frühstück", "Mittagessen", "Abendessen", "Hähnchen", "Reis", "Salat", "Obst", "Milch", "Saft", "Bier", "Wein", "Käse", "Brot"] },
    { name: "Colors", conceptId: "vocab.colors", words: ["rot", "blau", "grün", "weiß", "schwarz", "gelb", "grau", "rosa", "orange", "braun"] },
    { name: "Common objects", conceptId: "vocab.common_objects", words: ["Buch", "Kugelschreiber", "Tisch", "Stuhl", "Telefon", "Computer", "Tür", "Fenster", "Schlüssel", "Tasche"] },
    { name: "Weather", conceptId: "vocab.weather", words: ["es ist warm", "es ist kalt", "das Wetter ist schön", "es regnet", "es schneit", "die Sonne", "der Wind", "die Wolke"] },
    { name: "Places", conceptId: "vocab.places", words: ["Stadt", "Straße", "Geschäft", "Restaurant", "Bahnhof", "Flughafen", "Krankenhaus", "Hotel", "Schule", "Büro"] },
    { name: "Emotions", conceptId: "vocab.emotions_basic", words: ["froh", "traurig", "müde", "glücklich", "wütend", "Angst haben", "überrascht"] },
    { name: "Common verbs", conceptId: "vocab.common_verbs", words: ["essen", "trinken", "schlafen", "arbeiten", "sprechen", "hören", "schauen", "mögen", "wollen", "können", "lesen", "schreiben"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.subject_pronouns", name: "Subject pronouns", description: "ich, du, er/sie/es, wir, ihr, sie/Sie", examples: ["Ich bin Student.", "Sie ist Deutsche.", "Wir sind Freunde."] },
    { conceptId: "grammar.sein_present", name: "Sein — present tense", description: "Full conjugation of sein in the present", examples: ["Ich bin groß.", "Du bist nett.", "Er ist Lehrer."] },
    { conceptId: "grammar.haben_present", name: "Haben — present tense", description: "Full conjugation of haben in the present", examples: ["Ich habe Hunger.", "Hast du Geschwister?", "Sie hat ein Auto."] },
    { conceptId: "grammar.articles_gender", name: "Articles and noun gender", description: "der (m), die (f), das (n) — definite; ein/eine — indefinite", examples: ["Der Tisch ist groß.", "Das Buch ist interessant."] },
    { conceptId: "grammar.regular_verbs_present", name: "Regular verbs present tense", description: "Standard verb conjugation in present tense", examples: ["Ich lerne Deutsch.", "Du arbeitest hier.", "Wir spielen Fußball."] },
    { conceptId: "grammar.negation_basic", name: "Basic negation", description: "nicht and kein", examples: ["Ich spreche nicht Französisch.", "Ich habe kein Auto."] },
    { conceptId: "grammar.word_order_basic", name: "Basic word order", description: "V2 rule: verb always in second position", examples: ["Heute gehe ich einkaufen.", "Morgen kommt er."] },
    { conceptId: "grammar.questions_basic", name: "Basic questions", description: "W-Fragen: Wie?, Wo?, Was?, Wann?", examples: ["Wie heißt du?", "Wo wohnst du?"] },
  ],
  listeningTasks: ["Understand basic greetings and introductions", "Follow simple personal questions"],
  readingTasks: ["Read basic personal information forms", "Understand short simple messages"],
  speakingTasks: ["Introduce yourself", "Ask and answer basic personal questions"],
  writingTasks: ["Fill in personal information", "Write a brief self-introduction"],
  masteryEvidence: ["Can introduce self", "Uses present tense of common verbs", "Basic question formation"],
  conceptIds: [
    "vocab.self_identity", "vocab.family", "vocab.numbers_1_100", "vocab.time_days_months",
    "vocab.food_drink", "vocab.colors", "vocab.common_objects", "vocab.weather",
    "vocab.places", "vocab.emotions_basic", "vocab.common_verbs",
    "grammar.subject_pronouns", "grammar.sein_present", "grammar.haben_present",
    "grammar.articles_gender", "grammar.regular_verbs_present",
    "grammar.negation_basic", "grammar.word_order_basic", "grammar.questions_basic",
  ],
};

const a2: LevelCurriculum = {
  level: CEFRLevel.A2,
  label: "Elementary",
  description: "Can communicate in simple, routine tasks requiring direct exchange of information on familiar topics.",
  languageBalance: "40% English, 60% German. German for most conversation, English for explanations.",
  vocabularyClusters: [
    { name: "Travel", conceptId: "vocab.travel", words: ["Fahrkarte", "Flug", "Gepäck", "Reservierung", "Reisepass", "Zoll", "Abfahrt", "Ankunft"] },
    { name: "Shopping", conceptId: "vocab.shopping", words: ["Preis", "billig", "teuer", "Größe", "Rabatt", "Karte", "bar", "Quittung"] },
    { name: "Health", conceptId: "vocab.health", words: ["Arzt", "krank", "Schmerz", "Fieber", "Tablette", "Apotheke", "Termin"] },
    { name: "Household", conceptId: "vocab.household", words: ["Küche", "Schlafzimmer", "Badezimmer", "Wohnzimmer", "Garten", "Wohnung", "Treppe"] },
    { name: "Emotions expanded", conceptId: "vocab.emotions_expanded", words: ["besorgt", "nervös", "aufgeregt", "gelangweilt", "stolz", "verlegen"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.perfekt", name: "Perfekt (present perfect)", description: "Conversational past tense with haben/sein + Partizip II", examples: ["Ich habe gegessen.", "Er ist nach Berlin gefahren."] },
    { conceptId: "grammar.praeteritum_modal", name: "Präteritum of modals & sein/haben", description: "Simple past of common auxiliary/modal verbs", examples: ["Ich war müde.", "Er konnte nicht kommen."] },
    { conceptId: "grammar.accusative_dative", name: "Accusative & Dative cases", description: "Case system for direct and indirect objects", examples: ["Ich sehe den Mann.", "Ich gebe dem Mann das Buch."] },
    { conceptId: "grammar.separable_verbs", name: "Separable verbs", description: "Verbs with separable prefixes: aufstehen, anfangen, einkaufen", examples: ["Ich stehe um 7 Uhr auf.", "Wir fangen jetzt an."] },
    { conceptId: "grammar.prepositions", name: "Prepositions with cases", description: "in, an, auf, über, unter, neben + dative/accusative", examples: ["Ich bin in der Schule.", "Ich gehe in die Schule."] },
  ],
  listeningTasks: ["Follow short narratives about past events", "Understand directions"],
  readingTasks: ["Read short emails and messages", "Understand restaurant menus"],
  speakingTasks: ["Narrate past events", "Describe people and places"],
  writingTasks: ["Write a short personal email", "Describe daily routine"],
  masteryEvidence: ["Uses Perfekt correctly", "Handles basic case system", "Describes routines"],
  conceptIds: [
    "vocab.travel", "vocab.shopping", "vocab.health", "vocab.household", "vocab.emotions_expanded",
    "grammar.perfekt", "grammar.praeteritum_modal", "grammar.accusative_dative",
    "grammar.separable_verbs", "grammar.prepositions",
  ],
};

const b1: LevelCurriculum = {
  level: CEFRLevel.B1,
  label: "Intermediate",
  description: "Can deal with most situations likely to arise while travelling and discuss familiar topics.",
  languageBalance: "20% English, 80% German.",
  vocabularyClusters: [
    { name: "Work & career", conceptId: "vocab.work_career", words: ["Stelle", "Firma", "Chef", "Gehalt", "Besprechung", "Erfahrung", "Lebenslauf"] },
    { name: "Abstract concepts", conceptId: "vocab.abstract", words: ["Freiheit", "Gleichheit", "Gerechtigkeit", "Bildung", "Entwicklung", "Zukunft"] },
    { name: "Connectors", conceptId: "vocab.connectors", words: ["jedoch", "außerdem", "deshalb", "dagegen", "obwohl", "trotzdem"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.konjunktiv_ii", name: "Konjunktiv II", description: "Subjunctive mood for wishes, hypotheticals, politeness", examples: ["Ich würde gern reisen.", "Könntest du mir helfen?", "Wenn ich Zeit hätte, würde ich kommen."] },
    { conceptId: "grammar.nebensaetze", name: "Subordinate clauses", description: "Verb-final position: weil, dass, wenn, ob, als", examples: ["Ich lerne Deutsch, weil es interessant ist.", "Er sagte, dass er kommt."] },
    { conceptId: "grammar.genitive", name: "Genitive case", description: "Possessive case: des, der, des, der", examples: ["Das Auto des Mannes.", "Die Farbe der Blume."] },
    { conceptId: "grammar.relative_clauses", name: "Relative clauses", description: "der, die, das as relative pronouns", examples: ["Das Buch, das ich gelesen habe.", "Der Mann, der dort steht."] },
  ],
  listeningTasks: ["Follow news reports on familiar topics", "Understand opinions in discussions"],
  readingTasks: ["Read newspaper articles", "Understand formal letters"],
  speakingTasks: ["Express opinions", "Discuss hypothetical situations"],
  writingTasks: ["Write opinion essays", "Formal emails"],
  masteryEvidence: ["Uses Konjunktiv II correctly", "Expresses opinions with justification"],
  conceptIds: [
    "vocab.work_career", "vocab.abstract", "vocab.connectors",
    "grammar.konjunktiv_ii", "grammar.nebensaetze",
    "grammar.genitive", "grammar.relative_clauses",
  ],
};

const b2: LevelCurriculum = {
  level: CEFRLevel.B2,
  label: "Upper Intermediate",
  description: "Can interact with a degree of fluency and spontaneity with native speakers.",
  languageBalance: "5-10% English, 90-95% German.",
  vocabularyClusters: [
    { name: "Professional", conceptId: "vocab.professional", words: ["Strategie", "Verhandlung", "Führung", "Produktivität", "Innovation"] },
    { name: "Idioms", conceptId: "vocab.idioms", words: ["ins Fettnäpfchen treten", "den Nagel auf den Kopf treffen", "Daumen drücken", "auf dem Holzweg sein"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.konjunktiv_i", name: "Konjunktiv I (indirect speech)", description: "Used for reported speech in formal contexts", examples: ["Er sagte, er sei krank.", "Sie meinte, sie habe keine Zeit."] },
    { conceptId: "grammar.passive_voice", name: "Passive voice", description: "werden + Partizip II; various tenses", examples: ["Das Buch wird gelesen.", "Die Stadt wurde im Krieg zerstört."] },
    { conceptId: "grammar.extended_attributes", name: "Extended participial attributes", description: "Complex pre-noun modifiers", examples: ["Die vor kurzem renovierte Wohnung.", "Der seit Jahren in Berlin lebende Künstler."] },
  ],
  listeningTasks: ["Follow complex arguments", "Understand varied dialects"],
  readingTasks: ["Read literary texts", "Analyze opinion pieces"],
  speakingTasks: ["Debate complex topics", "Give presentations"],
  writingTasks: ["Write analytical essays", "Formal reports"],
  masteryEvidence: ["Handles nuance and register", "Uses idiomatic expressions naturally"],
  conceptIds: [
    "vocab.professional", "vocab.idioms",
    "grammar.konjunktiv_i", "grammar.passive_voice", "grammar.extended_attributes",
  ],
};

const c1: LevelCurriculum = {
  level: CEFRLevel.C1,
  label: "Advanced",
  description: "Can use language flexibly and effectively for social, academic, and professional purposes.",
  languageBalance: "100% German. English only if explicitly requested.",
  vocabularyClusters: [
    { name: "Literary", conceptId: "vocab.literary", words: ["Metapher", "Erzählung", "stilistisch", "Rhetorik", "Satire", "Allegorie"] },
    { name: "Academic", conceptId: "vocab.academic", words: ["Hypothese", "Paradigma", "Erkenntnistheorie", "Methodik", "qualitative Analyse"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.advanced_passive", name: "Advanced passive constructions", description: "Zustandspassiv, sein-Passiv, lassen + sich", examples: ["Das Problem lässt sich lösen.", "Die Tür ist geschlossen."] },
    { conceptId: "grammar.stylistic_devices", name: "Stylistic devices", description: "Rhetorical questions, irony, understatement", examples: [] },
  ],
  listeningTasks: ["Follow academic lectures", "Appreciate literary readings"],
  readingTasks: ["Analyze literary and academic texts"],
  speakingTasks: ["Discuss abstract concepts", "Adapt register fluidly"],
  writingTasks: ["Write academic papers", "Creative writing"],
  masteryEvidence: ["Near-native expression", "Handles abstract and literary topics"],
  conceptIds: ["vocab.literary", "vocab.academic", "grammar.advanced_passive", "grammar.stylistic_devices"],
};

const c2: LevelCurriculum = {
  level: CEFRLevel.C2,
  label: "Mastery",
  description: "Can understand with ease virtually everything heard or read. Native-like precision.",
  languageBalance: "100% German, indistinguishable from educated native speakers.",
  vocabularyClusters: [
    { name: "Full range", conceptId: "vocab.full_range", words: ["Neologismus", "Umgangssprache", "Regionalismus", "Archaismus"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.mastery", name: "Full mastery", description: "All structures. Focus on stylistic elegance.", examples: [] },
  ],
  listeningTasks: ["Understand any spoken German including dialects"],
  readingTasks: ["Read and analyze any text"],
  speakingTasks: ["Peer-level intellectual discussion"],
  writingTasks: ["Any genre or register"],
  masteryEvidence: ["Indistinguishable from native in written and spoken forms"],
  conceptIds: ["vocab.full_range", "grammar.mastery"],
};

export const deCurriculum: Record<CEFRLevel, LevelCurriculum> = {
  [CEFRLevel.A0]: a0,
  [CEFRLevel.A1]: a1,
  [CEFRLevel.A2]: a2,
  [CEFRLevel.B1]: b1,
  [CEFRLevel.B2]: b2,
  [CEFRLevel.C1]: c1,
  [CEFRLevel.C2]: c2,
};

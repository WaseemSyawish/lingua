import { CEFRLevel } from "@/generated/prisma/enums";
import { LevelCurriculum } from "../types";

/* ─── Spanish Curriculum: A0 through C2 ─── */

const a0: LevelCurriculum = {
  level: CEFRLevel.A0,
  label: "Pre-beginner",
  description: "Zero Spanish exposure. Building comfort and first contact with the language.",
  languageBalance: "Entirely English. Spanish only as isolated words with immediate translations.",
  vocabularyClusters: [
    { name: "Greetings", conceptId: "vocab.greetings_basic", words: ["hola", "adiós", "buenos días", "buenas noches", "gracias", "por favor", "de nada"] },
    { name: "Daily nouns", conceptId: "vocab.daily_nouns_basic", words: ["café", "agua", "pan", "mañana", "noche", "casa", "escuela"] },
    { name: "Responses", conceptId: "vocab.responses_basic", words: ["sí", "no", "bien", "muy bien", "vale"] },
    { name: "Numbers", conceptId: "vocab.numbers_1_10", words: ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"] },
    { name: "Identity", conceptId: "vocab.identity_basic", words: ["yo", "nombre", "cómo"] },
  ],
  grammarConcepts: [],
  listeningTasks: ["Hear individual Spanish words in English sentences"],
  readingTasks: [],
  speakingTasks: ["May repeat individual words voluntarily"],
  writingTasks: [],
  masteryEvidence: ["Recognizes 20+ basic Spanish words", "Shows comfort hearing Spanish"],
  conceptIds: ["vocab.greetings_basic", "vocab.daily_nouns_basic", "vocab.responses_basic", "vocab.numbers_1_10", "vocab.identity_basic"],
};

const a1: LevelCurriculum = {
  level: CEFRLevel.A1,
  label: "Beginner",
  description: "Can understand and use familiar everyday expressions and basic phrases.",
  languageBalance: "Predominantly English with generous Spanish woven in.",
  vocabularyClusters: [
    { name: "Self & identity", conceptId: "vocab.self_identity", words: ["me llamo", "tengo X años", "soy", "vivo en", "soy de"] },
    { name: "Family", conceptId: "vocab.family", words: ["madre", "padre", "hermano", "hermana", "hijo", "hija", "marido", "esposa", "niño", "familia", "abuelo", "abuela"] },
    { name: "Numbers", conceptId: "vocab.numbers_1_100", words: ["once", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa", "cien"] },
    { name: "Time", conceptId: "vocab.time_days_months", words: ["hora", "minuto", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo", "enero", "febrero", "hoy", "mañana", "ayer"] },
    { name: "Food & drink", conceptId: "vocab.food_drink", words: ["desayuno", "almuerzo", "cena", "pollo", "arroz", "ensalada", "fruta", "leche", "zumo", "cerveza", "vino", "queso", "pan"] },
    { name: "Colors", conceptId: "vocab.colors", words: ["rojo", "azul", "verde", "blanco", "negro", "amarillo", "gris", "rosa", "naranja", "marrón"] },
    { name: "Common objects", conceptId: "vocab.common_objects", words: ["libro", "bolígrafo", "mesa", "silla", "teléfono", "ordenador", "puerta", "ventana", "llave", "bolsa"] },
    { name: "Weather", conceptId: "vocab.weather", words: ["hace calor", "hace frío", "hace buen tiempo", "llueve", "nieva", "el sol", "el viento", "la nube"] },
    { name: "Places", conceptId: "vocab.places", words: ["ciudad", "calle", "tienda", "restaurante", "estación", "aeropuerto", "hospital", "hotel", "escuela", "oficina"] },
    { name: "Emotions", conceptId: "vocab.emotions_basic", words: ["contento", "triste", "cansado", "feliz", "enfadado", "tengo miedo", "sorprendido"] },
    { name: "Common verbs", conceptId: "vocab.common_verbs", words: ["comer", "beber", "dormir", "trabajar", "hablar", "escuchar", "mirar", "gustar", "querer", "poder", "leer", "escribir"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.subject_pronouns", name: "Subject pronouns", description: "yo, tú, él/ella, nosotros, vosotros, ellos/ellas", examples: ["Yo soy estudiante.", "Ella es española.", "Nosotros somos amigos."] },
    { conceptId: "grammar.ser_present", name: "Ser — present tense", description: "Full conjugation of ser in the present", examples: ["Yo soy alto.", "Tú eres simpático.", "Él es profesor."] },
    { conceptId: "grammar.estar_present", name: "Estar — present tense", description: "Full conjugation of estar in the present", examples: ["Estoy bien.", "¿Dónde estás?", "Ella está en casa."] },
    { conceptId: "grammar.tener_present", name: "Tener — present tense", description: "Full conjugation of tener", examples: ["Tengo 20 años.", "Tienes un hermano.", "Ella tiene hambre."] },
    { conceptId: "grammar.articles", name: "Articles", description: "Definite (el, la, los, las) and indefinite (un, una, unos, unas)", examples: ["El libro está en la mesa.", "Un hombre y una mujer."] },
    { conceptId: "grammar.ar_verbs_present", name: "Regular -ar verbs present tense", description: "Conjugation of regular -ar verbs", examples: ["Yo hablo español.", "Tú trabajas aquí.", "Nosotros estudiamos mucho."] },
    { conceptId: "grammar.negation_basic", name: "Basic negation", description: "No + verb structure", examples: ["No hablo francés.", "No tengo tiempo."] },
    { conceptId: "grammar.questions_basic", name: "Basic questions", description: "¿Cómo?, ¿Dónde?, ¿Qué?, ¿Cuándo?", examples: ["¿Cómo te llamas?", "¿Dónde vives?"] },
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
    "grammar.subject_pronouns", "grammar.ser_present", "grammar.estar_present",
    "grammar.tener_present", "grammar.articles", "grammar.ar_verbs_present",
    "grammar.negation_basic", "grammar.questions_basic",
  ],
};

const a2: LevelCurriculum = {
  level: CEFRLevel.A2,
  label: "Elementary",
  description: "Can communicate in simple, routine tasks requiring direct exchange of information on familiar topics.",
  languageBalance: "40% English, 60% Spanish. Spanish for most conversation, English for explanations.",
  vocabularyClusters: [
    { name: "Travel", conceptId: "vocab.travel", words: ["billete", "vuelo", "equipaje", "reserva", "pasaporte", "aduana", "salida", "llegada"] },
    { name: "Shopping", conceptId: "vocab.shopping", words: ["precio", "barato", "caro", "talla", "descuento", "tarjeta", "efectivo", "recibo"] },
    { name: "Health", conceptId: "vocab.health", words: ["médico", "enfermo", "dolor", "fiebre", "pastilla", "farmacia", "cita"] },
    { name: "Household", conceptId: "vocab.household", words: ["cocina", "dormitorio", "baño", "salón", "jardín", "piso", "escalera"] },
    { name: "Emotions expanded", conceptId: "vocab.emotions_expanded", words: ["preocupado", "nervioso", "emocionado", "aburrido", "orgulloso", "avergonzado"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.preterite", name: "Pretérito indefinido", description: "Simple past tense for completed actions", examples: ["Ayer comí paella.", "Fui al cine el viernes."] },
    { conceptId: "grammar.imperfect", name: "Pretérito imperfecto", description: "Imperfect tense for habitual/descriptive past", examples: ["Cuando era niño, jugaba mucho.", "Hacía sol todos los días."] },
    { conceptId: "grammar.reflexive_verbs", name: "Reflexive verbs", description: "Me levanto, te duchas, se viste...", examples: ["Me levanto a las 7.", "Se acuesta tarde."] },
    { conceptId: "grammar.object_pronouns", name: "Direct/indirect object pronouns", description: "lo, la, le, les, me, te, nos", examples: ["Lo compré ayer.", "Le di el libro."] },
    { conceptId: "grammar.comparisons", name: "Comparisons", description: "más...que, menos...que, tan...como", examples: ["Es más alto que yo.", "No es tan difícil como parece."] },
  ],
  listeningTasks: ["Follow short narratives about past events", "Understand directions"],
  readingTasks: ["Read short emails and messages", "Understand restaurant menus"],
  speakingTasks: ["Narrate past events", "Describe people and places"],
  writingTasks: ["Write a short personal email", "Describe daily routine"],
  masteryEvidence: ["Uses past tenses", "Describes routines", "Makes comparisons"],
  conceptIds: [
    "vocab.travel", "vocab.shopping", "vocab.health", "vocab.household", "vocab.emotions_expanded",
    "grammar.preterite", "grammar.imperfect", "grammar.reflexive_verbs",
    "grammar.object_pronouns", "grammar.comparisons",
  ],
};

const b1: LevelCurriculum = {
  level: CEFRLevel.B1,
  label: "Intermediate",
  description: "Can deal with most situations likely to arise while travelling and discuss familiar topics.",
  languageBalance: "20% English, 80% Spanish.",
  vocabularyClusters: [
    { name: "Work & career", conceptId: "vocab.work_career", words: ["empleo", "empresa", "jefe", "sueldo", "reunión", "experiencia", "currículum"] },
    { name: "Abstract concepts", conceptId: "vocab.abstract", words: ["libertad", "igualdad", "justicia", "educación", "desarrollo", "futuro"] },
    { name: "Connectors", conceptId: "vocab.connectors", words: ["sin embargo", "además", "por lo tanto", "en cambio", "aunque", "a pesar de"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.subjunctive_present", name: "Presente de subjuntivo", description: "Present subjunctive after wishes, doubts, emotions", examples: ["Espero que vengas.", "No creo que sea verdad."] },
    { conceptId: "grammar.conditional", name: "Condicional simple", description: "Would + verb", examples: ["Me gustaría viajar.", "¿Podrías ayudarme?"] },
    { conceptId: "grammar.si_clauses_1_2", name: "Si clauses (types 1 & 2)", description: "If-then conditional sentences", examples: ["Si tengo tiempo, iré.", "Si pudiera, viajaría."] },
    { conceptId: "grammar.relative_pronouns", name: "Relative pronouns", description: "que, quien, donde, cuyo", examples: ["El libro que leí.", "La ciudad donde nací."] },
  ],
  listeningTasks: ["Follow news reports on familiar topics", "Understand opinions in discussions"],
  readingTasks: ["Read newspaper articles", "Understand formal letters"],
  speakingTasks: ["Express opinions", "Discuss hypothetical situations"],
  writingTasks: ["Write opinion essays", "Formal emails"],
  masteryEvidence: ["Uses subjunctive correctly", "Expresses opinions with justification"],
  conceptIds: [
    "vocab.work_career", "vocab.abstract", "vocab.connectors",
    "grammar.subjunctive_present", "grammar.conditional",
    "grammar.si_clauses_1_2", "grammar.relative_pronouns",
  ],
};

const b2: LevelCurriculum = {
  level: CEFRLevel.B2,
  label: "Upper Intermediate",
  description: "Can interact with a degree of fluency and spontaneity with native speakers.",
  languageBalance: "5-10% English, 90-95% Spanish.",
  vocabularyClusters: [
    { name: "Professional", conceptId: "vocab.professional", words: ["estrategia", "negociación", "liderazgo", "productividad", "innovación"] },
    { name: "Idioms", conceptId: "vocab.idioms", words: ["meter la pata", "estar en las nubes", "no tener pelos en la lengua", "dar en el clavo"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.subjunctive_advanced", name: "Advanced subjunctive", description: "Imperfect subjunctive, pluperfect subjunctive", examples: ["Si hubiera sabido, habría venido.", "Ojalá hubiera estudiado más."] },
    { conceptId: "grammar.passive_voice", name: "Passive voice", description: "Ser + participle, se + verb", examples: ["El libro fue escrito por Cervantes.", "Se habla español aquí."] },
    { conceptId: "grammar.reported_speech", name: "Reported speech", description: "Indirect speech with tense shifts", examples: ["Dijo que vendría.", "Me preguntó si quería ir."] },
  ],
  listeningTasks: ["Follow complex arguments", "Understand varied accents"],
  readingTasks: ["Read literary texts", "Analyze opinion pieces"],
  speakingTasks: ["Debate complex topics", "Give presentations"],
  writingTasks: ["Write analytical essays", "Formal reports"],
  masteryEvidence: ["Handles nuance and register", "Uses idiomatic expressions naturally"],
  conceptIds: [
    "vocab.professional", "vocab.idioms",
    "grammar.subjunctive_advanced", "grammar.passive_voice", "grammar.reported_speech",
  ],
};

const c1: LevelCurriculum = {
  level: CEFRLevel.C1,
  label: "Advanced",
  description: "Can use language flexibly and effectively for social, academic, and professional purposes.",
  languageBalance: "100% Spanish. English only if explicitly requested.",
  vocabularyClusters: [
    { name: "Literary", conceptId: "vocab.literary", words: ["metáfora", "narrativa", "estilístico", "retórica", "sátira", "alegoría"] },
    { name: "Academic", conceptId: "vocab.academic", words: ["hipótesis", "paradigma", "epistemología", "metodología", "análisis cualitativo"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.literary_tenses", name: "Literary tenses", description: "Pretérito anterior, future perfect", examples: ["Hubo terminado antes de que llegaran."] },
    { conceptId: "grammar.stylistic_devices", name: "Stylistic devices", description: "Rhetorical questions, irony, understatement", examples: [] },
  ],
  listeningTasks: ["Follow academic lectures", "Appreciate literary readings"],
  readingTasks: ["Analyze literary and academic texts"],
  speakingTasks: ["Discuss abstract concepts", "Adapt register fluidly"],
  writingTasks: ["Write academic papers", "Creative writing"],
  masteryEvidence: ["Near-native expression", "Handles abstract and literary topics"],
  conceptIds: ["vocab.literary", "vocab.academic", "grammar.literary_tenses", "grammar.stylistic_devices"],
};

const c2: LevelCurriculum = {
  level: CEFRLevel.C2,
  label: "Mastery",
  description: "Can understand with ease virtually everything heard or read. Native-like precision.",
  languageBalance: "100% Spanish, indistinguishable from educated native speakers.",
  vocabularyClusters: [
    { name: "Full range", conceptId: "vocab.full_range", words: ["neologismo", "coloquialismo", "regionalismo", "arcaísmo"] },
  ],
  grammarConcepts: [
    { conceptId: "grammar.mastery", name: "Full mastery", description: "All structures. Focus on stylistic elegance.", examples: [] },
  ],
  listeningTasks: ["Understand any spoken Spanish including dialects"],
  readingTasks: ["Read and analyze any text"],
  speakingTasks: ["Peer-level intellectual discussion"],
  writingTasks: ["Any genre or register"],
  masteryEvidence: ["Indistinguishable from native in written and spoken forms"],
  conceptIds: ["vocab.full_range", "grammar.mastery"],
};

export const esCurriculum: Record<CEFRLevel, LevelCurriculum> = {
  [CEFRLevel.A0]: a0,
  [CEFRLevel.A1]: a1,
  [CEFRLevel.A2]: a2,
  [CEFRLevel.B1]: b1,
  [CEFRLevel.B2]: b2,
  [CEFRLevel.C1]: c1,
  [CEFRLevel.C2]: c2,
};

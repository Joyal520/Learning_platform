import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream, readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { computeAnalytics, generatePDFReport } from "./score_analysis.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const publicDir = resolve(projectRoot, "exam2");
const dataDir = resolve(__dirname, "data");
const env = loadEnv(resolve(projectRoot, ".env"));
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
const SUPABASE_URL = (process.env.SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || "";
const MAX_BODY_BYTES = 1_500_000;
const aiWindow = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

export async function handleExamApiRequest(req, res) {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const action = url.searchParams.get("action") || "";

    if (req.method === "GET" && action === "health") {
      return json(res, 200, { ok: true, openaiConfigured: Boolean(OPENAI_API_KEY) });
    }

    if (req.method === "POST" && action === "generate-exam") {
      if (!rateLimit(req, "generate", 6, 60_000)) {
        return json(res, 429, { error: "Too many AI requests. Please wait before generating again." });
      }
      const payload = await readJson(req);
      const validation = validateGenerationPayload(payload);
      if (validation) return json(res, 400, { error: validation });
      const exam = await generateExam(payload);
      await audit("ai_generation", {
        examType: payload.examType,
        difficulty: payload.difficulty,
        totalMarks: payload.requiredTotal,
        sectionCount: payload.sections.length
      });
      return json(res, 200, exam);
    }

    if (req.method === "POST" && action === "grade-attempt") {
      const payload = await readJson(req);
      const result = gradeAttempt(payload);
      await audit("attempt_graded", { examId: payload.exam?.metadata?.examId || "draft", score: result.totalScore });
      return json(res, 200, result);
    }

    if (req.method === "POST" && action === "save-exam") {
      const payload = await readJson(req);
      const saved = await saveExam(payload, req);
      await audit("exam_saved", { examId: saved.examId, approved: Boolean(payload.approved) });
      return json(res, 200, saved);
    }

    if (req.method === "POST" && action === "publish-exam") {
      const payload = await readJson(req);
      if (!payload.approved) return json(res, 403, { error: "Teacher approval is required before publishing." });
      const saved = await saveExam({ ...payload, publish: true }, req);
      await audit("exam_published", { examId: saved.examId });
      return json(res, 200, saved);
    }

    if (req.method === "GET" && action === "list-exams") {
      const result = await listTeacherExams(req, url.searchParams.get("classroomId"));
      return json(res, 200, result);
    }

    if (req.method === "GET" && action === "get-exam-results") {
      const result = await getTeacherExamResults(req, url.searchParams.get("examId"));
      return json(res, 200, result);
    }

    if (req.method === "GET" && action === "list-student-exams") {
      const result = await listStudentExams(req, url.searchParams.get("classroomId"));
      return json(res, 200, result);
    }

    if (req.method === "GET" && action === "get-student-exam") {
      const result = await getStudentExam(req, url.searchParams.get("classroomId"), url.searchParams.get("examId"));
      return json(res, 200, result);
    }

    if (req.method === "POST" && action === "submit-exam-attempt") {
      const payload = await readJson(req);
      const result = await submitExamAttempt(req, payload);
      return json(res, 200, result);
    }

    if ((req.method === "GET" || req.method === "POST") && action === "get-student-report") {
      const payload = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams.entries());
      const result = await getStudentReport(req, payload);
      return json(res, 200, result);
    }

    if ((req.method === "GET" || req.method === "POST") && action === "generate-student-report-pdf") {
      const payload = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams.entries());
      const result = await generateStudentReportPdf(req, payload);
      return json(res, 200, result);
    }

    if (req.method === "POST" && action === "score-analysis") {
      const payload = await readJson(req);
      const analytics = computeAnalytics(payload);
      
      const reportsDir = join(publicDir, "reports");
      await mkdir(reportsDir, { recursive: true });
      
      const fileName = `${payload.exam_id || "EXAM"}_${payload.class_id || "CLASS"}.pdf`;
      const pdfPath = join(reportsDir, fileName);
      await generatePDFReport(analytics, pdfPath);
      
      return json(res, 200, {
        report_pdf_url: `/exam2/reports/${fileName}`,
        summary: {
          average_score: analytics.average_score,
          pass_rate: analytics.pass_rate,
          highest_score: analytics.highest_score,
          lowest_score: analytics.lowest_score
        },
        analytics
      });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error.message || "Unexpected server error" });
  }
}

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const text = readFileSyncSafe(path);
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

function readFileSyncSafe(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

async function serveStatic(pathname, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const target = resolve(publicDir, `.${decodeURIComponent(requested)}`);
  if (!target.startsWith(publicDir)) return json(res, 403, { error: "Forbidden" });
  const ext = extname(target);
  try {
    const body = await readFile(target);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(body);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function validateGenerationPayload(payload) {
  if (!payload.content || payload.content.trim().length < 3) return "Content is required.";
  if (!payload.examType) return "Exam type is required.";
  if (!payload.difficulty) return "Difficulty is required.";
  if (!payload.duration?.value || !payload.duration?.unit) return "Duration is required.";
  if (!Array.isArray(payload.sections) || payload.sections.length === 0) return "At least one question section is required.";
  const total = payload.sections.reduce((sum, section) => sum + section.count * section.marks, 0);
  if (total !== Number(payload.requiredTotal || 100)) return `Total marks must equal ${payload.requiredTotal || 100}.`;
  return "";
}

async function generateExam(payload) {
  if (!OPENAI_API_KEY) return normalizeExam(buildFallbackExam(payload, "OPENAI_API_KEY is not configured."), payload);

  // Clean whitespaces to optimize input tokens
  const cleanedPayload = {
    ...payload,
    content: payload.content.replace(/\s+/g, " ").trim(),
    sections: payload.sections.map(s => ({
      ...s,
      instruction: s.instruction ? s.instruction.trim() : ""
    }))
  };

  const schema = examJsonSchema();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 80000); // 80 second timeout
  
  console.log("[generateExam] Starting OpenAI call...");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "You generate secure teacher-reviewed exams as structured JSON. Follow ALL rules below exactly.",
              "",
              "GENERAL RULES:",
              "1. Questions must be unique, grounded in supplied content, include answer keys.",
              "2. Keep each explanation under 15 words.",
              "3. Never include images, image references, or image descriptions.",
              "4. For each section, copy the provided 'instruction' string directly to the output 'instruction' property.",
              "5. For sections that are NOT 'Reading Comprehension Questions', set 'passage' to an empty string \"\".",
              "",
              "MCQ / FILL IN THE BLANKS / CLOZE PASSAGE RULES:",
              "- Provide exactly 4 unique options in the 'options' array. One must be the correct answer.",
              "- For MCQ, randomize the correct answer position across questions.",
              "",
              "REORDER THE SENTENCE RULES:",
              "- Each question must contain 6-8 words/phrases separated by slashes. Never more than 8.",
              "",
              "TRUE OR FALSE RULES:",
              "- Generate a roughly balanced mix of True and False answers (approximately half each).",
              "- Do NOT follow a predictable pattern (no alternating T,F,T,F). Randomize the order.",
              "- Never have more than 3 consecutive True or 3 consecutive False answers.",
              "",
              "READING COMPREHENSION RULES (CRITICAL - READ CAREFULLY):",
              "- You MUST generate a reading passage and put it in the section-level 'passage' property.",
              "- The 'passage' property is at the SECTION level, NOT inside individual questions.",
              "- The passage MUST NOT be empty. It must be a real, substantive paragraph.",
              "- Respect the 'paragraphLength' parameter: Short=100-150 words, Medium=200-300 words, Long=400-500 words.",
              "- The 'questions' array should test comprehension of the passage.",
              "- Each question must have 'options' as an empty array [] and 'correctAnswer' as a short answer.",
              "- Example section output: {\"sectionId\":\"s1\",\"title\":\"Reading Comprehension\",\"questionType\":\"Reading Comprehension Questions\",\"instruction\":\"...\",\"marksPerQuestion\":2,\"totalMarks\":10,\"passage\":\"The water cycle is a continuous process by which water circulates through the Earth's systems. Water evaporates from oceans and lakes, rises as vapor, condenses into clouds, and falls back as precipitation...\",\"questions\":[{\"questionId\":\"Q1\",\"questionType\":\"Reading Comprehension Questions\",\"questionText\":\"What happens to water when it evaporates?\",\"options\":[],\"correctAnswer\":\"It rises as vapor\",\"marks\":2,\"difficulty\":\"Medium\",\"explanation\":\"Evaporation turns water into vapor.\"}]}",
              "",
              "MATCHING QUESTIONS RULES (CRITICAL - READ CAREFULLY):",
              "- Generate the requested number of questions. Each question = one matching pair.",
              "- 'questionText' = left-column item (1-3 words ONLY). 'correctAnswer' = right-column item (1-3 words ONLY).",
              "- NEVER use sentences, explanations, or punctuation. Maximum 3 words per item.",
              "- Set 'options' to empty array [] for all matching questions.",
              "- CORRECT example: {\"questionText\":\"Labrador\",\"correctAnswer\":\"Friendly\"}",
              "- CORRECT example: {\"questionText\":\"H2O\",\"correctAnswer\":\"Water\"}",
              "- CORRECT example: {\"questionText\":\"1947\",\"correctAnswer\":\"Independence Year\"}",
              "- WRONG example (too long): {\"questionText\":\"Match the following breed\",\"correctAnswer\":\"This breed is known for being friendly and loyal\"}",
              "- WRONG example (sentence): {\"questionText\":\"What is a Labrador known for?\",\"correctAnswer\":\"A Labrador is known for being friendly\"}"
            ].join("\n")
          },
          {
            role: "user",
            content: JSON.stringify(cleanedPayload)
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "edtechra_exam",
            strict: true,
            schema
          }
        }
      })
    });

    clearTimeout(timeoutId);
    console.log("[generateExam] OpenAI response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[generateExam] OpenAI error:", errorBody.slice(0, 500));
      throw new Error(`OpenAI generation failed: ${response.status} ${errorBody.slice(0, 240)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      console.error("[generateExam] No content in response:", JSON.stringify(data).slice(0, 500));
      throw new Error("OpenAI response did not include structured text.");
    }
    console.log("[generateExam] Success. Normalizing exam...");
    return normalizeExam(JSON.parse(text), payload);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      console.warn("[generateExam] OpenAI timed out after 80s, using fallback.");
      return normalizeExam(buildFallbackExam(payload, "AI generation timed out. Using local fallback."), payload);
    }
    console.error("[generateExam] Error:", error.message);
    // Fall back to local generation on any error
    return normalizeExam(buildFallbackExam(payload, `AI error: ${error.message}`), payload);
  }
}

function buildFallbackExam(payload, reason = "Offline demo mode") {
  let index = 1;
  const sections = payload.sections.map((section) => ({
    sectionId: cryptoId("sec"),
    title: section.type,
    questionType: section.type,
    instruction: section.instruction || "",
    marksPerQuestion: section.marks,
    totalMarks: section.count * section.marks,
    passage: section.type === "Reading Comprehension Questions"
      ? `Photosynthesis is a vital process used by plants and other organisms to convert light energy into chemical energy. This chemical energy is stored in carbohydrate molecules, such as sugars, which are synthesized from carbon dioxide and water. In most cases, oxygen is also released as a waste product. Most plants, algae, and cyanobacteria perform photosynthesis; such organisms are called photoautotrophs. Photosynthesis is largely responsible for producing and maintaining the oxygen content of the Earth's atmosphere, and supplies most of the energy necessary for life on Earth. The process begins when energy from light is absorbed by proteins called reaction centres that contain green chlorophyll pigments.`
      : "",
    questions: Array.from({ length: section.count }, (_, qIdx) => {
      const id = `Q${String(index++).padStart(3, "0")}`;
      const isTF = section.type === "True or False Questions" || section.type === "True Or False";
      const isMatching = section.type === "Matching Questions";
      const answer = isTF
        ? (Math.random() < 0.5 ? "True" : "False")
        : isMatching
          ? sampleMatchingAnswer(qIdx)
          : sampleAnswer(section.type);
      return {
        questionId: id,
        questionType: section.type,
        questionText: isTF
          ? sampleTrueFalseQuestion(qIdx)
          : isMatching
            ? sampleMatchingQuestion(qIdx)
            : sampleQuestion(section.type, payload.content, id),
        options: (section.type === "Multiple Choice Questions (MCQ)" || section.type === "Fill In The Blanks" || section.type === "Cloze Passage Questions")
          ? [answer, "Alternative A", "Alternative B", "Alternative C"]
          : [],
        correctAnswer: answer,
        marks: section.marks,
        difficulty: section.difficulty || payload.difficulty,
        explanation: isTF
          ? sampleTrueFalseExplanation(qIdx)
          : isMatching
            ? "Pair description for local verification."
            : "Demo question generated locally. Use AI generation after configuring server access."
      };
    })
  }));
  return {
    metadata: {
      examId: cryptoId("exam"),
      title: `${payload.examType} - AI Draft`,
      examType: payload.examType,
      difficulty: payload.difficulty,
      duration: `${payload.duration.value} ${payload.duration.unit}`,
      totalMarks: payload.requiredTotal,
      gradingMode: payload.gradingMode,
      status: "draft",
      generatedAt: new Date().toISOString(),
      approvalRequired: true,
      generatorNote: reason
    },
    sections
  };
}

function sampleMatchingQuestion(qIdx) {
  const terms = ["Labrador", "Beagle", "Poodle", "Shepherd", "Bulldog", "Noun", "Verb", "Adjective", "Sun", "Water"];
  return terms[qIdx % terms.length];
}

function sampleMatchingAnswer(qIdx) {
  const definitions = ["Friendly", "Curious", "Intelligent", "Protective", "Docile", "Naming word", "Action word", "Describing word", "Light energy", "Hydrogen dioxide"];
  return definitions[qIdx % definitions.length];
}

function sampleTrueFalseQuestion(qIdx) {
  const questions = [
    "Plants produce their own food through photosynthesis.",
    "All plants have flowers.",
    "Roots help plants absorb water and nutrients from the soil.",
    "Plants do not need sunlight to grow.",
    "Photosynthesis occurs in the leaves of green plants.",
    "Stems only transport water and do not support the plant.",
    "Chlorophyll gives plants their green color."
  ];
  return questions[qIdx % questions.length];
}

function sampleTrueFalseExplanation(qIdx) {
  const explanations = [
    "Photosynthesis allows plants to make food.",
    "Not all plants produce flowers (e.g., ferns, mosses).",
    "Roots anchor the plant and absorb water/nutrients.",
    "Sunlight is required for photosynthesis.",
    "Chloroplasts in the leaf cells perform photosynthesis.",
    "Stems also hold the leaves up to the light.",
    "Chlorophyll is the green pigment in chloroplasts."
  ];
  return explanations[qIdx % explanations.length];
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeExam(exam, payload) {
  const totalMarks = payload.sections.reduce((sum, section) => sum + section.count * section.marks, 0);
  const normalized = {
    ...exam,
    metadata: {
      ...exam.metadata,
      examId: exam.metadata?.examId || cryptoId("exam"),
      examType: payload.examType,
      difficulty: payload.difficulty,
      duration: `${payload.duration.value} ${payload.duration.unit}`,
      totalMarks,
      gradingMode: payload.gradingMode,
      status: "draft",
      generatedAt: new Date().toISOString(),
      approvalRequired: true,
      generatorNote: exam.metadata?.generatorNote || "Generated by OpenAI and normalized by the Edtechra server."
    }
  };
  normalized.sections = (normalized.sections || []).map((section, sectionIndex) => {
    const payloadSection = payload.sections[sectionIndex] || {};
    const sectionType = payloadSection.type || section.questionType || "Short Answer Questions";
    const mappedQuestions = (section.questions || []).map((question, questionIndex) => {
        let options = Array.isArray(question.options) ? question.options.filter(Boolean) : [];
        const isDropdownType = ["Multiple Choice Questions (MCQ)", "Fill In The Blanks", "Cloze Passage Questions"].includes(sectionType);
        
        if (isDropdownType) {
          const correct = question.correctAnswer || "";
          if (correct && !options.some(o => o.trim().toLowerCase() === correct.trim().toLowerCase())) {
            options.push(correct);
          }
          const fallbacks = ["Option A", "Option B", "Option C", "Option D"];
          let fallbackIdx = 0;
          while (options.length < 4) {
            const candidate = fallbacks[fallbackIdx++];
            if (!options.some(o => o.trim().toLowerCase() === candidate.trim().toLowerCase())) {
              options.push(candidate);
            }
          }
          if (options.length > 4) {
            options = options.slice(0, 4);
          }
          options = shuffleArray(options);
        }
        let questionText = question.questionText || "";
        let correctAnswer = question.correctAnswer || "";
        
        if (sectionType === "Reorder the Sentence Questions" || sectionType === "Sentence Reordering" || sectionType === "Sentence Reorder Questions" || sectionType === "Reorder Sentence Questions") {
          correctAnswer = correctAnswer.replace(/\.+$/, "").trim();
          let words = correctAnswer.split(/\s+/).filter(Boolean);
          
          const properNounsList = [
            "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
            "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
            "london", "paris", "tokyo", "america", "china", "india", "england", "france", "germany",
            "john", "mary", "peter", "sarah", "david", "james", "emma", "olivia", "william", "sofia", "ayaan", "nethmi"
          ];
          
          const properNounsInSentence = new Set();
          words.forEach((w, idx) => {
            const cleanWord = w.replace(/[^a-zA-Z]/g, "").toLowerCase();
            if (cleanWord === "i") {
              properNounsInSentence.add(cleanWord);
            } else if (properNounsList.includes(cleanWord)) {
              properNounsInSentence.add(cleanWord);
            } else if (idx > 0 && w.charAt(0) === w.charAt(0).toUpperCase() && w.charAt(0) !== w.charAt(0).toLowerCase()) {
              properNounsInSentence.add(cleanWord);
            }
          });
          
          const normalizedWords = words.map((w, idx) => {
            const cleanWord = w.replace(/[^a-zA-Z]/g, "");
            const isProper = properNounsInSentence.has(cleanWord.toLowerCase());
            return isProper ? w : w.toLowerCase();
          });
          
          correctAnswer = normalizedWords.map((w, idx) => idx === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(" ");
          
          if (words.length > 8) {
            words = words.slice(0, 8);
            const truncatedNormalized = normalizedWords.slice(0, 8);
            correctAnswer = truncatedNormalized.map((w, idx) => idx === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(" ");
            questionText = shuffleArray(truncatedNormalized).join(" / ");
          } else {
            const splitter = questionText.includes("/") ? "/" : /\s+/;
            const tiles = questionText.split(splitter).map(w => w.trim().replace(/\.+$/, "")).filter(Boolean);
            const normalizedTiles = tiles.map(tile => {
              const cleanTile = tile.replace(/[^a-zA-Z]/g, "");
              const isProper = properNounsInSentence.has(cleanTile.toLowerCase());
              return isProper ? tile : tile.toLowerCase();
            });
            questionText = normalizedTiles.join(" / ");
          }
        }

        return {
          ...question,
          questionId: question.questionId || `S${sectionIndex + 1}Q${questionIndex + 1}`,
          questionType: sectionType,
          questionText,
          correctAnswer,
          options
        };
    });

    let questions = mappedQuestions;
    if (sectionType === "True or False Questions" || sectionType === "True Or False") {
      // Shuffle T/F questions randomly instead of forcing a predictable alternating pattern.
      // Ensure no more than 3 consecutive same answers.
      questions = shuffleArray(mappedQuestions);

      // Validate: break runs of 4+ consecutive same answers by swapping
      for (let attempts = 0; attempts < 20; attempts++) {
        let hasLongRun = false;
        for (let i = 0; i <= questions.length - 4; i++) {
          const ans = questions.slice(i, i + 4).map(q => String(q.correctAnswer || "").trim().toLowerCase());
          if (ans.every(a => a === ans[0])) {
            hasLongRun = true;
            break;
          }
        }
        if (!hasLongRun) break;
        questions = shuffleArray(questions);
      }

      questions.forEach((q, idx) => {
        q.questionId = `S${sectionIndex + 1}Q${idx + 1}`;
      });
    }

    // ── Matching: sanitize items to max 3 words and split if AI crammed all pairs into one question ──
    if (sectionType === "Matching Questions") {
      // If AI generated only 1 question but crammed multiple pairs (e.g. "Go - Went; Take - Took"),
      // try to split them into individual question objects.
      if (questions.length === 1) {
        const q = questions[0];
        const text = q.correctAnswer || "";
        // Check for semicolon-separated or newline-separated pairs
        const separators = [";", "\n", "|"];
        let pairs = null;
        for (const sep of separators) {
          if (text.includes(sep)) {
            pairs = text.split(sep).map(p => p.trim()).filter(Boolean);
            break;
          }
        }
        if (pairs && pairs.length > 1) {
          const splitQuestions = [];
          for (const pair of pairs) {
            // Try to split "Term - Definition" or "Term: Definition" or "Term = Definition"
            const dashMatch = pair.match(/^(.+?)\s*[-:=→]\s*(.+)$/);
            if (dashMatch) {
              splitQuestions.push({
                ...q,
                questionId: `S${sectionIndex + 1}Q${splitQuestions.length + 1}`,
                questionText: dashMatch[1].trim().split(/\s+/).slice(0, 3).join(" "),
                correctAnswer: dashMatch[2].trim().split(/\s+/).slice(0, 3).join(" "),
                options: []
              });
            }
          }
          if (splitQuestions.length > 1) {
            questions = splitQuestions;
          }
        }
      }

      // Truncate any matching item to max 3 words
      questions = questions.map(q => ({
        ...q,
        questionText: (q.questionText || "").split(/\s+/).slice(0, 3).join(" "),
        correctAnswer: (q.correctAnswer || "").split(/\s+/).slice(0, 3).join(" "),
        options: []
      }));
    }

    // ── Reading Comprehension: ensure passage is not empty ──
    let sectionPassage = section.passage || "";
    if (sectionType === "Reading Comprehension Questions" && !sectionPassage.trim()) {
      // If AI failed to generate a passage, build one from the first question's text or use content
      const contentSnippet = payload.content ? payload.content.slice(0, 500) : "";
      sectionPassage = contentSnippet || "No passage was generated. Please edit this text to add your reading passage.";
      console.warn("[normalizeExam] Reading Comprehension passage was empty; used content fallback.");
    }

    return {
      ...section,
      sectionId: section.sectionId || cryptoId("sec"),
      questionType: sectionType,
      title: section.title || sectionType,
      instruction: section.instruction || payloadSection.instruction || "",
      totalMarks: questions.reduce((sum, q) => sum + Number(q.marks || 0), 0),
      questions,
      passage: sectionPassage
    };
  });
  return normalized;
}

function sampleQuestion(type, content, id) {
  const topic = content.trim().split(/\s+/).slice(0, 10).join(" ");
  const map = {
    "Multiple Choice Questions (MCQ)": `Which statement best matches the supplied lesson content about ${topic}?`,
    "Fill In The Blanks": `Complete the key idea from the lesson: ${topic} ... _____.`,
    "Cloze Passage Questions": `Complete the passage by filling in the blanks for the ${topic} content: _____ is essential.`,
    "Matching Questions": `Match the related items of ${topic} below.`,
    "True or False Questions": `True or false: ${topic} is a central idea in the supplied material.`,
    "Reorder the Sentence Questions": `football / play / we / on / Sundays / love / to`,
    "Short Answer Questions": `Write a brief answer explaining the main concept of ${topic}.`,
    "Reading Comprehension Questions": `Based on the reading passage, what is a key detail related to ${topic}?`,
    "Essay Type Questions": `Write a structured response explaining ${topic} with examples from the provided material.`
  };
  return `${id}. ${map[type] || map["Essay Type Questions"]}`;
}

function sampleAnswer(type) {
  if (type === "Multiple Choice Questions (MCQ)") return "Core concept";
  if (type === "True or False Questions" || type === "True Or False") return "True";
  if (type === "Reorder the Sentence Questions" || type === "Sentence Reordering") return "We love to play football on Sundays";
  if (type === "Matching Questions") return "Column A Item 1 - Column B Item 1, Column A Item 2 - Column B Item 2";
  if (type === "Cloze Passage Questions" || type === "Fill In The Blanks") return "missing word";
  return "A complete answer that accurately reflects the supplied content.";
}

function gradeAttempt(payload) {
  const questions = (payload.exam?.sections || []).flatMap((section) => section.questions || []);
  const answers = payload.answers || {};
  const breakdown = questions.map((question) => {
    const submitted = answers[question.questionId];
    const exact = String(submitted || "").trim().toLowerCase() === String(question.correctAnswer || "").trim().toLowerCase();
    const hybrid = ["Essay Type Questions", "Essay Questions", "Reading Comprehension Questions", "Reading Comprehension", "Short Answer Questions"].includes(question.questionType);
    const score = hybrid ? Math.round(question.marks * 0.7) : exact ? question.marks : 0;
    return {
      questionId: question.questionId,
      score,
      maxScore: question.marks,
      feedback: hybrid ? "Queued for teacher review with provisional rubric score." : exact ? "Correct." : "Review the concept and try again."
    };
  });
  const totalScore = breakdown.reduce((sum, item) => sum + item.score, 0);
  const maxScore = breakdown.reduce((sum, item) => sum + item.maxScore, 0);
  return {
    totalScore,
    maxScore,
    percentage: maxScore ? Math.round((totalScore / maxScore) * 100) : 0,
    grade: gradeFromPercentage(maxScore ? (totalScore / maxScore) * 100 : 0),
    strengths: ["Completed attempt", "Objective answers processed"],
    weaknesses: ["Long-form answers need teacher confirmation"],
    feedback: "Objective questions were auto-graded. Hybrid sections remain reviewable.",
    breakdown
  };
}

function gradeFromPercentage(value) {
  if (value >= 90) return "A";
  if (value >= 80) return "B";
  if (value >= 70) return "C";
  if (value >= 60) return "D";
  return "Needs Support";
}

function hasSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function authToken(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

async function requireExamUser(req) {
  if (!hasSupabase()) throw new Error("Supabase is not configured for Exam 2.0.");
  const token = authToken(req);
  if (!token) {
    console.warn("[exam-engine] requireExamUser: No Authorization header token received");
    throw new Error("Missing Supabase access token.");
  }
  console.info("[exam-engine] requireExamUser: token present, length =", token.length, ", prefix =", token.substring(0, 20) + "...");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("[exam-engine] requireExamUser: Supabase auth REJECTED", { status: response.status, body: errorBody.substring(0, 200) });
    throw new Error("Invalid or expired Supabase session.");
  }
  const user = await response.json();
  console.info("[exam-engine] requireExamUser: authenticated as", user.id);
  return { user, token };
}

async function supabaseRest(table, { method = "GET", query = {}, body, prefer = "", single = false } = {}) {
  if (!hasSupabase()) throw new Error("Supabase is not configured for Exam 2.0.");
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const headers = serviceHeaders(prefer ? { Prefer: prefer } : {});
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = data?.message || data?.error || text || response.statusText;
    throw new Error(`Supabase ${table} ${method} failed: ${detail}`);
  }
  return single ? (Array.isArray(data) ? data[0] || null : data) : data;
}

async function assertTeacherForClass(req, classroomId) {
  const { user } = await requireExamUser(req);
  if (!classroomId) throw new Error("Missing classroom ID.");
  const classroom = await supabaseRest("classrooms", {
    query: {
      id: `eq.${classroomId}`,
      select: "id,title,teacher_id"
    },
    single: true
  });
  if (!classroom || classroom.teacher_id !== user.id) {
    throw new Error("You do not have teacher access to this classroom.");
  }
  return { user, classroom };
}

async function assertStudentForClass(req, classroomId) {
  const { user } = await requireExamUser(req);
  if (!classroomId) throw new Error("Missing classroom ID.");
  const member = await supabaseRest("classroom_members", {
    query: {
      classroom_id: `eq.${classroomId}`,
      profile_id: `eq.${user.id}`,
      role: "eq.student",
      select: "id,classroom_id,profile_id,role"
    },
    single: true
  });
  if (!member) throw new Error("You are not a member of this classroom.");
  return { user, member };
}

function parsePublishDate(date, time, endOfDay = false) {
  if (!date) return null;
  const safeTime = time || (endOfDay ? "23:59" : "00:00");
  const parsed = new Date(`${date}T${safeTime}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseDurationMinutes(publishing = {}, exam = {}) {
  const raw = publishing.durationSelect === "custom"
    ? `${publishing.durationValue || 60} ${publishing.durationUnit || "Minutes"}`
    : publishing.duration || exam.metadata?.duration || "60 Minutes";
  const match = String(raw).match(/(\d+(?:\.\d+)?)\s*(hour|hours|minute|minutes)/i);
  if (!match) return 60;
  const value = Number(match[1]) || 60;
  return /hour/i.test(match[2]) ? Math.round(value * 60) : Math.round(value);
}

function calculateExamStatus({ draft = false, startsAt = null, endsAt = null }) {
  if (draft) return "draft";
  const now = Date.now();
  const startMs = startsAt ? new Date(startsAt).getTime() : null;
  const endMs = endsAt ? new Date(endsAt).getTime() : null;
  if (endMs && endMs <= now) return "closed";
  if (startMs && startMs > now) return "scheduled";
  return "active";
}

function withRuntimeStatus(exam) {
  if (!exam) return exam;
  return {
    ...exam,
    runtime_status: calculateExamStatus({
      draft: exam.status === "draft" || exam.status === "archived",
      startsAt: exam.starts_at,
      endsAt: exam.ends_at
    })
  };
}

function buildExamRecord(payload, teacherId) {
  const publishing = payload.publishing || {};
  const exam = payload.exam || {};
  const metadata = exam.metadata || {};
  const startsAt = parsePublishDate(publishing.startDate, publishing.startTime);
  const endsAt = parsePublishDate(publishing.endDate, publishing.endTime, true);
  const draft = !payload.publish;
  return {
    classroom_id: payload.classroomId,
    teacher_id: teacherId || payload.teacherId,
    title: metadata.title || "Untitled Exam",
    description: metadata.generatorNote || "",
    exam_type: metadata.examType || payload.examType || "",
    difficulty: metadata.difficulty || payload.difficulty || "",
    duration_minutes: parseDurationMinutes(publishing, exam),
    total_marks: Number(metadata.totalMarks || 0),
    status: calculateExamStatus({ draft, startsAt, endsAt }),
    starts_at: startsAt,
    ends_at: endsAt,
    max_attempts: Math.max(1, Number(publishing.maxAttempts || 1)),
    show_marks_immediately: publishing.marksImmediately !== false,
    show_correct_answers: publishing.answersAfterExam !== false,
    allow_late_submission: Boolean(publishing.late),
    password: publishing.password || null,
    exam_config_json: {
      metadata,
      settings: payload.settings || {},
      publishing,
      approved: Boolean(payload.approved)
    },
    questions_json: exam.sections || [],
    source: payload.source || "exam2",
    published_at: draft ? null : new Date().toISOString()
  };
}

async function saveExam(payload, req) {
  if (hasSupabase() && payload.classroomId && authToken(req)) {
    const { user } = await assertTeacherForClass(req, payload.classroomId);
    const record = buildExamRecord(payload, user.id);
    const saved = await supabaseRest("exams", {
      method: "POST",
      body: record,
      prefer: "return=representation",
      single: true
    });
    return {
      examId: saved.id,
      status: saved.status,
      storage: "supabase",
      savedAt: saved.updated_at || saved.created_at,
      exam: withRuntimeStatus(saved)
    };
  }

  await mkdir(dataDir, { recursive: true });
  const examId = payload.exam?.metadata?.examId || cryptoId("exam");
  const record = {
    examId,
    status: payload.publish ? "published-local" : "draft",
    approved: Boolean(payload.approved),
    savedAt: new Date().toISOString(),
    metadata: payload.exam?.metadata || {},
    exam: payload.exam,
    settings: payload.settings || {},
    publishing: payload.publishing || {}
  };
  await writeFile(join(dataDir, `${examId}.json`), JSON.stringify(record, null, 2));
  return { examId, status: record.status, storage: "local-json", savedAt: record.savedAt };
}

async function listTeacherExams(req, classroomId) {
  const { classroom } = await assertTeacherForClass(req, classroomId);
  const exams = await supabaseRest("exams", {
    query: {
      classroom_id: `eq.${classroomId}`,
      select: "*",
      order: "created_at.desc"
    }
  });
  const results = await supabaseRest("exam_results", {
    query: {
      classroom_id: `eq.${classroomId}`,
      select: "exam_id,score,percentage,status"
    }
  });
  const stats = new Map();
  (results || []).forEach((result) => {
    const item = stats.get(result.exam_id) || { submissions: 0, averageScore: 0, totalScore: 0, needsReview: 0 };
    item.submissions += 1;
    item.totalScore += Number(result.percentage || 0);
    if (result.status === "submitted") item.needsReview += 1;
    item.averageScore = item.submissions ? Math.round(item.totalScore / item.submissions) : 0;
    stats.set(result.exam_id, item);
  });
  return {
    classroom,
    exams: (exams || []).map((exam) => ({
      ...withRuntimeStatus(exam),
      stats: stats.get(exam.id) || { submissions: 0, averageScore: 0, needsReview: 0 }
    }))
  };
}

async function getTeacherExamResults(req, examId) {
  if (!examId) throw new Error("Missing exam ID.");
  const exam = await supabaseRest("exams", {
    query: { id: `eq.${examId}`, select: "*" },
    single: true
  });
  if (!exam) throw new Error("Exam not found.");
  await assertTeacherForClass(req, exam.classroom_id);
  const rows = await supabaseRest("exam_results", {
    query: {
      exam_id: `eq.${examId}`,
      select: "*",
      order: "submitted_at.desc"
    }
  });
  return { exam: withRuntimeStatus(exam), results: rows || [] };
}

async function listStudentExams(req, classroomId) {
  const { user } = await assertStudentForClass(req, classroomId);
  console.info("[exam-engine] listStudentExams", { classroomId, userId: user.id });
  const exams = await supabaseRest("exams", {
    query: {
      classroom_id: `eq.${classroomId}`,
      select: "*",
      order: "created_at.desc"
    }
  });
  console.info("[exam-engine] Raw exams from Supabase", { count: (exams || []).length, statuses: (exams || []).map(e => e.status) });
  const attempts = await supabaseRest("exam_results", {
    query: {
      classroom_id: `eq.${classroomId}`,
      student_id: `eq.${user.id}`,
      select: "*",
      order: "attempt_number.desc"
    }
  });
  const attemptsByExam = new Map();
  (attempts || []).forEach((attempt) => {
    if (!attemptsByExam.has(attempt.exam_id)) attemptsByExam.set(attempt.exam_id, []);
    attemptsByExam.get(attempt.exam_id).push(attempt);
  });
  const filtered = (exams || []).filter((exam) => !["draft", "archived"].includes(exam.status));
  console.info("[exam-engine] Exams after status filter (keep non-draft/non-archived)", { count: filtered.length });
  return {
    exams: filtered
      .map((exam) => {
        const runtime = withRuntimeStatus(exam);
        const examAttempts = attemptsByExam.get(exam.id) || [];
        const latest = examAttempts[0] || null;
        const attemptCount = examAttempts.length;
        return {
          id: runtime.id,
          title: runtime.title,
          description: runtime.description,
          duration_minutes: runtime.duration_minutes,
          total_marks: runtime.total_marks,
          status: runtime.runtime_status,
          starts_at: runtime.starts_at,
          ends_at: runtime.ends_at,
          max_attempts: runtime.max_attempts,
          show_marks_immediately: runtime.show_marks_immediately,
          show_correct_answers: runtime.show_correct_answers,
          attempt_count: attemptCount,
          latest_result: latest,
          can_start: runtime.runtime_status === "active" && attemptCount < runtime.max_attempts
        };
      })
  };
}

async function getStudentExam(req, classroomId, examId) {
  const { user } = await assertStudentForClass(req, classroomId);
  const exam = await supabaseRest("exams", {
    query: {
      id: `eq.${examId}`,
      classroom_id: `eq.${classroomId}`,
      select: "*"
    },
    single: true
  });
  if (!exam || ["draft", "archived"].includes(exam.status)) throw new Error("Exam not found.");
  const runtime = withRuntimeStatus(exam);
  const attempts = await supabaseRest("exam_results", {
    query: {
      exam_id: `eq.${examId}`,
      student_id: `eq.${user.id}`,
      select: "*",
      order: "attempt_number.desc"
    }
  });
  const attemptCount = (attempts || []).length;
  const canStart = runtime.runtime_status === "active" && attemptCount < runtime.max_attempts;
  return {
    exam: {
      ...runtime,
      questions_json: canStart ? runtime.questions_json : [],
      password: undefined
    },
    attempt_count: attemptCount,
    latest_result: attempts?.[0] || null,
    can_start: canStart
  };
}

async function submitExamAttempt(req, payload) {
  const classroomId = payload.classroomId;
  const examId = payload.examId;
  const { user } = await assertStudentForClass(req, classroomId);
  const exam = await supabaseRest("exams", {
    query: {
      id: `eq.${examId}`,
      classroom_id: `eq.${classroomId}`,
      select: "*"
    },
    single: true
  });
  if (!exam || ["draft", "archived"].includes(exam.status)) throw new Error("Exam not found.");
  const runtime = withRuntimeStatus(exam);
  const now = Date.now();
  const startsAt = runtime.starts_at ? new Date(runtime.starts_at).getTime() : null;
  const endsAt = runtime.ends_at ? new Date(runtime.ends_at).getTime() : null;
  if (startsAt && startsAt > now) throw new Error("This exam has not opened yet.");
  if (endsAt && endsAt < now && !runtime.allow_late_submission) throw new Error("This exam is closed.");

  const attempts = await supabaseRest("exam_results", {
    query: {
      exam_id: `eq.${examId}`,
      student_id: `eq.${user.id}`,
      select: "id,attempt_number",
      order: "attempt_number.desc"
    }
  });
  if ((attempts || []).length >= Number(runtime.max_attempts || 1)) {
    throw new Error("Maximum attempts reached for this exam.");
  }
  const attemptNumber = (attempts?.[0]?.attempt_number || 0) + 1;
  const grading = gradeAttempt({
    exam: {
      metadata: runtime.exam_config_json?.metadata || {},
      sections: runtime.questions_json || []
    },
    answers: payload.answers || {}
  });
  const needsReview = grading.breakdown.some((item) => /teacher review/i.test(item.feedback || ""));
  const inserted = await supabaseRest("exam_results", {
    method: "POST",
    prefer: "return=representation",
    single: true,
    body: {
      exam_id: examId,
      classroom_id: classroomId,
      student_id: user.id,
      attempt_number: attemptNumber,
      answers_json: payload.answers || {},
      score: grading.totalScore,
      max_score: grading.maxScore,
      percentage: grading.percentage,
      grade: grading.grade,
      status: needsReview ? "submitted" : "reviewed",
      breakdown_json: grading.breakdown,
      feedback_json: {
        strengths: grading.strengths,
        weaknesses: grading.weaknesses,
        feedback: grading.feedback,
        late: Boolean(endsAt && endsAt < now)
      },
      started_at: payload.startedAt || new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      reviewed_at: needsReview ? null : new Date().toISOString()
    }
  });
  return { result: inserted, grading, needsReview };
}

async function getStudentReport(req, payload) {
  if (!payload.resultId && !payload.examId) throw new Error("Missing result or exam ID.");
  const { user } = await requireExamUser(req);
  const query = payload.resultId
    ? { id: `eq.${payload.resultId}`, select: "*" }
    : {
        exam_id: `eq.${payload.examId}`,
        student_id: `eq.${payload.studentId || user.id}`,
        select: "*",
        order: "attempt_number.desc"
      };
  const result = await supabaseRest("exam_results", { query, single: true });
  if (!result) throw new Error("Exam result not found.");
  if (result.student_id !== user.id) await assertTeacherForClass(req, result.classroom_id);

  const exam = await supabaseRest("exams", { query: { id: `eq.${result.exam_id}`, select: "*" }, single: true });
  const classroom = await supabaseRest("classrooms", { query: { id: `eq.${result.classroom_id}`, select: "id,title,subject,grade" }, single: true });
  const profile = await supabaseRest("profiles", { query: { id: `eq.${result.student_id}`, select: "*" }, single: true }).catch(() => null);
  return buildStudentReport({ result, exam, classroom, profile });
}

function buildStudentReport({ result, exam, classroom, profile }) {
  const breakdown = Array.isArray(result.breakdown_json) ? result.breakdown_json : [];
  const correct = breakdown.filter((item) => Number(item.score) >= Number(item.maxScore)).length;
  const wrong = breakdown.filter((item) => Number(item.score) === 0).length;
  const unreviewed = breakdown.filter((item) => /teacher review/i.test(item.feedback || "")).length;
  const weakItems = breakdown.filter((item) => Number(item.score) < Number(item.maxScore));
  return {
    student: {
      id: result.student_id,
      name: profile?.display_name || profile?.full_name || profile?.name || profile?.username || profile?.email || "Student"
    },
    classroom: {
      id: classroom?.id || result.classroom_id,
      name: classroom?.title || classroom?.name || "Classroom"
    },
    exam: {
      id: exam?.id || result.exam_id,
      title: exam?.title || "Exam",
      date: exam?.starts_at || exam?.published_at || exam?.created_at || null
    },
    result,
    summary: {
      total_marks: result.max_score,
      marks_scored: result.score,
      percentage: result.percentage,
      grade: result.grade,
      correct_answers: correct,
      wrong_answers: wrong,
      unreviewed_answers: unreviewed
    },
    question_breakdown: breakdown,
    strengths: result.feedback_json?.strengths || ["Completed the exam"],
    weaknesses: result.feedback_json?.weaknesses || weakItems.map((item) => `Review question ${item.questionId}`).slice(0, 3),
    improvement_suggestions: weakItems.length
      ? weakItems.map((item) => `Revise the concept tested in question ${item.questionId}.`).slice(0, 5)
      : ["Keep practicing to maintain accuracy."],
    ai_feedback: result.feedback_json?.feedback || "",
    teacher_feedback: result.teacher_feedback || ""
  };
}

async function generateStudentReportPdf(req, payload) {
  const report = await getStudentReport(req, payload);
  const reportsDir = join(publicDir, "reports", "students");
  await mkdir(reportsDir, { recursive: true });
  const fileName = `${report.exam.id}_${report.student.id}_${report.result.attempt_number || 1}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const pdfPath = join(reportsDir, fileName);
  await writeStudentReportPdf(report, pdfPath);
  return { report, report_pdf_url: `/exam2/reports/students/${fileName}` };
}

function writeStudentReportPdf(report, outputPath) {
  return new Promise((resolvePdf, rejectPdf) => {
    const doc = new PDFDocument({ margin: 48 });
    const stream = createWriteStream(outputPath);
    stream.on("finish", resolvePdf);
    stream.on("error", rejectPdf);
    doc.on("error", rejectPdf);
    doc.pipe(stream);

    doc.fontSize(22).text("Edtechra Individual Exam Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Student: ${report.student.name}`);
    doc.text(`Classroom: ${report.classroom.name}`);
    doc.text(`Exam: ${report.exam.title}`);
    doc.text(`Submitted: ${report.result.submitted_at || "Not recorded"}`);
    doc.moveDown();
    doc.fontSize(16).text("Marks Summary");
    doc.fontSize(12).text(`Score: ${report.summary.marks_scored}/${report.summary.total_marks}`);
    doc.text(`Percentage: ${report.summary.percentage}%`);
    doc.text(`Grade: ${report.summary.grade}`);
    doc.text(`Correct: ${report.summary.correct_answers}   Wrong: ${report.summary.wrong_answers}   Unreviewed: ${report.summary.unreviewed_answers}`);
    doc.moveDown();
    doc.fontSize(16).text("Feedback");
    doc.fontSize(12).text(`AI feedback: ${report.ai_feedback || "No AI feedback recorded."}`);
    doc.text(`Teacher feedback: ${report.teacher_feedback || "No teacher feedback recorded."}`);
    doc.moveDown();
    doc.fontSize(16).text("Improvement Suggestions");
    (report.improvement_suggestions || []).forEach((item) => doc.fontSize(12).text(`- ${item}`));
    doc.moveDown();
    doc.fontSize(16).text("Question Breakdown");
    (report.question_breakdown || []).forEach((item) => {
      doc.fontSize(11).text(`${item.questionId}: ${item.score}/${item.maxScore} - ${item.feedback || ""}`);
    });
    doc.moveDown();
    doc.fontSize(9).fillColor("#667085").text(`Generated: ${new Date().toISOString()}`);
    doc.end();
  });
}

async function audit(action, details) {
  await mkdir(dataDir, { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), action, details }) + "\n";
  await writeFile(join(dataDir, "exam_audit_logs.jsonl"), line, { flag: "a" });
}

function rateLimit(req, action, max, interval) {
  const key = `${req.socket.remoteAddress}:${action}`;
  const now = Date.now();
  const hits = (aiWindow.get(key) || []).filter((time) => now - time < interval);
  if (hits.length >= max) return false;
  hits.push(now);
  aiWindow.set(key, hits);
  return true;
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(body));
}

function cryptoId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function examJsonSchema() {
  const question = {
    type: "object",
    additionalProperties: false,
    required: ["questionId", "questionType", "questionText", "options", "correctAnswer", "marks", "difficulty", "explanation"],
    properties: {
      questionId: { type: "string" },
      questionType: { type: "string" },
      questionText: { type: "string" },
      options: { type: "array", items: { type: "string" } },
      correctAnswer: { type: "string" },
      marks: { type: "number" },
      difficulty: { type: "string" },
      explanation: { type: "string" }
    }
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["metadata", "sections"],
    properties: {
      metadata: {
        type: "object",
        additionalProperties: false,
        required: ["examId", "title", "examType", "difficulty", "duration", "totalMarks", "gradingMode", "status", "generatedAt", "approvalRequired", "generatorNote"],
        properties: {
          examId: { type: "string" },
          title: { type: "string" },
          examType: { type: "string" },
          difficulty: { type: "string" },
          duration: { type: "string" },
          totalMarks: { type: "number" },
          gradingMode: { type: "string" },
          status: { type: "string" },
          generatedAt: { type: "string" },
          approvalRequired: { type: "boolean" },
          generatorNote: { type: "string" }
        }
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["sectionId", "title", "questionType", "instruction", "marksPerQuestion", "totalMarks", "questions", "passage"],
          properties: {
            sectionId: { type: "string" },
            title: { type: "string" },
            questionType: { type: "string" },
            instruction: { type: "string" },
            marksPerQuestion: { type: "number" },
            totalMarks: { type: "number" },
            questions: { type: "array", items: question },
            passage: { type: "string" }
          }
        }
      }
    }
  };
}

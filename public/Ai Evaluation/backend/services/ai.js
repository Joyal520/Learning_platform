import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local server env files. Never use frontend VITE_ keys for grading.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), override: true });

// Access the API key from server-side environment variables only.
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn('WARNING: OpenAI API key is missing. Add OPENAI_API_KEY to the server environment.');
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Validates and normalizes the AI evaluation response to the strict contract
 * @param {string|Object} rawJson - The raw JSON response from the AI
 * @param {string} expectedModuleType - The expected module type
 * @returns {Object} Validated and normalized evaluation data
 */
export function validateAndNormalize(rawJson, expectedModuleType) {
  let parsed;
  try {
    parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  } catch (e) {
    throw new Error('Response is not valid JSON: ' + e.message);
  }

  // Handle unclear failure state
  if (parsed.unclear === true) {
    return {
      module_type: expectedModuleType,
      score: 0,
      subscores: {},
      mistakes: [],
      feedback: "Unclear text. Please upload a clearer image.",
      top_issue: "Unclear text",
      improvement: "Ensure the camera is focused and lighting is bright.",
      unclear: true,
      extracted_text: "Unclear text",
      corrected_text: "",
      ocr_confidence: 0.0
    };
  }

  // Schema check
  const requiredFields = [
    'module_type',
    'score',
    'subscores',
    'mistakes',
    'feedback',
    'top_issue',
    'improvement',
    'unclear',
    'extracted_text',
    'corrected_text',
    'ocr_confidence'
  ];

  for (const field of requiredFields) {
    if (!(field in parsed)) {
      throw new Error(`Missing required schema field: ${field}`);
    }
  }

  // Type checks and normalization
  parsed.module_type = expectedModuleType;
  
  if (typeof parsed.score !== 'number') {
    parsed.score = parseInt(parsed.score, 10) || 0;
  }
  if (typeof parsed.subscores !== 'object' || parsed.subscores === null) {
    parsed.subscores = {};
  }
  if (!Array.isArray(parsed.mistakes)) {
    parsed.mistakes = [];
  }
  if (typeof parsed.feedback !== 'string') {
    parsed.feedback = String(parsed.feedback || '');
  }
  if (typeof parsed.top_issue !== 'string') {
    parsed.top_issue = String(parsed.top_issue || '');
  }
  if (typeof parsed.improvement !== 'string') {
    parsed.improvement = String(parsed.improvement || '');
  }
  if (typeof parsed.unclear !== 'boolean') {
    parsed.unclear = parsed.unclear === 'true' || !!parsed.unclear;
  }
  if (typeof parsed.ocr_confidence !== 'number') {
    parsed.ocr_confidence = parseFloat(parsed.ocr_confidence) || 0.0;
  }
  if (typeof parsed.extracted_text !== 'string') {
    parsed.extracted_text = String(parsed.extracted_text || '');
  }
  if (typeof parsed.corrected_text !== 'string') {
    parsed.corrected_text = String(parsed.corrected_text || '');
  }

  // Enforce Token Economy limit programmatically (cut if exceeds 900 chars)
  if (parsed.feedback.length > 900) {
    parsed.feedback = parsed.feedback.substring(0, 897) + '...';
  }

  return parsed;
}

/**
 * Evaluates an image of handwritten text using OpenAI's Vision API.
 * Uses gpt-4o-mini for efficient OCR, transcription, and structural evaluation.
 * 
 * @param {string} base64Image - Base64 encoded image data (e.g. data:image/png;base64,...)
 * @param {string} moduleType - Module type: essay, worksheet, picture_description, handwriting
 * @param {string} additionalInput - Supplementary input (answer key, reference text, etc.)
 * @param {number} attempt - Internal counter for retry logic
 * @returns {Promise<Object>} The structured evaluation JSON
 */
export async function evaluateHandwriting(base64Image, moduleType, additionalInput = '', attempt = 1) {
  try {
    if (!openai) {
      throw new Error('AI grading is not configured yet. Add OPENAI_API_KEY to the server environment to enable automatic assessment.');
    }

    let moduleInstructions = '';
    if (moduleType === 'essay') {
      moduleInstructions = `
Evaluate the handwritten essay.
Primary Focus: grammar accuracy, spelling, sentence structure, coherence, and task completion.
Subscores object MUST contain exactly these keys with integer values (0 to 10):
- "grammar"
- "spelling"
- "content"
Score value: overall average or weighted score (0 to 10).
Feedback: 1-2 short bullet points (keep it extremely brief, strict, under 600 characters).
Top Issue: A single line describing the primary error.
Improvement: A short action point.
`;
    } else if (moduleType === 'worksheet') {
      moduleInstructions = `
Evaluate the handwritten worksheet answers against the provided Answer Key.
Answer Key: "${additionalInput}"
Primary Focus: Correctness only. Partial answers are allowed.
Subscores object MUST contain exactly these keys with integer values:
- "correct": count of correct questions
- "wrong": count of wrong questions
- "total_questions": total count of questions
Score value: same as subscores.correct.
Mistakes array: List incorrect answers (max 3 items), specifying the question, the student's wrong answer, and correct answer.
Feedback: MUST be empty string "". Do not explain.
Top Issue: MUST be empty string "".
Improvement: MUST be empty string "".
`;
    } else if (moduleType === 'picture_description') {
      moduleInstructions = `
Evaluate the handwritten description of a picture.
Description context/prompt: "${additionalInput}"
Primary Focus: Relevance to prompt, vocabulary, grammar, sentence clarity.
Subscores object MUST contain exactly these keys with integer values (0 to 10):
- "relevance"
- "language"
Score value: overall score (0 to 10).
Feedback: 1-2 short bullet points (keep it extremely brief, strict, under 600 characters).
Top Issue: The main grammar/relevance error.
Improvement: 1 short language suggestion.
`;
    } else if (moduleType === 'handwriting') {
      moduleInstructions = `
Evaluate the beautiful handwriting contest entry.
Reference Text to copy (if any): "${additionalInput}"
Primary Focus: Neatness, alignment, spacing, readability, accuracy of copied text.
Subscores object MUST contain exactly these keys with integer values (0 to 10):
- "neatness"
- "readability"
- "accuracy"
Score value: overall handwriting quality score (0 to 10).
Feedback: 1-2 short bullet points (keep it extremely brief, strict, under 600 characters).
Top Issue: The main neatness/alignment flaw.
Improvement: 1 short handwriting tip.
`;
    } else {
      throw new Error(`Unknown module type: ${moduleType}`);
    }

    const systemPrompt = `You are an AI assessment engine for an English learning platform.
Evaluate student work strictly. Do not use greetings or closing statements. Never use motivational language or over-praise.

${moduleInstructions}

CRITICAL RULES:
1. If the image is completely blurry, illegible, contains no handwriting, or cannot be parsed:
   You MUST return ONLY this JSON object:
   { "unclear": true }
   Do not include other keys. No exceptions.
2. Otherwise, transcribe the handwriting, assess it, and respond with ONLY a valid JSON object matching the schema below.
3. Feedback rules: Feedbacks must be extremely short. Max 6 bullet points OR max 600-900 characters total. Keep it sharp and minimal.
4. OCR confidence: Estimate how confident you are in the handwriting transcription as a decimal from 0.0 to 1.0 (e.g. 0.95) and save to "ocr_confidence".

Unified JSON Schema (Must return ONLY this JSON, do not wrap in markdown \`\`\`json blocks, do not explain):
{
  "module_type": "${moduleType}",
  "score": 0,
  "subscores": {},
  "mistakes": [
    {
      "question": "Q1 or N/A",
      "error": "incorrect text / answer",
      "correction": "corrected text / answer",
      "type": "grammar | spelling | structure | neatness"
    }
  ],
  "feedback": "bullet point 1\\nbullet point 2",
  "top_issue": "main problem description",
  "improvement": "actionable tip",
  "unclear": false,
  "extracted_text": "complete transcribed student handwriting text",
  "corrected_text": "complete corrected version of the student text",
  "ocr_confidence": 0.95
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Examine this handwriting sample.',
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    });

    const rawResponse = response.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('Empty response from OpenAI');
    }

    // Validation & Normalization Layer
    const validatedData = validateAndNormalize(rawResponse, moduleType);
    return validatedData;

  } catch (error) {
    console.error(`AI Service Error (Attempt ${attempt}/2):`, error.message);
    
    // Retry once
    if (attempt < 2) {
      console.log('Retrying AI evaluation with a fresh request...');
      return evaluateHandwriting(base64Image, moduleType, additionalInput, attempt + 1);
    }
    
    throw new Error(`AI Evaluation Pipeline failed: ${error.message}`);
  }
}

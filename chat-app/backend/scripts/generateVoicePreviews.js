import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import OpenAI from "openai";

const VOICE_PRESETS = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "verse",
  "shimmer",
];

const PROMPT_TEXT = "嗨～你好，很高興遇見你！";
const MODEL = "gpt-4o-mini-tts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(
  __dirname,
  "../../frontend/public/voices"
);

const ensureApiKey = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "請先在環境變數 OPENAI_API_KEY 中設定有效的 OpenAI API 金鑰。"
    );
  }
  return apiKey;
};

const ensureOutputDir = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

const writeFile = async (voiceId, data) => {
  const filePath = path.join(OUTPUT_DIR, `${voiceId}.mp3`);
  await fs.writeFile(filePath, data);
  return filePath;
};

const generateVoicePreview = async (client, voiceId) => {
  const response = await client.audio.speech.create({
    model: MODEL,
    voice: voiceId,
    input: PROMPT_TEXT,
    format: "mp3",
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return writeFile(voiceId, buffer);
};

const main = async () => {
  try {
    const apiKey = ensureApiKey();
    const client = new OpenAI({ apiKey });

    await ensureOutputDir();

    /* eslint-disable no-console */
    console.log(`開始使用 ${MODEL} 生成語音預覽...`);
    for (const voiceId of VOICE_PRESETS) {
      try {
        process.stdout.write(`  → 產生 ${voiceId} ... `);
        const filePath = await generateVoicePreview(client, voiceId);
        console.log(`完成，輸出檔案：${filePath}`);
      } catch (error) {
        console.error(
          `產生 ${voiceId} 失敗：${
            error?.message || JSON.stringify(error)
          }`
        );
      }
    }
    console.log("全部語音處理結束。");
    /* eslint-enable no-console */
  } catch (error) {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  }
};

main();

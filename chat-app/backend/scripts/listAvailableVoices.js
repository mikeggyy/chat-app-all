/**
 * 列出所有可用的 Google Cloud TTS 語音
 * 特別查找中文語音（cmn-TW, cmn-CN, yue-HK）
 */

import textToSpeech from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

const client = new textToSpeech.TextToSpeechClient();

const listVoices = async () => {
  try {
    console.log('正在查詢 Google Cloud TTS 可用語音...\n');

    const [result] = await client.listVoices({});
    const voices = result.voices;

    // 過濾中文語音
    const chineseVoices = voices.filter(voice =>
      voice.languageCodes.some(code =>
        code.startsWith('cmn-') || code.startsWith('yue-')
      )
    );

    console.log(`找到 ${chineseVoices.length} 個中文語音：\n`);

    // 按語言和類型分組
    const grouped = {};
    chineseVoices.forEach(voice => {
      voice.languageCodes.forEach(langCode => {
        if (!grouped[langCode]) {
          grouped[langCode] = {
            Journey: [],
            Studio: [],
            Neural2: [],
            Wavenet: [],
            Standard: []
          };
        }

        const voiceType = voice.name.includes('Journey') ? 'Journey' :
                         voice.name.includes('Studio') ? 'Studio' :
                         voice.name.includes('Neural2') ? 'Neural2' :
                         voice.name.includes('Wavenet') ? 'Wavenet' : 'Standard';

        grouped[langCode][voiceType].push({
          name: voice.name,
          gender: voice.ssmlGender,
          naturalSampleRateHertz: voice.naturalSampleRateHertz
        });
      });
    });

    // 顯示結果
    Object.keys(grouped).sort().forEach(langCode => {
      console.log(`\n========== ${langCode} ==========`);

      Object.keys(grouped[langCode]).forEach(type => {
        if (grouped[langCode][type].length > 0) {
          console.log(`\n  ${type} 語音 (${grouped[langCode][type].length} 個):`);
          grouped[langCode][type].forEach(v => {
            console.log(`    - ${v.name} (${v.gender}, ${v.naturalSampleRateHertz}Hz)`);
          });
        }
      });
    });

    console.log('\n\n統計總結：');
    Object.keys(grouped).forEach(langCode => {
      const total = Object.values(grouped[langCode]).reduce((sum, arr) => sum + arr.length, 0);
      console.log(`  ${langCode}: ${total} 個語音`);
      Object.keys(grouped[langCode]).forEach(type => {
        if (grouped[langCode][type].length > 0) {
          console.log(`    - ${type}: ${grouped[langCode][type].length}`);
        }
      });
    });

  } catch (error) {
    console.error('錯誤:', error.message);
    console.error(error);
  }
};

listVoices();

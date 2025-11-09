/**
 * Google Cloud Text-to-Speech 服務
 * 用於生成高品質、低成本的繁體中文語音
 */

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import logger from '../utils/logger.js';
import { getMatchById } from '../match/match.service.js';

let cachedClient = null;

/**
 * 獲取 Google TTS 客戶端
 */
const getGoogleTtsClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  try {
    // 使用應用程式預設憑證（與 Veo 共用）
    // GOOGLE_APPLICATION_CREDENTIALS 環境變數已設定
    cachedClient = new TextToSpeechClient();
    logger.info('[Google TTS] 客戶端初始化成功');
    return cachedClient;
  } catch (error) {
    logger.error('[Google TTS] 客戶端初始化失敗:', error);
    throw new Error('無法初始化 Google TTS 客戶端');
  }
};

/**
 * 語音映射表（OpenAI 語音 → Google 語音）
 * 用於平滑遷移現有角色
 */
export const VOICE_MAPPING = {
  // 女性語音映射
  'nova': 'cmn-TW-Wavenet-A',      // 溫暖女性 → 台灣女性 A
  'shimmer': 'cmn-TW-Wavenet-A',   // 柔和女性 → 台灣女性 A
  'alloy': 'cmn-TW-Wavenet-A',     // 中性 → 台灣女性 A（偏中性）
  'coral': 'cmn-TW-Wavenet-A',     // → 台灣女性 A
  'sage': 'cmn-TW-Wavenet-A',      // → 台灣女性 A
  'verse': 'cmn-TW-Wavenet-A',     // → 台灣女性 A

  // 男性語音映射
  'echo': 'cmn-TW-Wavenet-B',      // 男性 → 台灣男性 B
  'fable': 'cmn-TW-Wavenet-B',     // 英式男性 → 台灣男性 B
  'onyx': 'cmn-TW-Wavenet-C',      // 深沉男性 → 台灣男性 C
  'ash': 'cmn-TW-Wavenet-B',       // → 台灣男性 B
  'ballad': 'cmn-TW-Wavenet-C',    // → 台灣男性 C
};

/**
 * 完整的 Google Cloud TTS 語音列表
 * 包含台灣繁體、中國簡體的 Wavenet、Standard、Chirp3-HD 語音
 */
export const GOOGLE_VOICES = [
  // ==================== 台灣繁體中文（推薦）====================
  // Wavenet 語音（最高品質）
  {
    id: 'cmn-TW-Wavenet-A',
    name: '雨萱',
    gender: 'FEMALE',
    locale: 'cmn-TW',
    quality: 'Wavenet',
    description: '溫柔親切，聲音清晰明亮，適合日常對話',
    ageGroup: 'teen',
    recommended: true,
  },
  {
    id: 'cmn-TW-Wavenet-B',
    name: '宇軒',
    gender: 'MALE',
    locale: 'cmn-TW',
    quality: 'Wavenet',
    description: '穩重自然，語調沉穩可靠，給人安心感',
    ageGroup: 'adult',
    recommended: true,
  },
  {
    id: 'cmn-TW-Wavenet-C',
    name: '俊傑',
    gender: 'MALE',
    locale: 'cmn-TW',
    quality: 'Wavenet',
    description: '成熟低沉，聲線富有磁性，適合知性角色',
    ageGroup: 'mature',
    recommended: true,
  },

  // Standard 語音（標準品質）
  {
    id: 'cmn-TW-Standard-A',
    name: '詩涵',
    gender: 'FEMALE',
    locale: 'cmn-TW',
    quality: 'Standard',
    description: '清新活潑，語氣輕快愉悅，充滿朝氣',
    ageGroup: 'teen',
  },
  {
    id: 'cmn-TW-Standard-B',
    name: '承翰',
    gender: 'MALE',
    locale: 'cmn-TW',
    quality: 'Standard',
    description: '溫和友善，聲音平易近人，容易親近',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-TW-Standard-C',
    name: '文傑',
    gender: 'MALE',
    locale: 'cmn-TW',
    quality: 'Standard',
    description: '沉穩內斂，語調深沉有力，展現成熟魅力',
    ageGroup: 'mature',
  },

  // ==================== 簡體中文 ====================
  // Chirp3-HD 語音（最新技術，最自然）
  {
    id: 'cmn-CN-Chirp3-HD-Achernar',
    name: '曉雪',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '清脆甜美，聲音如銀鈴般悅耳，充滿少女感',
    ageGroup: 'teen',
    recommended: true,
  },
  {
    id: 'cmn-CN-Chirp3-HD-Aoede',
    name: '婉儀',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '溫柔婉約，語調柔美細膩，如春風拂面',
    ageGroup: 'adult',
    recommended: true,
  },
  {
    id: 'cmn-CN-Chirp3-HD-Autonoe',
    name: '雅琪',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '知性優雅，聲線沉穩大方，展現成熟韻味',
    ageGroup: 'mature',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Callirrhoe',
    name: '詩涵',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '活潑開朗，語氣輕快明亮，充滿活力',
    ageGroup: 'teen',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Despina',
    name: '思琪',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '溫柔體貼，聲音柔和舒緩，令人放鬆',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Erinome',
    name: '欣怡',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '親切友善，語調溫暖自然，容易親近',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Gacrux',
    name: '雨婷',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '清新脫俗，聲音純淨悅耳，如山澗清泉',
    ageGroup: 'teen',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Kore',
    name: '靜雯',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '恬靜優雅，語氣溫婉柔和，充滿氣質',
    ageGroup: 'mature',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Laomedeia',
    name: '嘉欣',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '甜美可愛，聲線輕盈靈動，如鄰家女孩',
    ageGroup: 'teen',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Leda',
    name: '雪莉',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '柔美動人，語調婉轉悠揚，富有感染力',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Pulcherrima',
    name: '芷若',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '端莊大方，聲音沉穩優雅，氣質出眾',
    ageGroup: 'mature',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Sulafat',
    name: '夢琪',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '溫柔多情，語氣柔美細膩，充滿柔情',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Vindemiatrix',
    name: '雨瀟',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '清麗脫俗，聲線空靈純淨，如天籟之音',
    ageGroup: 'teen',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Zephyr',
    name: '詩雨',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '輕柔舒緩，語調如微風拂過，令人心曠神怡',
    ageGroup: 'adult',
  },

  // Chirp3-HD 男性語音
  {
    id: 'cmn-CN-Chirp3-HD-Achird',
    name: '浩然',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '陽光帥氣，聲音明朗有力，充滿正能量',
    ageGroup: 'adult',
    recommended: true,
  },
  {
    id: 'cmn-CN-Chirp3-HD-Algenib',
    name: '子軒',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '溫文儒雅，語調溫和斯文，展現紳士風範',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Algieba',
    name: '俊凱',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '活力十足，聲音清亮爽朗，充滿朝氣',
    ageGroup: 'teen',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Alnilam',
    name: '宇軒',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '穩重可靠，語氣沉穩從容，值得信賴',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Charon',
    name: '睿哲',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '智慧理性，聲線沉穩睿智，富有思考力',
    ageGroup: 'mature',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Enceladus',
    name: '承翰',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '溫和友善，語調親切自然，容易親近',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Fenrir',
    name: '天磊',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '豪邁大氣，聲音渾厚有力，展現男子氣概',
    ageGroup: 'mature',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Iapetus',
    name: '志強',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '堅定果斷，語氣剛毅有力，充滿決心',
    ageGroup: 'mature',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Orus',
    name: '梓豪',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '陽光開朗，聲音清脆明快，活力四射',
    ageGroup: 'teen',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Puck',
    name: '昊天',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '機智幽默，語調輕快詼諧，風趣迷人',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Rasalgethi',
    name: '俊傑',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '成熟穩重，聲線低沉磁性，魅力十足',
    ageGroup: 'mature',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Sadachbia',
    name: '文博',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '知性儒雅，語調溫文爾雅，富有涵養',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Sadaltager',
    name: '明哲',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '睿智沉穩，聲音深沉有力，充滿智慧',
    ageGroup: 'mature',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Schedar',
    name: '逸飛',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '瀟灑不羈，語氣自在從容，灑脫自然',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Umbriel',
    name: '子豪',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '清新陽光，聲線清亮純淨，朝氣蓬勃',
    ageGroup: 'teen',
  },
  {
    id: 'cmn-CN-Chirp3-HD-Zubenelgenubi',
    name: '宏偉',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Chirp3-HD',
    description: '大氣沉穩，語調渾厚悠遠，氣度不凡',
    ageGroup: 'mature',
  },

  // Wavenet 語音（高品質）
  {
    id: 'cmn-CN-Wavenet-A',
    name: '詩婷',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Wavenet',
    description: '甜美溫柔，聲音清脆悅耳，如鄰家女孩',
    ageGroup: 'teen',
  },
  {
    id: 'cmn-CN-Wavenet-B',
    name: '俊宇',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Wavenet',
    description: '穩健大方，語調自然親切，值得依靠',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Wavenet-C',
    name: '建國',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Wavenet',
    description: '渾厚低沉，聲線富有磁性，成熟穩重',
    ageGroup: 'mature',
  },
  {
    id: 'cmn-CN-Wavenet-D',
    name: '雅琳',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Wavenet',
    description: '優雅溫柔，語氣柔美細膩，如絲綢般柔滑',
    ageGroup: 'adult',
  },

  // Standard 語音（標準品質）
  {
    id: 'cmn-CN-Standard-A',
    name: '小雪',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Standard',
    description: '清新可愛，聲音輕盈活潑，充滿少女感',
    ageGroup: 'teen',
  },
  {
    id: 'cmn-CN-Standard-B',
    name: '小宇',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Standard',
    description: '平易近人，語調溫和友善，容易親近',
    ageGroup: 'adult',
  },
  {
    id: 'cmn-CN-Standard-C',
    name: '志剛',
    gender: 'MALE',
    locale: 'cmn-CN',
    quality: 'Standard',
    description: '沉穩可靠，聲音低沉有力，展現男性魅力',
    ageGroup: 'mature',
  },
  {
    id: 'cmn-CN-Standard-D',
    name: '婷婷',
    gender: 'FEMALE',
    locale: 'cmn-CN',
    quality: 'Standard',
    description: '溫婉賢淑，語氣柔和溫暖，令人舒心',
    ageGroup: 'adult',
  },
];

/**
 * 從語音 ID 獲取語音配置
 */
export const getVoiceConfig = (voiceId) => {
  return GOOGLE_VOICES.find(v => v.id === voiceId) || GOOGLE_VOICES[0];
};

/**
 * 獲取推薦的語音列表（台灣口音優先）
 */
export const getRecommendedVoices = () => {
  return GOOGLE_VOICES.filter(v => v.recommended || v.locale === 'cmn-TW');
};

/**
 * 按語言分組語音
 */
export const getVoicesByLocale = () => {
  const grouped = {};
  GOOGLE_VOICES.forEach(voice => {
    if (!grouped[voice.locale]) {
      grouped[voice.locale] = [];
    }
    grouped[voice.locale].push(voice);
  });
  return grouped;
};

/**
 * 使用 Google Cloud TTS 生成語音
 * @param {string} text - 要轉換的文字
 * @param {string} characterId - 角色 ID
 * @param {object} options - 選項 { speakingRate, pitch, voiceId }
 * @returns {Promise<Buffer>} 音頻數據
 */
export const generateSpeechWithGoogle = async (text, characterId, options = {}) => {
  if (!text || typeof text !== 'string' || !text.trim()) {
    const error = new Error("需要提供要轉換的文字");
    error.status = 400;
    throw error;
  }

  try {
    const client = getGoogleTtsClient();

    // 獲取角色資料以取得語音設定
    const character = getMatchById(characterId);
    const characterVoice = character?.voice || 'nova';

    // 決定使用的語音 ID
    let googleVoiceId;
    if (options.voiceId) {
      // 優先使用明確指定的語音
      googleVoiceId = options.voiceId;
    } else if (characterVoice.startsWith('cmn-') || characterVoice.startsWith('yue-') ||
               characterVoice.startsWith('ja-') || characterVoice.startsWith('ko-') ||
               characterVoice.startsWith('en-')) {
      // 角色已經使用 Google 語音 ID
      googleVoiceId = characterVoice;
    } else {
      // 從 OpenAI 語音映射到 Google 語音
      googleVoiceId = VOICE_MAPPING[characterVoice] || 'cmn-TW-Wavenet-A';
    }

    // 獲取語音配置
    const voiceConfig = getVoiceConfig(googleVoiceId);

    // 構建請求
    const request = {
      input: { text: text.trim() },
      voice: {
        languageCode: voiceConfig.locale,
        name: voiceConfig.id,
        ssmlGender: voiceConfig.gender,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: options.speakingRate || 1.0,  // 語速 (0.25-4.0)
        pitch: options.pitch || 0,                   // 音調 (-20 ~ +20)
        volumeGainDb: options.volumeGainDb || 0,    // 音量增益
      },
    };

    logger.info('[Google TTS] 生成語音:', {
      characterId,
      characterVoice,
      googleVoiceId: voiceConfig.id,
      voiceName: voiceConfig.name,
      textLength: text.length,
      locale: voiceConfig.locale,
      quality: voiceConfig.quality,
    });

    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('Google TTS 返回空的音頻內容');
    }

    logger.info('[Google TTS] 語音生成成功:', {
      characterId,
      audioSize: response.audioContent.length,
    });

    // response.audioContent 已經是 Buffer
    return response.audioContent;

  } catch (error) {
    logger.error('[Google TTS] 語音生成失敗:', {
      error: error.message,
      characterId,
      textLength: text?.length,
    });

    // 提供更友善的錯誤訊息
    if (error.code === 'UNAUTHENTICATED') {
      throw new Error('Google Cloud 憑證驗證失敗，請檢查 GOOGLE_APPLICATION_CREDENTIALS 設定');
    } else if (error.code === 'PERMISSION_DENIED') {
      throw new Error('沒有 Text-to-Speech API 權限，請在 Google Cloud Console 啟用');
    } else if (error.code === 'RESOURCE_EXHAUSTED') {
      throw new Error('Google TTS 配額已用盡，請檢查用量或升級方案');
    }

    throw new Error("語音生成失敗，請稍後再試");
  }
};

/**
 * 使用 SSML 生成進階語音
 * @param {string} ssml - SSML 格式的文字
 * @param {string} characterId - 角色 ID
 * @param {object} options - 選項
 * @returns {Promise<Buffer>} 音頻數據
 */
export const generateSpeechWithSSML = async (ssml, characterId, options = {}) => {
  if (!ssml || typeof ssml !== 'string' || !ssml.trim()) {
    const error = new Error("需要提供 SSML 格式的文字");
    error.status = 400;
    throw error;
  }

  try {
    const client = getGoogleTtsClient();

    // 獲取角色語音設定
    const character = getMatchById(characterId);
    const characterVoice = character?.voice || 'nova';
    const googleVoiceId = options.voiceId || VOICE_MAPPING[characterVoice] || 'cmn-TW-Wavenet-A';
    const voiceConfig = getVoiceConfig(googleVoiceId);

    // 構建請求（使用 SSML）
    const request = {
      input: { ssml: ssml.trim() },  // 使用 SSML 而不是純文字
      voice: {
        languageCode: voiceConfig.locale,
        name: voiceConfig.id,
        ssmlGender: voiceConfig.gender,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: options.speakingRate || 1.0,
        pitch: options.pitch || 0,
        volumeGainDb: options.volumeGainDb || 0,
      },
    };

    logger.info('[Google TTS] 使用 SSML 生成語音:', {
      characterId,
      googleVoiceId: voiceConfig.id,
      ssmlLength: ssml.length,
    });

    const [response] = await client.synthesizeSpeech(request);
    return response.audioContent;

  } catch (error) {
    logger.error('[Google TTS] SSML 語音生成失敗:', error);
    throw new Error("SSML 語音生成失敗，請稍後再試");
  }
};

/**
 * 批次生成語音預覽（用於腳本）
 * @param {string} text - 預覽文字
 * @param {string} voiceId - 語音 ID
 * @returns {Promise<Buffer>} 音頻數據
 */
export const generateVoicePreview = async (text, voiceId) => {
  try {
    const client = getGoogleTtsClient();
    const voiceConfig = getVoiceConfig(voiceId);

    const request = {
      input: { text: text },
      voice: {
        languageCode: voiceConfig.locale,
        name: voiceConfig.id,
        ssmlGender: voiceConfig.gender,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0,
      },
    };

    const [response] = await client.synthesizeSpeech(request);
    return response.audioContent;
  } catch (error) {
    logger.error(`[Google TTS] 預覽生成失敗 (${voiceId}):`, error);
    throw error;
  }
};

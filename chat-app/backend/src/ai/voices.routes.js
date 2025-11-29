/**
 * 語音列表 API 路由
 * 提供可用語音列表給前端
 */

import { Router } from 'express';
import {
  sendSuccess,
  sendError,
  ApiError,
} from '../../../../shared/utils/errorFormatter.js';
import {
  GOOGLE_VOICES,
  getRecommendedVoices,
  getVoicesByLocale,
  VOICE_MAPPING,
} from './googleTts.service.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * 獲取所有可用語音列表
 * GET /api/voices
 */
router.get('/', (req, res, next) => {
  try {
    const useGoogleTts = process.env.USE_GOOGLE_TTS === 'true';

    if (useGoogleTts) {
      // 返回 Google Cloud TTS 語音列表
      const voices = GOOGLE_VOICES.map(v => ({
        id: v.id,
        name: v.name,
        gender: v.gender,
        locale: v.locale,
        quality: v.quality,
        description: v.description,
        ageGroup: v.ageGroup || 'adult',
        recommended: v.recommended || false,
        previewUrl: `/voices/google/${v.id}.mp3`,
      }));

      sendSuccess(res, {
        service: 'google',
        count: voices.length,
        voices,
      });
    } else {
      // 返回 OpenAI TTS 語音列表
      const openaiVoices = [
        { id: 'alloy', name: 'Alloy', gender: 'NEUTRAL', description: '中性、平衡' },
        { id: 'ash', name: 'Ash', gender: 'NEUTRAL', description: '中性' },
        { id: 'ballad', name: 'Ballad', gender: 'NEUTRAL', description: '敘事風格' },
        { id: 'coral', name: 'Coral', gender: 'FEMALE', description: '女性' },
        { id: 'echo', name: 'Echo', gender: 'MALE', description: '男性' },
        { id: 'fable', name: 'Fable', gender: 'MALE', description: '英式口音' },
        { id: 'onyx', name: 'Onyx', gender: 'MALE', description: '深沉男性' },
        { id: 'nova', name: 'Nova', gender: 'FEMALE', description: '溫暖女性（推薦）', recommended: true },
        { id: 'sage', name: 'Sage', gender: 'NEUTRAL', description: '中性' },
        { id: 'verse', name: 'Verse', gender: 'NEUTRAL', description: '詩意風格' },
        { id: 'shimmer', name: 'Shimmer', gender: 'FEMALE', description: '柔和女性', recommended: true },
      ].map(v => ({
        ...v,
        locale: 'multi',
        quality: 'Standard',
        previewUrl: `/voices/${v.id}.mp3`,
      }));

      sendSuccess(res, {
        service: 'openai',
        count: openaiVoices.length,
        voices: openaiVoices,
      });
    }
  } catch (error) {
    logger.error('獲取語音列表失敗:', error);
    next(error);
  }
});

/**
 * 獲取推薦的語音列表（台灣語音優先）
 * GET /api/voices/recommended
 */
router.get('/recommended', (req, res, next) => {
  try {
    const useGoogleTts = process.env.USE_GOOGLE_TTS === 'true';

    if (useGoogleTts) {
      const recommended = getRecommendedVoices().map(v => ({
        id: v.id,
        name: v.name,
        gender: v.gender,
        locale: v.locale,
        quality: v.quality,
        description: v.description,
        ageGroup: v.ageGroup || 'adult',
        previewUrl: `/voices/google/${v.id}.mp3`,
      }));

      sendSuccess(res, {
        service: 'google',
        count: recommended.length,
        voices: recommended,
      });
    } else {
      // OpenAI TTS 推薦語音
      sendSuccess(res, {
        service: 'openai',
        count: 2,
        voices: [
          {
            id: 'nova',
            name: 'Nova',
            gender: 'FEMALE',
            description: '溫暖女性（推薦）',
            locale: 'multi',
            quality: 'Standard',
            previewUrl: '/voices/nova.mp3',
          },
          {
            id: 'shimmer',
            name: 'Shimmer',
            gender: 'FEMALE',
            description: '柔和女性',
            locale: 'multi',
            quality: 'Standard',
            previewUrl: '/voices/shimmer.mp3',
          },
        ],
      });
    }
  } catch (error) {
    logger.error('獲取推薦語音失敗:', error);
    next(error);
  }
});

/**
 * 按語言分組獲取語音
 * GET /api/voices/by-locale
 */
router.get('/by-locale', (req, res, next) => {
  try {
    const useGoogleTts = process.env.USE_GOOGLE_TTS === 'true';

    if (useGoogleTts) {
      const grouped = getVoicesByLocale();
      const result = {};

      Object.entries(grouped).forEach(([locale, voices]) => {
        result[locale] = voices.map(v => ({
          id: v.id,
          name: v.name,
          gender: v.gender,
          quality: v.quality,
          description: v.description,
          ageGroup: v.ageGroup || 'adult',
          recommended: v.recommended || false,
          previewUrl: `/voices/google/${v.id}.mp3`,
        }));
      });

      sendSuccess(res, {
        service: 'google',
        locales: Object.keys(result),
        voices: result,
      });
    } else {
      // OpenAI 所有語音都是 multi-language
      sendSuccess(res, {
        service: 'openai',
        locales: ['multi'],
        voices: {
          multi: [
            { id: 'nova', name: 'Nova', gender: 'FEMALE', description: '溫暖女性', previewUrl: '/voices/nova.mp3' },
            { id: 'shimmer', name: 'Shimmer', gender: 'FEMALE', description: '柔和女性', previewUrl: '/voices/shimmer.mp3' },
            // ... 其他語音
          ],
        },
      });
    }
  } catch (error) {
    logger.error('獲取分組語音失敗:', error);
    next(error);
  }
});

/**
 * 獲取語音映射表（OpenAI → Google）
 * GET /api/voices/mapping
 */
router.get('/mapping', (req, res, next) => {
  try {
    sendSuccess(res, {
      mapping: VOICE_MAPPING,
      description: 'OpenAI 語音 ID 到 Google Cloud TTS 語音 ID 的映射',
    });
  } catch (error) {
    logger.error('獲取語音映射失敗:', error);
    next(error);
  }
});

/**
 * 獲取當前使用的 TTS 服務
 * GET /api/voices/service
 */
router.get('/service', (req, res, next) => {
  try {
    const useGoogleTts = process.env.USE_GOOGLE_TTS === 'true';

    sendSuccess(res, {
      service: useGoogleTts ? 'google' : 'openai',
      name: useGoogleTts ? 'Google Cloud TTS' : 'OpenAI TTS',
      features: useGoogleTts
        ? {
            costPerMillion: '$4',
            freeQuota: '100 萬字元/月',
            voiceCount: GOOGLE_VOICES.length,
            taiwanVoices: true,
            ssmlSupport: true,
            speedControl: true,
            pitchControl: true,
          }
        : {
            costPerMillion: '$15',
            freeQuota: '無',
            voiceCount: 11,
            taiwanVoices: false,
            ssmlSupport: false,
            speedControl: false,
            pitchControl: false,
          },
    });
  } catch (error) {
    logger.error('獲取 TTS 服務資訊失敗:', error);
    next(error);
  }
});

export default router;

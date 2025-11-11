/**
 * Selfie 生成 Composable
 *
 * 管理 AI 角色自拍照片的生成邏輯，包括：
 * - 自拍請求核心邏輯
 * - 權限檢查和限制處理
 * - 消息發送和錯誤處理
 * - 使用照片卡生成
 */

import { nextTick } from 'vue';
import { apiJson } from '../../utils/api';
import { getRandomSelfieMessage } from '../../config/selfieMessages';
import { writeCachedHistory } from '../../utils/conversationCache';

/**
 * 創建 Selfie 生成 composable
 * @param {Object} deps - 依賴項
 * @param {Function} deps.getCurrentUserId - 獲取當前用戶 ID
 * @param {Function} deps.getPartnerId - 獲取角色 ID
 * @param {Function} deps.getFirebaseAuth - 獲取 Firebase Auth 實例
 * @param {Object} deps.messages - 消息列表 ref
 * @param {Object} deps.messageListRef - 消息列表組件 ref
 * @param {Function} deps.rollbackUserMessage - 撤回用戶消息的方法
 * @param {Function} deps.requireLogin - 遊客登錄檢查
 * @param {Function} deps.canGeneratePhoto - 檢查照片生成權限
 * @param {Function} deps.fetchPhotoStats - 刷新照片統計
 * @param {Function} deps.showPhotoLimit - 顯示照片限制彈窗
 * @param {Function} deps.createLimitModalData - 創建限制彈窗數據
 * @param {Function} deps.requestSelfie - 請求自拍的 composable 方法
 * @param {Function} deps.closePhotoLimit - 關閉照片限制彈窗
 * @param {Function} deps.loadTicketsBalance - 重新加載解鎖卡餘額
 * @param {Function} deps.showError - 顯示錯誤提示
 * @param {Function} deps.showSuccess - 顯示成功提示
 * @param {Object} deps.config - 配置
 * @param {Object} deps.config.MESSAGE_ID_PREFIXES - 消息 ID 前綴
 * @returns {Object} Selfie 生成相關的狀態和方法
 */
export function useSelfieGeneration(deps) {
  const {
    getCurrentUserId,
    getPartnerId,
    getFirebaseAuth,
    messages,
    messageListRef,
    rollbackUserMessage,
    requireLogin,
    canGeneratePhoto,
    fetchPhotoStats,
    showPhotoLimit,
    createLimitModalData,
    requestSelfie,
    closePhotoLimit,
    loadTicketsBalance,
    showError,
    showSuccess,
    config,
  } = deps;

  const { MESSAGE_ID_PREFIXES } = config;

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 處理自拍請求（入口函數）
   * @returns {Promise<void>}
   */
  const handleRequestSelfie = async () => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    // 檢查遊客權限
    if (requireLogin({ feature: '請求自拍照片' })) {
      return;
    }

    // 先檢查拍照限制，避免發送訊息後才發現限制不足
    const limitCheck = await canGeneratePhoto();

    // ✅ 修復：當免費額度用完時，顯示彈窗讓用戶決定是否使用解鎖卡
    // 彈窗會根據 cards 數量顯示不同按鈕：
    // - cards > 0: 顯示「使用解鎖卡」按鈕
    // - cards = 0: 顯示「次數已達上限」及升級選項
    if (!limitCheck.allowed) {
      showPhotoLimit(createLimitModalData(limitCheck, 'photo'));
      return;
    }

    // 用於追蹤用戶消息 ID，以便失敗時撤回
    let userMessageId = null;

    try {
      // 1. 先發送一條隨機的拍照請求訊息
      const randomMessage = getRandomSelfieMessage();

      // 創建用戶消息
      const userMessage = {
        id: `${MESSAGE_ID_PREFIXES.SELFIE_REQUEST}${Date.now()}`,
        role: 'user',
        text: randomMessage,
        createdAt: new Date().toISOString(),
      };

      // 保存消息 ID 以便失敗時撤回
      userMessageId = userMessage.id;

      // 添加到消息列表
      messages.value.push(userMessage);

      // 滾動到底部
      await nextTick();
      messageListRef.value?.scrollToBottom();

      // 獲取認證權杖
      const firebaseAuth = getFirebaseAuth();
      const token = await firebaseAuth.getCurrentUserIdToken();

      // 發送到後端（只保存訊息，不請求 AI 回覆）
      await apiJson(`/api/conversations/${userId}/${matchId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          id: userMessage.id, // ✅ 傳遞消息 ID，確保前後端一致
          text: randomMessage,
          role: 'user',
        },
        skipGlobalLoading: true,
      });

      // 更新緩存
      writeCachedHistory(userId, matchId, messages.value);

      // 2. 然後調用拍照功能
      const photoResult = await requestSelfie(
        { canGeneratePhoto, fetchPhotoStats },
        (limitInfo) => {
          // On limit exceeded
          showPhotoLimit(limitInfo);
        },
        { usePhotoCard: false } // ✅ 此處僅在有免費額度時才被調用
      );

      // 如果拍照失敗（返回 null），撤回用戶訊息
      if (!photoResult && userMessageId) {
        await rollbackUserMessage(userId, matchId, userMessageId);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '請求自拍失敗');

      // 撤回用戶剛發送的訊息
      if (userMessageId) {
        await rollbackUserMessage(userId, matchId, userMessageId);
      }
    }
  };

  /**
   * 使用照片卡生成照片
   * @returns {Promise<void>}
   */
  const handleUsePhotoUnlockCard = async () => {
    const userId = getCurrentUserId();

    try {
      // 關閉模態框
      closePhotoLimit();

      // 使用照片卡生成照片
      const result = await requestSelfie(
        { canGeneratePhoto, fetchPhotoStats },
        (limitInfo) => {
          // 如果仍然失敗（例如沒有解鎖卡），顯示錯誤
          showError('使用拍照解鎖卡失敗，請重試');
        },
        { usePhotoCard: true } // 告訴 requestSelfie 使用照片卡
      );

      // 成功後重新加載解鎖卡數據
      if (result && userId) {
        await Promise.all([fetchPhotoStats(), loadTicketsBalance(userId)]);

        showSuccess('拍照解鎖卡使用成功！');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '使用照片卡失敗');
    }
  };

  // ==========================================
  // 返回 API
  // ==========================================
  return {
    // 方法
    handleRequestSelfie,
    handleUsePhotoUnlockCard,
  };
}

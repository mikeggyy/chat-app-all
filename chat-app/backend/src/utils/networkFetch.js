/**
 * 網絡請求工具
 * 解決 IPv6 連接不穩定問題
 */

import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import logger from './logger.js';

/**
 * 創建強制使用 IPv4 的 HTTP Agent
 */
const createIPv4Agent = (isHttps = true) => {
  const AgentClass = isHttps ? HttpsAgent : HttpAgent;
  return new AgentClass({
    family: 4, // 強制使用 IPv4
    timeout: 10000, // 10 秒超時
  });
};

/**
 * 使用 IPv4 的 fetch
 * 解決某些網絡環境下 IPv6 連接不穩定的問題
 *
 * @param {string} url - 請求 URL
 * @param {object} options - fetch 選項
 * @returns {Promise<Response>}
 */
export const fetchWithIPv4 = async (url, options = {}) => {
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';

  // 創建 IPv4 agent
  const agent = createIPv4Agent(isHttps);

  // 合併選項
  const fetchOptions = {
    ...options,
    agent,
  };

  try {
    logger.debug(`[網絡請求] 使用 IPv4 請求: ${url}`);
    const response = await fetch(url, fetchOptions);
    return response;
  } catch (error) {
    logger.error(`[網絡請求] IPv4 請求失敗: ${url}`, error);
    throw error;
  }
};

/**
 * 智能 fetch：先嘗試正常請求，失敗後自動重試 IPv4
 *
 * @param {string} url - 請求 URL
 * @param {object} options - fetch 選項
 * @returns {Promise<Response>}
 */
export const smartFetch = async (url, options = {}) => {
  try {
    // 第一次嘗試：使用默認方式（可能是 IPv6）
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    // 如果錯誤訊息包含 "reset" 或 "ECONNRESET"，可能是 IPv6 問題
    const errorMsg = error.message?.toLowerCase() || '';
    if (errorMsg.includes('reset') || errorMsg.includes('econnreset')) {
      logger.warn(`[網絡請求] 檢測到連接重置，嘗試使用 IPv4: ${url}`);

      // 第二次嘗試：強制使用 IPv4
      return await fetchWithIPv4(url, options);
    }

    // 其他錯誤直接拋出
    throw error;
  }
};

/**
 * 測試 URL 是否可訪問（同時測試 IPv4 和 IPv6）
 *
 * @param {string} url - 測試 URL
 * @returns {Promise<object>} - 測試結果
 */
export const testUrlConnectivity = async (url) => {
  const results = {
    url,
    ipv6: { success: false, error: null, time: 0 },
    ipv4: { success: false, error: null, time: 0 },
    recommendation: null,
  };

  // 測試 IPv6（默認）
  try {
    const startIpv6 = Date.now();
    await fetch(url, { method: 'HEAD' });
    results.ipv6.success = true;
    results.ipv6.time = Date.now() - startIpv6;
  } catch (error) {
    results.ipv6.error = error.message;
  }

  // 測試 IPv4
  try {
    const startIpv4 = Date.now();
    await fetchWithIPv4(url, { method: 'HEAD' });
    results.ipv4.success = true;
    results.ipv4.time = Date.now() - startIpv4;
  } catch (error) {
    results.ipv4.error = error.message;
  }

  // 給出建議
  if (results.ipv4.success && !results.ipv6.success) {
    results.recommendation = 'USE_IPV4_ONLY';
  } else if (results.ipv6.success && !results.ipv4.success) {
    results.recommendation = 'USE_IPV6_ONLY';
  } else if (results.ipv4.success && results.ipv6.success) {
    // 選擇更快的
    results.recommendation = results.ipv4.time < results.ipv6.time ? 'PREFER_IPV4' : 'PREFER_IPV6';
  } else {
    results.recommendation = 'BOTH_FAILED';
  }

  return results;
};

export default {
  fetchWithIPv4,
  smartFetch,
  testUrlConnectivity,
};

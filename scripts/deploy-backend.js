#!/usr/bin/env node

/**
 * Cloud Run 後端部署腳本
 * 用法: npm run deploy
 *
 * 功能:
 * 1. 同步 shared 目錄到 backend
 * 2. 構建 Docker 映像
 * 3. 部署到 Cloud Run（保留所有環境變數）
 * 4. 自動切換流量到新版本
 */

import { execSync, spawn } from 'child_process';
import { existsSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// 配置
const CONFIG = {
  projectId: 'chat-app-3-8a7ee',
  serviceName: 'chat-backend',
  region: 'asia-east1',
  imageName: 'gcr.io/chat-app-3-8a7ee/chat-backend',
};

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  step: (num, msg) => console.log(`\n${colors.cyan}[${num}]${colors.reset} ${msg}`),
};

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

async function main() {
  console.log(`\n${colors.green}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}   Chat App Backend - Cloud Run 部署${colors.reset}`);
  console.log(`${colors.green}═══════════════════════════════════════════════${colors.reset}\n`);

  const backendDir = join(ROOT_DIR, 'chat-app', 'backend');
  const sharedSrc = join(ROOT_DIR, 'shared');
  const sharedDest = join(backendDir, 'shared');

  // Step 1: 檢查 GCP 登入狀態
  log.step(1, '檢查 GCP 登入狀態...');
  try {
    const account = exec('gcloud auth list --filter=status:ACTIVE --format="value(account)"', { silent: true });
    if (!account?.trim()) {
      log.error('未登入 GCP，請執行: gcloud auth login');
      process.exit(1);
    }
    log.success(`已登入: ${account.trim()}`);
  } catch {
    log.error('無法檢查 GCP 登入狀態，請確認已安裝 gcloud CLI');
    process.exit(1);
  }

  // Step 2: 同步 shared 目錄
  log.step(2, '同步 shared 目錄...');
  if (existsSync(sharedSrc)) {
    // 清空目標目錄（保留 node_modules）
    if (existsSync(sharedDest)) {
      const items = ['backend-utils', 'config', 'utils', 'package.json', 'package-lock.json'];
      items.forEach(item => {
        const itemPath = join(sharedDest, item);
        if (existsSync(itemPath)) {
          rmSync(itemPath, { recursive: true, force: true });
        }
      });
    }
    // 複製新內容
    cpSync(sharedSrc, sharedDest, { recursive: true });
    log.success('shared 目錄已同步');
  } else {
    log.warn('shared 目錄不存在，跳過同步');
  }

  // Step 3: 獲取當前環境變數
  log.step(3, '獲取現有環境變數...');
  let envVars = '';
  let secrets = '';

  try {
    const result = exec(
      `gcloud run services describe ${CONFIG.serviceName} --region ${CONFIG.region} --project ${CONFIG.projectId} --format=json`,
      { silent: true }
    );

    if (result) {
      const service = JSON.parse(result);
      const containers = service.spec?.template?.spec?.containers || [];
      const envList = containers[0]?.env || [];

      const plainEnvs = [];
      const secretRefs = [];

      envList.forEach(env => {
        if (env.value !== undefined) {
          // 處理特殊字符
          const value = env.value.replace(/"/g, '\\"');
          plainEnvs.push(`${env.name}=${value}`);
        } else if (env.valueFrom?.secretKeyRef) {
          const secretName = env.valueFrom.secretKeyRef.name;
          const secretKey = env.valueFrom.secretKeyRef.key || 'latest';
          secretRefs.push(`${env.name}=${secretName}:${secretKey}`);
        }
      });

      if (plainEnvs.length > 0) {
        envVars = plainEnvs.join(',');
      }
      if (secretRefs.length > 0) {
        secrets = secretRefs.join(',');
      }

      log.success(`找到 ${plainEnvs.length} 個環境變數，${secretRefs.length} 個 Secret`);
    }
  } catch (error) {
    log.warn('無法獲取現有環境變數，將使用預設值');
  }

  // Step 4: 構建 Docker 映像
  log.step(4, '構建 Docker 映像...');
  process.chdir(backendDir);

  try {
    exec(`gcloud builds submit --tag ${CONFIG.imageName} --project ${CONFIG.projectId}`);
    log.success('映像構建完成');
  } catch (error) {
    log.error('映像構建失敗');
    process.exit(1);
  }

  // Step 5: 獲取映像 digest
  log.step(5, '獲取映像 digest...');
  let imageDigest;
  try {
    imageDigest = exec(
      `gcloud container images describe ${CONFIG.imageName}:latest --format="get(image_summary.digest)"`,
      { silent: true }
    ).trim();
    log.success(`映像: ${CONFIG.imageName}@${imageDigest}`);
  } catch {
    log.error('無法獲取映像 digest');
    process.exit(1);
  }

  // Step 6: 部署到 Cloud Run
  log.step(6, '部署到 Cloud Run...');
  const fullImage = `${CONFIG.imageName}@${imageDigest}`;
  const timestamp = Date.now().toString(36);

  let deployCmd = `gcloud run deploy ${CONFIG.serviceName} --image "${fullImage}" --region ${CONFIG.region} --project ${CONFIG.projectId} --platform managed --revision-suffix="deploy-${timestamp}"`;

  if (envVars) {
    deployCmd += ` --set-env-vars="${envVars}"`;
  }
  if (secrets) {
    deployCmd += ` --set-secrets="${secrets}"`;
  }

  try {
    exec(deployCmd);
    log.success('部署完成');
  } catch (error) {
    log.error('部署失敗，查看日誌了解詳情');
    process.exit(1);
  }

  // Step 7: 獲取服務狀態
  log.step(7, '驗證部署...');
  try {
    const serviceUrl = exec(
      `gcloud run services describe ${CONFIG.serviceName} --region ${CONFIG.region} --project ${CONFIG.projectId} --format="value(status.url)"`,
      { silent: true }
    ).trim();

    const revision = exec(
      `gcloud run services describe ${CONFIG.serviceName} --region ${CONFIG.region} --project ${CONFIG.projectId} --format="value(status.traffic[0].revisionName)"`,
      { silent: true }
    ).trim();

    console.log(`\n${colors.green}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}   部署成功！${colors.reset}`);
    console.log(`${colors.green}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`\n📦 Revision: ${revision}`);
    console.log(`🌐 URL: ${serviceUrl}`);
    console.log(`\n測試健康檢查:`);
    console.log(`  curl ${serviceUrl}/health\n`);
  } catch {
    log.warn('無法獲取服務狀態，請手動驗證');
  }

  process.chdir(ROOT_DIR);
}

main().catch(error => {
  log.error(`部署失敗: ${error.message}`);
  process.exit(1);
});

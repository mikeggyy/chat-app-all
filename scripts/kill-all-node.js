#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const isWindows = process.platform === 'win32';

/**
 * 在 Windows 上列出所有 Node.js 進程
 */
async function listNodeProcessesWindows() {
  try {
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH');

    if (!stdout.trim() || stdout.includes('INFO: No tasks')) {
      return [];
    }

    const lines = stdout.trim().split('\n');
    const processes = lines.map(line => {
      const match = line.match(/"([^"]+)","(\d+)"/);
      if (match) {
        return {
          name: match[1],
          pid: match[2]
        };
      }
      return null;
    }).filter(Boolean);

    return processes;
  } catch (error) {
    return [];
  }
}

/**
 * 在 Unix-like 系統上列出所有 Node.js 進程
 */
async function listNodeProcessesUnix() {
  try {
    const { stdout } = await execAsync('ps aux | grep node | grep -v grep');

    if (!stdout.trim()) {
      return [];
    }

    const lines = stdout.trim().split('\n');
    const processes = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        return {
          pid: parts[1],
          command: parts.slice(10).join(' ')
        };
      }
      return null;
    }).filter(Boolean);

    return processes;
  } catch (error) {
    return [];
  }
}

/**
 * 在 Windows 上終止所有 Node.js 進程
 */
async function killAllNodeWindows() {
  try {
    await execAsync('taskkill /F /IM node.exe');
    return true;
  } catch (error) {
    // 沒有找到進程或其他錯誤
    return false;
  }
}

/**
 * 在 Unix-like 系統上終止所有 Node.js 進程
 */
async function killAllNodeUnix() {
  try {
    await execAsync('pkill -9 node');
    return true;
  } catch (error) {
    // 沒有找到進程或其他錯誤
    return false;
  }
}

/**
 * 主函數
 */
async function main() {
  console.log('🔍 檢查運行中的 Node.js 進程...\n');

  // 列出所有 Node.js 進程
  const processes = isWindows
    ? await listNodeProcessesWindows()
    : await listNodeProcessesUnix();

  if (processes.length === 0) {
    console.log('✅ 沒有發現運行中的 Node.js 進程\n');
    return;
  }

  console.log(`📋 發現 ${processes.length} 個 Node.js 進程：\n`);

  if (isWindows) {
    processes.forEach((proc, index) => {
      console.log(`   ${index + 1}. PID: ${proc.pid} - ${proc.name}`);
    });
  } else {
    processes.forEach((proc, index) => {
      console.log(`   ${index + 1}. PID: ${proc.pid}`);
      console.log(`      指令: ${proc.command.substring(0, 80)}${proc.command.length > 80 ? '...' : ''}`);
    });
  }

  console.log('\n⚠️  即將終止所有 Node.js 進程...\n');

  // 終止所有 Node.js 進程
  const success = isWindows
    ? await killAllNodeWindows()
    : await killAllNodeUnix();

  if (success) {
    console.log('✅ 已成功終止所有 Node.js 進程\n');
  } else {
    console.log('ℹ️  沒有需要終止的 Node.js 進程\n');
  }

  // 再次檢查
  const remainingProcesses = isWindows
    ? await listNodeProcessesWindows()
    : await listNodeProcessesUnix();

  if (remainingProcesses.length > 0) {
    console.log(`⚠️  仍有 ${remainingProcesses.length} 個 Node.js 進程在運行`);
    console.log('   可能需要管理員權限才能終止這些進程\n');
  } else {
    console.log('✨ 所有 Node.js 進程已完全清理！\n');
  }
}

main().catch((error) => {
  console.error('❌ 執行時發生錯誤:', error.message);
  process.exit(1);
});

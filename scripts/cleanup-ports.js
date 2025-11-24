#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 需要清理的端口
const PORTS = [
  { port: 8180, name: 'Firestore Emulator' },
  { port: 9099, name: 'Auth Emulator' },
  { port: 9299, name: 'Storage Emulator' },
  { port: 4400, name: 'Emulator Hub' },
  { port: 4500, name: 'Emulator Logging' },
  { port: 4000, name: 'Main App Backend API' },
  { port: 5173, name: 'Main App Frontend' },
  { port: 4001, name: 'Admin Backend API' },
  { port: 5174, name: 'Admin Frontend' }
];

const isWindows = process.platform === 'win32';

/**
 * 在 Windows 上查找並結束佔用端口的進程
 */
async function killPortWindows(port) {
  try {
    // 查找佔用端口的進程
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);

    if (!stdout.trim()) {
      return null; // 端口未被佔用
    }

    // 解析進程 ID
    const lines = stdout.trim().split('\n');
    const pids = new Set();

    for (const line of lines) {
      const match = line.match(/LISTENING\s+(\d+)/);
      if (match) {
        pids.add(match[1]);
      }
    }

    // 結束所有佔用該端口的進程
    for (const pid of pids) {
      try {
        await execAsync(`powershell -Command "Stop-Process -Id ${pid} -Force"`);
        console.log(`✅ 已結束進程 PID ${pid} (端口 ${port})`);
      } catch (error) {
        // 進程可能已經結束，忽略錯誤
      }
    }

    return pids.size;
  } catch (error) {
    // 沒有找到佔用端口的進程
    return null;
  }
}

/**
 * 在 Unix-like 系統上查找並結束佔用端口的進程
 */
async function killPortUnix(port) {
  try {
    // 查找佔用端口的進程
    const { stdout } = await execAsync(`lsof -ti:${port}`);

    if (!stdout.trim()) {
      return null; // 端口未被佔用
    }

    // 解析進程 ID
    const pids = stdout.trim().split('\n');

    // 結束所有佔用該端口的進程
    for (const pid of pids) {
      try {
        await execAsync(`kill -9 ${pid}`);
        console.log(`✅ 已結束進程 PID ${pid} (端口 ${port})`);
      } catch (error) {
        // 進程可能已經結束，忽略錯誤
      }
    }

    return pids.length;
  } catch (error) {
    // 沒有找到佔用端口的進程
    return null;
  }
}

/**
 * 清理指定端口
 */
async function cleanupPort(port, name) {
  const killCount = isWindows
    ? await killPortWindows(port)
    : await killPortUnix(port);

  if (killCount === null) {
    console.log(`ℹ️  端口 ${port} (${name}) 未被佔用`);
  } else if (killCount === 0) {
    console.log(`ℹ️  端口 ${port} (${name}) 已釋放`);
  }
}

/**
 * 主函數
 */
async function main() {
  console.log('🔍 檢查並清理佔用的端口...\n');

  for (const { port, name } of PORTS) {
    await cleanupPort(port, name);
  }

  console.log('\n✨ 端口清理完成！\n');
}

main().catch((error) => {
  console.error('❌ 清理端口時發生錯誤:', error.message);
  process.exit(1);
});

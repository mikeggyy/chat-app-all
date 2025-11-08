#!/usr/bin/env node

const net = require('net');

/**
 * 檢查端口是否可用
 */
function checkPort(port, host = 'localhost') {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(1000);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * 等待端口就緒
 */
async function waitForPort(port, maxAttempts = 30, interval = 1000) {
  console.log(`⏳ 等待端口 ${port} 就緒...`);

  for (let i = 0; i < maxAttempts; i++) {
    const isReady = await checkPort(port);

    if (isReady) {
      console.log(`✅ 端口 ${port} 已就緒！`);
      return true;
    }

    // 等待一段時間後重試
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  console.error(`❌ 端口 ${port} 在 ${maxAttempts * interval / 1000} 秒後仍未就緒`);
  return false;
}

/**
 * 主函數
 */
async function main() {
  const port = parseInt(process.argv[2]);
  const maxAttempts = parseInt(process.argv[3]) || 30;

  if (!port || isNaN(port)) {
    console.error('❌ 請提供有效的端口號');
    console.error('用法: node wait-for-port.js <port> [maxAttempts]');
    process.exit(1);
  }

  const success = await waitForPort(port, maxAttempts);

  if (!success) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 錯誤:', error.message);
  process.exit(1);
});

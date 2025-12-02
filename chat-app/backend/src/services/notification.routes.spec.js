/**
 * Notification API 路由測試
 * 測試範圍：
 * - 獲取用戶通知列表
 * - 獲取未讀通知數量
 * - 獲取單個通知詳情
 * - 標記通知為已讀
 * - 標記所有通知為已讀
 * - 錯誤處理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import notificationRouter from './notification.routes.js';

// Mock all dependencies
vi.mock('./notification.service.js', () => ({
  getUserNotifications: vi.fn(),
  getNotificationById: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  getUnreadCount: vi.fn(),
}));

vi.mock('../auth/firebaseAuth.middleware.js', () => ({
  requireFirebaseAuth: (req, res, next) => {
    req.firebaseUser = { uid: 'test-user-123' };
    next();
  },
}));

vi.mock('../middleware/rateLimiterConfig.js', () => ({
  standardRateLimiter: (req, res, next) => next(),
  relaxedRateLimiter: (req, res, next) => next(),
}));

vi.mock('../../../../shared/utils/errorFormatter.js', () => ({
  sendSuccess: (res, data) => res.json({ success: true, data }),
  sendError: (res, code, message) => res.status(400).json({ success: false, error: code, message }),
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import mocked services after mocks are defined
import * as notificationService from './notification.service.js';

describe('Notification API Routes', () => {
  let app;

  beforeEach(async () => {
    // 創建 Express 應用
    app = express();
    app.use(express.json());
    app.use(notificationRouter);

    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('GET /api/notifications - 獲取用戶通知列表', () => {
    it('應該成功獲取通知列表', async () => {
      const mockNotifications = {
        notifications: [
          {
            id: 'notif-001',
            title: '系統公告',
            message: '歡迎使用新功能',
            isRead: false,
            createdAt: '2025-01-15T10:00:00Z',
            isSystemNotification: true,
          },
          {
            id: 'notif-002',
            title: '獎勵通知',
            message: '您獲得了 100 金幣',
            isRead: true,
            createdAt: '2025-01-14T10:00:00Z',
            isUserNotification: true,
          },
        ],
        unreadCount: 1,
        total: 2,
      };
      notificationService.getUserNotifications.mockResolvedValueOnce(mockNotifications);

      const response = await request(app)
        .get('/api/notifications')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toHaveLength(2);
      expect(response.body.data.unreadCount).toBe(1);
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-123', { limit: 50 });
    });

    it('應該支援自訂 limit 參數', async () => {
      const mockNotifications = { notifications: [], unreadCount: 0, total: 0 };
      notificationService.getUserNotifications.mockResolvedValueOnce(mockNotifications);

      await request(app)
        .get('/api/notifications?limit=10')
        .expect(200);

      expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-123', { limit: 10 });
    });

    it('應該限制最大 limit 為 100', async () => {
      const mockNotifications = { notifications: [], unreadCount: 0, total: 0 };
      notificationService.getUserNotifications.mockResolvedValueOnce(mockNotifications);

      await request(app)
        .get('/api/notifications?limit=200')
        .expect(200);

      expect(notificationService.getUserNotifications).toHaveBeenCalledWith('test-user-123', { limit: 100 });
    });

    it('應該處理服務錯誤', async () => {
      notificationService.getUserNotifications.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/notifications')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('GET /api/notifications/unread-count - 獲取未讀通知數量', () => {
    it('應該成功獲取未讀數量', async () => {
      notificationService.getUnreadCount.mockResolvedValueOnce(5);

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.unreadCount).toBe(5);
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith('test-user-123');
    });

    it('應該處理服務錯誤', async () => {
      notificationService.getUnreadCount.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/notifications/:id - 獲取單個通知詳情', () => {
    it('應該成功獲取通知詳情', async () => {
      const mockNotification = {
        id: 'notif-001',
        title: '系統公告',
        message: '歡迎使用新功能',
        fullContent: '這是完整內容...',
        isRead: false,
        createdAt: '2025-01-15T10:00:00Z',
        isSystemNotification: true,
      };
      notificationService.getNotificationById.mockResolvedValueOnce(mockNotification);

      const response = await request(app)
        .get('/api/notifications/notif-001')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notification.id).toBe('notif-001');
      expect(response.body.data.notification.title).toBe('系統公告');
      expect(notificationService.getNotificationById).toHaveBeenCalledWith('test-user-123', 'notif-001');
    });

    it('應該處理通知不存在的情況', async () => {
      notificationService.getNotificationById.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/notifications/non-existent')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('應該處理服務錯誤', async () => {
      notificationService.getNotificationById.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/notifications/notif-001')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/notifications/:id/read - 標記通知為已讀', () => {
    it('應該成功標記通知為已讀', async () => {
      notificationService.markNotificationAsRead.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/notifications/notif-001/read')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(notificationService.markNotificationAsRead).toHaveBeenCalledWith('test-user-123', 'notif-001');
    });

    it('應該處理服務錯誤', async () => {
      notificationService.markNotificationAsRead.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/notifications/notif-001/read')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/notifications/read-all - 標記所有通知為已讀', () => {
    it('應該成功標記所有通知為已讀', async () => {
      notificationService.markAllNotificationsAsRead.mockResolvedValueOnce(10);

      const response = await request(app)
        .post('/api/notifications/read-all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.markedCount).toBe(10);
      expect(notificationService.markAllNotificationsAsRead).toHaveBeenCalledWith('test-user-123');
    });

    it('應該處理沒有通知需要標記的情況', async () => {
      notificationService.markAllNotificationsAsRead.mockResolvedValueOnce(0);

      const response = await request(app)
        .post('/api/notifications/read-all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.markedCount).toBe(0);
    });

    it('應該處理服務錯誤', async () => {
      notificationService.markAllNotificationsAsRead.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/notifications/read-all')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('路由順序測試', () => {
    it('/unread-count 應該正確匹配而非被當作 :id', async () => {
      notificationService.getUnreadCount.mockResolvedValueOnce(3);

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .expect(200);

      // 確認是調用 getUnreadCount 而非 getNotificationById
      expect(notificationService.getUnreadCount).toHaveBeenCalled();
      expect(notificationService.getNotificationById).not.toHaveBeenCalled();
    });

    it('/read-all 應該正確匹配而非被當作 :id/read', async () => {
      notificationService.markAllNotificationsAsRead.mockResolvedValueOnce(5);

      const response = await request(app)
        .post('/api/notifications/read-all')
        .expect(200);

      // 確認是調用 markAllNotificationsAsRead 而非 markNotificationAsRead
      expect(notificationService.markAllNotificationsAsRead).toHaveBeenCalled();
      expect(notificationService.markNotificationAsRead).not.toHaveBeenCalled();
    });
  });

  describe('認證測試', () => {
    it('應該在所有請求中包含用戶 ID', async () => {
      notificationService.getUserNotifications.mockResolvedValueOnce({
        notifications: [],
        unreadCount: 0,
        total: 0,
      });

      await request(app).get('/api/notifications').expect(200);

      // 驗證 userId 被正確傳遞
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(
        'test-user-123',
        expect.any(Object)
      );
    });
  });
});

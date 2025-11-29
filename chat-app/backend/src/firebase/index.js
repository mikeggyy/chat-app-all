/**
 * Firebase Admin SDK 初始化（主應用）
 * ✅ 已遷移到共享工具：shared/backend-utils/firebase.js
 * 此文件僅用於向後兼容，重新導出共享工具
 */

export {
  getFirestoreDb,
  getFirebaseAdminAuth,
  db,
  auth,
  FieldValue,
  FieldPath
} from '../../../../shared/backend-utils/firebase.js';

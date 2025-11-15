import { getFirestoreDb, FieldValue } from "../firebase/index.js";

/**
 * 序列化 Firestore 數據，確保所有 Timestamp 和特殊對象都被轉換
 * @param {any} data - 要序列化的數據
 * @returns {any} 序列化後的數據
 */
export function serializeFirestoreData(data) {
  if (data === null || data === undefined) {
    return data;
  }

  // 處理 Firestore Timestamp 對象
  if (data && typeof data.toDate === 'function') {
    try {
      return data.toDate().toISOString();
    } catch (e) {
      // 如果轉換失敗，返回 null
      return null;
    }
  }

  // 處理數組
  if (Array.isArray(data)) {
    return data.map(serializeFirestoreData);
  }

  // 處理對象
  if (typeof data === 'object' && data !== null) {
    // 檢查是否是 FieldValue（包括 ServerTimestampTransform）
    if (data.constructor && data.constructor.name &&
        (data.constructor.name.includes('FieldValue') ||
         data.constructor.name.includes('Transform'))) {
      // 返回 null 而不是嘗試序列化這些特殊對象
      return null;
    }

    const serialized = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializeFirestoreData(value);
    }
    return serialized;
  }

  return data;
}

/**
 * 獲取 Firestore 文檔
 * @param {string} collection - 集合名稱
 * @param {string} docId - 文檔 ID
 * @returns {Promise<Object|null>} 文檔數據或 null
 */
export async function getDocument(collection, docId) {
  const db = getFirestoreDb();
  const docRef = db.collection(collection).doc(docId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }

  // ✅ 修復：序列化數據以避免 ServerTimestampTransform 問題
  const data = doc.data();
  const serialized = serializeFirestoreData(data);

  return {
    id: doc.id,
    ...serialized,
  };
}

/**
 * 設置文檔（創建或覆蓋）
 * @param {string} collection - 集合名稱
 * @param {string} docId - 文檔 ID
 * @param {Object} data - 文檔數據
 * @returns {Promise<void>}
 */
export async function setDocument(collection, docId, data) {
  const db = getFirestoreDb();
  const docRef = db.collection(collection).doc(docId);

  const timestamp = FieldValue.serverTimestamp();
  await docRef.set({
    ...data,
    updatedAt: timestamp,
  });
}

/**
 * 更新文檔（部分更新）
 * @param {string} collection - 集合名稱
 * @param {string} docId - 文檔 ID
 * @param {Object} data - 要更新的字段
 * @returns {Promise<void>}
 */
export async function updateDocument(collection, docId, data) {
  const db = getFirestoreDb();
  const docRef = db.collection(collection).doc(docId);

  await docRef.update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * 刪除文檔
 * @param {string} collection - 集合名稱
 * @param {string} docId - 文檔 ID
 * @returns {Promise<void>}
 */
export async function deleteDocument(collection, docId) {
  const db = getFirestoreDb();
  const docRef = db.collection(collection).doc(docId);
  await docRef.delete();
}

/**
 * 創建文檔（如果不存在）
 * @param {string} collection - 集合名稱
 * @param {string} docId - 文檔 ID
 * @param {Object} data - 文檔數據
 * @returns {Promise<boolean>} 是否創建了新文檔
 */
export async function createDocumentIfNotExists(collection, docId, data) {
  const db = getFirestoreDb();
  const docRef = db.collection(collection).doc(docId);

  const timestamp = FieldValue.serverTimestamp();
  const docData = {
    ...data,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        transaction.set(docRef, docData);
      }
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 查詢集合
 * @param {string} collection - 集合名稱
 * @param {Object} options - 查詢選項
 * @param {Array} options.where - where 條件 [[field, op, value], ...]
 * @param {Array} options.orderBy - 排序 [[field, direction], ...]
 * @param {number} options.limit - 限制數量
 * @returns {Promise<Array>} 文檔數組
 */
export async function queryCollection(collection, options = {}) {
  const db = getFirestoreDb();
  let query = db.collection(collection);

  // 添加 where 條件
  if (options.where && Array.isArray(options.where)) {
    for (const [field, op, value] of options.where) {
      query = query.where(field, op, value);
    }
  }

  // 添加排序
  if (options.orderBy && Array.isArray(options.orderBy)) {
    for (const [field, direction = "asc"] of options.orderBy) {
      query = query.orderBy(field, direction);
    }
  }

  // 添加限制
  if (options.limit && typeof options.limit === "number") {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => {
    // ✅ 修復：序列化數據以避免 ServerTimestampTransform 問題
    const data = doc.data();
    const serialized = serializeFirestoreData(data);
    return {
      id: doc.id,
      ...serialized,
    };
  });
}

/**
 * 批量寫入操作
 * @param {Array} operations - 操作數組 [{type, collection, docId, data}, ...]
 * @returns {Promise<void>}
 */
export async function batchWrite(operations) {
  const db = getFirestoreDb();
  const batch = db.batch();

  const timestamp = FieldValue.serverTimestamp();

  for (const op of operations) {
    const docRef = db.collection(op.collection).doc(op.docId);

    switch (op.type) {
      case "set":
        batch.set(docRef, {
          ...op.data,
          updatedAt: timestamp,
        });
        break;

      case "update":
        batch.update(docRef, {
          ...op.data,
          updatedAt: timestamp,
        });
        break;

      case "delete":
        batch.delete(docRef);
        break;

      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }

  await batch.commit();
}

// 導出 FieldValue 供其他模塊使用
export { FieldValue };

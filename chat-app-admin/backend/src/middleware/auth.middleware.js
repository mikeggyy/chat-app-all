import { auth } from "../firebase/index.js";

/**
 * Firebase 認證中間件
 * 驗證請求中的 Firebase ID Token
 */
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "未提供認證令牌" });
    }

    const token = authHeader.split("Bearer ")[1];

    // 驗證 Firebase ID Token
    const decodedToken = await auth.verifyIdToken(token);

    // 將用戶資訊附加到請求對象
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      claims: decodedToken,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "認證失敗", message: error.message });
  }
}

export default authMiddleware;

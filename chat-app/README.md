# Chat App Starter

This repository provides a minimal Vue 3 frontend and Node.js backend you can extend into a full application before deploying to Firebase.

## Prerequisites
- Node.js 18 or newer

## Getting Started

### Frontend (`./frontend`)
1. Copy `.env.example` to `.env`，然後填入 Firebase 專案的 `VITE_FIREBASE_*` 組態（可在 Firebase Console ➜ 專案設定 ➜ 一般 ➜ 你的應用程式中取得）。若需要自訂 API 來源也可調整 `VITE_API_URL`。
2. Install dependencies: `npm install`
3. Start Vite dev server: `npm run dev`
4. The app runs on `http://localhost:5173` by default.
5. Login success routes to the match screen (`/match`) which pulls mock data from the backend.

### Backend (`./backend`)
1. Copy `.env.example` to `.env`，填入伺服器埠號與允許的 CORS 網域，並新增 Firebase Admin Service Account 組態：
   - `FIREBASE_ADMIN_PROJECT_ID`
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY`（請將金鑰內容的換行替換為 `\n`，或在整段外層加上雙引號）
2. Install dependencies: `npm install`
3. Run in development mode: `npm run dev`
4. Health check endpoint: `GET http://localhost:4000/health`
5. Mock login endpoint for the frontend test button: `POST http://localhost:4000/auth/test`
6. Mock match endpoint powering the match screen: `GET http://localhost:4000/match/next`
7. List match options consumed by the frontend swipe carousel: `GET http://localhost:4000/match/all`

#### 生成角色語音預覽
- 在 `backend/.env` 設定 `OPENAI_API_KEY=`（可參考 `backend/.env.example`）。
- `cd backend && npm run generate:voices` 會用 `gpt-4o-mini-tts` 模型產生 10 個角色語音到 `frontend/public/voices/<voice>.mp3`。
- 腳本以第一個參數決定要新增哪一個角色，可修改 `VOICE_PRESETS` 新增更多語音 ID。

## Preparing for Firebase
- Frontend: run `npm run build` inside `frontend`, then configure Firebase Hosting to serve the `dist/` folder.
- Backend: if you plan to use Firebase Cloud Functions, migrate the Express app into a function handler (e.g., using `firebase-functions/v2/https`). Otherwise, deploy the Node server to your preferred hosting target and connect it to Firebase services (Auth, Firestore, etc.) via the SDKs.

Document new environment variables in `backend/.env.example` as you add integrations.

### Login Experience Notes
- The login page references `frontend/public/login-background.webp`. Replace this file with your production artwork while keeping the same filename.
- `使用 Google 登入` button 已串接 Firebase Auth（Popup 為主、Redirect 備援）。前端會在建立使用者時以 `Authorization: Bearer <Firebase ID Token>` 呼叫 `/api/users`，後端透過 Firebase Admin 驗證權杖再 upsert 使用者資料。請確認 `frontend/.env` 內的 Firebase 組態與 Firebase Console 的授權網域一致，並依需求新增測試或正式網域。
- `測試帳號登入` button calls the backend mock endpoint and surfaces the response for quick end-to-end checks。

- **素材**：將 AI 產出的角色圖片放在 `frontend/public/ai-role/`（如 `ai-role/match-role-01.webp`, `ai-role/match-role-02.webp`），並在 API 回傳對應路徑。
- **資料欄位**：Match API 需提供 `display_name`, `gender`, `locale`, `creator`, `background`, `first_message`, `secret_background`, `tags`, `portraitUrl` 等欄位。畫面目前會顯示名稱、背景敘述與標籤；其餘欄位暫存供日後擴充。
- Favorite status is stored locally for now—wire this up to Firestore/Realtime Database or Functions when ready.
- The “進入聊天室” button is a placeholder for future chat navigation; update the router when the chat module exists.
- 前端不再提供離線模式；務必啟動後端 API 才能登入並載入配對資料。
- 共用的 API 基底路徑請透過 `src/utils/api.js` 取得，確保所有請求使用相同設定。

### Global Loading Overlay
- 透過 `apiJson` / `apiFetch` 發出的請求預設會顯示全域 loading 動畫。
- 若要停用某次 loading，可傳入 `skipGlobalLoading: true`。
- 需要暫時關閉動畫時，可使用 `useGlobalLoading().temporarilyDisable(async () => { ... })` 包覆自訂流程。

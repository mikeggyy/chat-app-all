# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Local Development Workflow

**🚀 Quick Start (Recommended):**

```bash
npm run dev                        # Auto-start all services with data import
```

This single command will:
1. ✅ Start Firebase Emulator
2. ✅ Import all Firestore data automatically
3. ✅ Start Backend API
4. ✅ Start Frontend Dev Server

**Alternative: Manual startup sequence:**

```bash
# Terminal 1: Start Firebase Emulator (required for Auth and Firestore)
firebase emulators:start

# Terminal 2: Start Backend API
cd backend && npm run dev

# Terminal 3: Start Frontend Dev Server
cd frontend && npm run dev
```

**Development without auto-import:**

```bash
npm run dev:no-import              # Start all services without importing data
```

**Access Points**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Firebase Emulator UI: http://localhost:4001
- Firestore Emulator: http://localhost:8180
- Auth Emulator: http://localhost:9099

### Backend (`./backend`)

```bash
cd backend && npm install          # Install dependencies
cd backend && npm run dev          # Start Express API with nodemon (port 4000)
cd backend && npm run start        # Start production server
cd backend && npm run generate:voices  # Generate voice previews using OpenAI TTS
```

### Frontend (`./frontend`)

```bash
cd frontend && npm install         # Install dependencies
cd frontend && npm run dev         # Start Vite dev server (http://localhost:5173)
cd frontend && npm run build       # Build for production
cd frontend && npm run preview     # Preview production build
```

### Data Management Scripts

**Import all data (recommended):**

```bash
npm run import:all                 # Import all Firestore data (from root directory)
cd backend && npm run import:all   # Or from backend directory
```

**Individual import commands:**

```bash
npm run import:characters          # Import AI characters only
npm run import:configs             # Import system configs (gifts, selfie messages, rarities)
npm run import:membership          # Import membership tiers and pricing
npm run import:character-styles    # Import character creation style options
npm run import:test-data           # Seed test users and conversation data
```

**Direct script execution** (alternative method):

```bash
cd backend && node scripts/import-characters-to-firestore.js
cd backend && node scripts/import-configs-to-firestore.js
cd backend && node scripts/import-membership-configs.js
cd backend && node scripts/import-character-styles.js
cd backend && node scripts/seed-test-data.js
```

**Note:** When using `npm run dev`, data import runs automatically. See `backend/scripts/README.md` for detailed documentation.

### Development Utilities

**Port Management:**

```bash
npm run cleanup-ports              # Kill processes occupying development ports
npm run verify-config              # Verify all port configurations are synchronized
```

**Interactive Development Guide:**

```bash
npm run dev:guide                  # Interactive guide for starting development environment
```

**Port Configuration:**
- All port configurations are centralized in `config/ports.js`
- Run `npm run verify-config` after modifying ports to ensure consistency
- See `config/README.md` for detailed port management documentation

## Architecture Overview

### Configuration Management Architecture

The codebase uses centralized configuration to eliminate hardcoded values and ensure consistency:

**Root-Level Configuration** (`config/`):
- `config/ports.js` - Centralized port configuration for all services (Frontend, Backend, Firebase Emulator)
- Used by development scripts to ensure consistent port usage across the application
- Run `npm run verify-config` to verify all port configurations are synchronized

**Backend Configuration Structure**:
- `backend/src/config/limits.js` - All feature limits (conversation, voice, photo, ads, rate limits, history)
- `backend/src/utils/membershipUtils.js` - Shared membership functions (`getUserTier`, `isPaidMember`, `isFreeMember`)

**共享配置結構** (已整合):
- `shared/config/testAccounts.js` - 跨應用共享的測試帳號配置（前後端統一使用）

**Usage Pattern**:
```javascript
// Backend (從共享配置引用)
import { TEST_ACCOUNTS, isGuestUser, isDevUser } from '../../../../shared/config/testAccounts.js';
import { PHOTO_LIMITS, VOICE_LIMITS, RATE_LIMITS } from '../config/limits.js';
import { getUserTier, isPaidMember } from '../utils/membershipUtils.js';

// Frontend (從共享配置引用)
import { TEST_ACCOUNTS, isGuestUser } from '../../../../shared/config/testAccounts';
```

### Firestore Database Architecture

The application uses Firestore as the primary database for persistent data storage, replacing the previous in-memory approach. Firestore integration enables real-time data sync, scalability, and production-ready data persistence.

**Key Firestore Collections**:

1. **characters** - AI character definitions and metadata
   - Document ID: `match-001`, `match-002`, etc.
   - Fields: `display_name`, `gender`, `voice`, `background`, `secret_background`, `first_message`, `tags`, `plot_hooks`, `portraitUrl`, `totalChatUsers`, `totalFavorites`, `status`, `isPublic`

2. **gifts** - Gift items available for purchase
   - Document ID: `rose`, `chocolate`, `diamond`, etc.
   - Fields: `name`, `emoji`, `description`, `price`, `rarity`, `thankYouMessage`, `order`, `status`

3. **gift_rarities** - Gift rarity tier definitions
   - Document ID: `common`, `uncommon`, `rare`, `epic`, `legendary`
   - Fields: `name`, `color`, `order`

4. **selfie_messages** - Random messages displayed when requesting AI photos
   - Document ID: `msg-1`, `msg-2`, etc.
   - Fields: `message`, `order`, `status`

5. **membership_tiers** - Membership plan configurations
   - Document ID: `free`, `vip`, `vvip`
   - Fields: `name`, `price`, `currency`, `billingCycle`, `features` (detailed feature limits object)

6. **ai_feature_prices** - Pricing for AI features (photos, videos, unlock tickets)
   - Document ID: `ai_photo`, `ai_video`, `character_unlock_ticket`
   - Fields: `name`, `description`, `basePrice`, `currency`, `status`

7. **coin_packages** - Virtual currency purchase packages
   - Document ID: `coins_100`, `coins_500`, `coins_1000`, `coins_3000`
   - Fields: `name`, `coins`, `bonus`, `totalCoins`, `price`, `currency`, `popular`, `bestValue`, `status`

8. **system_configs** - System-wide configuration settings
   - Document ID: `ad_config` - Advertisement system configuration
   - Fields: `providers`, `types`, `dailyAdLimit`

9. **character_styles** - Character creation style options
   - Document ID: `style-1`, `style-2`, etc.
   - Fields: `id`, `name`, `description`, `tags`, `exampleImages`, `order`, `status`
   - Used in character creation flow for appearance customization

**User Data Collections** (per-user documents):
- **users/{userId}** - User profile, membership status, coins balance, assets
- **user_conversations/{userId}/conversations/{characterId}** - Chat history per character
- **user_favorites/{userId}/favorites/{characterId}** - Favorited characters
- **user_transactions/{userId}/transactions/{transactionId}** - Purchase/usage transaction logs

**Firestore Service Integration**:
- Backend uses Firebase Admin SDK for all Firestore operations
- Frontend reads configuration data via backend API endpoints
- User-specific data accessed through authenticated API calls
- Real-time listeners implemented for live updates where needed

**Migration Notes**:
- Configuration data (gifts, membership tiers, AI pricing) moved from code to Firestore for dynamic updates
- In-memory conversation store still used for active sessions, with Firestore as persistence layer
- Test account limits remain in `backend/src/config/limits.js` (not yet migrated to Firestore)

**See Also**: `docs/firestore-collections.md` for complete schema documentation

### Membership & Limit System

**Membership Tiers**:
- **Free**: Limited features with ad-based unlock system
- **VIP**: Monthly subscription with expanded limits
- **VVIP**: Premium tier with highest limits

**Feature Limits by Tier**:

1. **Conversation Limits** (`CONVERSATION_LIMITS`):
   - Free: 10 messages per character, can unlock 5 more via ads (max 10 ads/day)
   - VIP/VVIP: Unlimited messages (-1)

2. **Voice Limits** (`VOICE_LIMITS`):
   - Free: 10 voice plays per character, can unlock 5 more via ads (max 10 ads/day)
   - VIP/VVIP: Unlimited voice plays (-1)

3. **Photo Limits** (`PHOTO_LIMITS`):
   - Free: 3 photos lifetime (never resets)
   - VIP: 10 photos per month
   - VVIP: 50 photos per month
   - Test Account: 5 photos lifetime

4. **Rate Limits** (`RATE_LIMITS`):
   - AI Reply: 20 requests/minute
   - AI Suggestions: 15 requests/minute
   - TTS: 30 requests/minute
   - Image Generation: 5 requests/minute

**Limit Tracking Services**:
- `conversationLimit.service.js` - Tracks message counts per user per character
- `voiceLimit.service.js` - Tracks voice play counts per user per character
- `photoLimit.service.js` - Tracks photo generation counts per user with monthly reset logic
- `ad.service.js` - Tracks daily ad watch counts and cooldown periods

**Reset Logic**:
- Conversation/Voice: Per-character counters, ad unlocks reset daily
- Photos: Free tier never resets, VIP/VVIP reset monthly
- Ads: Daily limit (10/day), 5-minute cooldown between views

### Authentication & Session Management

- **Dual Auth System**: Supports both Firebase Authentication (Google OAuth) and test session tokens
- **Test Accounts**:
  - Guest User (`test-user`): Used for testing auth flow, limited functionality
  - Dev User: Full-featured test account with configured limits
- **Token Validation**: Router middleware checks token validity every 15 seconds (frontend/src/router/index.js:245)
- **Backend Validation**: Firebase Admin SDK verifies tokens via middleware (backend/src/auth/firebaseAuth.middleware.js)
- **User Profile**: Managed via composable `useUserProfile()` with reactive authentication state
- **Session Storage**: Test sessions stored in localStorage with expiration timestamps

### Conversation & AI System

- **In-Memory Store**: Conversations stored using Map keyed as `userId::characterId` (backend/src/conversation/conversation.service.js)
- **AI Integration**: OpenAI GPT-4o-mini generates character responses with customizable system prompts (backend/src/ai/ai.service.js)
- **Context Window**: Maintains last 12 messages for AI reply generation (HISTORY_LIMITS.MAX_HISTORY_WINDOW)
- **Suggestion System**: Generates 3 quick-reply suggestions based on last 6 messages (HISTORY_LIMITS.SUGGESTION_WINDOW)
- **Character System Prompts**: Built from character metadata (display_name, background, secret_background, plot_hooks, tags)

### Image Generation System

**Technology Stack**:
- **API**: Gemini 2.5 Flash Image (Nano Banana) via Replicate
- **Image Compression**: Sharp library compresses images to WebP format at quality 60
- **Aspect Ratio**: 2:3 (832x1248 or similar)
- **Style**: Disney Character style by default

**Generation Flow**:
1. Read character portrait from `frontend/public/ai-role/` as reference
2. Analyze recent conversation context (last 6 messages)
3. Generate image using Gemini API with character reference
4. Compress result to WebP (reduces size by 70-85%, from ~1MB to ~100-200KB)
5. Store as base64 data URL in conversation history
6. Track usage via `photoLimit.service.js`

**Image Compression** (`backend/src/ai/gemini.service.js`):
- Uses `sharp` package to convert to WebP format
- Quality setting: 60 (balances quality and file size)
- Prevents localStorage QuotaExceededError (5-10MB browser limit)
- Automatic fallback if compression fails

**Service Location**: `backend/src/ai/imageGeneration.service.js`

### Character Creation Flow

- **Multi-Step Process**: Gender → Appearance → Generating → Voice selection flow
- **State Management**: Flow state tracked in backend store (backend/src/characterCreation/characterCreation.service.js)
- **Charge Tracking**: Records credit charges with idempotency keys and status transitions (reserved → captured/void)
- **Generation Pipeline**: Uses `generateCreationResult()` with async generator function, automatic error handling, and result caching

### API Request Architecture

- **Centralized Client**: All API calls go through `apiJson()` and `apiFetch()` in frontend/src/utils/api.js
- **Global Loading**: Requests automatically show loading overlay unless `skipGlobalLoading: true` passed
- **Base URL Resolution**: Smart detection—prefers `VITE_API_URL`, falls back to runtime origin or localhost:4000
- **CORS Handling**: Automatically sets `mode: "cors"` for cross-origin requests
- **Vite Proxy**: Dev server proxies `/api`, `/match`, `/auth` to backend if reachable

### Idempotency System

The application implements comprehensive idempotency to ensure all consumable operations (voice playback, photo generation, gifts, AI replies) are safe to retry without duplicate charges or executions.

**Core Principles**:
- ✅ **Charge After Success** - Usage is only recorded after successful operation completion
- ✅ **Retry on Failure** - Failed operations don't consume credits, allowing users to retry
- ✅ **No Duplicate Execution** - Identical retry requests return cached results without re-execution

**Backend Implementation** (`backend/src/utils/idempotency.js`):
```javascript
import { handleIdempotentRequest } from './utils/idempotency.js';

const result = await handleIdempotentRequest(
  requestId,              // Unique request ID from client
  async () => {           // Actual operation
    return await performOperation();
  },
  { ttl: 15 * 60 * 1000 } // Cache for 15 minutes
);
```

**Frontend Request ID Generation** (`frontend/src/utils/requestId.js`):
```javascript
// Voice playback - deterministic (same messageId = same requestId)
const requestId = generateVoiceRequestId(userId, characterId, messageId);

// Photo generation - unique per request
const requestId = generatePhotoRequestId(userId, characterId);

// Gift sending - unique per request
const requestId = generateGiftRequestId(userId, characterId, giftId);
```

**Idempotent Operations**:
1. **Voice Playback** (`POST /api/ai/tts`) - Same message can replay cached audio without consuming credits
2. **Photo Generation** (`POST /api/ai/generate-selfie`) - Network failures can retry without duplicate charges
3. **Gift Sending** (`POST /api/gifts/send`) - Prevents duplicate coin deductions on retry
4. **AI Replies** (`POST /api/conversations/:userId/:characterId/reply`) - Prevents duplicate AI responses

**Cache Management**:
- Automatic cleanup every 5 minutes
- Maximum 10,000 cached requests
- 15-minute TTL for cached results
- Processing locks prevent concurrent duplicate requests

**Response Format** (all idempotent endpoints include):
```javascript
{
  // ... normal response data ...
  "_idempotent": false,  // true if cached result returned
  "_cached": false       // true if from cache (not re-executed)
}
```

**See Also**: `docs/IDEMPOTENCY.md` for detailed implementation and testing guide

### Router & Navigation Guards

- **Hash History**: Uses `createWebHashHistory()` for routing
- **Auth Guard**: `beforeEach` blocks unauthenticated access, redirects to login if token invalid
- **Bottom Nav Control**: Routes define `meta.showBottomNav` to toggle bottom navigation bar
- **Token Monitor**: Effect scope runs interval check, auto-redirects on token expiration

### Firebase Integration

- **Frontend**: Firebase web SDK for client-side auth (frontend/src/utils/firebase.js)
- **Backend**: Firebase Admin SDK for token verification and server-side operations
- **Configuration**: Frontend uses `VITE_FIREBASE_*` env vars, backend uses `FIREBASE_ADMIN_*` credentials
- **Service Account**: Private key must have newlines escaped as `\n` in .env file

**Firebase Emulator Setup** (for local development):

The project is configured to use Firebase Emulator for local development, providing:
- ✅ Free local testing (no Firebase quota usage)
- ✅ Fast local execution (no network latency)
- ✅ Offline development capability
- ✅ Data isolation from production
- ✅ Easy data reset (restart emulator)

**Starting the Emulator**:
```bash
firebase emulators:start  # Start Auth + Firestore emulators
```

**Emulator Endpoints**:
- Emulator UI: http://localhost:4001
- Auth Emulator: http://localhost:9099
- Firestore Emulator: http://localhost:8180

**Configuration** (automatically detected via environment variables):
- Frontend: Set `VITE_USE_EMULATOR=true` in `.env` to use emulators
- Backend: Set `USE_FIREBASE_EMULATOR=true` in `.env` to connect to emulators

**Mock Authentication** (when using emulator):
- Click "Google Login" button
- Enter any email (e.g., `test@example.com`)
- Instant login without real Google account

**Data Persistence** (optional):
```bash
# Import/export emulator data
firebase emulators:start --import=./emulator-data --export-on-exit
```

**See Also**: `docs/firebase-emulator-setup.md` for detailed setup instructions

### Shared Configuration

The `shared/` directory contains configuration and utilities used by both frontend and backend to ensure consistency.

**Configuration Files** (`shared/config/`):

1. **`constants.js`** - System-wide constants
   - **TIME_CONSTANTS**: Millisecond values for common time intervals
   - **TEXT_LENGTH_LIMITS**: Character limits for user input, messages, system prompts
   - **QUANTITY_LIMITS**: Limits for history, favorites, cache sizes, pagination
   - **FILE_SIZE_LIMITS**: Max sizes for avatars, images, JSON payloads
   - **IMAGE_CONSTANTS**: Image quality settings, dimensions for avatars/portraits
   - **API_CONSTANTS**: Timeouts, retry settings
   - **VALIDATION_RULES**: Regex patterns, password rules, ID formats
   - **HTTP_STATUS**: Standard HTTP status codes
   - **ERROR_CODES**: Application-specific error codes

2. **`gifts.js`** - Gift item definitions (emoji, prices, rarity, descriptions)
   - Used as seed data for Firestore `gifts` collection
   - Five rarity tiers: common, uncommon, rare, epic, legendary

3. **`potions.js`** - Potion/boost item definitions
   - Special consumable items with temporary effects

4. **`assets.js`** - Asset type definitions and configurations
   - Defines various user asset types and their properties

**Shared Utils** (`shared/utils/`):
- **`userUtils.js`** - User-related utility functions shared between frontend and backend

**Usage Pattern**:
```javascript
import { TIME_CONSTANTS, QUANTITY_LIMITS } from '../../../shared/config/constants.js';
import { GIFTS } from '../../../shared/config/gifts.js';

const timeout = TIME_CONSTANTS.THIRTY_SECONDS;
const maxHistory = QUANTITY_LIMITS.MAX_HISTORY_MESSAGES;
const roseGift = GIFTS.find(g => g.id === 'rose');
```

**Important**: Always use these shared constants instead of hardcoded magic numbers to maintain consistency across frontend and backend.

### ChatView Refactoring (2025-10)

**Major Restructuring**: ChatView.vue underwent significant refactoring, reducing code from 3,887 to 1,061 lines (73% reduction).

**New Component Structure** (`frontend/src/components/chat/`):
- `ChatHeader.vue` - Header navigation with character name and voice badge display
- `Message.vue` - Individual message rendering with voice playback and image support
- `MessageList.vue` - Message list container with auto-scrolling and loading states
- `MessageInput.vue` - Input area with suggestions, photo/gift buttons, and character limits

**Chat Composables** (`frontend/src/composables/chat/`):
- `useChatMessages.js` - Message history management, AI reply generation, conversation loading
- `useChatActions.js` - Chat actions (reset conversation, photo generation, gifts, voice playback)
- `useSuggestions.js` - AI-generated quick reply suggestions with loading states

**Architecture Benefits**:
- Improved maintainability (10x easier to modify individual components)
- Enhanced testability (components can be tested independently)
- Better reusability (chat components can be used in different contexts)
- Clearer separation of concerns (UI vs logic vs state management)

### Performance Optimizations

**Memory Management**:
- **LRU Cache**: Conversation and transaction data with automatic eviction when limits reached
- **Transaction Cleanup**: Automatic cleanup of transactions older than 90 days
- **Cache Size Limits**: Configurable max cache sizes to prevent memory leaks

**API Performance**:
- **Request Deduplication**: Identical GET requests share single network call to prevent duplicate API hits
- **JSON Result Caching**: Parsed JSON results cached to avoid Response body stream re-reading errors
- **Token Caching**: Firebase ID tokens cached with 55-minute TTL to reduce Firebase API calls

**Implementation Locations**:
- Request deduplication: `frontend/src/utils/api.js` (deduplicatedRequest, jsonResultCache)
- Conversation cache: `backend/src/conversation/conversation.service.js`
- Transaction cleanup: `backend/src/services/` (various limit services)
- Token cache: `frontend/src/composables/useFirebaseAuth.js`

## Key Patterns & Conventions

### Frontend Composables

**Core Composables**:
- **useUserProfile()**: Reactive user state, authentication checks, profile updates
- **useFirebaseAuth()**: Firebase auth operations (login, logout, token refresh)
- **useGlobalLoading()**: Controls global loading overlay, supports `temporarilyDisable()` wrapper
- **useGuestGuard()**: Guest user restrictions and upgrade prompts
- **useNotifications()**: In-app notification system
- **useToast()**: Toast message display utility

**Limit Management Composables**:
- **useBaseLimitService()**: Base service for limit management with common patterns
- **useConversationLimit()**: Manages conversation message limits per character
- **useVoiceLimit()**: Manages voice play limits per character
- **usePhotoLimit()**: Manages photo generation limits with tier-based logic

**Membership & Economy**:
- **useMembership()**: Handles membership tier upgrades and status checks
- **useCoins()**: Virtual currency management for in-app purchases
- **useUnlockTickets()**: Unlock ticket system for premium content

**Chat Composables** (`frontend/src/composables/chat/`):
- **useChatMessages()**: Message history, AI replies, conversation management
- **useChatActions()**: Reset, photo generation, gifts, voice playback
- **useSuggestions()**: AI-generated quick reply suggestions

### Backend Module Structure

Each feature module lives in `backend/src/<feature>/` with:

- `index.js`: Exports router and/or service functions
- `<feature>.routes.js`: Express router endpoints
- `<feature>.service.js`: Business logic and data access
- `<feature>.data.js`: Mock or static data (if applicable)

**Shared Directories**:
- `backend/src/config/`: Configuration constants (test accounts, limits)
- `backend/src/utils/`: Shared utility functions (membership utils, logger)
- `backend/src/middleware/`: Express middleware (rate limiter, auth, validation)
- `backend/scripts/`: Data import and management scripts (see `backend/scripts/README.md`)

**Feature Modules**:
- `backend/src/photoAlbum/`: Photo album management for characters
- `backend/src/characterStyles/`: Character creation style options management

**Modular Limit Service** (`backend/src/services/limitService/`):
- `constants.js`: Limit-specific constants
- `limitConfig.js`: Configuration retrieval with tier/test account handling
- `limitReset.js`: Reset logic for daily/monthly limits
- `limitTracking.js`: Usage tracking and enforcement

**Configuration Pattern**:
- Always import from centralized config files
- Use helper functions (`isGuestUser`, `getUserTier`) instead of direct ID comparisons
- All limits defined in `config/limits.js` for easy adjustment
- Prefer shared constants from `shared/config/constants.js`

### API Conventions

- RESTful endpoints under `/api/<resource>`
- Legacy match endpoints at `/match/next` and `/match/all` (to be migrated)
- Test auth endpoint at `/auth/test` returns test user credentials
- All responses are JSON
- Errors include `status` property for HTTP status codes
- Rate limiting applied per user (UID-based) or IP fallback

### Environment Configuration

**Frontend** (`frontend/.env`):
```env
# API Configuration
VITE_API_URL=http://localhost:4000  # Backend API base URL

# Firebase Configuration (from Firebase Console)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Firebase Emulator (for local development)
VITE_USE_EMULATOR=true              # Enable emulator mode
VITE_EMULATOR_HOST=localhost
VITE_EMULATOR_AUTH_PORT=9099
VITE_FIRESTORE_EMULATOR_PORT=8180
```

**Backend** (`backend/.env`):
```env
# Server Configuration
PORT=4000
CORS_ORIGIN=http://localhost:5173,http://localhost:4173

# Firebase Admin SDK (Service Account)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----"

# Firebase Emulator (for local development)
USE_FIREBASE_EMULATOR=true
FIREBASE_EMULATOR_HOST=localhost
FIRESTORE_EMULATOR_HOST=localhost:8180

# AI Services
OPENAI_API_KEY=sk-...               # For GPT-4o-mini and TTS
REPLICATE_API_TOKEN=r8_...          # For Gemini image generation

# Optional: Google Generative AI
GOOGLE_GENERATIVE_AI_API_KEY=...    # Alternative to Replicate for image generation
```

**Important Notes**:
- Private key must have newlines escaped as `\n` in `.env` file or wrapped in double quotes
- Copy `.env.example` files as starting templates
- Never commit `.env` files to version control
- Update `CORS_ORIGIN` in production to include your frontend domain

## Important Implementation Details

### Voice Generation

- Script: `backend/scripts/generateVoicePreviews.js`
- Uses OpenAI `gpt-4o-mini-tts` model with 10 preset voices (alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, verse)
- Outputs to `frontend/public/voices/<voice>.mp3`
- Requires `OPENAI_API_KEY` in backend/.env

### Image Generation & Compression

- Uses Gemini 2.5 Flash Image (Nano Banana) via Replicate API
- Character portraits serve as reference images for consistency
- Compresses generated images to WebP format (quality 60) using Sharp
- Typical compression: 800KB-1.2MB → 100-200KB (70-85% reduction)
- Prevents browser localStorage quota errors (5-10MB limit)
- Service: `backend/src/ai/gemini.service.js` and `backend/src/ai/imageGeneration.service.js`

### Photo Limit System

- **Service**: `backend/src/ai/photoLimit.service.js`
- **Tracking**: In-memory Map storing usage counts per user
- **Reset Logic**:
  - Free tier: Lifetime limit (never resets)
  - VIP/VVIP: Monthly reset on calendar month boundary
  - Test accounts: Configurable lifetime limit
- **Photo Cards**: Purchasable extra photos stored in `cards` counter
- **Priority**: Uses photo cards first, then base allowance

### Static Assets

- Character portraits: `frontend/public/ai-role/match-role-*.webp`
- Voice samples: `frontend/public/voices/<voice>.mp3`
- Login background: `frontend/public/login-background.webp`

### Data Flow for New Conversation Message

1. Frontend calls `/api/conversations/:userId/:characterId/messages` with user message
2. Backend checks conversation limits via `conversationLimit.service.js`
3. Backend appends user message to conversation store
4. Backend calls OpenAI to generate AI reply with context window
5. Backend appends partner message to conversation store
6. Backend updates user's conversation list metadata (lastMessage, lastMessageAt, etc.)
7. Returns both messages and full history to frontend

### Character Match Data Structure

```javascript
{
  id: string,
  display_name: string,
  gender: string,
  locale: string,
  creator: string,
  background: string,        // Public character description
  secret_background: string,  // Internal AI system prompt details
  first_message: string,
  tags: string[],
  plot_hooks: string[],      // Narrative hooks for AI to reference
  portraitUrl: string,
  voice: string              // Voice ID for TTS
}
```

### Membership Data Structure

```javascript
{
  membershipTier: "free" | "vip" | "vvip",
  membershipStatus: "active" | "expired" | "cancelled",
  membershipStartedAt: string | null,    // ISO date
  membershipExpiresAt: string | null,    // ISO date
  membershipAutoRenew: boolean
}
```

## Testing Considerations

- No test suite currently configured
- Manual testing required for all changes
- Test auth flow with "測試帳號登入" button on login page
- Verify Firebase auth with Google sign-in before deploying
- Check conversation history persists correctly across page refreshes during session
- Test photo generation with test account (limited to 5 photos)
- Verify image compression reduces file size appropriately
- Test limit systems with different membership tiers
- **Test chat components independently**: Each chat component (ChatHeader, Message, MessageList, MessageInput) should work correctly in isolation
- **Verify composable behavior**: Chat composables should handle loading states, errors, and edge cases properly
- **Check API request deduplication**: Verify that rapid identical requests don't cause duplicate network calls or stream reading errors
- **Test with different user tiers**: Free, VIP, VVIP users should see correct limits and features

## Deployment Notes

### Recommended Architecture: Cloud Run + Firebase Hosting

**前端（Frontend）**：Firebase Hosting
- 靜態資源託管，自動 CDN 加速
- 通過 `firebase.json` rewrites 將 API 請求代理到 Cloud Run
- 統一域名，無需處理 CORS

**後端（Backend）**：Cloud Run
- 支援 stateful 應用（in-memory 資料結構）
- 支援大型 payload（50MB，用於 base64 圖片）
- 支援長時間執行（60 秒，用於 AI 圖片生成）
- 自動擴展，按使用量計費

**資料庫**：Firestore + Firebase Auth + Storage
- 持久化資料儲存
- 身份驗證與授權
- 檔案儲存

### 部署步驟

#### 1. 後端部署到 Cloud Run

```bash
cd backend

# Linux/Mac
chmod +x deploy-cloudrun.sh
./deploy-cloudrun.sh

# Windows
deploy-cloudrun.bat
```

**手動部署命令**：
```bash
# 構建並部署
gcloud builds submit --tag gcr.io/your-project-id/chat-backend
gcloud run deploy chat-backend \
  --image gcr.io/your-project-id/chat-backend \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --min-instances 0 \
  --max-instances 10
```

**設置環境變數**（在 Cloud Run 控制台）：
- `NODE_ENV=production`
- `PORT=8080`
- `CORS_ORIGIN=https://your-project-id.web.app`
- `FIREBASE_ADMIN_*`（Firebase Admin SDK 憑證）
- `OPENAI_API_KEY`（OpenAI API Key）
- `REPLICATE_API_TOKEN`（Replicate API Token）

建議使用 **Secret Manager** 管理敏感資訊。

#### 2. 前端部署到 Firebase Hosting

```bash
# 構建前端
cd frontend
npm run build

# 部署
cd ..
firebase deploy --only hosting
```

**環境變數配置**（`frontend/.env.production`）：
- `VITE_API_URL=`（留空，使用 Firebase Hosting 代理）
- `VITE_FIREBASE_*`（Firebase 配置）
- `VITE_USE_EMULATOR=false`

#### 3. 部署 Firestore Rules 和資料

```bash
# 部署 Firestore rules
firebase deploy --only firestore:rules

# 部署 Storage rules
firebase deploy --only storage:rules

# 匯入初始資料（首次部署）
cd backend
npm run import:all
```

### 成本預估

**小型應用（<10萬請求/月）**：約 $0-5 USD/月（免費額度內）

**中型應用（<100萬請求/月）**：約 $10-25 USD/月

**高流量應用（>500萬請求/月）**：$50-200 USD/月

### 監控與優化

**查看日誌**：
```bash
gcloud run services logs read chat-backend --region asia-east1 --limit 50
```

**成本優化**：
- 設置 `min-instances=0`（無流量時不計費）
- 啟用 CPU 節流
- 使用記憶體快取減少 Firestore 讀取
- 設置預算警報

### 詳細文檔

完整部署指南請參考：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

包含：
- 詳細部署步驟
- 環境變數配置
- Secret Manager 使用
- 監控與日誌
- 疑難排解
- 回滾步驟
- 安全性設置

## Coding Conventions

**Style Guidelines**:
- Use 2-space indentation with semicolons for all JavaScript and Vue files
- ES Modules (`import`/`export`) throughout the codebase
- Vue component filenames use PascalCase (e.g., `ChatHeader.vue`)
- Composables use `useFoo` naming pattern (e.g., `useChatMessages.js`)
- Use `<script setup>` blocks with double quotes for strings
- Keep shared logic in composables rather than duplicating in views

**File Organization**:
- Co-locate test files with implementation using `*.spec.js` suffix
- Frontend: `components/`, `composables/`, `router/`, `utils/`, `views/`
- Backend: `src/<feature>/` with `routes.js`, `service.js`, `data.js`
- Place visual references in `reference-images/` directory

**Commit Guidelines**:
- Follow Conventional Commits format (e.g., `feat: add chat voice playback`, `fix: resolve API deduplication error`)
- Pull requests should describe changes, link issues, list verification steps, and include screenshots for UI updates
- Confirm `npm run build` (frontend) and `npm run start` (backend) succeed before requesting review

## Documentation Reference

The `docs/` directory contains detailed documentation for specific system components:

### Database & Infrastructure
- **`firestore-collections.md`** - Complete Firestore collection schema reference
  - All collection structures (characters, gifts, membership_tiers, etc.)
  - Field definitions and data types
  - Current data statistics
  - Backend management requirements

- **`firestore-data-model.md`** - Firestore data modeling patterns and relationships
  - Document structure guidelines
  - Query optimization patterns
  - Data normalization strategies

- **`firebase-emulator-setup.md`** - Comprehensive Firebase Emulator setup guide
  - Installation and configuration steps
  - Local development workflow
  - Emulator benefits and usage
  - Production deployment considerations

### System Design
- **`IDEMPOTENCY.md`** - Idempotency system implementation guide
  - Design principles and architecture
  - Request ID generation patterns
  - Cache management strategies
  - Testing and verification procedures
  - API endpoint specifications

### Other Resources
- **`AGENTS.md`** - Repository structure and development guidelines (legacy)
- **`會員機制說明.md`** - Membership system documentation (Traditional Chinese)
  - Tier definitions and pricing
  - Feature comparison
  - Upgrade flow and payment integration

### Scripts & Configuration
- **`backend/scripts/README.md`** - Comprehensive guide for backend scripts
  - Data import scripts usage
  - Import automation workflow
  - Script development guidelines
- **`config/README.md`** - Port configuration management guide
  - Centralized port configuration
  - Port modification procedures
  - Configuration verification

**When to Reference Documentation**:
- Implementing new Firestore collections → `firestore-collections.md`
- Setting up local development environment → `firebase-emulator-setup.md`
- Adding new consumable operations → `IDEMPOTENCY.md`
- Understanding membership logic → `會員機制說明.md`
- Managing data import scripts → `backend/scripts/README.md`
- Modifying service ports → `config/README.md`

## Agent-Specific Instructions

- Avoid destructive commands without explicit approval. If elevated filesystem or network access is required, document the need, request authorization, and prefer the minimal scope necessary.
- Always respond to user requests in Traditional Chinese.

### Configuration & Constants
- When modifying limits or configuration, always use the centralized config files in `backend/src/config/` and `frontend/src/config/`
- Never hardcode test account IDs or limit values—use the configuration constants
- **Use shared constants**: Import from `shared/config/constants.js` instead of hardcoding magic numbers (time intervals, limits, sizes)
- **Shared data**: Use configurations from `shared/config/` (gifts, assets, potions) for consistency

### Feature Implementation Patterns
- When adding new features with usage limits, follow the established pattern in `photoLimit.service.js`, `voiceLimit.service.js`, or `conversationLimit.service.js`
- **Follow the limit service pattern**: New limit features should use the modular structure in `backend/src/services/limitService/`
- **Idempotency for consumable operations**: Any new operation that consumes resources (credits, coins, limits) MUST implement idempotency using `handleIdempotentRequest()` from `backend/src/utils/idempotency.js`
- **Request ID generation**: Create appropriate request ID generator in `frontend/src/utils/requestId.js` (deterministic for repeatable operations, unique for one-time operations)

### Database Operations
- **Firestore preferred**: New persistent data should use Firestore collections, not in-memory storage
- **Collection naming**: Follow existing patterns (lowercase with underscores: `user_conversations`, `ai_feature_prices`)
- **Data migration**: When adding new Firestore collections, create corresponding import scripts in `backend/` (e.g., `import-xyz-to-firestore.js`)
- **Emulator testing**: Always test Firestore changes with Firebase Emulator before deploying to production

### Component Architecture
- **When working with ChatView**: The component has been modularized. Edit the specific sub-component (`ChatHeader.vue`, `Message.vue`, etc.) or composable instead of the main `ChatView.vue` file
- **Composable pattern**: Extract reusable logic into composables following the `useFoo` naming pattern
- **Component size**: Keep components under 500 lines; split larger components into sub-components

### API & Performance
- **API request optimization**: When adding new API calls, consider using the deduplication pattern for GET requests to avoid duplicate network calls
- **Cache appropriately**: Use LRU cache for frequently accessed data with automatic eviction
- **Rate limiting**: All new API endpoints should have appropriate rate limits defined

### Documentation
- **Reference docs first**: Check `docs/` directory for detailed documentation on Firestore, idempotency, and Firebase Emulator before implementing related features
- **Update docs**: When adding significant features, update relevant documentation in `docs/` and this CLAUDE.md file

### Scripts & Configuration Management
- **Port configuration**: Always use `config/ports.js` for port definitions. After modifying ports, run `npm run verify-config` to ensure all configurations are synchronized
- **Development scripts**: Place new development scripts in `scripts/` (root-level) or `backend/scripts/` (backend-specific)
- **Data import scripts**: When adding new Firestore collections, create corresponding import scripts and update `backend/scripts/import-all-data.js`
- **Script documentation**: Update `backend/scripts/README.md` when adding new import scripts

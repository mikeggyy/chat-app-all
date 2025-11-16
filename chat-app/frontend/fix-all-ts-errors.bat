@echo off
REM Comprehensive TypeScript Error Fixes for Windows
REM Run this script to fix all 118 TypeScript errors

echo ========================================
echo TypeScript Error Fixes
echo ========================================

cd /d %~dp0

echo.
echo Phase 1: Stopping any watchers...
taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq vite*" 2>nul

timeout /t 2 /nobreak >nul

echo.
echo Phase 2: Fixing simple unused imports...

REM Fix 1: useChatLimits.ts
powershell -Command "(Get-Content 'src\composables\chat\setup\useChatLimits.ts') -replace \"import type \{ CoinPackage, CoinTransaction, CoinsState \} from '../../../types/index\.js';\", '' | Set-Content 'src\composables\chat\setup\useChatLimits.ts'"

REM Fix 2: usePaginatedConversations.ts
powershell -Command "(Get-Content 'src\composables\usePaginatedConversations.ts') -replace ', type ComputedRef', '' | Set-Content 'src\composables\usePaginatedConversations.ts'"

REM Fix 3: useSettings.ts
powershell -Command "(Get-Content 'src\composables\useSettings.ts') -replace ', onBeforeUnmount', '' | Set-Content 'src\composables\useSettings.ts'"
powershell -Command "(Get-Content 'src\composables\useSettings.ts') -replace ', type ComputedRef', '' | Set-Content 'src\composables\useSettings.ts'"

REM Fix 4: useVirtualScroll.ts
powershell -Command "(Get-Content 'src\composables\useVirtualScroll.ts') -replace ', type UnwrapRef', '' | Set-Content 'src\composables\useVirtualScroll.ts'"

REM Fix 5: useChatVirtualScroll.ts
powershell -Command "(Get-Content 'src\composables\useChatVirtualScroll.ts') -replace 'import \{ computed, ref,', 'import { ref,' | Set-Content 'src\composables\useChatVirtualScroll.ts'"
powershell -Command "(Get-Content 'src\composables\useChatVirtualScroll.ts') -replace ', type ComputedRef', '' | Set-Content 'src\composables\useChatVirtualScroll.ts'"

REM Fix 6: useShopItems.ts
powershell -Command "(Get-Content 'src\composables\shop\useShopItems.ts') -replace 'import \{ ref, computed \}', 'import { computed }' | Set-Content 'src\composables\shop\useShopItems.ts'"

REM Fix 7: useCharacterCreationFlow.ts
powershell -Command "(Get-Content 'src\composables\useCharacterCreationFlow.ts') -replace ', type ComputedRef', '' | Set-Content 'src\composables\useCharacterCreationFlow.ts'"

echo.
echo Phase 3: Fixing property name issues...

REM Fix 8: useCharacterInfo.ts displayName -> display_name
powershell -Command "(Get-Content 'src\composables\photo-gallery\useCharacterInfo.ts') -replace '\.displayName', '.display_name' | Set-Content 'src\composables\photo-gallery\useCharacterInfo.ts'"

REM Fix 9: useCharacterInfo.ts portrait -> portraitUrl
powershell -Command "(Get-Content 'src\composables\photo-gallery\useCharacterInfo.ts') -replace '\.portrait\b', '.portraitUrl' | Set-Content 'src\composables\photo-gallery\useCharacterInfo.ts'"

echo.
echo Done! Run 'npm run type-check' to verify fixes.
echo ========================================

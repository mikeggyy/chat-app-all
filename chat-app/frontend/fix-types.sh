#!/bin/bash
# Script to fix TypeScript errors systematically

echo "Starting TypeScript error fixes..."

# Fix 1: Remove unused imports in useChatInitialization.ts
sed -i 's/import { nextTick, type Ref } from '\''vue'\'';/import { nextTick } from '\''vue'\'';/' src/composables/chat/useChatInitialization.ts

# Fix 2: Remove unused imports in useChatLimits.ts
sed -i '/^import { type ComputedRef } from '\''vue'\'';$/d' src/composables/chat/setup/useChatLimits.ts

# Fix 3: Remove unused imports in usePaginatedConversations.ts
sed -i 's/import { computed, ref, type ComputedRef } from '\''vue'\'';/import { computed, ref } from '\''vue'\'';/' src/composables/usePaginatedConversations.ts

# Fix 4: Remove unused imports in useSettings.ts
sed -i 's/import { ref, watch, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from '\''vue'\'';/import { ref, watch, onMounted, type Ref } from '\''vue'\'';/' src/composables/useSettings.ts

# Fix 5: Remove unused imports in useVirtualScroll.ts
sed -i 's/import { ref, computed, onMounted, onUnmounted, type Ref, type UnwrapRef, type ComputedRef } from '\''vue'\'';/import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from '\''vue'\'';/' src/composables/useVirtualScroll.ts

# Fix 6: Remove unused imports in useChatVirtualScroll.ts
sed -i 's/import { computed, ref, watch, nextTick, type Ref, type ComputedRef } from '\''vue'\'';/import { ref, watch, nextTick, type Ref } from '\''vue'\'';/' src/composables/useChatVirtualScroll.ts

# Fix 7: Remove unused imports in useShopItems.ts
sed -i 's/import { ref, computed } from '\''vue'\'';/import { computed } from '\''vue'\'';/' src/composables/shop/useShopItems.ts

# Fix 8: Remove unused imports in useCharacterCreationFlow.ts
sed -i 's/import { ref, computed, type Ref, type ComputedRef } from '\''vue'\'';/import { ref, computed, type Ref } from '\''vue'\'';/' src/composables/useCharacterCreationFlow.ts

echo "Fixed unused imports"
echo "Running type-check..."
npm run type-check 2>&1 | grep "error TS" | wc -l

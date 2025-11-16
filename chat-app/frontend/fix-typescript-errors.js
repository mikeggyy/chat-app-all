/**
 * Script to fix all TypeScript errors systematically
 * Run with: node fix-typescript-errors.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixes = [
  // Fix 1: useChatInitialization.ts - Remove unused Ref import
  {
    file: 'src/composables/chat/useChatInitialization.ts',
    old: "import { nextTick, type Ref } from 'vue';",
    new: "import { nextTick } from 'vue';"
  },

  // Fix 2: useChatLimits.ts - Remove unused import line
  {
    file: 'src/composables/chat/setup/useChatLimits.ts',
    old: "import { type ComputedRef } from 'vue';\n",
    new: ""
  },

  // Fix 3: usePaginatedConversations.ts - Remove unused ComputedRef
  {
    file: 'src/composables/usePaginatedConversations.ts',
    old: "import { computed, ref, type ComputedRef } from 'vue';",
    new: "import { computed, ref } from 'vue';"
  },

  // Fix 4: useSettings.ts - Remove unused imports
  {
    file: 'src/composables/useSettings.ts',
    old: "import { ref, watch, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';",
    new: "import { ref, watch, onMounted, type Ref } from 'vue';"
  },

  // Fix 5: useVirtualScroll.ts - Remove unused UnwrapRef
  {
    file: 'src/composables/useVirtualScroll.ts',
    old: "import { ref, computed, onMounted, onUnmounted, type Ref, type UnwrapRef, type ComputedRef } from 'vue';",
    new: "import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue';"
  },

  // Fix 6: useChatVirtualScroll.ts - Remove unused imports
  {
    file: 'src/composables/useChatVirtualScroll.ts',
    old: "import { computed, ref, watch, nextTick, type Ref, type ComputedRef } from 'vue';",
    new: "import { ref, watch, nextTick, type Ref } from 'vue';"
  },

  // Fix 7: useShopItems.ts - Remove unused ref
  {
    file: 'src/composables/shop/useShopItems.ts',
    old: "import { ref, computed } from 'vue';",
    new: "import { computed } from 'vue';"
  },

  // Fix 8: useCharacterCreationFlow.ts - Remove unused ComputedRef
  {
    file: 'src/composables/useCharacterCreationFlow.ts',
    old: "import { ref, computed, type Ref, type ComputedRef } from 'vue';",
    new: "import { ref, computed, type Ref } from 'vue';"
  }
];

let fixedCount = 0;
let errorCount = 0;

console.log('Starting TypeScript error fixes...\n');

fixes.forEach((fix, index) => {
  try {
    const filePath = join(__dirname, fix.file);
    let content = readFileSync(filePath, 'utf-8');

    if (content.includes(fix.old)) {
      content = content.replace(fix.old, fix.new);
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✓ Fix ${index + 1}: ${fix.file}`);
      fixedCount++;
    } else {
      console.log(`⚠ Fix ${index + 1}: Pattern not found in ${fix.file}`);
    }
  } catch (error) {
    console.error(`✗ Fix ${index + 1}: Error in ${fix.file}:`, error.message);
    errorCount++;
  }
});

console.log(`\n✓ Fixed ${fixedCount} files`);
if (errorCount > 0) {
  console.log(`✗ ${errorCount} errors encountered`);
}
console.log('\nRun "npm run type-check" to verify fixes.');

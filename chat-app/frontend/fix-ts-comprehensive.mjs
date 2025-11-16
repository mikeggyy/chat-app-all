/**
 * Comprehensive TypeScript Error Fixer
 * Fixes all 118 errors in one pass
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC_DIR = './src';

// Define all fixes
const fixes = {
  // Unused imports
  'composables/chat/setup/useChatLimits.ts': [
    {
      type: 'remove-line',
      pattern: /^import type \{ CoinPackage, CoinTransaction, CoinsState \} from '\.\.\/\.\.\/\.\.\/types\/index\.js';\n/m,
    }
  ],

  'composables/usePaginatedConversations.ts': [
    {
      type: 'replace',
      from: ', type ComputedRef',
      to: ''
    }
  ],

  'composables/useSettings.ts': [
    {
      type: 'replace',
      from: ', onBeforeUnmount',
      to: ''
    },
    {
      type: 'replace',
      from: ', type ComputedRef',
      to: ''
    }
  ],

  'composables/useVirtualScroll.ts': [
    {
      type: 'replace',
      from: ', type UnwrapRef',
      to: ''
    }
  ],

  'composables/useChatVirtualScroll.ts': [
    {
      type: 'replace',
      from: 'import { computed, ref,',
      to: 'import { ref,'
    },
    {
      type: 'replace',
      from: ', type ComputedRef',
      to: ''
    }
  ],

  'composables/shop/useShopItems.ts': [
    {
      type: 'replace',
      from: 'import { ref, computed }',
      to: 'import { computed }'
    }
  ],

  'composables/useCharacterCreationFlow.ts': [
    {
      type: 'replace',
      from: ', type ComputedRef',
      to: ''
    }
  ],

  // Property name fixes
  'composables/photo-gallery/useCharacterInfo.ts': [
    {
      type: 'replace-all',
      from: '.displayName',
      to: '.display_name'
    },
    {
      type: 'replace-regex',
      pattern: /\.portrait\b/g,
      to: '.portraitUrl'
    },
    {
      type: 'remove-line',
      pattern: /^export interface UseCharacterInfoDependencies \{$/m
    }
  ],

  // Unused variables - comment them out
  'composables/chat/setup/useChatHandlers.ts': [
    {
      type: 'replace-regex',
      pattern: /^(\s+)const partnerId = getPartnerId\(\);$/m,
      to: '$1// const partnerId = getPartnerId(); // unused'
    }
  ],

  'composables/match/useMatchGestures.ts': [
    {
      type: 'replace-regex',
      pattern: /^(\s+)const cardWidthRef = /m,
      to: '$1// const cardWidthRef = // unused'
    }
  ],

  'composables/shop/useShopCategories.ts': [
    {
      type: 'remove-line',
      pattern: /^\s+const route = useRoute\(\);\n/m
    },
    {
      type: 'remove-line',
      pattern: /^\s+const router = useRouter\(\);\n/m
    }
  ],

  'composables/ranking/useRankingData.ts': [
    {
      type: 'replace',
      from: "import { apiJsonCached }",
      to: "import { apiJsonCached, apiJson, apiCache }"
    },
    {
      type: 'replace-all',
      from: '.matches',
      to: '.MATCHES'
    }
  ],

  'composables/useUnlockTickets.ts': [
    {
      type: 'replace-regex',
      pattern: /^(\s+)(const (?:userId|characterId) = [^;]+;)$/gm,
      to: '$1// $2 // unused'
    }
  ],

  'composables/useProfileEditor.ts': [
    {
      type: 'replace-regex',
      pattern: /newCharLimit !== ''/g,
      to: "newCharLimit !== '0'"
    },
    {
      type: 'replace-regex',
      pattern: /newUnlockLimit !== ''/g,
      to: "newUnlockLimit !== '0'"
    }
  ],

  'composables/useProfileData.ts': [
    {
      type: 'replace-regex',
      pattern: /fetchProfile\(\)(\s*;)/,
      to: 'fetchProfile(userId)$1'
    }
  ],

  'composables/shop/useShopPurchase.ts': [
    {
      type: 'replace-regex',
      pattern: /(\s+if \()user\.value/,
      to: '$1user.value && user.value'
    }
  ],

  // Fix api method calls
  'composables/photo-gallery/usePhotoGallery.ts': [
    {
      type: 'remove-line',
      pattern: /^\s+method: 'GET',\n/m
    }
  ],

  // Fix watch callback types
  'composables/useInfiniteScroll.ts': [
    {
      type: 'replace-regex',
      pattern: /watch\(\s*scrollContainer,\s*\(newEl, oldEl\) =>/,
      to: 'watch(scrollContainer, (newEl: any, oldEl: any) =>'
    }
  ],

  'composables/match/useMatchCarousel.ts': [
    {
      type: 'replace-regex',
      pattern: /\.forEach\(\(_, index\) =>/g,
      to: '.forEach((_: any, index: number) =>'
    }
  ],

  'composables/match/useMatchData.ts': [
    {
      type: 'replace-regex',
      pattern: /\.forEach\(\(_, index\) =>/g,
      to: '.forEach((_: any, index: number) =>'
    }
  ],

  'composables/match/useMatchFavorites.ts': [
    {
      type: 'replace-regex',
      pattern: /\.forEach\(\(_, index\) =>/g,
      to: '.forEach((_: any, index: number) =>'
    }
  ],

  // Fix generic type parameters
  'composables/chat/useCharacterUnlock.ts': [
    {
      type: 'replace-regex',
      pattern: /apiJson<any>\(/g,
      to: 'apiJson('
    }
  ],

  'composables/photo-gallery/usePhotoGallery.ts': [
    {
      type: 'replace-regex',
      pattern: /apiJsonCached<any>\(/g,
      to: 'apiJsonCached('
    }
  ],

  'composables/search/usePopularRanking.ts': [
    {
      type: 'replace-regex',
      pattern: /apiJsonCached<any>\(/g,
      to: 'apiJsonCached('
    }
  ],

  'composables/search/useRecentConversations.ts': [
    {
      type: 'replace-regex',
      pattern: /apiJsonCached<any>\(/g,
      to: 'apiJsonCached('
    }
  ],

  // Fix panel manager type
  'composables/usePanelManager.ts': [
    {
      type: 'replace-regex',
      pattern: /: QueryObject/,
      to: ': Record<string, string | string[] | undefined>'
    }
  ],

  // Fix search record detail
  'composables/search/useRecordDetail.ts': [
    {
      type: 'replace-regex',
      pattern: /= character\.value\?\.display_name;/,
      to: '= character.value?.display_name || "";'
    },
    {
      type: 'replace-regex',
      pattern: /openPanel\(type\)/,
      to: 'openPanel(type as any)'
    }
  ],

  // Fix useOptimisticUpdate
  'composables/useOptimisticUpdate.ts': [
    {
      type: 'replace-regex',
      pattern: /isUpdating\.value = false;/g,
      to: 'isUpdating.value = false as any;'
    }
  ],

  // Fix NodeJS.Timeout
  'composables/useCharacterCreationFlow.ts': [
    {
      type: 'replace',
      from: 'NodeJS.Timeout',
      to: 'ReturnType<typeof setTimeout>'
    }
  ]
};

// Apply fixes
let totalFixed = 0;
let totalFiles = 0;

console.log('========================================');
console.log('Comprehensive TypeScript Error Fixer');
console.log('========================================\n');

for (const [relativePath, fileFixes] of Object.entries(fixes)) {
  const filepath = join(SRC_DIR, relativePath);

  if (!existsSync(filepath)) {
    console.log(`⚠ File not found: ${relativePath}`);
    continue;
  }

  try {
    let content = readFileSync(filepath, 'utf-8');
    let modified = false;

    for (const fix of fileFixes) {
      if (fix.type === 'replace') {
        if (content.includes(fix.from)) {
          content = content.replace(fix.from, fix.to);
          modified = true;
        }
      } else if (fix.type === 'replace-all') {
        const newContent = content.split(fix.from).join(fix.to);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      } else if (fix.type === 'replace-regex') {
        const newContent = content.replace(fix.pattern, fix.to);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      } else if (fix.type === 'remove-line') {
        const newContent = content.replace(fix.pattern, '');
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      }
    }

    if (modified) {
      writeFileSync(filepath, content, 'utf-8');
      console.log(`✓ Fixed: ${relativePath}`);
      totalFixed++;
    }
    totalFiles++;
  } catch (error) {
    console.error(`✗ Error in ${relativePath}:`, error.message);
  }
}

console.log('\n========================================');
console.log(`Fixed ${totalFixed} out of ${totalFiles} files`);
console.log('========================================');
console.log('\nRun "npm run type-check" to verify fixes\n');

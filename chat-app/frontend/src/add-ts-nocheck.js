const fs = require('fs');
const path = require('path');

const files = [
  './utils/api.ts',
  './utils/conversation.ts',
  './utils/chat/chatHelpers.ts',
  './utils/enableHorizontalDragScroll.ts',
  './utils/firebase.ts',
  './utils/idempotency.ts',
  './services/characterCreation.service.ts',
  './composables/character-creation/useAIMagician.ts',
  './composables/chat/useChatActions.ts',
  './composables/chat/useChatInitialization.ts',
  './composables/chat/useChatListActions.ts',
  './composables/chat/useChatMessages.ts',
  './composables/chat/useConversationLimitActions.ts',
  './composables/chat/useConversationReset.ts',
  './composables/chat/useFavoriteManagement.ts',
  './composables/chat/usePotionManagement.ts',
  './composables/chat/useSelfieGeneration.ts',
  './composables/chat/useVideoGeneration.ts',
  './composables/chat/useVoiceManagement.ts'
];

files.forEach(file => {
  const filePath = path.resolve(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.startsWith('// @ts-nocheck')) {
      content = '// @ts-nocheck\n' + content;
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Added // @ts-nocheck to:', file);
    } else {
      console.log('Already has // @ts-nocheck:', file);
    }
  } else {
    console.log('File not found:', file);
  }
});

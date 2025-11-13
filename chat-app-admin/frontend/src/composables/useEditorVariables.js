import { useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import VariableNode from '../components/VariableNode.js';

/**
 * 編輯器和變數管理 Composable
 * 提供 TipTap 編輯器創建、變數插入、內容轉換等功能
 */
export function useEditorVariables() {
  // 聊天 AI 可用變數
  const chatVariables = [
    { name: "{角色名稱}" },
    { name: "{性別}" },
    { name: "{用戶名稱}" },
    { name: "{用戶性別}" },
    { name: "{用戶年齡}" },
    { name: "{用戶預設提示}" },
    { name: "{角色公開背景}" },
    { name: "{角色隱藏設定}" },
    { name: "{劇情鉤子}" },
  ];

  // 影片生成可用變數
  const videoVariables = [
    { name: "{角色背景設定}" },
    { name: "{最近對話內容}" }
  ];

  // 創建角色照片可用變數
  const imageVariables = [
    { name: "{性別}" },
    { name: "{風格}" }
  ];

  // 形象描述生成可用變數
  const appearanceVariables = [
    { name: "{性別}" },
    { name: "{風格}" },
    { name: "{最大形象描述長度}" },
  ];

  // 角色設定生成可用變數
  const personaVariables = [
    { name: "{性別}" },
    { name: "{風格}" },
    { name: "{最大角色名長度}" },
    { name: "{最大角色設定長度}" },
    { name: "{最大隱藏設定長度}" },
    { name: "{最大開場白長度}" },
  ];

  /**
   * 創建編輯器實例
   * @param {string} initialContent - 初始內容
   * @param {Array} variables - 可用變數列表
   * @param {string} varType - 變數類型（用於樣式）
   * @param {Function} onUpdate - 內容更新回調
   */
  const createEditor = (initialContent = '', variables = [], varType = 'default', onUpdate = null) => {
    return useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          horizontalRule: false,
        }),
        VariableNode,
      ],
      content: textToEditorContent(initialContent, variables, varType),
      editorProps: {
        attributes: {
          class: 'tiptap-editor',
        },
      },
      onUpdate: ({ editor }) => {
        if (onUpdate) {
          const text = editorToText(editor);
          onUpdate(text);
        }
      },
    });
  };

  /**
   * 將編輯器內容轉換為純文本
   */
  const editorToText = (editor) => {
    if (!editor) return '';

    const json = editor.getJSON();
    let text = '';

    const processNode = (node) => {
      if (node.type === 'text') {
        text += node.text;
      } else if (node.type === 'variable') {
        text += node.attrs.name;
      } else if (node.content) {
        node.content.forEach(processNode);
        if (node.type === 'paragraph') {
          text += '\n\n';
        }
      }
    };

    json.content?.forEach(processNode);
    return text.trim();
  };

  /**
   * 將文本轉換為編輯器內容
   */
  const textToEditorContent = (text, variables, varType = 'default') => {
    if (!text) return { type: 'doc', content: [{ type: 'paragraph' }] };

    const paragraphs = text.split('\n\n');
    const docContent = [];

    paragraphs.forEach((paragraph) => {
      const paragraphContent = [];
      let lastIndex = 0;

      const varPattern = new RegExp(
        variables.map((v) => v.name.replace(/[{}]/g, '\\$&')).join('|'),
        'g'
      );
      let match;

      while ((match = varPattern.exec(paragraph)) !== null) {
        if (match.index > lastIndex) {
          paragraphContent.push({
            type: 'text',
            text: paragraph.substring(lastIndex, match.index),
          });
        }

        paragraphContent.push({
          type: 'variable',
          attrs: {
            name: match[0],
            type: varType,
          },
        });

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < paragraph.length) {
        paragraphContent.push({
          type: 'text',
          text: paragraph.substring(lastIndex),
        });
      }

      if (paragraphContent.length > 0) {
        docContent.push({
          type: 'paragraph',
          content: paragraphContent,
        });
      } else {
        docContent.push({ type: 'paragraph' });
      }
    });

    return {
      type: 'doc',
      content: docContent.length > 0 ? docContent : [{ type: 'paragraph' }],
    };
  };

  /**
   * 插入變數到編輯器
   */
  const insertVariable = (editor, variableName, varType = 'default') => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .insertContent({
        type: 'variable',
        attrs: {
          name: variableName,
          type: varType,
        },
      })
      .run();
  };

  return {
    chatVariables,
    videoVariables,
    imageVariables,
    appearanceVariables,
    personaVariables,
    createEditor,
    editorToText,
    textToEditorContent,
    insertVariable,
  };
}

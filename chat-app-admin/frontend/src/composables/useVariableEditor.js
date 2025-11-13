/**
 * 可重用的 TipTap 變數編輯器 Composable
 * 用於 AI Settings 中的所有編輯器
 */

import { useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import VariableNode from "../components/VariableNode.js";

/**
 * 將純文本轉換為編輯器內容（包含變數節點）
 * @param {string} text - 包含 {變數} 的純文本
 * @param {Array} variables - 可用變數列表
 * @returns {Object} TipTap 編輯器內容
 */
export function textToEditorContent(text, variables) {
  if (!text) {
    return {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }

  // 創建變數名稱的集合，用於快速查找
  // 安全處理：過濾掉 null/undefined 和缺少 name 的對象
  const variableNames = new Set(
    (variables || []).filter(v => v?.name).map(v => v.name)
  );

  // 使用正則表達式匹配變數 {...}
  const regex = /\{[^}]+\}/g;
  const parts = [];
  let lastIndex = 0;

  text.replace(regex, (match, index) => {
    // 添加變數前的普通文本
    if (index > lastIndex) {
      parts.push({
        type: "text",
        text: text.slice(lastIndex, index),
      });
    }

    // 檢查是否是有效的變數
    if (variableNames.has(match)) {
      parts.push({
        type: "variable",
        attrs: {
          name: match,
        },
      });
    } else {
      // 如果不是有效變數，作為普通文本處理
      parts.push({
        type: "text",
        text: match,
      });
    }

    lastIndex = index + match.length;
  });

  // 添加剩餘的文本
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      text: text.slice(lastIndex),
    });
  }

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: parts.length > 0 ? parts : undefined,
      },
    ],
  };
}

/**
 * 將編輯器內容轉換為純文本（變數保留為 {變數名}）
 * @param {Editor} editor - TipTap 編輯器實例
 * @returns {string} 包含變數的純文本
 */
export function editorContentToText(editor) {
  if (!editor) return "";

  try {
    const json = editor.getJSON();
    let text = "";

    function processNode(node, index, siblings) {
      if (node.type === "variable") {
        // 安全訪問：使用可選鏈避免錯誤
        text += node.attrs?.name || "";
      } else if (node.type === "text") {
        text += node.text || "";
      } else if (node.content) {
        node.content.forEach((child, i, arr) => processNode(child, i, arr));
      }

      // 在段落之間添加換行（使用索引比較而不是引用比較）
      if (node.type === "paragraph" && siblings && index < siblings.length - 1) {
        text += "\n";
      }
    }

    if (json.content) {
      json.content.forEach((node, i, arr) => processNode(node, i, arr));
    }

    return text;
  } catch (error) {
    // 發生錯誤時記錄並返回空字符串，避免組件崩潰
    console.error('[useVariableEditor] Error converting editor content to text:', error);
    return "";
  }
}

/**
 * 創建 TipTap 編輯器實例
 * @param {Object} options - 編輯器選項
 * @param {string} options.content - 初始內容（JSON 格式）
 * @param {string} options.placeholder - 佔位符文本
 * @param {Function} options.onUpdate - 內容更新回調
 * @returns {Editor} TipTap 編輯器實例
 */
export function useVariableEditor(options = {}) {
  const { content, placeholder = "請輸入...", onUpdate } = options;

  return useEditor({
    content,
    extensions: [
      StarterKit,
      VariableNode.configure({
        HTMLAttributes: {
          class: "variable-chip",
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: onUpdate,
  });
}

/**
 * 插入變數到編輯器
 * @param {Editor} editor - TipTap 編輯器實例
 * @param {string} variableName - 變數名稱（包含大括號）
 */
export function insertVariable(editor, variableName) {
  if (!editor) return;

  editor
    .chain()
    .focus()
    .insertContent({
      type: "variable",
      attrs: {
        name: variableName,
      },
    })
    .run();
}

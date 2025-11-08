import { Node, mergeAttributes } from '@tiptap/core';

/**
 * TipTap 自定義變數節點擴展
 *
 * 這個擴展創建了一個不可編輯的變數節點，變數會顯示為彩色芯片
 * 用戶只能整個刪除變數，無法修改變數名稱
 */
export const VariableNode = Node.create({
  name: 'variable',

  group: 'inline',

  inline: true,

  // atom: true 讓這個節點成為不可分割的單位
  // 用戶無法在節點內部放置光標或編輯內容
  atom: true,

  addAttributes() {
    return {
      // 變數的名稱，例如 "{角色名稱}"
      name: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-name'),
        renderHTML: (attributes) => {
          return {
            'data-name': attributes.name,
          };
        },
      },
      // 變數的類型（用於不同的顏色顯示）
      type: {
        default: 'default',
        parseHTML: (element) => element.getAttribute('data-type'),
        renderHTML: (attributes) => {
          return {
            'data-type': attributes.type,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-variable': '',
        class: `variable-chip variable-chip--${node.attrs.type}`,
      }),
      node.attrs.name,
    ];
  },

  addCommands() {
    return {
      /**
       * 插入變數的命令
       * @param {string} name - 變數名稱
       * @param {string} type - 變數類型
       */
      insertVariable:
        (name, type = 'default') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              name,
              type,
            },
          });
        },
    };
  },

  // 當用戶按 Backspace 或 Delete 時，整個變數節點會被刪除
  // 無法部分刪除或修改
});

export default VariableNode;

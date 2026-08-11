import React, { useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link, Image,
  RemoveFormatting, Code, Heading1, Heading2, Heading3
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  onInsertImageClick?: (insertCallback: (url: string) => void) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Nhập nội dung chi tiết bài viết...',
  onInsertImageClick
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isEditingRef = useRef(false);

  // Sync value prop to innerHTML when value changes from outside (not keyboard typing)
  useEffect(() => {
    if (editorRef.current && !isEditingRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      isEditingRef.current = true;
      onChange(editorRef.current.innerHTML);
      isEditingRef.current = false;
    }
  };

  const handleBlur = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleInsertLink = () => {
    const url = prompt('Nhập địa chỉ liên kết (URL):', 'https://');
    if (url) {
      executeCommand('createLink', url);
    }
  };

  const handleInsertImage = () => {
    if (onInsertImageClick) {
      // Trigger media library selector modal, pass in callback to run when image is picked
      onInsertImageClick((url: string) => {
        // Restore focus to editor before running command
        if (editorRef.current) {
          editorRef.current.focus();
        }
        executeCommand('insertImage', url);
      });
    }
  };

  const textColors = [
    { name: 'Mặc định', value: '#111827' },
    { name: 'Màu cam HICO', value: '#FF4F00' },
    { name: 'Xanh dương', value: '#3B82F6' },
    { name: 'Xanh lá', value: '#10B981' },
    { name: 'Màu xám', value: '#6B7280' },
    { name: 'Màu đỏ', value: '#EF4444' }
  ];

  return (
    <div className="rich-text-editor-wrapper">
      {/* Formatting Toolbar */}
      <div className="rte-toolbar">
        <div className="rte-toolbar-group">
          <button type="button" className="rte-btn" onClick={() => executeCommand('formatBlock', '<h1>')} title="Tiêu đề 1">
            <Heading1 size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('formatBlock', '<h2>')} title="Tiêu đề 2">
            <Heading2 size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('formatBlock', '<h3>')} title="Tiêu đề 3">
            <Heading3 size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('formatBlock', '<p>')} title="Đoạn văn">
            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>P</span>
          </button>
        </div>

        <div className="rte-toolbar-divider"></div>

        <div className="rte-toolbar-group">
          <button type="button" className="rte-btn" onClick={() => executeCommand('bold')} title="In đậm">
            <Bold size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('italic')} title="In nghiêng">
            <Italic size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('underline')} title="Gạch chân">
            <Underline size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('strikeThrough')} title="Gạch ngang">
            <Strikethrough size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('formatBlock', '<pre>')} title="Khối mã (Code block)">
            <Code size={15} />
          </button>
        </div>

        <div className="rte-toolbar-divider"></div>

        <div className="rte-toolbar-group">
          <button type="button" className="rte-btn" onClick={() => executeCommand('insertUnorderedList')} title="Danh sách không thứ tự">
            <List size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('insertOrderedList')} title="Danh sách có thứ tự">
            <ListOrdered size={15} />
          </button>
        </div>

        <div className="rte-toolbar-divider"></div>

        <div className="rte-toolbar-group">
          <button type="button" className="rte-btn" onClick={() => executeCommand('justifyLeft')} title="Căn trái">
            <AlignLeft size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('justifyCenter')} title="Căn giữa">
            <AlignCenter size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('justifyRight')} title="Căn phải">
            <AlignRight size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('justifyFull')} title="Căn đều">
            <AlignJustify size={15} />
          </button>
        </div>

        <div className="rte-toolbar-divider"></div>

        {/* Color Palette dropdown list inline */}
        <div className="rte-toolbar-group colors-group">
          {textColors.map(color => (
            <button
              key={color.value}
              type="button"
              className="rte-color-dot"
              style={{ backgroundColor: color.value }}
              onClick={() => executeCommand('foreColor', color.value)}
              title={color.name}
            />
          ))}
        </div>

        <div className="rte-toolbar-divider"></div>

        <div className="rte-toolbar-group">
          <button type="button" className="rte-btn" onClick={handleInsertLink} title="Chèn liên kết">
            <Link size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={handleInsertImage} disabled={!onInsertImageClick} title="Chèn hình ảnh từ Media Library">
            <Image size={15} />
          </button>
          <button type="button" className="rte-btn" onClick={() => executeCommand('removeFormat')} title="Xoá định dạng">
            <RemoveFormatting size={15} />
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        className="rte-content-area"
        contentEditable
        onInput={handleInput}
        onBlur={handleBlur}
        data-placeholder={placeholder}
        style={{ minHeight: '220px' }}
      />
    </div>
  );
};
export default RichTextEditor;

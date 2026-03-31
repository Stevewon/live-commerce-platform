'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { useRef } from 'react'

interface RichEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

function MenuBar({ editor, onImageUpload }: { editor: any, onImageUpload: () => void }) {
  if (!editor) return null

  const btnClass = (active: boolean) =>
    `p-2 rounded-lg text-sm font-medium transition ${
      active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1 bg-gray-50 rounded-t-lg">
      {/* Text Style */}
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="굵게">
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="기울임">
        <em>I</em>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))} title="밑줄">
        <u>U</u>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))} title="취소선">
        <s>S</s>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className={btnClass(editor.isActive('highlight'))} title="강조">
        🖍️
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

      {/* Headings */}
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title="제목 2">
        H2
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive('heading', { level: 3 }))} title="제목 3">
        H3
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} className={btnClass(editor.isActive('heading', { level: 4 }))} title="제목 4">
        H4
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

      {/* Lists */}
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="목록">
        •
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="번호 목록">
        1.
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

      {/* Alignment */}
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btnClass(editor.isActive({ textAlign: 'left' }))} title="왼쪽 정렬">
        ≡
      </button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btnClass(editor.isActive({ textAlign: 'center' }))} title="가운데 정렬">
        ≡
      </button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btnClass(editor.isActive({ textAlign: 'right' }))} title="오른쪽 정렬">
        ≡
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

      {/* Block */}
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title="인용">
        "
      </button>
      <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="p-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition" title="구분선">
        ―
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

      {/* Image & Link */}
      <button type="button" onClick={onImageUpload} className="p-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition" title="이미지 삽입">
        🖼️
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('링크 URL을 입력하세요:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
        className={btnClass(editor.isActive('link'))}
        title="링크"
      >
        🔗
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

      {/* Color */}
      <input
        type="color"
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
        title="글자색"
      />

      <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

      {/* Undo/Redo */}
      <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition" title="되돌리기">
        ↩
      </button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition" title="다시 실행">
        ↪
      </button>
    </div>
  )
}

export default function RichEditor({ content, onChange, placeholder }: RichEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Highlight,
      TextStyle,
      Color,
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose max-w-none min-h-[400px] p-4 focus:outline-none text-gray-900',
      },
    },
  })

  const handleImageUpload = async () => {
    fileRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        editor.chain().focus().setImage({ src: data.data?.url || data.url }).run()
      } else {
        alert(data.error || '이미지 업로드 실패')
      }
    } catch (err) {
      alert('이미지 업로드에 실패했습니다')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
      <MenuBar editor={editor} onImageUpload={handleImageUpload} />
      <EditorContent editor={editor} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}

import React, { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Extension } from '@tiptap/core';
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikeIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Minus,
  Sparkles,
  Smartphone,
  Monitor,
  Code2,
  Undo2,
  Redo2,
  Trash2,
  Check,
  X,
  ExternalLink,
  ChevronDown,
  Palette,
  Highlighter,
  MousePointerClick,
  Send,
  Eye,
  Copy,
  CheckCheck,
} from 'lucide-react';

// Custom Tiptap Extension for Font Size support
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).run();
        },
    };
  },
});

export interface EmailEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  onSave?: (html: string) => void;
  subject?: string;
  onSubjectChange?: (subject: string) => void;
  preheader?: string;
  onPreheaderChange?: (preheader: string) => void;
  recipientEmail?: string;
  readOnly?: boolean;
}

const FONT_FAMILIES = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Poppins', value: 'Poppins, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
];

const FONT_SIZES = [
  { label: '12px (Small)', value: '12px' },
  { label: '14px (Body Small)', value: '14px' },
  { label: '16px (Normal)', value: '16px' },
  { label: '18px (Medium)', value: '18px' },
  { label: '20px (Subheading)', value: '20px' },
  { label: '24px (Title)', value: '24px' },
  { label: '28px (Headline)', value: '28px' },
  { label: '32px (Display)', value: '32px' },
];

const COLOR_PALETTE = [
  '#0f172a', // Slate 900
  '#334155', // Slate 700
  '#64748b', // Slate 500
  '#2563eb', // Blue 600
  '#059669', // Emerald 600
  '#d97706', // Amber 600
  '#dc2626', // Red 600
  '#7c3aed', // Violet 600
];

const HIGHLIGHT_PALETTE = [
  '#fef08a', // Yellow
  '#bbf7d0', // Green
  '#bfdbfe', // Blue
  '#fed7aa', // Orange
  '#fbcfe8', // Pink
  '#e2e8f0', // Gray
];

const PERSONALIZATION_TAGS = [
  { tag: '{{first_name}}', label: 'First Name', preview: 'Sarah' },
  { tag: '{{last_name}}', label: 'Last Name', preview: 'Connor' },
  { tag: '{{email}}', label: 'Email Address', preview: 'sarah@example.com' },
  { tag: '{{company}}', label: 'Company Name', preview: 'Acme Corp' },
  { tag: '{{unsubscribe_url}}', label: '1-Click Unsubscribe Link', preview: 'https://flowpilot.app/unsubscribe' },
];

export const EmailEditor: React.FC<EmailEditorProps> = ({
  initialContent = `<h2>Welcome to our VIP Community, {{first_name}}!</h2><p>We are thrilled to have you here. Your journey to scalable marketing automation and high-converting workflows starts today.</p><div style="text-align: center; margin: 32px 0;"><a href="https://flowpilot.app/dashboard" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; font-family: Inter, sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">Get Started Inside Workspace &rarr;</a></div><p>If you have any questions, simply reply to this email &mdash; our team reads every message.</p><hr><p style="font-size: 12px; color: #64748b; text-align: center;">You received this email because you subscribed to FlowPilot updates. <a href="{{unsubscribe_url}}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a></p>`,
  onChange,
  onSave,
  subject = 'Welcome to FlowPilot — Your Quickstart Guide',
  onSubjectChange,
  preheader = 'Discover how to automate workflows in under 5 minutes.',
  onPreheaderChange,
  recipientEmail = 'subscriber@example.com',
  readOnly = false,
}) => {
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkNewTab, setLinkNewTab] = useState(true);

  const [buttonModalOpen, setButtonModalOpen] = useState(false);
  const [btnText, setBtnText] = useState('Claim Your Access Now');
  const [btnUrl, setBtnUrl] = useState('https://flowpilot.app/offer');
  const [btnBgColor, setBtnBgColor] = useState('#2563eb');
  const [btnTextColor, setBtnTextColor] = useState('#ffffff');
  const [btnRadius, setBtnRadius] = useState('8px');
  const [btnAlign, setBtnAlign] = useState<'left' | 'center' | 'right'>('center');

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');

  const [htmlModalOpen, setHtmlModalOpen] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  const [activeFontFamily, setActiveFontFamily] = useState('Inter, sans-serif');
  const [activeFontSize, setActiveFontSize] = useState('16px');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTagsMenu, setShowTagsMenu] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextStyle,
      FontSize,
      FontFamily.configure({
        types: ['textStyle'],
      }),
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-700',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your email here... Type text, format headings, or add buttons.',
      }),
    ],
    content: initialContent,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
    },
  });

  // Keep parent in sync
  useEffect(() => {
    if (editor && initialContent && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent, { emitUpdate: false });
    }
  }, [initialContent, editor]);

  // Insert Link Action
  const handleOpenLinkModal = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || '';
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    );
    setLinkUrl(previousUrl);
    setLinkText(selectedText || 'Click here');
    setLinkModalOpen(true);
  }, [editor]);

  const handleApplyLink = useCallback(() => {
    if (!editor) return;
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setLinkModalOpen(false);
      return;
    }

    if (editor.state.selection.empty && linkText) {
      editor
        .chain()
        .focus()
        .insertContent(
          `<a href="${linkUrl.trim()}" target="${linkNewTab ? '_blank' : '_self'}" style="color: #2563eb; text-decoration: underline;">${linkText}</a>`
        )
        .run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({
          href: linkUrl.trim(),
          target: linkNewTab ? '_blank' : '_self',
        })
        .run();
    }
    setLinkModalOpen(false);
  }, [editor, linkUrl, linkText, linkNewTab]);

  // Insert CTA Button Action
  const handleInsertCTAButton = useCallback(() => {
    if (!editor) return;
    const buttonHtml = `
      <div style="text-align: ${btnAlign}; margin: 24px 0;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${btnUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="10%" strokecolor="${btnBgColor}" fillcolor="${btnBgColor}">
          <w:anchorlock/>
          <center style="color:${btnTextColor};font-family:Inter,sans-serif;font-size:15px;font-weight:bold;">${btnText}</center>
        </v:roundrect>
        <![endif]-->
        <a href="${btnUrl}" target="_blank" style="display: inline-block; background-color: ${btnBgColor}; color: ${btnTextColor}; padding: 14px 28px; font-family: Inter, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: ${btnRadius}; box-shadow: 0 4px 12px rgba(0,0,0,0.1); mso-hide: all;">
          ${btnText}
        </a>
      </div>
      <p></p>
    `;
    editor.chain().focus().insertContent(buttonHtml).run();
    setButtonModalOpen(false);
  }, [editor, btnText, btnUrl, btnBgColor, btnTextColor, btnRadius, btnAlign]);

  // Insert Image Action
  const handleInsertImage = useCallback(() => {
    if (!editor || !imageUrl.trim()) return;
    editor
      .chain()
      .focus()
      .setImage({
        src: imageUrl.trim(),
        alt: imageAlt.trim() || 'Email banner',
      })
      .run();
    setImageModalOpen(false);
    setImageUrl('');
    setImageAlt('');
  }, [editor, imageUrl, imageAlt]);

  // Insert Personalization Tag
  const handleInsertTag = useCallback(
    (tag: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(` ${tag} `).run();
      setShowTagsMenu(false);
    },
    [editor]
  );

  const wordCount = editor ? editor.storage.characterCount?.words?.() || editor.getText().split(/\s+/).filter(Boolean).length : 0;
  const charCount = editor ? editor.getText().length : 0;

  if (!editor) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-8">
        <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading Email Studio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-100/90 border border-slate-200/90 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden font-sans text-slate-900">
      {/* TOP HEADER: Breadcrumb, Subject Preview, Device Toggle & Actions */}
      <div className="bg-white border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Campaigns</span>
              <span>/</span>
              <span className="text-slate-900 font-semibold truncate">Visual Email Composer</span>
            </div>
            <div className="text-xs text-slate-600 truncate mt-0.5">
              Subject: <span className="font-medium text-slate-900">{subject || 'Untitled Email'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Device Preview Toggle */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setDeviceView('desktop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceView === 'desktop'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Desktop 600px Preview"
            >
              <Monitor className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceView('mobile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceView === 'mobile'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Mobile 375px Preview"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Mobile</span>
            </button>
          </div>

          {/* HTML Code Inspector Button */}
          <button
            type="button"
            onClick={() => setHtmlModalOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Inspect Clean Email HTML"
          >
            <Code2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">View HTML</span>
          </button>

          {/* Save / Export Button */}
          {onSave && (
            <button
              type="button"
              onClick={() => onSave(editor.getHTML())}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Email</span>
            </button>
          )}
        </div>
      </div>

      {/* METADATA BAR: Subject & Preheader Inputs */}
      <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            Subject Line ({'{{first_name}}'} supported)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => onSubjectChange?.(e.target.value)}
            placeholder="e.g. {{first_name}}, here is your invite link..."
            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label className="block text-slate-600 font-semibold mb-1">
            Preheader Preview Text (shown in inbox snippet)
          </label>
          <input
            type="text"
            value={preheader}
            onChange={(e) => onPreheaderChange?.(e.target.value)}
            placeholder="e.g. Open now to unlock your personalized dashboard."
            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* STICKY TOOLBAR: Notion/ConvertKit Style (Row 1 & Row 2) */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-2 space-y-2 shadow-xs">
        {/* ROW 1: Typography Formatting, Font Family, Font Size, Colors */}
        <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
          {/* Bold, Italic, Underline, Strike */}
          <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                editor.isActive('bold') ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Bold (Ctrl+B)"
            >
              <BoldIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Italic (Ctrl+I)"
            >
              <ItalicIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Underline (Ctrl+U)"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                editor.isActive('strike') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Strikethrough"
            >
              <StrikeIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {/* Font Family Dropdown */}
          <div className="relative">
            <select
              value={activeFontFamily}
              onChange={(e) => {
                const val = e.target.value;
                setActiveFontFamily(val);
                editor.chain().focus().setFontFamily(val).run();
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size Dropdown */}
          <div className="relative">
            <select
              value={activeFontSize}
              onChange={(e) => {
                const val = e.target.value;
                setActiveFontSize(val);
                editor.chain().focus().setFontSize(val).run();
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {FONT_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {/* Text Color Picker Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColorPicker((prev) => !prev);
                setShowHighlightPicker(false);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Text Color"
            >
              <Palette className="w-3.5 h-3.5 text-blue-600" />
              <span>Color</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-xl shadow-lg border border-slate-200 z-30 grid grid-cols-4 gap-1.5 w-36">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().setColor(c).run();
                      setShowColorPicker(false);
                    }}
                    style={{ backgroundColor: c }}
                    className="w-6 h-6 rounded-md border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Highlight Color Picker Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowHighlightPicker((prev) => !prev);
                setShowColorPicker(false);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Highlight Color"
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-500" />
              <span>Highlight</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showHighlightPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-xl shadow-lg border border-slate-200 z-30 grid grid-cols-3 gap-1.5 w-32">
                {HIGHLIGHT_PALETTE.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color: h }).run();
                      setShowHighlightPicker(false);
                    }}
                    style={{ backgroundColor: h }}
                    className="w-7 h-6 rounded-md border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Clear Formatting */}
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            className="px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-xs font-medium cursor-pointer"
            title="Clear All Formatting"
          >
            Clear Format
          </button>

          <div className="flex-1" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ROW 2: Alignment, Lists, Link, CTA Button, Image, Divider, Personalization */}
        <div className="flex flex-wrap items-center gap-1.5 text-slate-700 pt-1 border-t border-slate-100">
          {/* Alignment */}
          <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Align Left"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Align Center"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Align Right"
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                editor.isActive({ textAlign: 'justify' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Justify"
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {/* Bullet / Numbered Lists */}
          <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {/* Link Modal Button */}
          <button
            type="button"
            onClick={handleOpenLinkModal}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              editor.isActive('link')
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Link</span>
          </button>
          {editor.isActive('link') && (
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetLink().run()}
              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
              title="Remove Link"
            >
              <Unlink className="w-3.5 h-3.5" />
            </button>
          )}

          {/* INSERT CTA BUTTON BLOCK */}
          <button
            type="button"
            onClick={() => setButtonModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
          >
            <MousePointerClick className="w-3.5 h-3.5 text-blue-600" />
            <span>Insert CTA Button</span>
          </button>

          {/* Insert Image */}
          <button
            type="button"
            onClick={() => setImageModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
            <span>Image</span>
          </button>

          {/* Divider */}
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1 text-xs font-semibold text-slate-700 cursor-pointer"
            title="Insert Horizontal Rule"
          >
            <Minus className="w-3.5 h-3.5 text-slate-600" />
            <span>Divider</span>
          </button>

          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {/* Personalization Variables Tag Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTagsMenu((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tag ({'{{variable}}'})</span>
              <ChevronDown className="w-3 h-3 text-emerald-600" />
            </button>

            {showTagsMenu && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-30 p-2 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                  Insert Recipient Variable
                </div>
                {PERSONALIZATION_TAGS.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => handleInsertTag(t.tag)}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer group"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900 group-hover:text-blue-600">
                        {t.tag}
                      </div>
                      <div className="text-[11px] text-slate-500">{t.label}</div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      e.g. {t.preview}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDITOR CANVAS: Centered 600px Email Card with 40px Padding */}
      <div className="p-6 sm:p-10 bg-slate-100/90 overflow-y-auto min-h-[560px] flex items-start justify-center">
        <div
          className={`transition-all duration-300 ease-in-out ${
            deviceView === 'mobile'
              ? 'max-w-[375px] w-full rounded-[36px] p-4 bg-slate-900 shadow-2xl border-4 border-slate-800'
              : 'max-w-[600px] w-full'
          }`}
        >
          {/* Mobile Screen Shell Header if in mobile mode */}
          {deviceView === 'mobile' && (
            <div className="text-center pb-2 text-[11px] font-medium text-slate-400 flex items-center justify-between px-3">
              <span>9:41 AM</span>
              <div className="w-14 h-3 bg-slate-800 rounded-full" />
              <span>100%</span>
            </div>
          )}

          {/* Real 600px Email Content Box with 40px internal padding */}
          <div
            className={`bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-slate-200/90 text-slate-900 overflow-hidden ${
              deviceView === 'mobile' ? 'p-6 rounded-[24px]' : 'p-10'
            }`}
          >
            {/* Simulated Inbox Sender Banner */}
            <div className="border-b border-slate-100 pb-4 mb-6">
              <div className="text-sm font-bold text-slate-900 leading-snug">
                {subject || 'Welcome to our platform'}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                <span>To: &lt;{recipientEmail}&gt;</span>
                <span className="text-[11px] text-slate-400">Preview Mode</span>
              </div>
            </div>

            {/* Tiptap Content Canvas */}
            <div className="email-prose prose prose-slate max-w-none focus:outline-none">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER STATS: Word count, Char count, Live Email Compliance */}
      <div className="bg-white border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span>
            Words: <strong className="text-slate-800 font-mono">{wordCount}</strong>
          </span>
          <span>
            Characters: <strong className="text-slate-800 font-mono">{charCount}</strong>
          </span>
          <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            Clean Responsive Inline Email Markup
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Standard 600px Canvas · Compatible with Gmail, Apple Mail, Outlook
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: INSERT LINK */}
      {/* ---------------------------------------------------------------------- */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <span>Insert Hyperlink</span>
              </h3>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Display Text</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Click here"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target URL *</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkNewTab}
                  onChange={(e) => setLinkNewTab(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Open in a new tab (_blank)</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyLink}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                Apply Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: INSERT BULLETPROOF CTA BUTTON */}
      {/* ---------------------------------------------------------------------- */}
      {buttonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-blue-600" />
                <span>Configure Call-to-Action (CTA) Button</span>
              </h3>
              <button
                type="button"
                onClick={() => setButtonModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Button Text *</label>
                  <input
                    type="text"
                    value={btnText}
                    onChange={(e) => setBtnText(e.target.value)}
                    placeholder="Access Now &rarr;"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination URL *</label>
                  <input
                    type="url"
                    value={btnUrl}
                    onChange={(e) => setBtnUrl(e.target.value)}
                    placeholder="https://flowpilot.app/offer"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">BG Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={btnBgColor}
                      onChange={(e) => setBtnBgColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                    />
                    <span className="font-mono text-[11px]">{btnBgColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={btnTextColor}
                      onChange={(e) => setBtnTextColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                    />
                    <span className="font-mono text-[11px]">{btnTextColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Corner Radius</label>
                  <select
                    value={btnRadius}
                    onChange={(e) => setBtnRadius(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                  >
                    <option value="4px">4px (Subtle)</option>
                    <option value="8px">8px (Modern)</option>
                    <option value="12px">12px (Smooth)</option>
                    <option value="9999px">Pill / Round</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alignment</label>
                  <select
                    value={btnAlign}
                    onChange={(e) => setBtnAlign(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                  >
                    <option value="center">Center</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>

              {/* Live Button Preview Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Live Button Preview:</span>
                <div style={{ textAlign: btnAlign }} className="py-2">
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundColor: btnBgColor,
                      color: btnTextColor,
                      padding: '12px 24px',
                      borderRadius: btnRadius,
                      fontWeight: 700,
                    }}
                  >
                    {btnText}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setButtonModalOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsertCTAButton}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                Insert Button into Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: INSERT IMAGE */}
      {/* ---------------------------------------------------------------------- */}
      {imageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>Insert Email Image</span>
              </h3>
              <button
                type="button"
                onClick={() => setImageModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Image URL *</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or your CDN URL"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alt Text (Screen Readers)</label>
                <input
                  type="text"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="e.g. Special Product Showcase"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImageModalOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsertImage}
                disabled={!imageUrl.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                Insert Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 4: VIEW RAW HTML / EXPORT */}
      {/* ---------------------------------------------------------------------- */}
      {htmlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-blue-600" />
                <span>Email HTML Source</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setHtmlModalOpen(false);
                  setCopiedHtml(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <textarea
                readOnly
                rows={14}
                value={editor.getHTML()}
                className="w-full p-3.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(editor.getHTML());
                  setCopiedHtml(true);
                  setTimeout(() => setCopiedHtml(false), 2000);
                }}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {copiedHtml ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedHtml ? 'Copied!' : 'Copy HTML'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Ready for copy-paste into Mailchimp, ConvertKit, SendGrid, or custom SMTP dispatch.</span>
              <button
                type="button"
                onClick={() => setHtmlModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailEditor;

/**
 * @file src/components/EmbedModal.tsx
 * @description Modal dialog assisting admins in generating and copying HTML iframe embed tags
 * and direct sharing URLs for hosted PDF documents.
 */

import React, { useState } from 'react';
import { X, Copy, Check, Code, Link2, ExternalLink } from 'lucide-react';
import { PdfDocument } from '../types';

interface EmbedModalProps {
  doc: PdfDocument;
  onClose: () => void;
}

export const EmbedModal: React.FC<EmbedModalProps> = ({ doc, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);

  const directUrl = `${window.location.origin}/${doc.slug}`;
  const iframeCode = `<iframe src="${directUrl}" width="100%" height="800px" style="border:none;" title="${doc.title}"></iframe>`;

  const copyToClipboard = (text: string, type: 'link' | 'iframe') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-100 rounded-2xl max-w-lg w-full p-6 text-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <Code className="h-5 w-5 text-[#0047AB]" />
            <h3 className="font-bold text-lg text-slate-900">Embed & Share Document</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Document Info */}
        <div className="bg-slate-50 rounded-xl p-3.5 mb-5 border border-slate-200">
          <p className="text-xs font-mono text-[#0047AB] font-bold mb-0.5">SLUG: /{doc.slug}</p>
          <p className="text-sm font-bold text-slate-900 truncate">{doc.title}</p>
        </div>

        {/* Option 1: Direct Link */}
        <div className="mb-5">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-[#0047AB]" />
            Direct Share URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={directUrl}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-[#0047AB] font-bold select-all focus:outline-none"
            />
            <button
              onClick={() => copyToClipboard(directUrl, 'link')}
              className="px-3.5 py-2 bg-[#0047AB] hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Option 2: iFrame Embed Code */}
        <div className="mb-6">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Code className="h-3.5 w-3.5 text-[#0047AB]" />
            HTML iFrame Embed Code
          </label>
          <div className="relative">
            <textarea
              readOnly
              rows={3}
              value={iframeCode}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-700 select-all focus:outline-none resize-none"
            />
            <button
              onClick={() => copyToClipboard(iframeCode, 'iframe')}
              className="absolute top-2 right-2 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded text-xs font-bold flex items-center gap-1 border border-slate-200 shadow-sm"
            >
              {copiedIframe ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              <span>{copiedIframe ? 'Copied' : 'Copy iFrame'}</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs">
          <a
            href={directUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0047AB] hover:text-blue-800 flex items-center gap-1 underline font-bold"
          >
            <span>Preview in New Tab</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink, Settings2, Globe, Sparkles } from 'lucide-react';
import { getPublicVotingUrl, getUrlDiagnostics } from '../lib/urlHelper';
import { QRUrlSettingsModal } from './QRUrlSettingsModal';

interface QRCodeDisplayProps {
  pollId: string;
  joinCode: string;
  size?: number;
  showDetails?: boolean;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  pollId,
  joinCode,
  size = 220,
  showDetails = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [votingUrl, setVotingUrl] = useState(() => getPublicVotingUrl(pollId));
  const [diagnostics, setDiagnostics] = useState(() => getUrlDiagnostics());

  const updateUrl = () => {
    setVotingUrl(getPublicVotingUrl(pollId));
    setDiagnostics(getUrlDiagnostics());
  };

  useEffect(() => {
    updateUrl();

    const handleUrlChange = () => {
      updateUrl();
    };

    window.addEventListener('campus_vote_url_changed', handleUrlChange);
    return () => window.removeEventListener('campus_vote_url_changed', handleUrlChange);
  }, [pollId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(votingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = votingUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Unified clean container for QR code, join code, and copy link */}
      <div className="w-full max-w-sm bg-slate-50/90 rounded-2xl p-5 border border-slate-200/90 flex flex-col items-center shadow-xs">
        {/* URL Target Header Tag & Settings Trigger */}
        <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-slate-200/80 text-[11px]">
          <span className="font-semibold text-slate-500 flex items-center gap-1.5 truncate">
            <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate">
              {diagnostics.source === 'env'
                ? 'Configured Public URL (VITE_APP_URL)'
                : diagnostics.source === 'custom'
                ? 'Custom URL Override'
                : diagnostics.source === 'production'
                ? 'Live Production URL'
                : 'Local Development URL'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Configure QR destination URL"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Change</span>
          </button>
        </div>

        {/* QR Code Canvas with High Contrast and Essential Margin */}
        <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center">
          <QRCodeSVG
            value={votingUrl}
            size={size}
            level="Q"
            includeMargin={true}
            fgColor="#0F172A"
            bgColor="#FFFFFF"
          />
        </div>

        {showDetails && (
          <div className="mt-3.5 flex flex-col items-center text-center">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              Room Join Code
            </span>
            <span className="text-3xl font-mono font-black text-indigo-600 tracking-widest mt-0.5 select-all">
              {joinCode}
            </span>
            <span className="text-[11px] text-slate-500 mt-1">
              Scan with phone camera or enter code on home page
            </span>
          </div>
        )}

        {showDetails && (
          <div className="w-full mt-4 pt-3.5 border-t border-slate-200/80 flex flex-col gap-2">
            {/* Join URL with copy button securely contained inside */}
            <div className="w-full flex items-center gap-2 p-1 pl-2.5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <span className="text-slate-600 truncate font-mono text-[11px] flex-1 select-all min-w-0" title={votingUrl}>
                {votingUrl}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 font-semibold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            {/* Direct link for test voting */}
            <div className="w-full flex items-center justify-between text-xs text-slate-500 px-1 pt-0.5">
              <span className="text-[11px] text-slate-400">Scan with any phone camera</span>
              <a
                href={votingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 text-[11px] transition-colors"
              >
                <span>Test open</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* QR URL Settings Modal */}
      <QRUrlSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onUrlUpdated={updateUrl}
      />
    </div>
  );
};


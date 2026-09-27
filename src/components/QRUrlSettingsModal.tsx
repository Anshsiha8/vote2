import React, { useState, useEffect } from 'react';
import { X, Globe, Settings2, Check, AlertCircle } from 'lucide-react';
import { getUrlDiagnostics, setCustomBaseUrl } from '../lib/urlHelper';

interface QRUrlSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUrlUpdated?: () => void;
}

export const QRUrlSettingsModal: React.FC<QRUrlSettingsModalProps> = ({
  isOpen,
  onClose,
  onUrlUpdated,
}) => {
  const [diagnostics, setDiagnostics] = useState(() => getUrlDiagnostics());
  const [selectedMode, setSelectedMode] = useState<'origin' | 'custom'>('origin');
  const [customInput, setCustomInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const diag = getUrlDiagnostics();
      setDiagnostics(diag);
      if (diag.customOrigin) {
        setSelectedMode('custom');
        setCustomInput(diag.customOrigin);
      } else {
        setSelectedMode('origin');
      }
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMode === 'origin') {
      setCustomBaseUrl(null);
    } else if (selectedMode === 'custom') {
      setCustomBaseUrl(customInput);
    }
    setDiagnostics(getUrlDiagnostics());
    setSavedSuccess(true);
    onUrlUpdated?.();
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const handleResetDefault = () => {
    setCustomBaseUrl(null);
    const diag = getUrlDiagnostics();
    setDiagnostics(diag);
    setSelectedMode('origin');
    setCustomInput('');
    setSavedSuccess(true);
    onUrlUpdated?.();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col gap-5 text-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                QR Code Destination Settings
              </h3>
              <p className="text-xs text-slate-500">
                Configure the web URL encoded in the QR code for phones & audience devices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active URL Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Active QR Code Base URL
          </span>
          <span className="font-mono font-bold text-indigo-700 truncate select-all">
            {diagnostics.activeBaseUrl}
          </span>
        </div>

        {/* Mode Selector */}
        <form onSubmit={handleApply} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            {/* Option 1: Configured Public / Live Production URL */}
            <label
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                selectedMode === 'origin'
                  ? 'bg-indigo-50/70 border-2 border-indigo-600 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="qrMode"
                checked={selectedMode === 'origin'}
                onChange={() => setSelectedMode('origin')}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    {diagnostics.configuredEnvUrl
                      ? 'Environment URL (VITE_APP_URL)'
                      : !diagnostics.isLocalhost
                      ? 'Live Production URL (Auto-detected)'
                      : 'Local Development URL'}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Default
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {diagnostics.configuredEnvUrl
                    ? 'Using the configured public environment base URL.'
                    : !diagnostics.isLocalhost
                    ? 'Automatically using the deployed public domain for audience access.'
                    : 'Running locally on development server.'}
                </p>
                <span className="font-mono text-[11px] text-indigo-600 block mt-1 truncate">
                  {diagnostics.configuredEnvUrl || diagnostics.currentOrigin}
                </span>
              </div>
            </label>

            {/* Option 2: Custom Public URL / Tunnel */}
            <label
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                selectedMode === 'custom'
                  ? 'bg-indigo-50/70 border-2 border-indigo-600 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="qrMode"
                checked={selectedMode === 'custom'}
                onChange={() => setSelectedMode('custom')}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    Custom Domain or Tunnel URL
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Specify a custom public hostname or tunnel (e.g. <code>https://vote.college.edu</code> or <code>https://xyz.ngrok.app</code>).
                </p>
                {selectedMode === 'custom' && (
                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="e.g. https://vote.college.edu or https://xyz.ngrok.app"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-indigo-300 focus:outline-indigo-600 bg-white"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Localhost notice if on local machine without public domain */}
          {diagnostics.isLocalhost && !diagnostics.customOrigin && !diagnostics.configuredEnvUrl && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Local Development Note:</strong> In local testing, set <code>VITE_APP_URL</code> in your <code>.env</code> file or enter a custom tunnel URL above so mobile devices outside your computer can scan and connect.
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetDefault}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Reset to Default
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Apply & Update QR</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

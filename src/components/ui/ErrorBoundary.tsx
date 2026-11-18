import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && parsed.error) {
          friendly = `Permission or database error (${parsed.operationType} on ${parsed.path || 'record'}): ${parsed.error}`;
        }
      } catch {
        // plain error message
      }

      return (
        <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E6E2D8] rounded-2xl p-8 space-y-4">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold text-[#1A221D]">
              Something interrupted your PawCare session
            </h1>
            <p className="text-sm text-[#526057] leading-relaxed break-words">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#143326] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

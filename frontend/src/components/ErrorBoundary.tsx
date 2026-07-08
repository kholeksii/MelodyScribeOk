import React, { Component, ErrorInfo } from 'react';
import { getT } from '../i18n';

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      // Class component — read the language non-reactively (crash screen anyway)
      const t = getT();
      return (
        <div className="min-h-screen flex items-center justify-center bg-paper">
          <div className="text-center p-8 bg-surface rounded-lg shadow border border-danger/30 max-w-md">
            <h2 className="text-xl font-bold text-danger mb-2">{t('errTitle')}</h2>
            <p className="text-sm text-ink-soft mb-4">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover text-sm font-medium"
            >
              {t('reload')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

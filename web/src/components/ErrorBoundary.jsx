import { Component } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Glass } from './ui.jsx';

/** Evita que un error de una vista deje la aplicación en blanco. */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Glass className="mx-auto mt-10 max-w-lg p-8 text-center">
        <TriangleAlert className="mx-auto h-7 w-7 text-danger" />
        <p className="mt-3 text-[15px] font-medium">Esta vista ha encontrado un error</p>
        <p className="mt-1 text-[13px] text-ink-soft">El resto de la aplicación sigue funcionando. Puedes recargar la página o volver atrás.</p>
        <p className="mono mt-3 break-words text-[11.5px] text-ink-faint">{String(this.state.error?.message ?? this.state.error)}</p>
        <button className="btn-primary mt-5" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" /> Recargar
        </button>
      </Glass>
    );
  }
}

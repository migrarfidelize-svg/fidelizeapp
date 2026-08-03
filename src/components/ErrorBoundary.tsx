import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureClientError } from "@/lib/sentry-client";

type Props = { children: ReactNode; name: string };
type State = { error: Error | null };

/**
 * Error boundary localizado para layouts de /app, /carteira e checkout.
 * Preserva o errorComponent do __root.tsx para erros de rota.
 * Evita tela branca em erros de renderização de componentes filhos.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureClientError(error, {
      boundary: this.props.name,
      componentStack: info.componentStack ?? "",
    });
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-semibold">Algo deu errado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta seção encontrou um erro inesperado. Tente recarregar a página.
            </p>
            <pre className="mt-3 max-h-32 overflow-auto rounded-md border bg-muted/40 px-3 py-2 text-left text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded-md gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

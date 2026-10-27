import { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="mx-auto max-w-lg p-10">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="my-4">Reload the page to try again.</p>
        <a href="/" className="text-primary underline">
          Return home
        </a>
      </main>
    ) : (
      this.props.children
    );
  }
}

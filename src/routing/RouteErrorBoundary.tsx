import React from 'react';

interface State { failed: boolean; }

export class RouteErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  render() {
    if (this.state.failed) {
      return <main id="main-content" tabIndex={-1} className="route-state"><h1>Something went wrong.</h1><p>Please return to the home page and try again.</p><a href="/">Home</a></main>;
    }
    return this.props.children;
  }
}

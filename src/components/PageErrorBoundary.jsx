import React from 'react';
import RecoveryPage from '../pages/RecoveryPage.jsx';

// The conversion workspace state lives above this boundary and survives a page render failure.
export default class PageErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed)
      this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? (
      <RecoveryPage
        kind="500"
        registry={this.props.registry}
        pendingCount={this.props.pendingCount}
        onRetry={() => this.setState({ failed: false })}
      />
    ) : (
      this.props.children
    );
  }
}

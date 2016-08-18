import * as React from 'react';

class FixedNav extends React.Component<{className?: string}, {height?: string}> {
  constructor() {
    super();
    this.state = {height: '0px'};
  }
  componentDidMount() {
    const nav = this.refs['nav'] as Element;
    const navStyle = getComputedStyle(nav);
    this.setState({height: navStyle.height});
  }
  render() {
    const {height} = this.state;
    const {className = '', children} = this.props;
    return (
      <div>
        <nav ref="nav" className={`fixedflow ${className}`}>
          {children}
        </nav>
        <div ref="copy" className="flow-copy" style={{height}}></div>
      </div>
    );
  }
}

export default FixedNav;

import * as React from 'react';

import * as xdom from '../xdom';

const wrapXNode = (node, i) => <XNodeComponent key={i} node={node} />;

class XNodeComponent extends React.Component<{node: xdom.XNode}, {}> {
  render() {
    const {node} = this.props;
    if (xdom.isXText(node)) {
      return <span>{node.data}</span>;
    }
    else if (xdom.isXReference(node)) {
      // const properties = {};
      // properties['title'] = `labels=${node.labels.join(',')}`;
      return <div className="reference">code={node.code}</div>;
    }
    else if (xdom.isXNamedContainer(node)) {
      // Handles Section, Subsection, and Subsubsection
      return <div className={node.name}>{node.childNodes.map(wrapXNode)}</div>;
    }
    else if (xdom.isXExample(node)) {
      // TODO: figure out if className is something else sometimes too?
      return <div className="example">{node.childNodes.map(wrapXNode)}</div>;
    }
    else if (xdom.isXDocument(node)) {
      return <div className="document">{node.childNodes.map(wrapXNode)}</div>;
    }
    else if (xdom.isXFootnote(node)) {
      return <div className="footnote">{node.childNodes.map(wrapXNode)}</div>;
    }
    else if (xdom.isXEndnote(node)) {
      return <div className="endnote">{node.childNodes.map(wrapXNode)}</div>;
    }
    // lower priority general case:
    else if (xdom.isXContainer(node)) {
      return <div className="container">{node.childNodes.map(wrapXNode)}</div>;
    }
    else {
      throw new Error('Cannot render abstract class "XNode"');
    }
  }
}

export default XNodeComponent;

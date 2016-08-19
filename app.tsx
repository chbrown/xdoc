import {base64} from 'coders';
import * as JSZip from 'jszip';

import * as React from 'react';
import {render} from 'react-dom';
import {Router, Route, IndexRoute, Link, useRouterHistory} from 'react-router';
import {createHashHistory} from 'history';

import {XMLTree} from 'xmltree/react';

import {Parser} from './formats/docx';
import * as layouts from './layouts';

import DateTime from './components/DateTime';
import FixedNav from './components/FixedNav';
import XNode from './components/XNode';

import './site.less';

interface StoredFileJSON {
  name: string;
  size: number;
  type: string;
  lastModifiedDate: any;
  data: string;
}

class StoredFile {
  constructor(public name: string,
              public size: number,
              public type: string,
              public lastModifiedDate: any,
              private data_base64?: string,
              private data_arrayBuffer?: ArrayBuffer) { }

  get key(): string {
    return `storedfile:${this.name}`;
  }

  /**
  If neither `data_base64` nor `data_arrayBuffer` are available, this method
  will fail.
  */
  get base64(): string {
    if (this.data_base64 === undefined) {
      const bytes = new Uint8Array(this.data_arrayBuffer);
      this.data_base64 = base64.encodeBytesToString(bytes);
    }
    return this.data_base64;
  }
  /**
  If neither `data_base64` nor `data_arrayBuffer` are available, this method
  will fail.

  This cached getter allows us to load the file metadata for several stored
  files without having to read the decode the base64 into ArrayBuffer until we
  need it.
  */
  get arrayBuffer(): ArrayBuffer {
    if (this.data_arrayBuffer === undefined) {
      const bytes = base64.decodeStringToBytes(this.data_base64);
      this.data_arrayBuffer = new Uint8Array(bytes).buffer;
    }
    return this.data_arrayBuffer;
  }

  /**
  When stored as JSON, a StoredFile has its data encoded as a Base64 string,
  under the key `data`.
  */
  static fromJSON(object: StoredFileJSON): StoredFile {
    return new StoredFile(object.name, object.size, object.type, object.lastModifiedDate, object.data);
  }
  toJSON(): StoredFileJSON {
    return {
      name: this.name,
      size: this.size,
      type: this.type,
      lastModifiedDate: this.lastModifiedDate,
      data: this.base64,
    };
  }
}

const _loadStoredFile_cache: {[index: string]: StoredFile} = {};
function loadStoredFile(name: string) {
  if (_loadStoredFile_cache[name] === undefined) {
    const json = localStorage.getItem(`storedfile:${name}`);
    _loadStoredFile_cache[name] = StoredFile.fromJSON(JSON.parse(json));
  }
  return _loadStoredFile_cache[name];
}
function loadDocument(name: string) {
  const storedFile = loadStoredFile(name);
  const parser = new Parser(storedFile.arrayBuffer);
  return parser.document;
}

interface RouteProps {
  params: {
    name: string,
    splat?: string,
  };
}

interface DocumentsState {
  storedFiles?: StoredFile[];
}
class Documents extends React.Component<{}, DocumentsState> {
  constructor(props, context) {
    super(props, context);
    const storedFiles: StoredFile[] = Object.keys(localStorage)
      .filter(key => key.match(/^storedfile:/) !== null)
      .map(key => StoredFile.fromJSON(JSON.parse(localStorage.getItem(key))));
    this.state = {storedFiles};
  }
  /**
  the "remove" button triggers this handler from the documents view/template.
  */
  removeStoredFile(storedFile: StoredFile) {
    localStorage.removeItem(storedFile.key);
    this.setState(previousState => {
      const {storedFiles} = previousState;
      const index = storedFiles.indexOf(storedFile);
      storedFiles.splice(index, 1);
      return {storedFiles};
    });
  }
  /**
  The input[type="file"] onChange handler calls this function
  */
  readFile(ev: React.FormEvent) {
    const {files} = ev.target as HTMLInputElement;
    const file = files[0];
    const reader = new FileReader();
    reader.onerror = err => {
      throw err;
    };
    reader.onload = ev => {
      // reader.result is ArrayBuffer
      const storedFile = new StoredFile(file.name, file.size, file.type,
        file.lastModifiedDate, undefined, reader.result);
      localStorage.setItem(storedFile.key, JSON.stringify(storedFile));
      console.log(`Loaded file "${storedFile.name}" and saved in localStorage`);
      this.setState(previousState => {
        const {storedFiles: previousStoredFiles} = previousState;
        const storedFiles = [...previousStoredFiles, storedFile];
        return {storedFiles};
      });
    };
    reader.readAsArrayBuffer(file);
  }
  render() {
    const {storedFiles} = this.state;
    return (
      <div>
        <section className="hpad">
          <h1><code>xdoc</code>: a Word-to-LaTeX converter.</h1>
          <h3>Instructions:</h3>
          <ol>
            <li>Load a Word document file using the input below. This file is only
              available to your browser; it is not uploaded to any server.</li>
            <li>Preview the automatically generated <code>xdoc</code> representation
              of your document using the "XDoc" link.</li>
            <li>Generate a LaTeX representation via the "LaTeX" link. Copy and paste the
              contents of that page into a file on your computer, and render it with <code>pdflatex</code>.</li>
          </ol>
          <p>Only modern Word documents (those with a <code>.docx</code> extension) are supported.</p>
          <p>If something breaks, try it again in Chrome.
            If it's still broken, please <a href="https://github.com/chbrown/xdoc/issues/new">create an issue GitHub</a>.</p>
        </section>

        {storedFiles.length ?
          <div>
            <section className="hpad">
              <h2>Stored documents</h2>
            </section>
            <table className="fill padded lined striped">
              <thead>
                <tr>
                  <th title="File name">Name</th>
                  <th></th>
                  <th></th>
                  <th title="Original file contents size">Size</th>
                  {/*<th title="MIME Type">Type</th>*/}
                  <th title="Last modified date">Modified</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {storedFiles.map(storedFile =>
                  <tr key={storedFile.name}>
                    <td><Link to={`/${storedFile.name}/files`}>{storedFile.name}</Link></td>
                    <td><Link to={`/${storedFile.name}/xdoc`}>XDoc</Link></td>
                    <td><Link to={`/${storedFile.name}/latex`}>LaTeX</Link></td>
                    {/*the storedFile.base64 getter should not trigger a base64 conversion*/}
                    <td className="number" title={`Base64 string length: ${storedFile.base64.length}`}>
                      {storedFile.size}
                    </td>
                    {/*<td>{storedFile.type}</td>*/}
                    <td><DateTime date={storedFile.lastModifiedDate} /></td>
                    <td><button onClick={this.removeStoredFile.bind(this, storedFile)}>Remove</button></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div> :
          <section className="hpad">
            <p>
              You have not loaded any files.
              A list of loaded files will appear here after you have uploaded at least one.
            </p>
          </section>}

        <section className="hpad">
          <form>
            <label>
              <div><b>Load a new Word Document</b></div>
              <input type="file" onChange={this.readFile.bind(this)} />
            </label>
          </form>
        </section>
      </div>
    );
  }
}

class Document extends React.Component<RouteProps, {}> {
  // originally an abstract route controller
  render() {
    const {children, params: {name}} = this.props;
    // relative links would work below, but react-router can't handle detecting
    // active links unless it's the full path
    return (
      <div>
        <FixedNav className="sub">
          <span className="text"><b>{name}</b></span>
          <Link className="tab" activeClassName="current" to={`/${name}/files`}>Files</Link>
          <Link className="tab" activeClassName="current" to={`/${name}/xdoc`}>XDoc</Link>
          {/*<Link className="tab" activeClassName="current" to="validate">Validate</Link>*/}
          <Link className="tab" activeClassName="current" to={`/${name}/latex`}>LaTeX</Link>
        </FixedNav>
        {children}
      </div>
    );
  }
}

class Files extends React.Component<RouteProps, {}> {
  render() {
    const {children, params: {name}} = this.props;
    const storedFile = loadStoredFile(name);
    const zip = new JSZip(storedFile.arrayBuffer);
    // TODO: Fix jszip.d.ts
    const files = zip['files'];
    const zipFiles: JSZipObject[] = Object.keys(files).map(fileName => files[fileName]);
    return (
      <div>
        <section className="hpad">
          <h3>Document zip archive contents</h3>
          <p>You can use this file to view the raw XML for all files inside the Word document.</p>
          <p>This is helpful for developing and debugging, but if you just want to convert your document,
            use the <Link to={`/${name}/latex`}>LaTeX</Link> link.</p>
        </section>

        <table className="fill padded lined striped">
          <thead>
            <tr>
              <th>Name</th>
              <th>Dir</th>
              <th>Date</th>
              <th>Comment</th>
              <th>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {zipFiles.map(zipFile =>
              <tr key={zipFile.name}>
                <td><Link to={`/${name}/files/${zipFile.name}`}>{zipFile.name}</Link></td>
                <td>{String(zipFile.dir)}</td>
                <td><DateTime date={zipFile.date} /></td>
                <td>{zipFile.comment}</td>
                <td>{zipFile['unixPermissions'] || zipFile['dosPermissions']}</td>
              </tr>
            )}
          </tbody>
        </table>
        {children}
      </div>
    );
  }
}

const xmlTreeBlacklist = [
  // revision information
  'w:rsid', 'w:rsidR', 'w:rsidRDefault', 'w:rsidRPr', 'w:rsidP',
  // font information
  'w:rFonts', 'w:ascii', 'w:hAnsi', 'w:cs', 'w:bidi',
  // font size information
  'w:sz', 'w:szCs',
  // list item user interface config
  'w:nsid', 'w:multiLevelType', 'w:tmpl',
];

class DocumentFilesXML extends React.Component<RouteProps, {}> {
  render() {
    const {params: {name, splat: filepath}} = this.props;
    const storedFile = loadStoredFile(name);
    const zip = new JSZip(storedFile.arrayBuffer);
    const file = zip.file(filepath);
    const text = file.asText();
    return (
      <section className="hpad">
        <h4>Legend</h4>
        <ul className="xml">
          <li className="attribute">
            Attribute
            <ul className="attribute">
              <li className="name">Name</li>
              <li className="value">Value</li>
            </ul>
          </li>
          <li className="start">Start Tag</li>
          <li className="end">End Tag</li>
          <li className="text" style={{margin: 0}}>Text</li>
        </ul>

        <h3>File: {file.name}</h3>
        <XMLTree className="xml" xml={text} exclude={xmlTreeBlacklist} />
      </section>
    );
  }
}

interface DocumentXDocState {
  outlined?: boolean;
}
class DocumentXDoc extends React.Component<RouteProps, DocumentXDocState> {
  constructor(props, context) {
    super(props, context);
    // outlined defaults to false
    const outlined = localStorage.getItem('outlined') === 'true';
    this.state = {outlined};
  }
  setOutlined(ev: React.FormEvent) {
    const {checked} = ev.target as HTMLInputElement;
    localStorage.setItem('outlined', String(checked));
    this.setState({outlined: checked});
  }
  render() {
    const {params: {name}} = this.props;
    const xDocument = loadDocument(name);

    const {outlined} = this.state;
    return (
      <div>
        <section className="hpad">
          <h2>Metadata</h2>
          <ul>
            {Object.keys(xDocument.metadata).map(key =>
              <li key={key}>{key}: {xDocument.metadata[key]}</li>
            )}
          </ul>
        </section>

        <section className="hpad">
          <h2>Document</h2>

          <div>
            <label>
              <input type="checkbox" checked={outlined} onChange={this.setOutlined.bind(this)} />
              <span> Show outlines around each span</span>
            </label>
          </div>

          <div className={`document ${outlined ? 'outlined' : ''}`}>
            <XNode node={xDocument} />
          </div>
        </section>
      </div>
    );
  }
}

class DocumentXDocJSON extends React.Component<RouteProps, {}> {
  render() {
    const {params: {name}} = this.props;
    const xDocument = loadDocument(name);
    return (
      <section className="hpad">
        <h2>Document</h2>
        <pre>{JSON.stringify(xDocument, null, '  ')}</pre>
      </section>
    );
  }
}

interface DocumentLaTeXState {
  layout: string;
}
class DocumentLaTeX extends React.Component<RouteProps, DocumentLaTeXState> {
  constructor(props, context) {
    super(props, context);
    const layout = localStorage.getItem('layout') || 'plain';
    this.state = {layout};
  }
  selectLayout(ev: React.FormEvent) {
    const {value} = ev.target as HTMLSelectElement;
    localStorage.setItem('layout', value);
    this.setState({layout: value});
  }
  render() {
    const {params: {name}} = this.props;
    const xDocument = loadDocument(name);

    const {layout} = this.state;
    const latex = layout ? layouts[layout](xDocument) : '';
    const latexHref = layout ? `data:text/plain;charset=utf-8,${encodeURIComponent(latex)}` : '';

    return (
      <div>
        <section className="hpad no-select">
          <label>
            <span><b>Layout</b></span>
            {' '}
            <select onChange={this.selectLayout.bind(this)} value={layout}>
              {Object.keys(layouts).map(layout =>
                <option key={layout} value={layout}>{layout}</option>
              )}
            </select>
          </label>
          {' '}
          <a download="paper.tex" href={latexHref}>Download .tex</a>
        </section>

        <section className="hpad">
          <div className="latex">{latex}</div>
        </section>
      </div>
    );
  }
}

class App extends React.Component<{}, {}> {
  render() {
    const {children} = this.props;
    return (
      <div>
        <FixedNav>
          <Link className="tab" activeClassName="current" to="/">Documents</Link>
        </FixedNav>
        {children}
      </div>
    );
  }
}

class NotFound extends React.Component<{}, {}> {
  render() {
    return (
      <section>
        <h2>Route not found!</h2>
      </section>
    );
  }
}

// hashHistory directly from react-router sets ugly ?_k= on all URLs;
// this is the recommended/only work-around
const appHistory = useRouterHistory(createHashHistory)({queryKey: false});

// we have to use hashHistory since we have no control over the root on gh-pages
const router = (
  <Router history={appHistory}>
    <Route path="/" component={App}>
      <IndexRoute component={Documents} />
      <Route path=":name" component={Document}>
        <Route path="files" component={Files}>
          <Route path="*" component={DocumentFilesXML} />
        </Route>
        <Route path="xdoc" component={DocumentXDoc} />
        <Route path="xdocjson" component={DocumentXDocJSON} />
        <Route path="latex" component={DocumentLaTeX} />
        {/* <Route path="validate" component={Validate} /> */}
      </Route>
      <Route path="*" component={NotFound} />
    </Route>
  </Router>
);

render(router, document.getElementById('app'));

import {XDocument} from './xdom';

export function plain(document: XDocument) {
  var timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  var latex = document.toLaTeX();
  return `\\documentclass{article}

% Converted by xdoc on ${timestamp}

\\usepackage{hyperref}
\\usepackage{fixltx2e}
\\usepackage{times}

\\usepackage{gb4e}
\\newcommand{\\example}[1]{
  \\begin{exe}
    \\ex{#1}
  \\end{exe}
}

\\usepackage{cleveref}
\\crefformat{xnumi}{(#2#1#3)}
\\crefformat{xnumii}{(#2#1#3)}
\\crefformat{xnumiii}{(#2#1#3)}

\\begin{document}
${latex}
\\end{document}
`;
}

interface Author {
  name: string;
  institute: string;
  department: string;
  address: string;
  email: string;
}

export function semprag(document: XDocument) {
  var timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  var latex = document.toLaTeX();
  // extract metadata fields
  var title = document.metadata['title'];
  var short_title = document.metadata['title'].split(':')[0];
  var keywords = document.metadata['keywords'];
  var thanks = 'TODO: Thanks';
  var authors: Author[] = [{
    name: document.metadata['creator'],
    institute: 'TODO: institute',
    department: 'TODO: department',
    address: 'TODO: address',
    email: 'TODO: email',
  }];
  var author_names = authors.map(author => author.name);
  var sp_authors = authors.map(author => {
    return `\\spauthor{${author.name} \\\\ \\institute{${author.institute}}}`;
  });

  var addresses = authors.map(author => {
    return `  \\begin{address}
    ${author.name} \\\\
    ${author.department} \\\\
    ${author.institute} \\\\
    ${author.address} \\\\
    \\email{${author.email}}
  \\end{address}`;
  });

  var abstract = 'TODO: abstract';

  return `\\documentclass[lucida,biblatex]{sp}

% Converted by xdoc on ${timestamp}

\\usepackage{gb4e-emulate}

%\\addbibresource{paper.bib}

\\usepackage{cleveref}
\\crefformat{xnumi}{(#2#1#3)}
\\crefformat{xnumii}{(#2#1#3)}
\\crefformat{xnumiii}{(#2#1#3)}
\\crefformat{exei}{(#2#1#3)}
\\crefformat{exeii}{(#2#1#3)}
\\crefformat{exeiii}{(#2#1#3)}

\\pdfauthor{${author_names.join(' ')}}
\\pdftitle{${title}}
\\pdfkeywords{${keywords}}

\\author[${author_names.join(' ')}]{
  ${sp_authors.join('\\AND')}
}

\\title[${short_title}]{${title}%
\\thanks{${thanks}}
}

\\begin{document}

\\maketitle

\\begin{abstract}
  ${abstract}
\\end{abstract}

\\begin{keywords}
${keywords}
\\end{keywords}

${latex}

\\printbibliography

\\begin{addresses}
  ${addresses.join('\n')}
\\end{addresses}

\\end{document}
`;
}

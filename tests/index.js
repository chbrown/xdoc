import assert from 'assert';
import {describe, it} from 'mocha';

import {calculateFlags, stringifyXTexts} from '../latex';
import {XText, Style} from '../xdom';

describe('XText normalization', () => {
  it('should normalize bold style', () => {
    var texts = [
      new XText('Hello '),
      new XText('World', Style.Bold),
      new XText(" what's up?"),
    ];
    var latex = stringifyXTexts(texts);
    assert.equal(latex, "Hello \\textbf{World} what's up?");
  });

  it('should normalize nested styles', () => {
    var texts = [
      new XText('Left '),
      new XText('Middle1 ', Style.Bold), new XText('Middle2', Style.Bold | Style.Italic),
      new XText(' Right'),
    ];
    var latex = stringifyXTexts(texts);
    assert.equal(latex, "Left \\textbf{Middle1 \\textit{Middle2}} Right");
  });
});

describe('bitwise operations', () => {
  it('should reduce 1 | 2 | 4 (= 7) to [1, 2, 4]', () => {
    var flags = calculateFlags(1 | 2 | 4);
    assert.deepEqual(flags, [1, 2, 4]);
  });
  it('should reduce 4 | 16 (= 20) to [4, 16]', () => {
    var flags = calculateFlags(4 | 16);
    assert.deepEqual(flags, [4, 16]);
  });
});

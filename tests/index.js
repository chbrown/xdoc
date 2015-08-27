/// <reference path="../type_declarations/DefinitelyTyped/node/node.d.ts" />
/// <reference path="../type_declarations/index.d.ts" />
var assert = require('assert');
var latex_1 = require('../latex');
var xdom_1 = require('../xdom');
describe('XText normalization', function () {
    it('should normalize bold style', function () {
        var texts = [
            new xdom_1.XText('Hello '),
            new xdom_1.XText('World', xdom_1.Style.Bold),
            new xdom_1.XText(" what's up?"),
        ];
        var latex = latex_1.stringifyXTexts(texts);
        assert.equal(latex, "Hello \\textbf{World} what's up?");
    });
    it('should normalize nested styles', function () {
        var texts = [
            new xdom_1.XText('Left '),
            new xdom_1.XText('Middle1 ', xdom_1.Style.Bold), new xdom_1.XText('Middle2', xdom_1.Style.Bold | xdom_1.Style.Italic),
            new xdom_1.XText(' Right'),
        ];
        var latex = latex_1.stringifyXTexts(texts);
        assert.equal(latex, "Left \\textbf{Middle1 \\textit{Middle2}} Right");
    });
});
describe('bitwise operations', function () {
    it('should reduce 1 | 2 | 4 (= 7) to [1, 2, 4]', function () {
        var flags = latex_1.calculateFlags(1 | 2 | 4);
        assert.deepEqual(flags, [1, 2, 4]);
    });
    it('should reduce 4 | 16 (= 20) to [4, 16]', function () {
        var flags = latex_1.calculateFlags(4 | 16);
        assert.deepEqual(flags, [4, 16]);
    });
});

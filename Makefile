BIN := node_modules/.bin
DTS := lodash/lodash jszip/jszip virtual-dom/virtual-dom \
	jquery/jquery angularjs/angular

all: build/bundle.js build/bundle.min.js site.css
type_declarations: $(DTS:%=type_declarations/DefinitelyTyped/%.d.ts)

type_declarations/DefinitelyTyped/%:
	mkdir -p $(@D)
	curl -s https://raw.githubusercontent.com/chbrown/DefinitelyTyped/master/$* > $@

%.css: %.less $(BIN)/lessc $(BIN)/cleancss
	$(BIN)/lessc $< | $(BIN)/cleancss --keep-line-breaks --skip-advanced -o $@

%.js: %.ts type_declarations $(BIN)/tsc
	$(BIN)/tsc -m commonjs -t ES5 $<

%.min.js: %.js
	closure-compiler --angular_pass --language_in ECMASCRIPT5 --warning_level QUIET $< >$@

build/bundle.js: app.js $(BIN)/browserify
	mkdir -p $(@D)
	$(BIN)/browserify $< -o $@

$(BIN)/browserify $(BIN)/tsc $(BIN)/watchify:
	npm install

# no need for `trap 'kill $$(jobs -p)' SIGTERM`
dev: $(BIN)/browserify $(BIN)/watchify
	($(BIN)/tsc -m commonjs -t ES5 -w *.ts & \
   $(BIN)/watchify app.js -o build/bundle.js -v & \
   wait)

BIN := node_modules/.bin
DTS := lodash/lodash jszip/jszip virtual-dom/virtual-dom \
	jquery/jquery angularjs/angular react/react react/react-addons

all: build/bundle.js site.css
type_declarations: $(DTS:%=type_declarations/DefinitelyTyped/%.d.ts)

type_declarations/DefinitelyTyped/%:
	mkdir -p $(@D)
	curl -s https://raw.githubusercontent.com/borisyankov/DefinitelyTyped/master/$* > $@

$(BIN)/tsc $(BIN)/webpack:
	npm install

%.js: %.ts type_declarations $(BIN)/tsc
	$(BIN)/tsc --experimentalDecorators -m commonjs -t ES5 $<

build/bundle.js: webpack.config.js app.js $(BIN)/webpack
	mkdir -p $(@D)
	NODE_ENV=production $(BIN)/webpack --config $<

dev: webpack.config.js $(BIN)/webpack
	$(BIN)/webpack --watch --config $<

DTS := lodash/lodash jszip/jszip virtual-dom/virtual-dom \
	jquery/jquery angularjs/angular angularjs/angular-resource

all: build/bundle.js site.css

type_declarations: $(DTS:%=type_declarations/DefinitelyTyped/%.d.ts)

type_declarations/DefinitelyTyped/%:
	mkdir -p $(@D)
	curl -s https://raw.githubusercontent.com/chbrown/DefinitelyTyped/master/$* > $@

%.css: %.less
	lessc $< | cleancss --keep-line-breaks --skip-advanced -o $@

%.js: %.ts type_declarations | node_modules/.bin/tsc
	node_modules/.bin/tsc -m commonjs -t ES5 $<

build/bundle.js: app.js | node_modules/.bin/browserify
	mkdir -p $(@D)
	node_modules/.bin/browserify $< -v -o $@

node_modules/.bin/browserify node_modules/.bin/tsc node_modules/.bin/watchify:
	npm install

SHELL := bash

# no need for `trap 'kill $$(jobs -p)' SIGTERM`
dev: | node_modules/.bin/browserify node_modules/.bin/watchify
	(node_modules/.bin/tsc -m commonjs -t ES5 -w *.ts & \
   node_modules/.bin/watchify app.js -o build/bundle.js -v & \
   wait)

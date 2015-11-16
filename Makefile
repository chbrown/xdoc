BIN := node_modules/.bin
TYPESCRIPT := formats/docx.ts app.ts characters.ts latex.ts layouts.ts util.ts xdom.ts
JAVASCRIPT := $(TYPESCRIPT:%.ts=%.js)

all: $(JAVASCRIPT) build/bundle.js

$(BIN)/tsc $(BIN)/webpack $(BIN)/mocha:
	npm install

%.js: %.ts $(BIN)/tsc
	$(BIN)/tsc

build/bundle.js: webpack.config.js app.js $(BIN)/webpack
	mkdir -p $(@D)
	NODE_ENV=production $(BIN)/webpack --config $<

dev: webpack.config.js $(BIN)/webpack
	$(BIN)/webpack --watch --config $<

test: $(JAVASCRIPT) $(BIN)/mocha
	$(BIN)/mocha --compilers js:babel-core/register tests/

BIN := node_modules/.bin
TYPESCRIPT := $(shell jq -r '.files[]' tsconfig.json | grep -v node_modules)
JAVASCRIPT := $(TYPESCRIPT:%.ts=%.js)

all: $(JAVASCRIPT) build/bundle.js .gitignore .npmignore

$(BIN)/tsc $(BIN)/webpack $(BIN)/mocha:
	npm install

%.js: %.ts $(BIN)/tsc
	$(BIN)/tsc

.npmignore: tsconfig.json
	echo $(TYPESCRIPT) tests/ Makefile tsconfig.json | tr ' ' '\n' > $@

.gitignore: tsconfig.json
	echo $(JAVASCRIPT) $(TYPESCRIPT:%.ts=%.d.ts) | tr ' ' '\n' > $@

build/bundle.js: webpack.config.js app.js $(BIN)/webpack
	mkdir -p $(@D)
	NODE_ENV=production $(BIN)/webpack --config $<

dev: webpack.config.js $(BIN)/webpack
	$(BIN)/webpack --watch --config $<

test: $(JAVASCRIPT) $(BIN)/mocha
	$(BIN)/mocha --compilers js:babel-core/register tests/

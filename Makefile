BIN := node_modules/.bin
TYPESCRIPT := $(shell jq -r '.files[]' tsconfig.json | grep -Fv .d.ts)
TYPESCRIPT_BASENAMES := $(basename $(TYPESCRIPT))
JAVASCRIPT := $(TYPESCRIPT_BASENAMES:%=%.js)

all: $(JAVASCRIPT) build/bundle.js .gitignore .npmignore

$(BIN)/tsc $(BIN)/webpack $(BIN)/mocha:
	npm install

%.js: %.ts $(BIN)/tsc
	$(BIN)/tsc

%.js: %.tsx $(BIN)/tsc
	$(BIN)/tsc

.npmignore: tsconfig.json
	echo $(TYPESCRIPT) tests/ Makefile tsconfig.json | tr ' ' '\n' > $@

.gitignore: tsconfig.json
	echo $(JAVASCRIPT) $(TYPESCRIPT_BASENAMES:%=%.d.ts) | tr ' ' '\n' > $@

build/bundle.js: webpack.config.js $(JAVASCRIPT) $(BIN)/webpack
	@mkdir -p $(@D)
	NODE_ENV=production $(BIN)/webpack --config $<

dev: webpack.config.js $(BIN)/webpack
	(\
   $(BIN)/webpack --watch --config $< & \
   $(BIN)/tsc --watch & \
   wait)

test: $(JAVASCRIPT) $(BIN)/mocha
	$(BIN)/mocha --compilers js:babel-core/register tests/


GITREF = .git/refs/heads

.PHONY: all
all: ./build/pypyjs/build/pypy.vm.js \
     ./build/pypyjs/build/pypy \
     ./build/cpython/python \
     ./build/v8/d8 \
     ./build/gecko-dev/js/src/build/dist/bin/js

# XXX TODO: how to ensure we use a consistent build environment?
# Should we specify a specific docker image tag?

./build/pypyjs/$(GITREF)/master:
	mkdir -p build
	git clone --recursive https://github.com/rfk/pypyjs ./build/pypyjs


./build/cpython/$(GITREF)/2.7:
	mkdir -p build
	git clone https://github.com/python/cpython ./build/cpython
	cd ./build/cpython && git checkout -t origin/2.7


./build/v8/$(GITREF)/master:
	mkdir -p build
	git clone https://github.com/v8/v8-git-mirror ./build/v8


./build/gecko-dev/$(GITREF)/master:
	mkdir -p build
	git clone https://github.com/mozilla/gecko-dev ./build/gecko-dev


./build/pypyjs/build/pypy.vm.js: ./build/pypyjs/$(GITREF)/master
	cd ./build/pypyjs && make ./build/pypy.vm.js


./build/pypyjs/build/pypy: ./build/pypyjs/$(GITREF)/master
	cd ./build/pypyjs && make ./build/pypy


./build/cpython/python: ./build/cpython/$(GITREF)/2.7
	cd ./build/cpython && ./configure CC="clang -m32"
	cd ./build/cpython && make
	if [ -f ./build/cpython/python.exe ]; then cd ./build/cpython/ && ln -fs python.exe python; fi;


./build/v8/d8: ./build/v8/$(GITREF)/master
	# XXX TODO: this needs "gclient" from depot_tools
	cd ./build/v8 && make dependencies
	cd ./build/v8 && make x64.release
	cd ./build/v8 && ln -sf ./out/x64.release/d8 ./d8


./build/gecko-dev/js/src/build/dist/bin/js: ./build/gecko-dev/$(GITREF)/master
	cd ./build/gecko-dev/js/src && `which autoconf2.13 autoconf-2.13 autoconf213`
	cd ./build/gecko-dev/js/src && mkdir build
	cd ./build/gecko-dev/js/src/build && ../configure --enable-optimize --disable-debug
	cd ./build/gecko-dev/js/src/build && make


.PHONY: update
update: ./build/pypyjs/$(GITREF)/master ./build/cpython/$(GITREF)/2.7
	cd ./build/pypyjs && git pull
	cd ./build/cpython && git pull
	cd ./build/v8 && git pull
	cd ./build/gecko-dev && git pull

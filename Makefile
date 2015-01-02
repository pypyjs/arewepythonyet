

GITREFS = .git/refs/heads


.PHONY: all
all: build bench


.PHONY: build
build: \
     ./build/lib/pypy/package.json \
     ./build/lib/pypy-nojit/package.json \
     ./build/bin/pypy \
     ./build/bin/python \
     ./build/bin/js \
     ./build/bin/d8


.PHONY: bench
bench:
	PYTHONPATH=$(CURDIR) python -m arewepythonyet ./


.PHONY: update
update: ./build/pypyjs/$(GITREFS)/master ./build/cpython/$(GITREFS)/2.7 \
        ./build/gecko-dev/$(GITREFS)/master ./build/v8/$(GITREFS)/master \
        ./build/depot_tools/$(GITREFS)/master
	cd ./build/pypyjs && git pull
	cd ./build/cpython && git pull
	cd ./build/gecko-dev && git pull
	cd ./build/depot_tools && git pull
	cd ./build/v8 && git pull


.PHONY: clean
clean:
	cd ./build/v8 && rm -f pypy python js d8
	rm -rf ./build/pypyjs/build
	cd ./build/cpython && make clean
	rm -rf ./build/gecko-dev/js/src/build
	cd ./build/v8 && make clean


.PHONY: clobber
clobber:
	rm -rf ./build



./build/pypyjs/$(GITREFS)/master:
	mkdir -p ./build/bin
	git clone --recursive https://github.com/rfk/pypyjs ./build/pypyjs


./build/cpython/$(GITREFS)/2.7:
	mkdir -p ./build/bin
	git clone https://github.com/python/cpython ./build/cpython
	cd ./build/cpython && git checkout -t origin/2.7


./build/v8/$(GITREFS)/master:
	mkdir -p ./build/bin
	git clone https://github.com/v8/v8-git-mirror ./build/v8


./build/gecko-dev/$(GITREFS)/master:
	mkdir -p ./build/bin
	git clone https://github.com/mozilla/gecko-dev ./build/gecko-dev


./build/depot_tools/$(GITREFS)/master:
	mkdir -p ./build/bin
	git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git ./build/depot_tools



./build/lib/pypy/package.json: ./build/pypyjs/$(GITREFS)/master
	mkdir -p ./build/lib
	cd ./build/pypyjs && make release
	cd ./build/lib && tar -xzf ../pypyjs/build/pypy.js-*.tar.gz 
	cd ./build/lib && mv pypy.js-* pypy


./build/lib/pypy-nojit/package.json: ./build/pypyjs/$(GITREFS)/master
	mkdir -p ./build/lib
	cd ./build/pypyjs && make release-nojit
	cd ./build/lib && tar -xzf ../pypyjs/build/pypy-nojit.js-*.tar.gz 
	cd ./build/lib && mv pypy-nojit.js-* pypy-nojit


./build/bin/pypy: ./build/pypyjs/$(GITREFS)/master
	cd ./build/pypyjs && python ./deps/pypy/rpython/bin/rpython --backend=c --cc="clang" --opt=jit --gcrootfinder=shadowstack --translation-backendopt-remove_asserts --output=./build/pypy ./deps/pypy/pypy/goal/targetpypystandalone.py --withoutmod-bz2 --withoutmod-_rawffi --withoutmod-cpyext
	ln -fs ../pypyjs/build/pypy ./build/bin/pypy


./build/bin/python: ./build/cpython/$(GITREFS)/2.7
	cd ./build/cpython && ./configure CC="clang -m32"
	cd ./build/cpython && make
	if [ -f ./build/cpython/python.exe ]; then cd ./build/cpython/ && ln -fs python.exe python; fi;
	ln -fs ../cpython/python ./build/bin/python


./build/bin/js: ./build/gecko-dev/$(GITREFS)/master
	cd ./build/gecko-dev/js/src && `which autoconf2.13 autoconf-2.13 autoconf213`
	cd ./build/gecko-dev/js/src && mkdir -p build
	cd ./build/gecko-dev/js/src/build && ../configure --enable-optimize --disable-debug
	cd ./build/gecko-dev/js/src/build && make
	ln -fs ../gecko-dev/js/src/build/dist/bin/js ./build/bin/js


./build/bin/d8: ./build/v8/$(GITREFS)/master \
                ./build/depot_tools/$(GITREFS)/master
	cd ./build/v8 && PATH="$(CURDIR)/build/depot_tools:$$PATH" CC=clang make dependencies
	cd ./build/v8 && PATH="$(CURDIR)/build/depot_tools:$$PATH" CC=clang make x64.release
	ln -fs ../v8/out/x64.release/d8 ./build/bin/d8

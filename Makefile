

GITREFS = .git/refs/heads
VENV = ./build/venv

# Handy defaults for building with homebrew on OSX.
CFLAGS = -I/usr/local/opt/openssl/include -I/usr/local/Cellar/libffi/3.0.13/lib/libffi-3.0.13/include
LDFLAGS = -L/usr/local/opt/openssl/lib -L/usr/local/Cellar/libffi/3.0.13/lib/libffi-3.0.13/lib


.PHONY: all
all: build bench


.PHONY: build
build: \
     ./build/lib/pypy/package.json \
     ./build/lib/pypy-nojit/package.json \
     ./build/bin/pypy \
     ./build/bin/pypy-nojit \
     ./build/bin/python \
     ./build/bin/js \
     ./build/bin/d8 \
     $(VENV)/COMPLETE


.PHONY: bench
bench: $(VENV)/COMPLETE
	PYTHONPATH=$(CURDIR) $(VENV)/bin/python -m arewepythonyet bench ./


.PHONY: summary
summary: $(VENV)/COMPLETE
	PYTHONPATH=$(CURDIR) $(VENV)/bin/python -m arewepythonyet summarize ./


.PHONY: update
update: ./build/pypyjs/$(GITREFS)/master ./build/cpython/$(GITREFS)/2.7 \
        ./build/gecko-dev/$(GITREFS)/master ./build/v8/$(GITREFS)/master \
        ./build/depot_tools/$(GITREFS)/master
	cd ./build/pypyjs && git pull && git submodule update
	cd ./build/cpython && git pull
	cd ./build/gecko-dev && git pull
	cd ./build/depot_tools && git pull
	cd ./build/v8 && git checkout master && git pull
	docker pull rfkelly/pypyjs-build


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
	git clone --recursive https://github.com/pypyjs/pypyjs ./build/pypyjs


./build/cpython/$(GITREFS)/2.7:
	mkdir -p ./build/bin
	git clone https://github.com/python/cpython ./build/cpython
	cd ./build/cpython && git checkout -t origin/2.7


./build/v8/$(GITREFS)/master: ./build/depot_tools/$(GITREFS)/master
	mkdir -p ./build/bin
	if [ ! -d ./build/v8 ] ; then cd ./build && PATH=./depot_tools/:$$PATH fetch v8; fi
	cd ./build/v8 && git checkout master


./build/gecko-dev/$(GITREFS)/master:
	mkdir -p ./build/bin
	git clone https://github.com/mozilla/gecko-dev ./build/gecko-dev


./build/depot_tools/$(GITREFS)/master:
	mkdir -p ./build/bin
	git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git ./build/depot_tools


# XXX TODO: this should depend on the version of docker build image somehow..
./build/lib/pypy/package.json: ./build/pypyjs/$(GITREFS)/master ./build/pypyjs/build/pypyjs.vm.js
	mkdir -p ./build/lib
	rm -rf ./build/lib/pypy
	rm -rf ./build/pypyjs/build/pypyjs-*.tar.gz
	cd ./build/pypyjs && npm install
	cd ./build/pypyjs && make release
	cd ./build/lib && tar -xzf ../pypyjs/build/pypyjs-*.tar.gz 
	cd ./build/lib && mv pypyjs-* pypy

./build/pypyjs/build/pypyjs.vm.js: ./build/pypyjs/.git/modules/deps/pypy/HEAD
	cd ./build/pypyjs && rm -f ./build/pypyjs.vm.js
	cd ./build/pypyjs && make ./build/pypyjs.vm.js


./build/lib/pypy-nojit/package.json: ./build/pypyjs/$(GITREFS)/master ./build/pypyjs/build/pypyjs-nojit.vm.js
	mkdir -p ./build/lib
	rm -rf ./build/lib/pypy-nojit
	rm -rf ./build/pypyjs/build/pypyjs-nojit-*.tar.gz
	cd ./build/pypyjs && npm install
	cd ./build/pypyjs && make release-nojit
	cd ./build/lib && tar -xzf ../pypyjs/build/pypyjs-nojit-*.tar.gz 
	cd ./build/lib && mv pypyjs-nojit-* pypy-nojit

./build/pypyjs/build/pypyjs-nojit.vm.js: ./build/pypyjs/.git/modules/deps/pypy/HEAD
	cd ./build/pypyjs && rm -f ./build/pypyjs-nojit.vm.js
	cd ./build/pypyjs && make ./build/pypyjs-nojit.vm.js


./build/bin/pypy: ./build/pypyjs/.git/modules/deps/pypy/HEAD
	cd ./build/pypyjs && python ./deps/pypy/rpython/bin/rpython --backend=c --cc="clang $(CFLAGS) $(LDFLAGS)" --opt=jit --gcrootfinder=shadowstack --translation-backendopt-remove_asserts --no-shared --output=./deps/pypy/pypy.exe ./deps/pypy/pypy/goal/targetpypystandalone.py --withoutmod-bz2 --withoutmod-_rawffi --withoutmod-cpyext
	ln -fs ../pypyjs/deps/pypy/pypy.exe ./build/bin/pypy


./build/bin/pypy-nojit: ./build/pypyjs/.git/modules/deps/pypy/HEAD
	cd ./build/pypyjs && python ./deps/pypy/rpython/bin/rpython --backend=c --cc="clang $(CFLAGS) $(LDFLAGS)" --opt=2 --gcrootfinder=shadowstack --translation-backendopt-remove_asserts --no-shared --output=./deps/pypy/pypy-nojit.exe ./deps/pypy/pypy/goal/targetpypystandalone.py --withoutmod-bz2 --withoutmod-_rawffi --withoutmod-cpyext
	ln -fs ../pypyjs/deps/pypy/pypy-nojit.exe ./build/bin/pypy-nojit


./build/bin/python: ./build/cpython/$(GITREFS)/2.7
	cd ./build/cpython && ./configure CC="clang -m32"
	cd ./build/cpython && make
	if [ -f ./build/cpython/python.exe ]; then ln -fs ../cpython/python.exe ./build/bin/python; else ln -fs ../cpython/python ./build/bin/python; fi;


./build/bin/js: ./build/gecko-dev/$(GITREFS)/master
	cd ./build/gecko-dev/js/src && `which autoconf2.13 autoconf-2.13 autoconf213`
	cd ./build/gecko-dev/js/src && mkdir -p build
	cd ./build/gecko-dev/js/src/build && ../configure --enable-optimize --disable-debug
	cd ./build/gecko-dev/js/src/build && make
	# This suddenly doesn't like being run via symlink, it makes it
	# unable to find some relatively-loaded .dylib files.
	#ln -fs ../gecko-dev/js/src/build/dist/bin/js ./build/bin/js
	echo "#!/bin/sh" > ./build/bin/js
	echo "\`dirname \$$0\`/../gecko-dev/js/src/build/dist/bin/js \$$@" >> ./build/bin/js
	chmod +x ./build/bin/js


./build/bin/d8: ./build/v8/$(GITREFS)/master \
                ./build/depot_tools/$(GITREFS)/master
	cd ./build/v8 && PATH="$(CURDIR)/build/depot_tools:$$PATH" gclient sync
	cd ./build/v8 && PATH="$(CURDIR)/build/depot_tools:$$PATH" CC=clang GYP_DEFINES="v8_use_external_startup_data=0" make x64.release
	ln -fs ../v8/out/x64.release/d8 ./build/bin/d8


$(VENV)/COMPLETE: ./requirements.txt ./build/bin/python
	virtualenv --no-site-packages  --python=python2.7 $(VENV)
	$(VENV)/bin/pip install -r ./requirements.txt
	touch $(VENV)/COMPLETE

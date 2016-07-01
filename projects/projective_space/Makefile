SOURCES=vis util
OUT=js

all: compile compress html

compress: compile
	# Minify the resulting javascript
	cd $(OUT) ; \
	$(foreach F, $(SOURCES), uglifyjs --screw-ie8 \
	    --in-source-map $(F).js.map \
	    --source-map $(F).min.js.map \
	    -mco $(F).min.js -- $(F).js ; )

compile:
	# Generate source map in OUT and compile the coffee
	$(foreach F, $(SOURCES), coffee --bare -mo $(OUT) -c $(F).coffee ; )


html:
	pandoc article.markdown --mathjax -o article.html
	cat metadata vis.html article.html tail.html > index.hakyll.html

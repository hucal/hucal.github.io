DATAFOLDER=trade
DATAFILE=dyadic_trade_3.0
DATAOUTPUT=jsons

all: process

process: download_cow_data
	python process_data.py $(DATAFOLDER)/$(DATAFILE).csv $(DATAOUTPUT)

download_cow_data:
	echo Data source: http://www.correlatesofwar.org/data-sets/bilateral-trade
	mkdir -p $(DATAFOLDER)
	cd $(DATAFOLDER)
	curl -o $(DATAFILE).zip \
		http://www.correlatesofwar.org/data-sets/bilateral-trade/cow_trade_3.0/at_download/file
	unzip $(DATAFILE).zip

cshapes:
	echo Data source: http://nils.weidmann.ws/projects/cshapes
	echo Converted using online tool: http://www.shpescape.com/mix/

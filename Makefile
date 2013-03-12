UUID=avd-search-provider@alexmurray.github.com
INSTALL_PATH=~/.local/share/gnome-shell/extensions/$(UUID)
ZIP_PATH=$(UUID).zip
SRC_PATH=src
SCHEMAS_PATH=schemas

$(ZIP_PATH):
	glib-compile-schemas $(SCHEMAS_PATH) \
		--targetdir=$(SCHEMAS_PATH) \
		--strict && \
	zip -r -u $(ZIP_PATH) $(SCHEMAS_PATH) && \
	cd $(SRC_PATH) && \
	zip -r -u ../$(ZIP_PATH) .

install: $(ZIP_PATH)
	mkdir -p $(INSTALL_PATH) && \
	unzip -o $(ZIP_PATH) -d $(INSTALL_PATH)

uninstall:
	rm $(INSTALL_PATH) -rf

clean:
	rm -f $(UUID).zip $(SCHEMAS_PATH)/gschemas.compiled

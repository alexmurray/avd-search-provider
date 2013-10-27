/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/**
 * AVD Search Provider for GNOME Shell
 *
 * Copyright (c) 2012 Alex Murray <murray.alex@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const IconGrid = imports.ui.iconGrid;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Params = imports.misc.params;
const Util = imports.misc.util;
const FileUtils = imports.misc.fileUtils;
const Lang = imports.lang;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;

let provider = null;

const AVDIconBin = new Lang.Class({
    Name: 'AVDIconBin',

    _init: function(protocol, name) {
        this.actor = new St.Bin({ reactive: true,
                                  track_hover: true });
        this._protocol = protocol;
        this.icon = new IconGrid.BaseIcon(name,
                                          { showLabel: true,
                                            createIcon: Lang.bind(this, this.createIcon) } );

        this.actor.child = this.icon.actor;
        this.actor.label_actor = this.icon.label;
    },

    createIcon: function (size) {
        let box = new Clutter.Box();
        const icon_path = GLib.build_filenamev([Lib.getAndroidSDKPath(),
                                                'tools',
                                                'apps', 'SdkController', 'res', 'drawable-xhdpi', 'ic_launcher.png']);
        let icon_file = Gio.file_new_for_path(icon_path);
        let gicon = new Gio.FileIcon({file: icon_file});
        let icon = new St.Icon({ gicon: gicon,
                             icon_size: size});
        box.add_child(icon);
        return box;
    }
});

const AVDSearchProvider = new Lang.Class({
    Name: 'AVDSearchProvider',

    _init: function (name) {
        this.id = 'avd-search-provider';

        // TODO: integrate the concept of configured correctly or not
        // as a core part of the extension so we can notify more
        // readily when misconfigured
        if (!GLib.file_test(GLib.build_filenamev([Lib.getAndroidSDKPath(),
                                                  'tools', 'android']),
                            GLib.FileTest.EXISTS)) {
            // show notification which allows the extension to be configured
            let source = new MessageTray.Source('Android Virtual Device Search Provider Extension',
                                                'gtk-warning');
            let notification = new MessageTray.Notification(source,
                                                            'Configuration Required',
                                                            'Android Virtual Device Search Provider Extension requires the location of the Android SDK to be configured before it can be used');
            notification.addButton('preferences', 'Configure');
            notification.connect('action-invoked', function (self, action) {
                let appSys = Shell.AppSystem.get_default();
                let app = appSys.lookup_app('gnome-shell-extension-prefs.desktop');
                app.launch(global.display.get_current_time_roundtrip(),
                           ['extension:///' + 'avd-search-provider@alexmurray.github.com'], -1, null);
            });
            Main.messageTray.add(source);
            source.notify(notification);
        }
    },

    // FIXME: do this asynchronously
    _getAVDS: function () {
        let android = GLib.build_filenamev([Lib.getAndroidSDKPath(),
                                            'tools', 'android']);
        let avds = [];
        let [ret, out, err, error] =
                GLib.spawn_sync(null, // pwd
                                [android, 'list', 'avds'], // argv
                                null, // envp
                                0, // flags
                                null); // child setup
        if (ret) {
            let match;
            let re = RegExp('Name: (.*)', 'gi');
            while ((match = re.exec(out))) {
                avds.push({ name: match[1] });
            }
        } else {
            log('Error executing "' + android + ' list avds": ' + error + '\n. Please ensure the extension configured with the correct path to the Android SDK');
        }
        return avds;
    },

    createResultObject: function (result, terms) {
        let icon = new AVDIconBin(result.id.protocol, result.name);
        return icon;
    },

    filterResults: function (results, max) {
        return results.slice(0, max);
    },

    getResultMetas: function (ids, callback) {
        let metas = [];
        for (let i = 0; i < ids.length; i++) {
            let id = ids[i];
            metas.push({ id: id, name: id.name });
        }
        callback(metas);
    },

    activateResult: function (id) {
        Util.spawn([ GLib.build_filenamev([Lib.getAndroidSDKPath(),
                                           'tools', 'emulator']),
                     '@' + id.name ]);
    },

    _getResultSet: function (avds, terms) {
        let results = [];
        // search for terms ignoring case - create re's once only for
        // each term and make sure matches all terms
        let res = terms.map(function (term) { return new RegExp(term, 'i'); });
        for (let i = 0; i < avds.length; i++) {
            let avd = avds[i];
            let failed = false;
            for (let j = 0; j < res.length; j++) {
                let re = res[j];
                // search on name, protocol or the term android
                failed |= (avd.name.search(re) < 0 &&
                           'android'.search(re) < 0);
                if (failed) {
                    break;
                }
            }
            if (!failed) {
                results.push(avd);
            }
        }
        this.searchSystem.setResults(this, results);
    },

    getInitialResultSet: function (terms) {
        this._getResultSet(this._getAVDS(), terms);
    },

    getSubsearchResultSet: function (results, terms) {
        this._getResultSet(results, terms);
    }
});

function init (meta) {
}

function enable () {
    if (!provider) {
        provider = new AVDSearchProvider();
        Main.overview.addSearchProvider(provider);
    }
}

function disable() {
    if (provider) {
        Main.overview.removeSearchProvider(provider);
        provider = null;
    }
}

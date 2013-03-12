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

const Main = imports.ui.main;
const Search = imports.ui.search;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Params = imports.misc.params;
const Util = imports.misc.util;
const FileUtils = imports.misc.fileUtils;
const Lang = imports.lang;

const ANDROID_SDK_PATH =  GLib.build_filenamev([GLib.get_home_dir(), '/android-sdk-linux']);

let provider = null;
const AVDSearchProvider = new Lang.Class({
    Name: 'AVDSearchProvider',
    Extends: Search.SearchProvider,

    _init: function (name) {
        this.parent('ANDROID VIRTUAL DEVICES');
    },

    // FIXME: do this asynchronously like in
    // /usr/share/gnome-shell/js/ui/networkAgent.js - this means we
    // would only support GNOME 3.6
    _getAVDS: function () {
        let android = GLib.build_filenamev([ANDROID_SDK_PATH, 'tools', 'android']);
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
            global.log('Error executing "' + android + ' list avds": ' + error + '\n. Please ensure the extension configured with the correct path to the Android SDK');
        }
        return avds;
    },

    getResultMeta: function (id) {
        return { id: id,
                 name: id.name,
                 createIcon: Lang.bind(this, function (size) {
                     const icon_path = GLib.build_filenamev([ANDROID_SDK_PATH, 'tools',
                                                             'apps', 'SdkController', 'res', 'drawable-xhdpi', 'ic_launcher.png']);
                     let icon_file = Gio.file_new_for_path(icon_path);
                     let gicon = new Gio.FileIcon({file: icon_file});
                     return new St.Icon({ gicon: gicon,
                                          icon_size: size});
                 })
               };
    },

    getResultMetas: function (ids, callback) {
        let metas = ids.map(this.getResultMeta, this);
        // GNOME 3.5.1 or so introduced passing result asynchronously
        // via callback so try that first - if it fails then simply
        // return the results to stay compatible with 3.4
        try {
            callback(metas);
        } finally {
            return metas;
        }
    },

    activateResult: function (id) {
        Util.spawn([ GLib.build_filenamev([ANDROID_SDK_PATH, 'tools', 'emulator']), '@' + id.name ]);
    },

    dragActivateResult: function(id, params) {
        params = Params.parse(params, { workspace: -1,
                                        timestamp: global.get_current_time() });
        let workspace = global.screen.get_workspace_by_index(params.workspace);
        workspace.activate(params.timestamp);
        this.activateResult(id);
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
        // GNOME 3.5.1 or so introduced passing result asynchronously
        // via pushResults() so try that first - if it fails then
        // simply return the results to stay compatible with 3.4
        try {
            this.searchSystem.pushResults(this, results);
        } finally {
            return results;
        }
    },

    getInitialResultSet: function (terms) {
        // GNOME 3.4 needs the results returned directly whereas 3.5.1
        // etc will ignore this and instead need pushResults() from
        // _getResultSet() above
        return this._getResultSet(this._getAVDS(), terms);
    },

    getSubsearchResultSet: function (results, terms) {
        // GNOME 3.4 needs the results returned directly whereas 3.5.1
        // etc will ignore this and instead need pushResults() from
        // _getResultSet() above
        return this._getResultSet(results, terms);
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

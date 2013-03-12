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

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function _getSettings () {
    const name = 'com.github.alexmurray.avd-search-provider';
    let dir = Me.dir.get_child('schemas').get_path();
    let settings = null;
    let path = null;

    // Extension installed in .local
    let local_schema = dir + '/gschemas.compiled';
    if (GLib.file_test(local_schema, GLib.FileTest.EXISTS)) {
        let src = Gio.SettingsSchemaSource.new_from_directory(dir,
                                                              Gio.SettingsSchemaSource.get_default(),
                                                              false);
        let schema = src.lookup(name, false);
        settings = new Gio.Settings({ settings_schema: schema });
    } else {
	// Extension installed system-wide
        if (Gio.Settings.list_schemas().indexOf(name) == -1) {
            throw "Schema \"%s\" not found.".format(name);
        }
        settings = new Gio.Settings({ schema: name });
    }
    return settings;
}

function getAndroidSDKPath () {
    let settings = _getSettings();
    let path = settings.get_string('android-sdk-path');
    if (!GLib.path_is_absolute(path)) {
        path = GLib.build_filenamev([GLib.get_home_dir(), path]);
    }
    return path;
}

function setAndroidSDKPath (path) {
    let settings = _getSettings();
    return settings.set_string('android-sdk-path', path);
}

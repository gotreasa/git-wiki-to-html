#!/usr/bin/env node
/**
 * CLI tool for transforming markdown files to html from a src folder to dest
 * usage: node ./git-wiki-to-html.js [srcFolder] [dstFolder] [custom-options-folder]
 *
 * rules/menu files defaults to ./data/default/*  - if not provided
 * new rules/menu items are merged on top of default rules
 *
 * Note: After `npm install` the path to ./node_modules/bin/ can be used
 *
 */
'use strict';
const path = require('path');
const GitWikiToHTML = require('../');
const Console = require('console').Console;
const _ = require('lodash');

const myConsole = new Console(process.stdout, process.stderr);
if (process.argv.length < 3 || process.argv[2] == '--help') {
    myConsole.log(
        'usage: node ./git-wiki-to-html.js [srcFolder] [dstFolder] [options-folder]'
    );
    process.exit(0);
}

// load default rules
let defaultOptions = require('../data/default/options.json');

// overrite rules/menu tpl if any folder required
if (process.argv[4]) {
    let templatesFolder = path.isAbsolute(process.argv[4]) ? process.argv[4] :
        path.join(process.cwd(), process.argv[4]);
    let concatArrays = function(objValue, srcValue) {
        if (_.isArray(objValue)) {
            return objValue.concat(srcValue);
        }
    };
    myConsole.log('Merging additional rules/menu/other options from: %s', templatesFolder);
    try {
        let customOptions = require(path.join(templatesFolder, '/options.json'));
        defaultOptions = _.mergeWith(defaultOptions, customOptions, concatArrays);
    } catch (err) {
        myConsole.log('No additional menu templates present in provided templates folder', err);
    }

}

defaultOptions.srcDir = process.argv[2] || null;
defaultOptions.destDir = process.argv[3] || null;

const obj = new GitWikiToHTML(defaultOptions);

obj.transform().then(function() {
    myConsole.log('Transform DONE. %s Files generated: ', obj.resFiles.length);
}).catch((err) => {
    myConsole.log('Error: ', err);
    process.exit(1);
});

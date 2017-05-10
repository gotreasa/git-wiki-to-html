#!/usr/bin/env node
/**
 * CLI tool for transforming markdown files to html from a src folder to dest
 * usage: node ./git-wiki-to-html.js [srcFolder] [dstFolder] [rules-json-file] [menu-tpl-json-file]
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
        'usage: node ./git-wiki-to-html.js [srcFolder] [dstFolder] [custom-rules-folder]'
    );
    process.exit(0);
}

// load default rules
let rules = require('../data/default/rules.json');
let menuTpls = require('../data/default/menu.json');

// overrite rules/menu tpl if any folder required
if (process.argv[4]) {
    let templatesFolder = path.isAbsolute(process.argv[4]) ? process.argv[4] :
        path.join(process.cwd(), process.argv[4]);
    let concatArrays = function(objValue, srcValue) {
        if (_.isArray(objValue)) {
            return objValue.concat(srcValue);
        }
    };
    myConsole.log('Merging additional rules/menu from: %s', templatesFolder);
    try {
        let additionalMenuTpls = require(path.join(templatesFolder, '/menu.json'));
        menuTpls = _.mergeWith(menuTpls, additionalMenuTpls, concatArrays);
    } catch (err) {
        myConsole.log('No additional menu templates present in provided templates folder', err);
    }

    try {
        let additionalRules = require(path.join(templatesFolder, '/rules.json'));
        rules = _.mergeWith(rules, additionalRules, concatArrays);
    } catch (err) {
        myConsole.log('No additional rules present in provided templates folder', err);
    }
}

const obj = new GitWikiToHTML({
    'srcDir': process.argv[2] || null,
    'destDir': process.argv[3] || null,
    'rules': rules,
    'menuTpls': menuTpls
});

obj.transform().then(function() {
    myConsole.log('Transform DONE. %s Files generated: ', obj.resFiles.length);
}).catch((err) => {
    myConsole.log('Error: ', err);
    process.exit(1);
});

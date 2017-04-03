#!/usr/bin/env node
/**
 * CLI tool for transforming markdown files to html from a src folder to dest
 * usage: node ./git-wiki-to-html.js [srcFolder] [dstFolder] [rules-json-file] [menu-tpl-json-file]
 *
 * rules/menu files defaults to ./data/tpl/*-ibm-northstar.json ones if not provided
 *
 * Note: After `npm install` the path to ./node_modules/bin/ can be used
 *
 */

var path = require('path');
var GitWikiToHTML = require('../');
const Console = require('console').Console;

var myConsole = new Console(process.stdout, process.stderr);
if (process.argv.length < 3 || process.argv[2] == '--help') {
    myConsole.log(
        'usage: node ./git-wiki-to-html.js [srcFolder] [dstFolder] [TODO:rules-file-or-json]'
    );
    process.exit(0);
}

var rulesTplFile = '../data/tpl/rules-ibm-northstar.json';
var menuTplFile = '../data/tpl/menu-ibm-northstar.json';

if (process.argv[4] && process.argv[4].match(/\.json$/)) {
    rulesTplFile = path.isAbsolute(process.argv[4]) ? process.argv[4] : path.join(process.cwd(), process.argv[4]);
}

myConsole.log('Using rules from: %s', rulesTplFile);

var rules = {};
try {
    rules = require(rulesTplFile);
} catch (err) {
    myConsole.log('Failed to load rules from JSON file: ', err);
    process.exit(1);
}

if (process.argv[5] && process.argv[5].match(/\.json$/)) {
    menuTplFile = path.isAbsolute(process.argv[5]) ? process.argv[5] : path.join(process.cwd(), process.argv[5]);
}

myConsole.log('Using menu tpl from: %s', menuTplFile);

var menuTpls = {};
try {
    menuTpls = require(menuTplFile);
} catch (err) {
    myConsole.log('Failed to load menu tpls from JSON file: ', err);
    process.exit(1);
}

var obj = new GitWikiToHTML({
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

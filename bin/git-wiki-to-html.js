#!/usr/bin/env node
/**
 * CLI tool for transforming markdown files to html from a src folder to dest
 * usage: node ./git-wiki-to-html.js [srcFolder] [dstFolder] [TODO:rules-file-or-json]
 *
 * Note: After `npm install` the path to ./node_modules/bin/ can be used
 *
 */

var GitWikiToHTML = require('../');
const Console = require('console').Console;

var myConsole = new Console(process.stdout, process.stderr);
if (process.argv.length < 3 || process.argv[2] == '--help') {
    myConsole.log(
        'usage: node ./git-wiki-to-html.js [srcFolder] [dstFolder] [TODO:rules-file-or-json]'
    );
    process.exit(0);
}

// TODO review rules and passing them to the GitWikiToHTML
var obj = new GitWikiToHTML({
    'srcDir': process.argv[2] || null,
    'destDir': process.argv[3] || null,
    'rules': {
        'pre': [
            {'/<h([1-3])/': '<h$1 class="ibm-h$1" '}
        ],
        'post': []
    }
});

obj.transform().then(function() {
    myConsole.log('Transform DONE. %s Files generated: ', obj.resFiles.length);
}).catch((err) => {
    myConsole.log('Error: ', err);
    process.exit(1);
});

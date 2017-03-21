/**
 * Git help to HTML module
 * Copyright(c) 2017
 *
 * MIT Licensed
 *
 */
var debug = require('debug')('git-wiki-to-html');
var fs = require('fs');
var fsp = require('fs-promise');
var marked  = require('marked');
const path = require('path');
var self;

/**
 * Module for transforming markdown files from a srcDir to html with menu generated
 * and rules applied pre/post markdown processing
 *
 * @param {object} options for the module
 * @return {Function}
 * @api public
 */
function GitWikiToHTML(options) {
    options = options || {};
    // TODO move rules to options
    this.rules = options.rules || [];
    this.menus = [];
    this.srcDir = options.srcDir || './';
    this.destDir = options.destDir || './';
    this.filesFilterRule = options.filesFilterRule || '[a-zA-Z_]+:.*\.md';
    this.srcFiles = [];
    this.resFiles = [];
    self = this;
}

GitWikiToHTML.prototype.transform = function() {
    debug('transform');
    return new Promise(function(resolve, reject) {
        // check if valid options
        if (!self.validConfiguration()) {
            return reject(new Error('Invalid SRC/DEST folder options'));
        }

        self.loadFiles().then(function(files) {
            debug('files loaded');
            var queueAll = [];
            files.forEach(function(item) {
                var rwPromise = fsp.readFile(path.join(self.srcDir, item), 'utf-8').then(function(content) {
                    // parse content
                    var transfContent = self.parse(content);
                    return self.writeFile(item.replace(/\.md$/, '.html'), transfContent);
                });

                queueAll.push(rwPromise);
            });

            Promise.all(queueAll).then(function() {
                debug('All files written');
                resolve();
            }).catch(function(err) {
                debug('Error happended during write');
                reject(err);
            });
        }).catch(function(err) {
            debug('files failed', err);
            reject(err);
        });
    });
};

GitWikiToHTML.prototype.loadFiles = function() {
    debug('loadFiles');

    return new Promise(function(resolve, reject) {
        if (self.srcFiles && self.srcFiles.length > 0) {
            debug('loadFiles - loaded from object');
            return resolve(self.srcFiles);
        }

        // load files if not already loaded
        fsp.readdir(self.srcDir).then(function(filenames) {
            self.srcFiles = filenames.filter(function(item) {
                return !!item.match(new RegExp(self.filesFilterRule));
            });
            resolve(self.srcFiles);
        }).catch(function(err) {
            reject(err);
        });
    });
};

GitWikiToHTML.prototype.parse = function(content) {
    // TODO apply pre-rules
    // marked
    return marked(content);
    // TODO apply post-rules
};

GitWikiToHTML.prototype.writeFile = function(filename, content) {
    return fsp.writeFile(path.join(self.destDir, filename), content).then(function() {
        debug('File generated: %s', path.join(self.destDir, filename));
        self.resFiles.push(filename);
    });
};

GitWikiToHTML.prototype.validConfiguration = function() {
    if (!fs.statSync(self.srcDir).isDirectory()) {
        debug('Invalid SRC folder: ', self.srcDir);
        return false;
    }

    if (!fs.statSync(self.destDir).isDirectory()) {
        debug('Invalid OUTPUT folder: ', self.destDir);
        return false;
    }
    return true;
};

module.exports = GitWikiToHTML;

/**
 * Git help to HTML module
 * Copyright(c) 2017
 *
 * MIT Licensed
 *
 */
'use strict';
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
class GitWikiToHTML {
    constructor(options) {
        options = options || {};
        // TODO move rules to options
        this.rules = options.rules || {};
        this.menus = [];
        this.srcDir = options.srcDir || './';
        this.destDir = options.destDir || './';
        this.filesFilterRule = options.filesFilterRule || '^[a-z\_]+:.*\.md$';
        this.srcFiles = [];
        this.resFiles = [];
        this.menu = {};
        self = this;
    }

    transform() {
        debug('transform');
        return new Promise((resolve, reject) => {
            // check if valid options
            if (!self.validConfiguration()) {
                return reject(new Error('Invalid SRC/DEST folder options'));
            }

            self.loadFiles().then((files) => {
                debug('files loaded');
                var queueAll = [];
                files.forEach((item) => {
                    var rwPromise = fsp.readFile(path.join(self.srcDir, item), 'utf-8').then(function(content) {
                        // parse content
                        var transfContent = self.parse(content);
                        return self.writeFile(item.replace(/\.md$/, '.html'), transfContent);
                    });

                    queueAll.push(rwPromise);
                });

                Promise.all(queueAll).then(() => {
                    debug('All files written');
                    self.menu = self.buildMenuTree(self.srcFiles);
                    var langs = Object.keys(self.menu);
                    if (langs.length > 0) {
                        // sync write menu(s)
                        langs.forEach(language => {
                            var menuStr = self.getMenu(self.menu[language]['Help']);
                            debug('Write menu file: %s', `${language}:_menu_.html`);
                            // locales are saved in filenames with _ instead of -
                            var fixedLocales = language.replace('_', '-');
                            fs.writeFileSync(path.join(self.destDir, `${fixedLocales}:_menu_.html`), menuStr);
                        });
                    }

                    resolve();
                }).catch((err) => {
                    debug('Error happended during write');
                    reject(err);
                });
            }).catch((err) => {
                debug('files failed', err);
                reject(err);
            });
        });
    }

    /**
     * Transforms the filenames list into an menu hierarchy object
     * @param  array
     */
    buildMenuTree(filesListObj) {
        var menu = {};
        filesListObj.forEach((item) => {
            var rawItem = item.replace(/.md$/, '');
            var parts = rawItem.split(':');
            var iterator = menu;
            parts.forEach((menuitem, index) => {
                if (!iterator[menuitem]) {
                    iterator[menuitem] = {};
                }
                if (index == parts.length - 1) {
                    iterator[menuitem]['_link'] = rawItem;
                }

                iterator = iterator[menuitem];
            });
        });
        return menu;
    }

    getMenu(menuObj, menuKey, level) {
        level = level || 1;
        if (!menuObj || typeof menuObj !== 'object') return '';
        // only _link inside
        if (menuObj._link && Object.keys(menuObj).length == 1) {
            return self.getMenuTpl(menuKey, menuObj._link, '', level, 'item');
        }

        // category object
        var rootLink = null;
        if (Object.keys(menuObj).length > 0) {
            var str = '';
            Object.keys(menuObj).forEach((key) => {
                // endpoint
                var itemMenu = menuObj[key];
                // currently we are not supporting category with separate link
                if (key !== '_link') {
                    str +=  self.getMenu(itemMenu, key, level + 1);
                } else {
                    rootLink = itemMenu;
                }
            });
            // saving category _link for template usage
            var ulLink = rootLink || '';
            return self.getMenuTpl(menuKey, ulLink, str, level, 'categ');
        }
    }

    getMenuTpl(key, link, subitems, level, type) {
        key = key || '';
        link = link || '';
        level = level || 1;
        type = type || 'item';
        var title = key.replace(/-/gm, ' ');
        link = link.replace(/^[a-z\-]+:/, '');
        var result = '';
        // TODO move to tpl files
        var tplMenu = {
            'item': `<li id="${link}"><a role="treeitem" href="/help/#${link}" translate>${title}</a></li>
`,
            'categ': `<li><span class="ibm-subnav-heading" translate>${title}</span>
<ul class="ibm-level-${level}" role="tree">
${subitems}
</ul>
</li>
`,
            'categ-1': `<ul id="ibm-primary-links" role="tree" class="ibm-level-${level}">
${subitems}
</ul>
`
        };

        switch (type) {
        case 'item':
            result = tplMenu['item'];
            break;
        case 'categ':
            // look for a level based template before falling on categ
            result = tplMenu['categ-' + level] ? tplMenu['categ-' + level] : tplMenu['categ'];
            break;
        }
        return result;
    }

    loadFiles() {
        debug('loadFiles');

        return new Promise((resolve, reject) => {
            if (self.srcFiles && self.srcFiles.length > 0) {
                debug('loadFiles - loaded from object');
                return resolve(self.srcFiles);
            }

            // load files if not already loaded
            fsp.readdir(self.srcDir).then((filenames) => {
                self.srcFiles = filenames.filter((item) => {
                    return !!item.match(new RegExp(self.filesFilterRule));
                });
                resolve(self.srcFiles.sort());
            }).catch((err) => {
                reject(err);
            });
        });
    }

    parse(content) {
        // TODO apply pre-rules
        // marked
        content = this.applyRules(content, this.rules['pre'] || []);
        content = marked(content);
        content = this.applyRules(content, this.rules['post'] || []);
        return content;
    }

    applyRules(content, rules) {
        if (rules && rules.length > 0) {
            rules.forEach((ruleObj) => {
                var key = Object.keys(ruleObj)[0];
                var fromRule = new RegExp(key, 'gm');
                content = content.replace(fromRule, ruleObj[key]);
            });
        }
        return content;
    }

    writeFile(filename, content) {
        return fsp.writeFile(path.join(self.destDir, filename), content).then(() => {
            debug('File generated: %s', path.join(self.destDir, filename));
            self.resFiles.push(filename);
        });
    }

    validConfiguration() {
        if (!fs.statSync(self.srcDir).isDirectory()) {
            debug('Invalid SRC folder: ', self.srcDir);
            return false;
        }

        if (!fs.statSync(self.destDir).isDirectory()) {
            debug('Invalid OUTPUT folder: ', self.destDir);
            return false;
        }
        return true;
    }

}

module.exports = GitWikiToHTML;

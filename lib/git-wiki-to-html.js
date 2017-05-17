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
var Mustache  = require('mustache');
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
        this.rules = options.rules || {};
        // set a simple default menu tpl
        this.menuTpls = options.menuTpls || {
            'item': '<li><a href="{{link}}">{{title}}</a></li>',
            'category': '<li><span>{{title}}</span><ul>{{{subitems}}}</ul></li>',
            'category-1': '<ul>{{{subitems}}}</ul>'
        };
        this.menus = [];
        this.srcDir = options.srcDir || './';
        this.destDir = options.destDir || './';
        this.filesFilterRule = options.filesFilterRule || '^[a-z\_]+:.*\.md$';
        this.srcFiles = [];
        this.resFiles = [];
        this.defaultLanguage = options.defaultLanguage || 'en';
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
                    if (self.menu.size > 0) {
                        // sync write menu(s)
                        self.menu.forEach((langMenu, language) => {
                            var menuStr = self.getMenu(langMenu.get('Help'));
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
        let orderedFilesListObj = this.getOrderedFiles(filesListObj, self.rules.order || []);
        let menu = new Map();
        orderedFilesListObj.forEach((item) => {
            let rawItem = item.replace(/.md$/, '');
            let parts = rawItem.split(':');
            let iterator = menu;
            parts.forEach((menuitem, index) => {
                if (!iterator.has(menuitem)) {
                    iterator.set(menuitem, new Map());
                }
                let subMenu = iterator.get(menuitem);
                if (index == parts.length - 1) {
                    subMenu.set('_link', rawItem);
                }

                iterator = subMenu;
            });
        });
        return menu;
    }

    getMenu(menuMap, menuKey, level) {
        level = level || 1;
        if (!menuMap || !menuMap instanceof Map) return '';
        // only _link inside
        if (menuMap.has('_link') && menuMap.size == 1) {
            return self.getMenuTpl(menuKey, menuMap.get('_link'), '', level, 'item');
        }

        // category object
        let rootLink = null;
        if (menuMap.size > 0) {
            let str = '';
            menuMap.forEach((itemMenu, key) => {
                // endpoint
                // currently we are not supporting category with separate link
                if (key !== '_link') {
                    str +=  self.getMenu(itemMenu, key, level + 1);
                } else {
                    rootLink = itemMenu;
                }
            });
            // saving category _link for template usage
            let ulLink = rootLink || '';
            return self.getMenuTpl(menuKey, ulLink, str, level, 'category');
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
        var tplMenu = self.menuTpls;

        switch (type) {
        case 'item':
            result = tplMenu['item'];
            break;
        case 'category':
            // look for a level based template before falling on categ
            result = tplMenu['category-' + level] ? tplMenu['category-' + level] : tplMenu['category'];
            break;
        }
        return  Mustache.render(result, {title: title, link: link, subitems: subitems, level: level});
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

    getOrderedFiles(sourceArr, priorityList) {
        let sourceArrSorted = Object.assign([], sourceArr);
        return sourceArrSorted.sort(function(item1, item2) {
            let revOrder = Object.assign([], priorityList || []);
            revOrder.reverse();
            // order rules don't have locales'
            let index1 = revOrder.indexOf(item1.replace(/^[a-z_]+:/, ''));
            let index2 = revOrder.indexOf(item2.replace(/^[a-z_]+:/, ''));
            if (index1 === -1 && index2 === -1) {
                return item1 > item2 ? -1 : (item1 < item2 ? 1 : 0);
            } else {
                return index1 > index2 ? -1 : (index1 < index2 ? 1 : 0);
            }
        });
    }

    getTranslationObject(filesListObj) {
        let langs = [];
        let langTransObj = {};
        let transObj = {};
        filesListObj.forEach(
            (item) => {
                let rawItem = item.replace(/.md$/, '');
                let parts = rawItem.split(':');
                let lang = parts.shift();

                if (langs.indexOf(lang) === -1) langs.push(lang);

                // the transObj based on default language
                if (lang === this.defaultLanguage) {
                    parts.forEach((part) => {
                        let transKey = part.replace(/-/gm, ' ');
                        if (!transObj[transKey]) {
                            transObj[transKey] = transKey;
                        }
                    });
                }
            }
        );

        langs.forEach((langKey) => {
            langTransObj[langKey] = transObj;
        });

        return langTransObj;
    }
}

module.exports = GitWikiToHTML;

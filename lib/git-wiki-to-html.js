/**
 * Git help to HTML module
 * Copyright(c) 2017
 *
 * MIT Licensed
 *
 */
'use strict';
const debug = require('debug')('git-wiki-to-html');
let fs = require('fs');
let fsp = require('fs-promise');
const marked  = require('marked');
const Mustache  = require('mustache');
const path = require('path');
const util = require('util');
const localeMatch = '^([a-z][a-zA-Z_]+)';
let self;

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
        // TODO set default separator to # for windows support and validate allowed chars in separator
        // TODO allowed [#-_]+
        this.separator = options.separator || ':';
        this.hashSeparator = options.hashSeparator || encodeURIComponent(this.separator);
        // TODO set default multilang to false
        this.multilang = options.multilang === false ? false : true;
        // TODO set empty prefix as default
        this.prefixFiles = typeof(options.prefixFiles) !== undefined ? options.prefixFiles : 'Help';
        // File filters depend on single/multilang mode
        // uderscored_locale#categ1#categ2#item.md
        // categ1#categ2#item.md
        this.filesFilterRule = options.filesFilterRule ||
            [
                this.multilang ? localeMatch + this.separator : '',
                this.prefixFiles ? this.prefixFiles : '',
                '.*\.md$'
            ].join('');
        this.linkTemplate = options.linkTemplate || './#/%s';
        this.menuFileName = options.menuFile || '_menu_.html';
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
                const queueAll = [];
                files.forEach((item) => {
                    const rwPromise = fsp.readFile(path.join(self.srcDir, item), 'utf-8').then((content) => {
                        // parse content
                        const transfContent = self.parse(content);
                        return self.writeFile(item.replace(/\.md$/, '.html'), transfContent);
                    });

                    queueAll.push(rwPromise);
                });

                Promise.all(queueAll).then(() => {
                    debug('All files written');
                    self.menu = self.buildMenuTree(self.srcFiles);
                    if (self.menu.size > 0) {
                        // sync write menu(s)
                        if (self.multilang) {
                            self.menu.forEach((langMenu, language) => {
                                // TODO add prefix option
                                let menuStr = self.getMenu(
                                    self.prefixFiles ? langMenu.get(self.prefixFiles) : langMenu);
                                debug('Write menu file: %s', `${language}${self.separator}${self.menuFileName}`);
                                fs.writeFileSync(path.join(self.destDir,
                                    `${language}${self.separator}${self.menuFileName}`), menuStr);
                            });
                        } else {
                            let menuStr = self.getMenu(self.prefixFiles ? self.menu.get(self.prefixFiles) :
                                 self.menu);
                            debug('Write menu file: %s', self.menuFileName);
                            fs.writeFileSync(path.join(self.destDir, self.menuFileName), menuStr);
                        }
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
            let parts = rawItem.split(self.separator);
            let iterator = menu;
            parts.forEach((menuitem, index) => {
                if (!iterator.has(menuitem)) {
                    iterator.set(menuitem, new Map());
                }
                let subMenu = iterator.get(menuitem);
                if (index == parts.length - 1) {
                    subMenu.set('_link', rawItem.replace(new RegExp(self.separator, 'g'), self.hashSeparator));
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
        var title = key.replace(/-/gm, ' ').trim();
        // strip lang locales if any
        if (self.multilang) link = link.replace(new RegExp(localeMatch + this.hashSeparator), '');
        let formatedLink = util.format(self.linkTemplate, link);
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
        return  Mustache.render(result, {title: title, link: formatedLink, subitems: subitems, level: level});
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
        return sourceArrSorted.sort((item1, item2) => {
            let revOrder = Object.assign([], priorityList || []);
            revOrder.reverse();
            // order rules don't have locales'
            let langReg = self.multilang ? new RegExp(localeMatch + this.separator) : '';
            let index1 = revOrder.indexOf(item1.replace(langReg, ''));
            let index2 = revOrder.indexOf(item2.replace(langReg, ''));
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
                let parts = rawItem.split(self.separator);
                let lang = parts.shift();

                if (langs.indexOf(lang) === -1) langs.push(lang);

                // the transObj based on default language
                if (lang === this.defaultLanguage) {
                    parts.forEach((part) => {
                        let transKey = part.replace(/-/gm, ' ').trim();
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

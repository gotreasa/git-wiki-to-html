'use strict';

var expect = require('chai').expect,
    sinon = require('sinon'),
    rewire = require('rewire'),
    GitWikiToHTML = rewire('../lib/git-wiki-to-html.js');

describe('Testsuite - CloudantStore', function() {
    var fsMock = {
        statSync: function() {},
        writeFileSync: function() {}
    };

    var fspMock = {
        readdir: function() {},
        writeFile: function() {},
        readFile: function() {}
    };

    var statSyncStub, readdirStub, writeFileStub, readFileStub, writeFileSyncStub;

    var dirContent = [
        '.git',
        'Home.md',
        'en:Help.md',
        'en:Help:Landing-Some-Page.md',
        'fr_ca:Help.md',
        'test.txt'
    ];

    var dirFilteredContent = [
        'en:Help.md',
        'en:Help:Landing-Some-Page.md',
        'fr_ca:Help.md'
    ];

    var menuBuilt = {
        'en': {
            'Help': {
                'Categ-page': {
                    'Item-page-1': {
                        '_link': 'en:Help:Categ-page:Item-page-1'
                    },
                    'Item-page-2': {
                        '_link': 'en:Help:Categ-page:Item-page-2'
                    }
                },
                'Landing-Some-Page': {
                    '_link': 'en:Help:Landing-Some-Page'
                },
                '_link': 'en:Help'
            }
        },
        'fr_ca': {
            'Help': {
                'Categ-page': {
                    'Item-page-1': {
                        'Page': {
                            '_link': 'fr_ca:Help:Categ-page:Item-page-2'
                        }
                    }
                },
                '_link': 'fr_ca:Help'
            }
        }
    };

    var menuSrcFiles = [
        'en:Help.md',
        'en:Help:Landing-Some-Page.md',
        'en:Help:Categ-page:Item-page-1.md',
        'en:Help:Categ-page:Item-page-2.md',
        'fr_ca:Help.md',
        'fr_ca:Help:Categ-1:Categ-2:Page.md'
    ];

    before(function() {
        GitWikiToHTML.__set__('fs', fsMock);
        GitWikiToHTML.__set__('fsp', fspMock);
    });

    beforeEach(function() {
        readFileStub = sinon.stub(fspMock, 'readFile');
        statSyncStub = sinon.stub(fsMock, 'statSync');
        readdirStub = sinon.stub(fspMock, 'readdir');
        writeFileStub = sinon.stub(fspMock, 'writeFile');
        writeFileSyncStub = sinon.stub(fsMock, 'writeFileSync');
    });

    afterEach(function() {
        readFileStub.restore();
        statSyncStub.restore();
        readdirStub.restore();
        writeFileStub.restore();
        writeFileSyncStub.restore();
    });

    it('Testcase - Constructor - default params', function() {
        var error = null;
        try {
            var parser = new GitWikiToHTML();
        } catch (err) {
            error = err;
        }
        expect(error).to.be.null;
        expect(parser).not.to.be.null;
        expect(parser.srcDir).to.equal('./');
        expect(parser.srcDir).to.equal('./');
    });

    it('Testcase - Constructor - with params', function() {
        var error = null;
        try {
            var parser = new GitWikiToHTML({
                srcDir: './path/to/src',
                destDir: './path/to/dest'
            });
        } catch (err) {
            error = err;
        }
        expect(error).to.be.null;
        expect(parser).not.to.be.null;
        expect(parser.srcDir).to.equal('./path/to/src');
        expect(parser.destDir).to.equal('./path/to/dest');
    });

    it('Testcase - validConfiguration - valid', function() {
        statSyncStub.returns({isDirectory: function() { return true; }});
        var parser = new GitWikiToHTML({
            srcDir: './path/to/src',
            destDir: './path/to/dest'
        });

        var isValid = parser.validConfiguration();
        expect(isValid).to.equal(true);
    });

    it('Testcase - validConfiguration - invalid srcDir', function() {
        statSyncStub.returns({isDirectory: function() { return false; }});
        var parser = new GitWikiToHTML({
            srcDir: './invalid-path/to/src',
            destDir: './invalid-path/to/dest'
        });

        var isValid = parser.validConfiguration();
        expect(isValid).to.equal(false);
    });

    it('Testcase - validConfiguration - invalid srcDir', function() {
        statSyncStub.withArgs('./path/to/src').returns({isDirectory: function() { return true; }});
        statSyncStub.withArgs('./invalid-path/to/dest').returns({isDirectory: function() { return false; }});
        var parser = new GitWikiToHTML({
            srcDir: './path/to/src',
            destDir: './invalid-path/to/dest'
        });

        var isValid = parser.validConfiguration();
        expect(isValid).to.equal(false);
    });

    it('Testcase - loadFiles - not cached', function(done) {
        readdirStub.returns(Promise.resolve(dirContent));
        var parser = new GitWikiToHTML();

        parser.loadFiles()
        .then((res) => {
            expect(res).to.deep.equal(dirFilteredContent);
            done();
        }, (err) => {
            expect(err).to.be.null;
            done();
        });
    });

    it('Testcase - loadFiles - read failure', function(done) {
        readdirStub.returns(Promise.reject(new Error('read fail')));
        var parser = new GitWikiToHTML();

        parser.loadFiles()
        .then(() => {
            expect(false).to.be.true;
            done();
        }, (err) => {
            expect(err.message).to.equal('read fail');
            done();
        });
    });

    it('Testcase - loadFiles - from cache', function(done) {
        readdirStub.returns(Promise.resolve([]));
        var parser = new GitWikiToHTML();
        parser.srcFiles = ['en:sample:file.md'];
        parser.loadFiles()
        .then((res) => {
            expect(res).to.deep.equal(['en:sample:file.md']);
            done();
        }, () => {
            expect(false).to.equal(true);
            done();
        });
    });

    it('Testcase - writeFile', function(done) {
        writeFileStub.returns(Promise.resolve());
        var parser = new GitWikiToHTML(
            {destDir: './dest'}
        );

        parser.writeFile('en:test:file.html', '<p>HTML file</p>')
        .then(() => {
            expect(writeFileStub.calledWith('dest/en:test:file.html')).to.equal(true);
            expect(parser.resFiles[0]).to.equal('en:test:file.html');
            done();
        }, () => {
            expect(false).to.be.true;
            done();
        }).catch((err)=> { done(err); });
    });

    it('Testcase - parse', function() {
        var parser = new GitWikiToHTML();
        var content = parser.parse('# Title for the page');
        expect(content).to.equal('<h1 id="title-for-the-page">Title for the page</h1>\n');
    });

    it('Testcase - transform', function(done) {
        var parser = new GitWikiToHTML();
        parser.srcFiles = ['en:Help.md', 'en:Help:Landing.md', 'fr_ca:Help.md', 'fr_ca:Help:Landing.md'];
        sinon.stub(parser, 'validConfiguration').returns(true);
        readFileStub.returns(Promise.resolve('# content'));
        writeFileStub.returns(Promise.resolve());
        writeFileSyncStub.returns(true);

        parser.transform()
        .then(() => {
            expect(readFileStub.callCount).to.equal(4);
            expect(writeFileSyncStub.callCount).to.equal(2);
            expect(parser.resFiles[0]).to.equal('en:Help.html');
            expect(parser.resFiles[1]).to.equal('en:Help:Landing.html');
            done();
        }, () => {
            expect(false).to.be.true;
            done();
        }).catch((err)=> { done(err); });
    });

    it('Testcase - transform - not validConfiguration', function(done) {
        var parser = new GitWikiToHTML();
        parser.srcFiles = ['en:Help.md', 'en:Help:Landing.md'];
        sinon.stub(parser, 'validConfiguration').returns(false);
        readFileStub.returns(Promise.resolve('# content'));
        writeFileStub.returns(Promise.resolve());

        parser.transform()
        .then(() => {
            expect(false).to.be.true;
            done();
        }, (err) => {
            expect(err).to.be.ok;
            expect(err.message).to.equal('Invalid SRC/DEST folder options');
            done();
        }).catch((err)=> { done(err); });
    });

    it('Testcase - transform - loadFiles fails', function(done) {
        var parser = new GitWikiToHTML();
        var error = new Error('Load fails');
        parser.srcFiles = ['en:Help.md', 'en:Help:Landing.md'];
        sinon.stub(parser, 'validConfiguration').returns(true);
        sinon.stub(parser, 'loadFiles').returns(Promise.reject(error));

        parser.transform()
        .then(() => {
            expect(false).to.be.true;
            done();
        }, (err) => {
            expect(err).to.be.ok;
            expect(err).to.deep.equal(error);
            done();
        }).catch((err)=> { done(err); });
    });

    it('Testcase - transform - write fails', function(done) {
        var parser = new GitWikiToHTML();
        var error = new Error('Write failure');
        parser.srcFiles = ['en:Help.md', 'en:Help:Landing.md'];
        sinon.stub(parser, 'validConfiguration').returns(true);
        readFileStub.returns(Promise.resolve('# content'));
        writeFileStub.returns(Promise.reject(error));

        parser.transform()
        .then(() => {
            expect(false).to.be.true;
            done();
        }, (err) => {
            expect(err).to.be.ok;
            expect(err).to.deep.equal(error);
            done();
        }).catch((err)=> { done(err); });
    });

    it('Testcase - applyRules - empty rules - same content', function() {
        var parser = new GitWikiToHTML();
        var content = `# Some content h1
            Another line here
        `;
        var resp = parser.applyRules(
            content,
            null);
        expect(resp).to.equal(content);
    });

    it('Testcase - applyRules - a list of markdown rules', function() {
        var parser = new GitWikiToHTML();
        var content = `# Some content h1 ((link))
            Another line here
        `;
        var expectedRes = `# Something content h1 (%28link%29)
            Another line here
        `;
        var resp = parser.applyRules(
            content,
            [
                {'Some ': 'Something '},
                 {'\\((.*)\\((.*)\\)(.*)\\)': '($1%28$2%29$3)'}
            ]);
        expect(resp).to.equal(expectedRes);
    });

    it('Testcase - applyRules - empty rules - a list of html rules', function() {
        var parser = new GitWikiToHTML();
        var content = `<h1 id="soemthing">Text</h1>
        <h2>Text H2</h2>
        <table><tr><td>content here</td></tr></table>
        <table id="tbl-id"><tr><td>content here</td></tr></table>
        <img src="/path/to/img" />
        `;
        var expectedRes = `<h1 class='ibm-h1' id="soemthing">Text</h1>
        <h2 class='ibm-h2'>Text H2</h2>
        <table class="ibm-data-table ibm-altcols ibm-grid"><tr><td>content here</td></tr></table>
        <table class="ibm-data-table ibm-altcols ibm-grid" id="tbl-id"><tr><td>content here</td></tr></table>
        <img class="ibm-resize" src="/path/to/img" />
        `;
        var resp = parser.applyRules(
            content,
            [
                {'<h([1-3])': '<h$1 class=\'ibm-h$1\''},
                {'<table([\\s]?)': '<table class="ibm-data-table ibm-altcols ibm-grid"$1'},
                {'<img ': '<img class="ibm-resize" '}
            ]);
        expect(resp).to.equal(expectedRes);
    });

    it('Testcase - buildMenuTree', function() {
        var parser = new GitWikiToHTML();
        var result = parser.buildMenuTree(menuSrcFiles);

        expect(result.get('en').get('Help').get('Landing-Some-Page').get('_link'))
            .to.equal('en:Help:Landing-Some-Page');
        expect(result.get('en').get('Help').get('Categ-page').get('Item-page-1').get('_link'))
            .to.equal('en:Help:Categ-page:Item-page-1');
    });

    it('Testcase - buildMenuTree - ordered', function() {
        var parser = new GitWikiToHTML({
            rules: {
                order: [
                    'Help:Categ-page:Item-page-2.md'
                ]
            }
        });
        var result = parser.buildMenuTree(menuSrcFiles);
        var lev1EnMapKeys = (result.get('en').get('Help')).keys();
        expect(lev1EnMapKeys.next().value).to.equal('Categ-page');
        expect(lev1EnMapKeys.next().value).to.equal('Landing-Some-Page');
        var lev2EnMapKeys = (result.get('en').get('Help').get('Categ-page')).keys();
        expect(lev2EnMapKeys.next().value).to.equal('Item-page-2');
        expect(lev2EnMapKeys.next().value).to.equal('Item-page-1');
    });

    it('Testcase - getMenuTpl - item', function() {
        var parser = new GitWikiToHTML();
        parser.menu = menuBuilt;
        var result = parser.getMenuTpl('Item-page-1', 'en:Help:Categ-page:Item-page-1', null, null, 'item');
        expect(result).to.deep.equal('<li><a href="Help:Categ-page:Item-page-1">Item page 1</a></li>');
    });

    it('Testcase - getMenuTpl - categ', function() {
        var parser = new GitWikiToHTML();
        var result = parser.getMenuTpl('Categ-Page', null, '_SUBITEMS_', 2, 'category');
        expect(result).to.deep.equal('<li><span>Categ Page</span><ul>_SUBITEMS_</ul></li>');
    });

    it('Testcase - getMenuTpl - categ level', function() {
        var parser = new GitWikiToHTML();
        var result = parser.getMenuTpl('Categ-Page', null, '_SUBITEMS_', 1, 'category');
        expect(result).to.deep.equal('<ul>_SUBITEMS_</ul>');
    });

    it('Testcase - getMenu', function() {
        var parser = new GitWikiToHTML();
        var menuMap = parser.buildMenuTree(menuSrcFiles);
        var resultFr = parser.getMenu(menuMap.get('fr_ca').get('Help'));
        expect(resultFr).to.deep.equal('<ul><li><span>Categ 1</span><ul><li><span>Categ 2</span>' +
        '<ul><li><a href="fr_ca:Help:Categ-1:Categ-2:Page">Page</a></li></ul></li></ul></li></ul>');
        var resultEn = parser.getMenu(menuMap.get('en').get('Help'));
        expect(resultEn).to.deep.equal('<ul><li><a href="Help:Landing-Some-Page">Landing Some Page</a>' +
        '</li><li><span>Categ page</span><ul><li><a href="Help:Categ-page:Item-page-2">Item page 2</a>' +
        '</li><li><a href="Help:Categ-page:Item-page-1">Item page 1</a></li></ul></li></ul>');
    });

    it('Testcase - getMenu ordered', function() {
        var parser = new GitWikiToHTML({
            rules: {
                order: [
                    'Help:Categ-page:Item-page-2.md'
                ]
            }
        });
        var menuMap = parser.buildMenuTree(menuSrcFiles);
        var result = parser.getMenu(menuMap.get('en').get('Help'));
        expect(result).to.deep.equal('<ul><li><span>Categ page</span><ul><li><a href="Help:' +
        'Categ-page:Item-page-2">Item page 2</a></li><li><a href="Help:Categ-page:Item-page-1"' +
        '>Item page 1</a></li></ul></li><li><a href="Help:Landing-Some-Page">Landing Some Page</a></li></ul>');
    });


    it('Testcase - getOrderedFiles', function() {
        var parser = new GitWikiToHTML();
        parser.menu = menuBuilt;
        var result = parser.getOrderedFiles([]);
        expect(result).to.deep.equal([]);
    });

    it('Testcase - getOrderedFiles', function() {
        var parser = new GitWikiToHTML();
        var result = parser.getOrderedFiles([
            'en:A:B', 'en:A:A', 'en:B', 'en:C', 'en:D', 'en:E', 'fr_ca:D', 'fr_ca:A:B'
        ], [
            'D', 'E', 'C'
        ]);
        expect(result).to.deep.equal([
            'en:D',
            'fr_ca:D',
            'en:E',
            'en:C',
            'fr_ca:A:B',
            'en:B',
            'en:A:B',
            'en:A:A'
        ]);
    });

    it('Testcase - getTranslationObject()', function() {
        const transDirFilteredContent = {
            en: {
                'Help': 'Help',
                'Landing Some Page': 'Landing Some Page'
            },
            fr_ca: {
                'Help': 'Help',
                'Landing Some Page': 'Landing Some Page'
            }
        };

        const parser = new GitWikiToHTML();
        const result = parser.getTranslationObject(dirFilteredContent);

        expect(result).to.deep.equal(transDirFilteredContent);
    });

    it('Testcase - getTranslationObject() - default lang only (en)', function() {
        const dirFilteredContentEn = [
            'en:Help.md',
            'en:Help:Landing-Some-Page.md'
        ];
        const transDirFilteredContentEn = {
            en: {
                'Help': 'Help',
                'Landing Some Page': 'Landing Some Page'
            }
        };

        const parser = new GitWikiToHTML();
        const result = parser.getTranslationObject(dirFilteredContentEn);

        expect(parser.defaultLanguage).equal('en');
        expect(result).to.deep.equal(transDirFilteredContentEn);
    });

    it('Testcase - getTranslationObject() - no files', function() {
        const parser = new GitWikiToHTML();
        const result = parser.getTranslationObject([]);
        expect(result).to.deep.equal({});
    });

    it('Testcase - test default rules for parsing links', function() {
        let str = `[IBM Link](https://github.ibm.com/mySA/help/wiki/en:Help:Opportunity--%28OM%29:SC4BP:Opportunities) 
text [GIT link](https://github.com/mySA/help/wiki/en:Help.md)`;
        const rules = require('../data/default/rules.json');
        const parser = new GitWikiToHTML(
            {rules: rules}
        );

        const result = parser.parse(str);
        const expectedStr = `<p><a href="/help/#/Help:Opportunity--(OM):SC4BP:Opportunities">IBM Link</a> 
text <a href="/help/#/Help.md">GIT link</a></p>
`;
        expect(result).to.deep.equal(expectedStr);
    });
});

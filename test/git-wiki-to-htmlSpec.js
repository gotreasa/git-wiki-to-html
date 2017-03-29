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
                'Categ-1': {
                    'Categ-2': {
                        'Page': {
                            '_link': 'fr_ca:Help:Categ-1:Categ-2:Page'
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
        expect(result).to.deep.equal(menuBuilt);
    });

    it('Testcase - getMenuTpl - item', function() {
        var parser = new GitWikiToHTML();
        parser.menu = menuBuilt;
        var result = parser.getMenuTpl('Item-page-1', 'en:Help:Categ-page:Item-page-1', null, null, 'item');
        expect(result).to.deep.equal('<li id="Help:Categ-page:Item-page-1"><a role="treeitem" href="/help/#Help:' +
        'Categ-page:Item-page-1" translate>Item page 1</a></li>\n');
    });

    it('Testcase - getMenuTpl - categ', function() {
        var parser = new GitWikiToHTML();
        parser.menu = menuBuilt;
        var result = parser.getMenuTpl('Categ-Page', null, '_SITEMS_', 2, 'categ');
        expect(result).to.deep.equal('<li><span class="ibm-subnav-heading" translate>Categ Page</span>\n' +
        '<ul class="ibm-level-2" role="tree">\n_SITEMS_\n</ul>\n</li>\n');
    });

    it('Testcase - getMenuTpl - categ level', function() {
        var parser = new GitWikiToHTML();
        parser.menu = menuBuilt;
        var result = parser.getMenuTpl('Categ-Page', null, '_SITEMS_', 1, 'categ');
        expect(result).to.deep.equal('<ul id="ibm-primary-links" role="tree" class="ibm-level-1">\n_SITEMS_\n</ul>\n');
    });

    it('Testcase - getMenu', function() {
        var parser = new GitWikiToHTML();
        parser.menu = menuBuilt;
        var result = parser.getMenu(menuBuilt['fr_ca']['Help']);
        expect(result).to.deep.equal('<ul id="ibm-primary-links" role="tree" class="ibm-level-1">\n' +
        '<li><span class="ibm-subnav-heading" translate>Categ 1</span>\n<ul class="ibm-level-2" ' +
        'role="tree">\n<li><span class="ibm-subnav-heading" translate>Categ 2</span>\n<ul class="' +
        'ibm-level-3" role="tree">\n<li id="fr_ca:Help:Categ-1:Categ-2:Page"><a role="treeitem" ' +
        'href="/help/#fr_ca:Help:Categ-1:Categ-2:Page" translate>Page</a></li>\n\n</ul>\n</li>\n\n' +
        '</ul>\n</li>\n\n</ul>\n');
    });
});

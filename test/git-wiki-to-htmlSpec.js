'use strict';

var expect = require('chai').expect,
    sinon = require('sinon'),
    rewire = require('rewire'),
    GitWikiToHTML = rewire('../lib/git-wiki-to-html.js');

describe('Testsuite - CloudantStore', function() {
    var fsMock = {
        statSync: function() {}
    };

    var fspMock = {
        readdir: function() {},
        writeFile: function() {},
        readFile: function() {}
    };

    var statSyncStub, readdirStub, writeFileStub, readFileStub;

    var dirContent = [
        '.git',
        'Home.md',
        'en:Help.md',
        'en:Help:Landing.md',
        'fr:Help.md',
        'test.txt'
    ];

    var dirFilteredContent = [
        'en:Help.md',
        'en:Help:Landing.md',
        'fr:Help.md'
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
    });

    afterEach(function() {
        readFileStub.restore();
        statSyncStub.restore();
        readdirStub.restore();
        writeFileStub.restore();
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
        parser.srcFiles = ['en:Help.md', 'en:Help:Landing.md'];
        sinon.stub(parser, 'validConfiguration').returns(true);
        readFileStub.returns(Promise.resolve('# content'));
        writeFileStub.returns(Promise.resolve());

        parser.transform()
        .then(() => {
            expect(readFileStub).calledTwice;
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
});

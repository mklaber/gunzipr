const chai = require('chai')
chai.use(require('sinon-chai'))
chai.use(require('chai-things'))
import * as path from 'path'
import * as mock from 'mock-fs'
import {expect, test} from '@oclif/test'
import {gzipSync} from 'zlib'
import * as fs from 'fs-extra'
import * as sinon from 'sinon'
import {inspect} from 'util'

import cmd = require('../src')
import {stub} from 'sinon'

describe('gunzipr', () => {
  let createReadStreamSpy: sinon.SinonSpy
  let createWriteStreamSpy: sinon.SinonSpy
  let removeSpy: sinon.SinonSpy
  const filesInFolder = {
    'fake-file.gz': gzipSync('fake-file-content'),
    'fake-file-2.gz': gzipSync('fake-file-2-content'),
    'sub-dir': {
      'fake-file-in-sub.gz': gzipSync('fake-file-in-sub-content'),
      'fake-file-in-sub-2.gz': gzipSync('fake-file-in-sub-2-content'),
      'file-to-skip.txt': 'file-to-skip-content',
    },
  }
  const mockStructure = {
    'some/dir': filesInFolder,
    '/absolute/dir': filesInFolder,
    'some/bad/dir': {
      ...{
        'bad-file.gz': 'not-gzipped-content',
      },
      ...filesInFolder,
      ...{
        // eslint-disable-next-line quote-props
        deeper: {
          'even-worse-file.gz': 'even-worse-file-content',
        },
      },
    },
    'some/alt-suffix/dir': {
      ...{
        'fake-file-alt.gzip': gzipSync('fake-file-alt-content'),
        'fake-file-alt-2.gzip': gzipSync('fake-file-alt-2-content'),
      },
      ...filesInFolder,
    },
    'some/dir/with/reportable/results': {
      // should find 4, gunzip 2 and fail 1
      'file-found.gz': gzipSync('file-found-content'),
      'file-found-2.gz': gzipSync('file-found-2-content'),
      'existing-file.gz': gzipSync('existing-file-content'),
      'existing-file': 'existing-file-content',
      'bad-file.gz': 'bad-file-content',
    },
    'some/dir/for/overwrite': {
      'file-found.txt.gz': gzipSync('file-found-content'),
      'file-found.txt': 'file-found-existing-content',
    },

    // pass through so that the sut can actually work
    'package.json': mock.load(path.resolve(__dirname, '../package.json')),
    // eslint-disable-next-line quote-props
    node_modules: mock.load(path.resolve(__dirname, '../node_modules')),
  }

  beforeEach(() => {
    mock(mockStructure)
    // mock-fs has already wrapped these, so unwrap them
    sinon.restore()
    createReadStreamSpy = sinon.spy(fs, 'createReadStream')
    createWriteStreamSpy = sinon.spy(fs, 'createWriteStream')
    removeSpy = sinon.spy(fs, 'remove')
  })

  const expectToCallFile = (
    spy: sinon.SinonSpy<string[], any>,
    fileName: string
  ): void => {
    const paths = ([] as string[]).concat(...spy.getCalls().map(c => c.args))
    // eslint-disable-next-line no-console
    console.log(inspect(paths))
    expect(paths).to.contain.something.that.matches(
      new RegExp(fileName.replace('.', '\\.') + '$'),
      `should have been called with a path to ${fileName}`
    )
  }

  const expectNotToCallFile = (
    spy: sinon.SinonSpy<string[], any>,
    fileName: string
  ): void => {
    const paths = ([] as string[]).concat(...spy.getCalls().map(c => c.args))
    // eslint-disable-next-line no-console
    console.log(inspect(paths))
    expect(paths).not.to.contain.something.that.matches(
      new RegExp(fileName.replace('.', '\\.') + '$'),
      `should not have been called with a path to ${fileName}`
    )
  }

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--keep', '--verbose', 'some/dir']))
  .it('works', ctx => {
    expect(ctx.stdout).to.contain('fake-file.gz')

    expect(createReadStreamSpy.called)
    expect(createWriteStreamSpy.called)

    expect(fs.existsSync('some/dir/fake-file.gz'), 'should keep file').to.be
    .true
    expect(
      fs.existsSync('some/dir/fake-file'),
      'should write to similarly named file'
    ).to.be.true

    expect(
      fs.readFileSync('some/dir/fake-file', 'utf-8'),
      'should decompress file'
    ).to.equal('fake-file-content')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--keep', '--verbose', 'some/dir']))
  .it('keeps gz files', ctx => {
    expect(removeSpy).to.not.have.been.called
    expect(createReadStreamSpy.called).is.true
    expect(ctx.stdout).not.to.contain('[rm]')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--verbose', 'some/dir']))
  .it('deletes gunzipped files', ctx => {
    expect(removeSpy).to.have.been.called
    expect(ctx.stdout).to.contain('[rm]')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--verbose', 'some/dir']))
  .it('skips non .gz files', ctx => {
    expectNotToCallFile(createReadStreamSpy, 'file-to-skip.txt')
    expect(ctx.stdout).not.to.contain('file-to-skip')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--verbose', 'some/dir/for/overwrite']))
  .it('does not overwrite files', _ctx => {
    expectNotToCallFile(createReadStreamSpy, 'file-found.txt.gz')
    expectNotToCallFile(createWriteStreamSpy, 'file-found.txt')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--verbose', '--overwrite', 'some/dir/for/overwrite']))
  .it('overwrites files', ctx => {
    expectToCallFile(createReadStreamSpy, 'file-found.txt.gz')
    expectToCallFile(createWriteStreamSpy, 'file-found.txt')
    expect(ctx.stderr).to.match(/overwrite.+file-found\.txt/)
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--verbose', '--suffix=.gzip', 'some/alt-suffix/dir']))
  .it('uses alternate suffix', _ctx => {
    expect(createWriteStreamSpy).to.have.been.calledTwice
    expect(createReadStreamSpy).to.have.been.calledTwice
    expectToCallFile(createWriteStreamSpy, 'fake-file-alt')
    expectToCallFile(createWriteStreamSpy, 'fake-file-alt-2')
    expectToCallFile(createReadStreamSpy, 'fake-file-alt.gzip')
    expectToCallFile(createReadStreamSpy, 'fake-file-alt-2.gzip')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--verbose', 'some/dir']))
  .it('verbose should be verbose', ctx => {
    expect(ctx.stdout).to.contain('some/dir')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['some/dir']))
  .it('is not verbose unless asked', ctx => {
    expect(ctx.stdout).not.to.contain('some/dir')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--verbose', 'some/bad/dir']))
  .it('skips errors', ctx => {
    expectToCallFile(createWriteStreamSpy, 'bad-file')
    expectToCallFile(createWriteStreamSpy, 'even-worse-file')
    expect(ctx.stderr).to.contain('bad-file.gz')
    expect(ctx.stderr).to.contain('even-worse-file.gz')
    expect(ctx.stdout).to.contain('2 .gz file(s) failed')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--verbose', 'some/dir/with/reportable/results']))
  .it('reports results', ctx => {
    expect(ctx.stdout).to.contain('4 .gz file(s) found')
    expect(ctx.stdout).to.contain('3 .gz file(s) gunzipped')
    expect(ctx.stdout).to.contain('1 .gz file(s) failed')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run(['--verbose', '/absolute/dir']))
  .it('works with an absolute dir', _ctx => {
    // just make sure a file got found and written
    expectToCallFile(createWriteStreamSpy, 'fake-file')
  })

  test
  .stdout()
  .stderr()
  .do(() => cmd.run([]))
  .catch(error => expect(error.message).to.match(/Path to gunzip/i))
  .it('requires an argument')

  test
  .stdout()
  .stderr()
  .do(() => {
    stub(require('zlib'), 'createGunzip').throws(new Error('some error'))
  })
  .do(() => cmd.run(['--keep', '--verbose', 'some/dir']))
  .catch('some error')
  .it('throws all other errors')

  afterEach(() => {
    mock.restore()
  })
})

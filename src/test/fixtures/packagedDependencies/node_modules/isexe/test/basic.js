var t = require('tap')
var fs = require('fs')
var path = require('path')
var fixture = path.resolve(__dirname, 'fixtures')
var meow = fixture + '/meow.cat'
var fail = fixture + '/fail.false'
var noent = fixture + '/enoent.exe'
var mkdirp = require('mkdirp')
var rimraf = require('rimraf')

var isWindows = process.platform === 'win32'
var hasAccess = typeof fs.access === 'function'
var winSkip = isWindows && 'windows'
var accessSkip = !hasAccess && 'no fs.access function'
var hasPromise = typeof Promise === 'function'
var promiseSkip = !hasPromise && 'no global Promise'

function reset () {
  delete require.cache[require.resolve('../')]
  return require('../')
}

t.test('setup fixtures', function (t) {
  rimraf.sync(fixture)
  mkdirp.sync(fixture)
  fs.writeFileSync(meow, '#!/usr/bin/env cat\nmeow\n')
  fs.chmodSync(meow, parseInt('0755', 8))
  fs.writeFileSync(fail, '#!/usr/bin/env false\n')
  fs.chmodSync(fail, parseInt('0644', 8))
  t.end()
})

t.test('promise', { skip: promiseSkip }, function (t) {
  isexe = reset()
  t.test('meow async', function (t) {
    isexe(meow).then(function (is) {
      t.ok(is)
      t.end()
    })
  })
  t.test('fail async', function (t) {
    isexe(fail).then(function (is) {
      t.notOk(is)
      t.end()
    })
  })
  t.test('noent async', function (t) {
    isexe(noent).catch(function (er) {
      t.ok(er)
      t.end()
    })
  })
  t.test('noent ignore async', function (t) {
    isexe(noent, { ignoreErrors: true }).then(function (is) {
      t.notOk(is)
      t.end()
    })
  })
  t.end()
})

t.test('access', { skip: accessSkip || winSkip }, function (t) {
  runTest(t)
})

t.test('mode', { skip: winSkip }, function (t) {
  delete fs.access
  delete fs.accessSync
  runTest(t)
})

t.test('windows', function (t) {
  global.TESTING_WINDOWS = true
  process.env.PATHEXT = '.EXE;.CAT;.CMD;.COM'
  runTest(t)
})

t.test('cleanup', function (t) {
  rimraf.sync(fixture)
  t.end()
})

function runTest (t) {
  var isexe = reset()

  t.notOk(isexe.sync(fail))
  t.notOk(isexe.sync(noent, { ignoreErrors: true }))
  t.ok(isexe.sync(meow))
  t.throws(function () {
    isexe.sync(noent)
  })

  t.test('meow async', function (t) {
    isexe(meow, function (er, is) {
      if (er) {
        throw er
      }
      t.ok(is)
      t.end()
    })
  })

  t.test('fail async', function (t) {
    isexe(fail, function (er, is) {
      if (er) {
        throw er
      }
      t.notOk(is)
      t.end()
    })
  })

  t.test('noent async', function (t) {
    isexe(noent, function (er, is) {
      t.ok(er)
      t.notOk(is)
      t.end()
    })
  })

  t.test('noent ignore async', function (t) {
    isexe(noent, { ignoreErrors: true }, function (er, is) {
      if (er) {
        throw er
      }
      t.notOk(is)
      t.end()
    })
  })

  t.end()
}

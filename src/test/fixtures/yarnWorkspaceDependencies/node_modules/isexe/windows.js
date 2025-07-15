module.exports = isexe
isexe.sync = sync

var fs = require('fs')

function checkPathExt (path) {
  var pathext = process.env.PATHEXT
  if (!pathext) {
    return true
  }
  pathext = pathext.split(';')
  for (var i = 0; i < pathext.length; i++) {
    var p = pathext[i].toLowerCase()
    if (p && path.substr(-p.length).toLowerCase() === p) {
      return true
    }
  }
  return false
}

function isexe (path, cb) {
  fs.stat(path, function (er, st) {
    cb(er, er ? false : checkPathExt(path))
  })
}

function sync (path) {
  fs.statSync(path)
  return checkPathExt(path)
}

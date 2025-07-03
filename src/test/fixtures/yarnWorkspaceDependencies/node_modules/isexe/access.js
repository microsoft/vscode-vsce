module.exports = isexe
isexe.sync = sync

var fs = require('fs')

function isexe (path, cb) {
  fs.access(path, fs.X_OK, function (er) {
    cb(er, !er)
  })
}

function sync (path) {
  fs.accessSync(path, fs.X_OK)
  return true
}

module.exports = isexe
isexe.sync = sync

var fs = require('fs')

function isexe (path, cb) {
  fs.stat(path, function (er, st) {
    cb(er, er ? false : checkMode(st))
  })
}

function sync (path) {
  return checkMode(fs.statSync(path))
}

function checkMode (stat) {
  var mod = stat.mode
  var uid = stat.uid
  var gid = stat.gid
  var u = parseInt('100', 8)
  var g = parseInt('010', 8)
  var o = parseInt('001', 8)
  var ug = u | g

  var ret = (mod & o) ||
    (mod & g) && process.getgid && gid === process.getgid() ||
    (mod & u) && process.getuid && uid === process.getuid() ||
    (mod & ug) && process.getuid && process.getuid() === 0

  return ret
}

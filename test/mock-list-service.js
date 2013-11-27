var _ = require('lodash')
  , lists = {}
  , id = 0

module.exports =
  { read: function (id, cb) {
      cb(null, lists[id])
    }
  , create: function (list, cb) {
      var _id = '_' + id++
      lists[_id] = list
      cb(null, _.extend({ _id: _id }, list))
    }
  }

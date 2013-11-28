var schemata = require('schemata')

module.exports = function () {
  return schemata(
    { _id:
      { type: String
      , tag: ['root']
      }
    , parent:
       { type: String
       , tag: ['root']
       }
    , visible:
      { type: Boolean
      , tag: ['root']
      , defaultValue: false
      , validators:
        { all: []
        }
      }
    , teaserLists:
      { type: Object
      , defaultValue: function () {
          return {}
        }
      }
    })
}

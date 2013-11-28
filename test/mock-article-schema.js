var schemata = require('schemata')

module.exports = function () {

  return schemata(
    { _id:
      { type: String
      }
    , state:
      { type: String
      , options: ['Draft', 'Published', 'Archived', 'Trashed']
      , defaultValue: 'Draft'
      , validators:
        { all: []
        }
      }
    , shortTitle:
      { type: String
      , name: 'Short Head'
      , validators:
        { draft: []
        , published: []
        , archived: []
        }
      }
    , longTitle:
      { type: String
      , name: 'Headline'
      , validators:
        { draft: []
        , published: []
        , archived: []
        }
      }
    , subTitle:
      { type: String
      , name: 'Sell'
      , validators:
        { draft: []
        , published: []
        , archived: []
        }
      }
    , type:
      { type: String
      , defaultValue: 'article'
      , validators:
        { draft: []
        , published: []
        , archived: []
        }
      }
    })
}

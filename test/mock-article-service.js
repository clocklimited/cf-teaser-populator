var _ = require('lodash')
  , save = require('save')
  , crudService = require('crud-service')
  , logger = require('mc-logger')

function createPublicQuery(query, options) {
  var now = options && options.date ? options.date : new Date()
    , publicQuery = _.extend({}, query,
    { state: 'Published'
    , $and:
      [ { $or: [{ liveDate: null }, { liveDate: { $lte: now } }] }
      , { $or: [{ expiryDate: null }, { expiryDate: { $gte: now } } ] }
      ]
    })

  if (query.previewId) {
    publicQuery = query
  }

  return publicQuery
}

module.exports = function(saveEngine) {
  var articleSave = save('article', { engine: saveEngine, debug: false, logger: logger })
    , schema = require('./mock-article-schema')()
    , service = crudService('article', articleSave, schema)

  // Find the articles that are available to the public
  service.findPublic = function (query, options, callback) {
    service.find(createPublicQuery(query, options), options, callback)
  }

  return service
}

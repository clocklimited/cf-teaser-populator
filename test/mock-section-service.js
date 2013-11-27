var save = require('save')
  , crudService = require('crud-service')
  , logger = require('mc-logger')
  , _ = require('lodash')

function getQuery(query) {
  var now = new Date()
    , publicQuery = _.extend({}, query,
    { visible: true
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
  var sectionSave = save('section', { engine: saveEngine, debug: false, logger: logger })
    , schema = require('fleet-street/bundles/section/schema')([], sectionSave)
    , liteSchema = require('fleet-street/bundles/section/lite-schema')()
    , service = crudService('section', sectionSave, schema)

  service.findPublic = function (query, options, callback) {
    var publicQuery = getQuery(query)
    service.find(publicQuery, options, callback)
  }

  // This should be refactored out to use oakify and the changes be put back into
  // fleet-street
  service.getChildSections = function (parent, sections, maxDepth, depth) {

    var items = []
    maxDepth = maxDepth ? maxDepth : 0

    sections.forEach(function (section) {
      var currentDepth = depth ? depth : 1
      if (section.parent === parent) {

        var item = liteSchema.stripUnknownProperties(liteSchema.makeDefault(section))

        item.subItems = []

        if (maxDepth !== currentDepth) {
          item.subItems = service.getChildSections(section._id, sections, maxDepth, currentDepth + 1)
        }

        items.push(item)
      }
    })

    return items
  }

  return service
}

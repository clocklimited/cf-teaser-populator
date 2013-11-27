var save = require('save')
  , crudService = require('crud-service')
  , logger = require('mc-logger')

module.exports = function(saveEngine) {
  var tagSave = save('tag', { engine: saveEngine, debug: false, logger: logger })
    , schema = require('fleet-street/bundles/tag/schema')([], tagSave)
    , service = crudService('tag', tagSave, schema)

  return service
}

var MongoClient = require('mongodb').MongoClient
  , dbConnection
  , connectionTimes = 0
  , timesCalled = 0
  , mongoHost = process.env.NODE_MONGO_HOST || '127.0.0.1'
  , mongoPort = process.env.NODE_MONGO_PORT || 27017

module.exports.connect = function(done) {
  connectionTimes += 1
  if (dbConnection) return done(null, dbConnection)

  var mongoConnectionString = 'mongodb://' + mongoHost + ':' + mongoPort + '/cf-teaser-populator-tests'
  MongoClient.connect(mongoConnectionString, function (error, db) {

    dbConnection = db

    // Start with an empty database
    db.dropDatabase(function() {
      return done(null, dbConnection)
    })
  })
}

module.exports.disconnect = function (done) {
  timesCalled += 1
  // Only calling dbConnection#close once at the end
  if (timesCalled === connectionTimes) {
    dbConnection.dropDatabase()
    dbConnection.close()
  }
  done()
}

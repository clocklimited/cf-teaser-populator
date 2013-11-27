var MongoClient = require('mongodb').MongoClient
  , dbConnection
  , connectionTimes = 0
  , timesCalled = 0

module.exports.connect = function(done) {
  connectionTimes += 1
  if (dbConnection) return done(null, dbConnection)

  MongoClient.connect('mongodb://127.0.0.1/cf-teaser-populator-tests', function (error, db) {

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

var articleFixtures = require('fleet-street/test/article/fixtures')
  , async = require('async')
  , should = require('should')
  , saveMongodb = require('save-mongodb')
  , _ = require('lodash')
  , nullLogger = require('mc-logger')
  // , uberCache = require('uber-cache')
  , createTeaserPopulator = require('../teaser-populator')
  , createDedupeAggregator = require('cf-dedupe-list-aggregator')
  , teaserPopulator
  , hierarchyBuilder = require('fleet-street/lib/hierarchy-builders/section')
  , slugUniquer = 1
  // Global to allow checks once articles are created
  , articles = [[],[]]
  , dbConnect = require('./db-connection')
  , sectionService
  , articleService
  , tagService
  , listService

function createSections(lists, cb) {

  var topLevel =
      [ { name: 'Home'
        , visible: true
        , slug: 'home'
        , displayInNav: true
        , order: 1
        , teaserLists: { testTeaser: { lists: [ lists[0]._id ] }, desired: { lists: [ lists[1]._id ] } }
        }
      , { name: 'Section A', visible: true, slug: 'A', displayInNav: true, order: 2 }
      , { name: 'Section B'
        , visible: true
        , slug: 'B'
        , displayInNav: true
        , order: 3
        , teaserLists: { testTeaser: { lists: [ lists[0]._id ] } } }
      , { name: 'Section C', visible: true, slug: 'C', displayInNav: true, order: 4 }
      ]
  async.map(topLevel, sectionService.create, function (err, results) {
    var secondLevel =
      [ { name: 'Sub Section B.1'
        , visible: true
        , slug: '1'
        , parent: results[2]._id
        , order: 7
        }
      , { name: 'Sub Section B.2'
        , visible: true
        , slug: '2'
        , parent: results[2]._id
        , order: 8
        , teaserLists: { testTeaser: { lists: [ lists[0]._id ] } }
        }
      ]
    async.map(secondLevel, sectionService.create, function (err, results) {
      var thirdLevel =
        [ { name: 'Sub-sub Section B.1a'
          , visible: true
          , slug: 'a'
          , parent: results[0]._id
          , order: 9
          }
        , { name: 'Sub-sub Section B.1b'
          , visible: true
          , slug: 'b'
          , parent: results[0]._id
          , order: 10
          , teaserLists: { testTeaser: { lists: [ lists[0]._id ] } }
          }
        ]
      async.map(thirdLevel, sectionService.create, function (err) {
        cb(err)
      })
    })

  })
}

function createList(cb) {
  var lists = []

  async.series(
  [ publishedArticleMaker(articles[0])
  , publishedArticleMaker(articles[0])
  , publishedArticleMaker(articles[0])
  , publishedArticleMaker(articles[0])
  , publishedArticleMaker(articles[0])
  , publishedArticleMaker(articles[1])
  , publishedArticleMaker(articles[1])
  , publishedArticleMaker(articles[1])
  , publishedArticleMaker(articles[1])
  , publishedArticleMaker(articles[1])
  , function (cb) {
      // Get the first 2 articles from second list, and duplicate to test list
      articles[0] = articles[0].concat(articles[1].slice(0, 2))

      listService.create(
          { type: 'manual'
          , name: 'test list'
          , articles: articles[0]
          , limit: 100
          }
        , function (err, res) {
            lists[0] = res
            cb(null, res)
          })
    }
  , function (cb) {
      listService.create(
          { type: 'manual'
          , name: 'second list'
          , articles: articles[1]
          , limit: 100
          }
        , function (err, res) {
            lists[1] = res
            cb(null, res)
          })
    }
  ], function (err) {
    if (err) return cb(err)
    return cb(null, lists)
  })
}

function publishedArticleMaker(articles, custom) {
  return function (cb) {
    var model = _.extend({}, articleFixtures.validNewPublishedModel, custom)

    // Make slug unique to stop validation errors (slug and section unique)
    model.slug += slugUniquer
    slugUniquer++

    articleService.create(model, function (err, result) {
      if (err) return cb(err)
      articles.push(_.extend({}, { articleId: result._id }, custom))
      cb(null)
    })
  }
}


describe('Teaser Populator', function () {

  // Initialize the mongo database
  before(function (done) {

    dbConnect.connect(function (error, db) {

      function persistence(name) {
        return saveMongodb(db.collection(name + Date.now()))
      }

      articleService = require('./mock-article-service')(persistence('article'))
      tagService = require('./mock-tag-service')(persistence('tag'))
      sectionService = require('./mock-section-service')(persistence('section'))
      listService = require('./mock-list-service')

        // .register('cache', uberCache())

      var aggregate = createDedupeAggregator(listService, sectionService,
        articleService, { logger: nullLogger })

      teaserPopulator = createTeaserPopulator(aggregate)
      createList(function (err, lists) {
        if (err) return done(err)
        createSections(lists, function (err) {
          if (err) return done(err)
          done()
        })
      })
    })

  })

  after(dbConnect.disconnect)

  describe('populate()', function () {

    it('should swap out each array of ids on the teaserList property for actual articles', function (done) {

      hierarchyBuilder(sectionService)({}, function (err, hierarchy) {
        if (err) return done(err)
        teaserPopulator(hierarchy, function (err, sections) {
          if (err) return done(err)
          sections.forEach(function (section) {
            Object.keys(section.teaserLists).forEach(function (key) {

              // Only the sections that had lists should have articles
              if (section.slug === '1' || section.slug === 'a') {
                section.teaserLists[key].articles.should.have.length(0)
              } else {
                section.teaserLists[key].articles.length.should.be.above(0)
              }

              // Make sure supposed articles have got some article-y fields
              section.teaserLists[key].articles.forEach(function (article) {
                article.should.have.property('_id')
                article.should.have.property('type')
                article.should.and.have.property('shortTitle')
                article.should.and.have.property('longTitle')
                article.should.and.have.property('subTitle')
              })

            })
          })
          done()
        })
      })
    })

    it('should not go deeper than maxDepth', function (done) {

      hierarchyBuilder(sectionService)({}, function (err, hierarchy) {
        if (err) return done(err)
        teaserPopulator(hierarchy, 1, function (err, sections) {
          if (err) return done(err)
          sections.forEach(function (section) {
            // Only the top level sections should have articles
            if (section.teaserLists.testTeaser) {
              section.teaserLists.testTeaser.articles.length.should.be.above(0)
              if (section.subItems.length) {
                should.not.exist(section.subItems[1].teaserLists.testTeaser.articles)
              }
            }
          })
          done()
        })
      })
    })

    it('should only retrieve the desiredLists if present', function (done) {

      hierarchyBuilder(sectionService)({}, function (err, hierarchy) {
        if (err) return done(err)
        teaserPopulator(hierarchy, 1, [ 'desired' ], function (err, sections) {
          if (err) return done(err)
          sections.forEach(function (section) {
            // Only the top level sections should have articles
            if (section.slug === 'home') {
              section.teaserLists.desired.articles.length.should.be.above(0)
            }
            if (section.teaserLists.testTeaser) {
              should.not.exist(section.teaserLists.testTeaser.articles)
            }
          })
          done()
        })
      })
    })

    /*
     * As the list size is 7, and 2 articles are duplicated at the end, setting
     * the maxListSize to 6 will return the second duplicated article in the
     * second list, but not the first
     */
    it('should not dedupe not visible articles from second desiredLists if maxListSize is defined', function (done) {

      hierarchyBuilder(sectionService)({}, function (err, hierarchy) {
        if (err) return done(err)
        teaserPopulator(hierarchy, 1, [ 'testTeaser', 'desired' ], 6, function (err, sections) {
          if (err) return done(err)
          sections.forEach(function (section) {
            // Only the top level sections should have articles
            if (section.slug === 'home') {
              section.teaserLists.desired.articles.length.should.be.above(0)
              section.teaserLists.testTeaser.articles.length.should.be.above(0)

              should.exist(section.teaserLists.desired.articles)
              should.exist(section.teaserLists.testTeaser.articles)

              // This item should be the second duplicated article from the desired list, NOT the first
              section.teaserLists.desired.articles[0]._id.should.equal(articles[1][1].articleId)

              // This item should be the first non-duplicated article from the desired list
              section.teaserLists.desired.articles[1]._id.should.equal(articles[1][2].articleId)
            }
          })
          done()
        })
      })
    })

    /*
     * Setting the maxListSize to 2 will return the first 2 items from both
     * lists, as the duplicated items will not be within the dedupe limit
     */
    it('should dedupe visible articles from second desiredLists if maxListSize is defined', function (done) {
      hierarchyBuilder(sectionService)({}, function (err, hierarchy) {
        if (err) return done(err)
        teaserPopulator(hierarchy, 1, [ 'testTeaser', 'desired' ], 2, function (err, sections) {
          if (err) return done(err)
          sections.forEach(function (section) {
            // Only the top level sections should have articles
            if (section.slug === 'home') {
              section.teaserLists.desired.articles.length.should.be.above(0)
              section.teaserLists.testTeaser.articles.length.should.be.above(0)

              should.exist(section.teaserLists.desired.articles)
              should.exist(section.teaserLists.testTeaser.articles)

              // This item should be the first duplicated article from the desired list
              section.teaserLists.desired.articles[0]._id.should.equal(articles[1][0].articleId)

              // This item should be the second duplicated article from the desired list
              section.teaserLists.desired.articles[1]._id.should.equal(articles[1][1].articleId)
            }
          })
          done()
        })
      })
    })

    it('should callback with the error if dedupeListAggregator calls the cb with error', function (done) {
      function aggregate(lists, dedupe, maxListSize, section, cb) {
        cb(new Error('This is a list aggregator error'))
      }

      var testTeaserPopulator = createTeaserPopulator(aggregate)

      hierarchyBuilder(sectionService)({}, function (err, hierarchy) {
        testTeaserPopulator(hierarchy, 1, [ 'desired' ], function (err) {
          err.message.should.equal('This is a list aggregator error')
          done()
        })
      })
    })

  })

})

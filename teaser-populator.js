module.exports = createTeaserPopulator

var async = require('async')
  , doorman = require('doorman')

function createTeaserPopulator(dedupeListAggregator) {

  /*
   * Takes a navigation hierarchy and populates the
   * teaserLists field with the actual article contents
   * using the list aggregator. Use the maxDepth argument
   * to limit how many levels of the hierarchy get articles.
   * Use maxListSize to make sure articles aren't deduped from
   * a desired list that are not shown.
   */
  function populate(hierarchy, maxDepth, desiredLists, maxListSize, cb) {

    if (typeof maxDepth === 'function') {
      cb = maxDepth
      maxDepth = Infinity
      maxListSize = null
      desiredLists = undefined
    }

    if (typeof desiredLists === 'function') {
      cb = desiredLists
      maxListSize = null
      desiredLists = undefined
    }

    if (typeof maxListSize === 'function') {
      cb = maxListSize
      maxListSize = null
    }

    function aggregateLists(section, cb) {
      // Use the passed in desired lists, otherwise default to getting all lists
      var listNames = Array.isArray(desiredLists) ? desiredLists : Object.keys(section.teaserLists)
        , dedupe = doorman()

      function eachList(key, cb) {
        var desiredList = section.teaserLists[key]
        // Call back if the section doesn't have the desired list
        if (!desiredList) return cb(null)

        dedupeListAggregator(desiredList.lists, dedupe, maxListSize, section, function (err, articles) {
          if (err) return cb(err)
          section.teaserLists[key].articles = articles
          cb(null)
        })
      }

      async.eachSeries(listNames, eachList, cb)
    }

    function eachLevel(depth, section, cb) {
      // Create a container for the async functions that might get called on this section
      var toCall = []

      // If this section has child sections, push a call to descend it (and bump the recursion depth count)
      if (section.subItems.length) {
        toCall.push(function (cb) {
          descend(section.subItems, depth + 1, cb)
        })
      }

      // If this section has any teaserLists, they need to be aggregated
      if (section.teaserLists && Object.keys(section.teaserLists).length > 0) {
        toCall.push(aggregateLists.bind(null, section))
      }

      // There are no sub items to recurse and no lists to populate
      if (!toCall.length) return cb(null)

      // Recurse the sub items and populate the lists in parallel, then call back
      async.parallel(toCall, cb)
    }

    /*
     * This is a scary async recursive function and I am very scared – Ben G
     */
    function descend(level, depth, cb) {

      // Only recurse down to maxDepth
      if (depth > maxDepth) return cb(null)

      // Operate on each item in parallel
      async.each(level, eachLevel.bind(null, depth), cb)
    }

    // Begin the recursive descent of the hierarchy
    descend(hierarchy, 1, function (err) {
      if (err) return cb(err)
      cb(null, hierarchy)
    })

  }

  return populate

}

'use strict'

const expect = require('chai').expect
const DataLimbo = require('../index')
const middleman = DataLimbo.middleman
const NEW = DataLimbo.NEW
const DELETED = DataLimbo.DELETED
const RETAINED = DataLimbo.RETAINED
const DIRTY = DataLimbo.DIRTY
const _ = require('lodash')

describe("Function middleman", function () {
    var target // an ordinary object
    var midMan // the proxied middle man
    var targetBeforeChange
    beforeEach(function(){
        target = {a:'A',o:{n:42, useless:'void'}, toDelete:42}
        midMan = middleman(target)
        targetBeforeChange = JSON.stringify(target)
    })
    function makeSomeChanges(tf) {
        tf.a='AA' // update a property
        tf.o.n = 43
        tf.x={} // add a property object
        tf.y={null:null} // add a property object with nested properties
        tf.o.z = {name:'bing'} // add nested property
        tf.nn='NNNN' // add a property value
        delete tf.toDelete
        delete tf.o.useless
        tf.o.n = 42 // change it back
    }
    it("Middleman should be a proxy with basic properties", function(){
        expect(midMan.$isProxy).true
        expect(midMan.$principal).to.equal(target)
        expect(typeof midMan.$proxyKeyMap).to.equal("object")
        expect(midMan.$propertyState()===RETAINED)
        expect(midMan.o.$propertyState()===RETAINED)
        expect(midMan.$propertyState('a')===RETAINED)
        expect(midMan.$changed).false
        expect(midMan.$testPrincipalEqual()).true
        expect(midMan.$testPrincipalEqual('a')).true
        expect(midMan.$testPrincipalEqual('not///exist')).undefined
        expect(midMan.o.$propertyState('n')).to.equal(RETAINED)
        expect(midMan.o.$testPrincipalEqual('n')).true
    })
    it("Middleman should look the same as target", function(){
        expect(JSON.stringify(midMan)).to.equal(targetBeforeChange)
        expect(_.isEqual(midMan, target)).true
    })
    it("Middleman should work like target but not changing target before commit", function(){
        makeSomeChanges(midMan)
        expect(midMan.$changed).true
        expect(midMan.o.$changed).true
        expect(midMan.$propertyState('a')).to.equal(DIRTY)
        expect(midMan.$propertyState('x')).to.equal(NEW)
        expect(midMan.x.$propertyState()).to.equal(NEW)
        expect(midMan.$propertyState('y')).to.equal(NEW)
        expect(midMan.y.$propertyState()).to.equal(NEW)
        expect(midMan.o.$propertyState()).to.equal(RETAINED)
        expect(midMan.$propertyState('o')).to.equal(RETAINED)
        expect(midMan.$propertyState('toDelete')).to.equal(DELETED)
        expect(midMan.o.$propertyState('useless')).to.equal(DELETED)
        expect(JSON.stringify(midMan)).not.equal(JSON.stringify(target))
        expect(JSON.stringify(target)).to.equal(targetBeforeChange)
        expect(midMan.$testPrincipalEqual()).true
        expect(midMan.$testPrincipalEqual('a')).false
        expect(midMan.$testPrincipalEqual('not///exist')).undefined
        expect(midMan.o.$propertyState('n')).to.equal(DIRTY)
        expect(midMan.o.$testPrincipalEqual('n')).true // changed but still equal
        makeSomeChanges(target) // make the same changes
        expect(JSON.stringify(midMan)).to.equal(JSON.stringify(target))
        expect(_.isEqual(midMan, target)).true
    })
    it("Changes should be correctly reflected to target after commit", function(){
        makeSomeChanges(midMan)
        const midManJSON = JSON.stringify(midMan)
        midMan.$commit()
        // after commit, every thing should be RETAINED again
        expect(midMan.$changed).false
        expect(midMan.o.$changed).false
        expect(midMan.$propertyState('a')).to.equal(RETAINED)
        expect(midMan.$propertyState('x')).to.equal(RETAINED)
        expect(midMan.x.$propertyState()).to.equal(RETAINED)
        expect(midMan.$propertyState('y')).to.equal(RETAINED)
        expect(midMan.y.$propertyState()).to.equal(RETAINED)
        expect(midMan.o.$propertyState()).to.equal(RETAINED)
        expect(midMan.$propertyState('o')).to.equal(RETAINED)
        expect(midMan.$propertyState('toDelete')).to.equal(undefined)
        expect(midMan.o.$propertyState('useless')).to.equal(undefined)
        expect(midMan.$testPrincipalEqual()).true
        expect(midMan.$testPrincipalEqual('a')).true
        expect(midMan.$testPrincipalEqual('not///exist')).undefined
        expect(midMan.o.$propertyState('n')).to.equal(RETAINED)
        expect(midMan.o.$testPrincipalEqual('n')).true

        const targetJSON = JSON.stringify(target)
        expect(targetJSON).to.equal(midManJSON)
        expect(_.isEqual(midMan, target)).true
    })
})
'use strict'

/**
 * Vuex store front
 * 
 * Provide a store front as a middleman between form components (inputs) and Vuex store. 
 * When getting a value from the store, the store front retrieve the value and return to component, and at the same time 
 * retain a copy. Later retrieval returns the copy instead of obtaining the value from store. When setting a value, the store
 * front retain the value, marked 'dirty', without setting it in the store. When committing, the store front optionally validates the
 * retained & dirty values, and if validation succeeds, set the values to store with a commit.
 * 
 * The store front only deals with string path that does not start with "__".
 * 
 */

const DIRTY = 'DIRTY'
const NEW = 'NEW'

class MiddlemanHandler {
    constructor(target) {
        this.__keyMap = {}
        this.__statMap = {}
        this.__target = target
    }
    get(target, key, context) {
        // this would be the handler instance
        // target would be a store module or state, or anything
        // key would be a string or Symbol
        // context would be the Proxy
        if (target !== this.__target) {
            throw "ERROR: MiddlemanHandler can only be used to its target!"
        }
        // first some markers
        if (key === '__isProxy') {
            return true
        }
        if (key === '__proxyKeyMap') {
            return this.__keyMap
        }
        if (key === '__proxyTarget') {
            return this.__target
        }
        if (key === '__proxyStateMap') {
            return this.__statMap
        }

        // first to check if a copy/proxy of the property is already retained
        const retainedProp = this.__keyMap[key]
        if (retainedProp !== undefined) {
            // exists a retained copy/proxy, simply return it
            return retainedProp
        } else {
            // now check if an value exists at target
            const targetProp = Reflect.get(...arguments)
            // if key not defined at target, just return undefined
            if (targetProp === undefined) {
                return undefined
            }
            if (typeof targetProp !== "object" || targetProp === null) {
                // retain a copy and return
                this.__keyMap[key] = targetProp
                return targetProp
            }
            // retain a proxy and return
            const proxiedTargetPropObj = Middleman(targetProp)
            this.__keyMap[key] = proxiedTargetPropObj
            return proxiedTargetPropObj
        }
    }

    set(target, key, value) {
        if (target !== this.__target) {
            throw "ERROR: MiddlemanHandler can only be used to its target!"
        }
        var retained
        if (typeof value !== "object" || value === null) {
            // retain and set dirty
            retained = value
        } else {
            retained = Middleman(value)
        }
        var state
        if (key in target) {
            state = DIRTY
        } else {
            state = NEW
        }
        this.__keyMap[key] = retained
        this.__statMap[key] = state
    }

    ownKeys(target) {
        if (target !== this.__target) {
            throw "ERROR: MiddlemanHandler can only be used to its target!"
        }
        const ownKeys = Reflect.ownKeys(target)
        // add new keys
        for (var key in this.__statMap) {
            if (this.__statMap[key] === NEW) {
                ownKeys.push(key)
            }
        }
        return ownKeys

    }

    has(target, key) {
        if (target !== this.__target) {
            throw "ERROR: MiddlemanHandler can only be used to its target!"
        }
        if (key in target) {
            return true
        }
        return this.__statMap[key] === NEW || this.__statMap[key] === DIRTY
    }

    getOwnPropertyDescriptor(target, key) {
        if (this.__statMap[key] === NEW) {
            return {
                configurable: true,
                enumerable: true,
                value: this.__keyMap[key]
            }
        }
        return Reflect.getOwnPropertyDescriptor(...arguments)

    }
}

function Middleman(target) {
    const handler = new MiddlemanHandler(target)
    return new Proxy(target, handler)
}

module.exports = {
    Middleman: Middleman,
    MiddlemanHandler: MiddlemanHandler
}
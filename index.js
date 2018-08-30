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
const RETAINED = 'RETAINED'
const DELETED = 'DELETED'

/**
 * Proxy handler class, attach a new instance for each target
 */
class MiddlemanHandler {
    constructor(target) {
        this.keyMap = {} // { keyOfAProperty: {value:valueOfProperty,state:STATE,validator:(value)=>{}}}
        this.target = target
    }

    assertAttachment(target) {
        if (target !== this.target) {
            throw TypeError("ERROR: MiddlemanHandler can only be used to its target!")
        }
    }

    commit() {
        // make sure this is called in the context of the proxy
        if (!(this.$isProxy)) {
            throw TypeError("commit() should be called in the context of Proxy")
        }
        const keyMap = this.$proxyKeyMap
        const target = this.$proxyTarget

        // commit changes to the target
        for (var key in keyMap) {
            const retained = keyMap[key]
            const state = retained.state
            const value = retained.value
            switch (state) {
                case RETAINED:
                    if (value && value.$isProxy) {
                        value.$commit()
                    }
                    break // nothing to do
                case DELETED:
                    Reflect.deleteProperty(target, key)
                    break
                case DIRTY:
                case NEW:
                    
                    if (value && value.$isProxy) {
                        // first commit the proxy property's changes as well
                        value.$commit()
                        Reflect.set(target, key, value.$proxyTarget)
                    } else {
                        Reflect.set(target, key, value)
                    }

            }
        }
    }

    get(target, key, context) {
        // this would be the handler instance
        // target would be a store module or state, or anything
        // key would be a string or Symbol
        // context would be the Proxy
        this.assertAttachment(target)
        // return the proxy's own properties
        if (key === '$isProxy') {
            return true
        }
        if (key === '$proxyKeyMap') {
            return this.keyMap
        }
        if (key === '$proxyTarget') {
            return this.target
        }
        if (key === '$commit') {
            return this.commit
        }

        // first to check if a copy/proxy of the property is already retained
        const retainedProp = this.keyMap[key]
        if (retainedProp !== undefined) {
            // exists a retained property, return the value. 
            // no worries here, if property is DELETED, value would be undefined
            return retainedProp.value
        } else {
            // no knowledge of this property, check from the target
            let retained = Reflect.get(...arguments)
            // if key not defined at target, just return undefined, so to be consistent with ordinary object
            if (retained === undefined) {
                return undefined
            }
            if (typeof retained === "object" && retained !== null) {
                retained = Middleman(retained)
            }
            // also retain a copy of the property descriptor
            const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
            if (descriptor) {
                delete descriptor.value
            }
            // retain in keyMap
            this.keyMap[key] = {
                value: retained,
                state: RETAINED,
                descriptor: descriptor

            }
            return retained
        }
    }

    set(target, key, value) {
        this.assertAttachment(target)
        let retained = (typeof value !== "object" || value === null) ? value : Middleman(value)
        let state = (key in this.keyMap || key in target) ? DIRTY : NEW
        this.keyMap[key] = {
            value: retained,
            state: state,
            descriptor: {
                configurable: true,
                enumerable: true,
                writable: true
            }
        }
        return true
    }

    deleteProperty(target, key) {
        // if cannot delete target property, cannot delete middleman property
        const tDesc = Object.getOwnPropertyDescriptor(target, key)
        if (tDesc !== undefined) { // found the property in target
            if (tDesc.configurable === false) {
                throw TypeError("Cannot delete non-configurable own property")
            }
            // else ok to delete
        } else {
            // not found in target, was it ever there?
            if (!(key in this.keyMap)) {
                // it was neither here or in target, return false
                return false
            }
        }
        // mark deleted without actually delete
        this.keyMap[key] = {
            state: DELETED,
            value: undefined
        }
        return true

    }

    ownKeys(target) {
        this.assertAttachment(target)
        // target's keys are all middleman's keys unless deleted
        const targetKeys = Reflect.ownKeys(target)
        const res = []
        for (var i = 0; i < targetKeys.length; i++) {
            const key = targetKeys[i]
            const retained = this.keyMap[key]
            if (!(retained && retained.state === DELETED)) {
                res.push(key)
            }
        }
        // add new keys
        for (var key in this.keyMap) {
            if (this.keyMap[key].state === NEW && (!(key in target))) {
                res.push(key)
            }
        }
        return res

    }

    has(target, key) {
        this.assertAttachment(target)
        const retainedProp = this.keyMap[key]
        if (retainedProp === undefined) {
            // no knowledge, check target
            return Reflect.has(...arguments)
        }
        return (retainedProp.state !== DELETED)
    }

    getOwnPropertyDescriptor(target, key) {
        this.assertAttachment(target)
        const retainedProp = this.keyMap[key]
        if (retainedProp && retainedProp.state !== DELETED) {
            return retainedProp.descriptor
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
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
 * Proxy handler class, attach a new instance for each value
 */
class MiddlemanHandler {
    /**
     * 
     * @param {*} value 
     * @param {MiddlemanHandler} parentHandler 
     * @param {string} propertyName 
     * @param {string} propertyState 
     * @param {Object} propertyDescriptor 
     */
    constructor(value, parentHandler, propertyName, propertyState, propertyDescriptor) {
        if (parentHandler !== undefined && (!parentHandler instanceof MiddlemanHandler)) {
            throw TypeError("Parent, if set, must be a MiddlemanHandler")
        }
        if (parentHandler === this) {
            throw "parent cannot be this"
        }
        this.keyMap = {} // key : property's Proxy
        this.value = value
        this.proxy = (typeof value === 'object' && value !== null) ?
            new Proxy(value, this) : undefined

        this.parentHandler = parentHandler // parent
        this.propertyName = propertyName
        this.propertyState = propertyState // the property itself's state
        this.propertyDescriptor = propertyDescriptor
        this.changed = false // state of the object tree
    }

    commit() {
        if (typeof this.value !== 'object') {
            throw TypeError("Commit can only be called on the proxy of an object")
        }
        // commit changes to the value
        for (var key in this.keyMap) {
            const retainedProperty = this.keyMap[key]
            // retained is a MiddlemanHandler
            // if retained has changes inside (meaning retained's value is an object)
            // then first commit the changes inside the retained
            if (retainedProperty.changed) {
                retainedProperty.commit()
            }
            switch (retainedProperty.propertyState) {
                case RETAINED:
                    break // nothing to do
                case DELETED:
                    Reflect.deleteProperty(this.value, key)
                    break
                case DIRTY:
                case NEW:
                    Reflect.set(this.value, key, retainedProperty.value)
            }
        }
    }

    valueOrProxy() {
        return this.proxy === undefined ? this.value : this.proxy
    }

    assertAttachment(target) {
        if (target !== this.value || (typeof target !== 'object')) {
            throw TypeError("ERROR: MiddlemanHandler can only be used to its value!")
        }
    }
    /**
     * Return the retained Proxy of the property. Create and retain if 
     * have not done before.
     * @param {string} key 
     */
    getOrRetainProperty(key) {
        const retainedProp = this.keyMap[key] // would be a proxy
        if (retainedProp !== undefined) {
            return retainedProp
        }
        // no knowledge of this property, check from the value
        let retained = this.value[key]
        // if property does not exist, return undefined
        if (retained === undefined) {
            return undefined
        }
        // obtain a descriptor
        const descriptor = Reflect.getOwnPropertyDescriptor(this.value, key)
        // property exists, obtain the property descriptor
        if (descriptor) {
            delete descriptor.value
        }
        // create a RETAINED property proxy
        let newlyRetained = new MiddlemanHandler(retained, this, key, RETAINED, descriptor)
        // retain in keyMap
        this.keyMap[key] = newlyRetained
        return newlyRetained
    }
    /**
     * Proxy handler
     * @param {*} value : the value object
     * @param {*} key : property key, string or Symbol
     * @param {*} context : the proxy object
     */
    get(target, key, context) {
        this.assertAttachment(target)
        // return the proxy's own properties
        switch (key) {
            case '$isProxy':
                return true
            case '$proxyKeyMap':
                return this.keyMap
            case '$principal':
                return this.value
            case '$commit':
                return () => {
                    this.commit()
                }
            case '$propertyState':
                return function (thisHandler) {
                    return (propertyName) => {
                        const targetProp =
                            propertyName ?
                            thisHandler.getOrRetainProperty(propertyName) :
                            thisHandler
                        return targetProp ?
                            targetProp.propertyState : undefined
                    }
                }(this)
            case '$changed':
                if (typeof target !== 'object' || target === null) {
                    throw TypeError("$changed is only meaningful for a not-null object.")
                }
                return this.changed
            default:
                const retained = this.getOrRetainProperty(key)
                return retained === undefined ? undefined : retained.valueOrProxy()
        }
    }


    set(target, key, value) {
        this.assertAttachment(target)
        const state = key in target ? DIRTY : NEW
        let retained = new MiddlemanHandler(value, this, key, state, {
            configurable: true,
            enumerable: true,
            writable: true
        })
        this.keyMap[key] = retained
        this.setChanged() // this node has changed
        return true
    }

    /**
     * set this, and all the ancestor handlers changed
     */
    setChanged() {
        this.changed = true
        if (this.parentHandler !== undefined) {
            this.parentHandler.setChanged()
        }
    }

    deleteProperty(target, key) {
        // first retain the key
        // if cannot delete value property, cannot delete middleman property
        const handler = this.getOrRetainProperty(key)
        // no such property, ever, return false
        if (handler === undefined) {
            return false
        }
        // cannot delete
        if (handler.propertyDescriptor.configurable === false) {
            throw TypeError("Cannot delete non-configurable own property")
        }
        // mark deleted without actually delete
        handler.keyMap = {}
        handler.value = undefined
        handler.proxy = undefined
        handler.propertyState = DELETED
        handler.changed = false // undefined is not a changed object
        this.setChanged()
        return true
    }

    ownKeys(target) {
        this.assertAttachment(target)
        // target's keys are all middleman's keys unless deleted
        const targetKeys = Reflect.ownKeys(target)
        const res = []
        for (var i = 0; i < targetKeys.length; i++) {
            const key = targetKeys[i]
            const retained = this.keyMap[key] // is a MiddlemanHandler
            if (!(retained && retained.propertyState === DELETED)) {
                res.push(key)
            }
        }
        // add new keys
        for (var key in this.keyMap) {
            if (this.keyMap[key].propertyState === NEW && (!(key in target))) {
                res.push(key)
            }
        }
        return res
    }

    has(target, key) {
        this.assertAttachment(target)
        const retainedProp = this.keyMap[key]
        if (retainedProp === undefined) {
            // no knowledge, check value
            return Reflect.has(...arguments)
        }
        return (retainedProp.propertyState !== DELETED)
    }

    getOwnPropertyDescriptor(target, key) {
        this.assertAttachment(target)
        const retainedProp = this.keyMap[key]
        if (retainedProp && retainedProp.state !== DELETED) {
            return retainedProp.propertyDescriptor
        }
        return Reflect.getOwnPropertyDescriptor(...arguments)
    }
}

function middleman(value, parentHandler, propertyName, propertyState, propertyDescriptor) {
    if (typeof (value) !== 'object') {
        throw TypeError("Cannot create Middleman for a non-object value, Middleman is a Proxy.")
    }
    const handler = new MiddlemanHandler(value, parentHandler, propertyName, propertyState, propertyDescriptor)
    return handler.proxy
}

module.exports = {
    middleman: middleman,
    MiddlemanHandler: MiddlemanHandler,
    DIRTY: DIRTY,
    RETAINED: RETAINED,
    NEW: NEW,
    DELETED,
    DELETED
}
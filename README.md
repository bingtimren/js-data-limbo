# js-data-limbo

This library provides a data middleman (a Proxy) of a data object (the 'principal' of the middleman) that behave as an intermediate layer of that data object. Any changes to the data object through the middleman is first retained in the middleman without affecting the data object. Until the '$commit()' method is called, the changes are committed to the actual data object. To discard the changes, simply discard the middleman object without $commit().

If any property of the data object that the middleman retains is an object (not a primitive), the middleman creates and retains a new middleman (Proxy) of that property. When "$commit()", the middleman commits all changes deep down.

This library relies on the support of Proxy object, an ES6 feature.

## Creating the middleman

```JS
const DataLimbo = require('data-limbo')
...
var proxy = DataLimbo.middleman(dataObj)
```

## Middleman property and methods

All middleman's own property and methods are prefixed with '$' to avoid conflict with the properties of the data object

### $isProxy

Always 'true' to indicate the middleman is a proxy, not the actual object.

### $principal

$principal of a middleman holds the actual object that the middleman represents

### $changed

If any of the property of the middleman has been changed. "Change" here includes any create/update/delete of any property, and also includes any create/update/delete of any property of an object property (child) of the middleman (even if the child property itself is not updated).

When $changed is true, $commit() would actual make some changes to the middleman or its children.

### $commit()

Commit the changes to the actual object, the $principal

### $propertyState([propertyName])

If [propertyName] is not provided, and the middleman is being held by a parent middleman as holder of a property, returns the property state of the middleman (as a property of the parent middleman).

If [propertyName] is provided, return the property state of the property of the middleman.

A property state is:
 - RETAINED: retained property from the original data object without change
 - NEW: new property added to the middleman but still not committed
 - DELETED: property already deleted from the middleman but still not committed
 - DIRTY: property is updated since retained but still not committed

### $testPrincipalEqual([propertyName])

Test if the property this middleman represents, when propertyName is not provided and this middleman is a property of a parent middleman, still equals (===) to the actual property of the actual data object.

Test if value of the property of this middleman with the propertyName still equals (===) to the actual property of the actual data object.

This method can be used to detect change to the actual data object that is not made through the middleman.

## Examples

```JS
const DataLimbo = require('data-limbo')

// This is the actual data object
var dataObj = {one:1, two:"TWO", insideObj:{}}

// Create a middleman
var proxy = DataLimbo.middleman(dataObj)

// Check the middleman
console.log(proxy.one) // 1
console.log(proxy.$isProxy) // true
console.log(proxy.$principal === dataObj) // true
console.log(proxy.$changed) // false
console.log(proxy.$propertyState()) // undefined
console.log(proxy.$propertyState('one')) // RETAINED
console.log(proxy.insideObj.$propertyState()) // RETAINED
console.log(proxy.insideObj.$changed) // false
console.log(proxy.$propertyState("insideObj")) // RETAINED
console.log(proxy.$testPrincipalEqual()) // true
console.log(proxy.$testPrincipalEqual('one')) // true
console.log(proxy.insideObj.$testPrincipalEqual()) // true
console.log(JSON.stringify(proxy)) // {"one":1,"two":"TWO","insideObj":{}}

// make some change to a property of a child object
proxy.insideObj.answer=42
console.log(proxy.$changed) // true
console.log(proxy.insideObj.$changed) // true

// $testPrincipalEqual still returns true because the object is not changed
console.log(proxy.$testPrincipalEqual()) // true
console.log(proxy.insideObj.$testPrincipalEqual()) // true

// make more changes
proxy.one = 'ONE'
proxy.x = 'X'

// without $commit() the changes are only with the middleman
console.log(JSON.stringify(proxy)) // {"one":"ONE","two":"TWO","insideObj":{"answer":42},"x":"X"}
console.log(JSON.stringify(dataObj)) // {"one":1,"two":"TWO","insideObj":{}}

// check the middleman again
console.log(proxy.$propertyState()) // undefined
console.log(proxy.$changed) // true
console.log(proxy.$propertyState('one')) // DIRTY
console.log(proxy.$propertyState('x')) // NEW
console.log(proxy.insideObj.$propertyState()) // RETAINED
console.log(proxy.insideObj.$propertyState('answer')) // NEW
console.log(proxy.$propertyState("insideObj")) // RETAINED
console.log(proxy.$testPrincipalEqual('one')) // false

// commit, now the changes are made to the actual object
proxy.$commit()
console.log(JSON.stringify(proxy)) // {"one":"ONE","two":"TWO","insideObj":{"answer":42},"x":"X"}
console.log(JSON.stringify(dataObj)) // {"one":"ONE","two":"TWO","insideObj":{"answer":42},"x":"X"}

// check again after commit
console.log(proxy.$propertyState()) // undefined
console.log(proxy.$propertyState('one')) // RETAINED
console.log(proxy.$propertyState('x')) // RETAINED
console.log(proxy.insideObj.$propertyState()) // RETAINED
console.log(proxy.insideObj.$propertyState('answer')) // RETAINED
console.log(proxy.$propertyState("insideObj")) // RETAINED
console.log(proxy.$testPrincipalEqual()) // true
console.log(proxy.$testPrincipalEqual('one')) // true
console.log(proxy.insideObj.$testPrincipalEqual()) // true

// direct change to the actual object can be detected with $testPrincipalEqual, but not $changed property of the middleman
dataObj.one = '1'
console.log(proxy.$testPrincipalEqual('one')) // false
console.log(proxy.$changed) // false
```
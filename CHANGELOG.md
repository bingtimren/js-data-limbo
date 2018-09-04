# Change Log

** 0.3.3
Added property status tests after commit.
Fixed commit() logic, to restore property state to RETAINED and object not CHANGED.

** 0.3.2 Sep 4, 2018
Added lodash _.isEqual deep equal test.
Fixed a bug by checking if a key is object's own key.

** 0.2.0 Aug 30, 2018
Implemented & tested handler functions:
- get
- set
- deleteProperty
- ownKeys
- has
- getOwnPropertyDescriptor

Implemented & tested Middleman functions:
- $commit()

Test cases:
- Create proxy and check basic properties
- Middleman deep equals to target
- Make changes to Middleman, expect Middleman withhold changes, make same changes to target, expect changed Middleman deep equals to changed target
- Make changes to Middleman and commits the changes, expect target deep equals to changed Middleman
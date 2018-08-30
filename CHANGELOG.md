# Change Log

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
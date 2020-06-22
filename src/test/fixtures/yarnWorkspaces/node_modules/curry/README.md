CURRY
=====

A curry function without anything **too clever**
_(... because hunger is the finest spice)_

[![browser support](https://ci.testling.com/hughfdjackson/curry.png)](https://ci.testling.com/hughfdjackson/curry)


# Why

If you don't know currying, or aren't sold on it's awesomeness, perhaps [a friendly blog post](http://hughfdjackson.com/javascript/2013/07/06/why-curry-helps/) will help.


# API

### curry

```javascript
var curry = require('curry');

//-- creating a curried function is pretty
//-- straight forward:
var add = curry(function(a, b){ return a + b });

//-- it can be called like normal:
add(1, 2) //= 3

//-- or, if you miss off any arguments,
//-- a new funtion that expects all (or some) of
//-- the remaining arguments will be created:
var add1 = add(1);
add1(2) //= 3;

//-- curry knows how many arguments a function should take
//-- by the number of parameters in the parameter list

//-- in this case, a function and two arrays is expected
//-- (fn, a, b).  zipWith will combine two arrays using a function:
var zipWith = curry(function(fn, a, b){
    return a.map(function(val, i){ return fn(val, b[i]) });
});

//-- if there are still more arguments required, a curried function
//-- will always return a new curried function:
var zipAdd = zipWith(add);
var zipAddWith123 = zipAdd([1, 2, 3]);

//-- both functions are usable as you'd expect at any time:
zipAdd([1, 2, 3], [1, 2, 3]); //= [2, 4, 6]
zipAddWith123([5, 6, 7]); //= [6, 8, 10]

//-- the number of arguments a function is expected to provide
//-- can be discovered by the .length property
zipWith.length; //= 3
zipAdd.length; //= 2
zipAddWith123.length; //= 1
```

### curry.to

Sometimes it's necessary (especially when wrapping variadic functions) to explicitly provide an arity for your curried function:

```javascript
var sum = function(){
	var nums = [].slice.call(arguments);
	return nums.reduce(function(a, b){ return a + b });
}

var sum3 = curry.to(3, sum);
var sum4 = curry.to(4, sum);

sum3(1, 2)(3) //= 6
sum4(1)(2)(3, 4) //= 10
```

### curry.adapt

It's a (sad?) fact that JavaScript functions are often written to take the 'context' object as the first argument.

With curried functions, of course, we want it to be the last object.  `curry.adapt` shifts the context to the last argument,
to give us a hand with this:

```javascript
var delve = require('delve');
var delveC = curry.adapt(delve);

var getDataFromResponse = delveC('response.body.data');
getDataFromResponse({ response: { body: { data: { x: 2 }} } }); //= { x: 2 }
```

### curry.adaptTo

Like `curry.adapt`, but the arity explicitly provided:

```javascript
var _ = require('lodash');
var map = curry.adaptTo(2, _.map);
var mapInc = map(function(a){ return a + 1 })

mapInc([1, 2, 3]) //= [2, 3, 4]
```

# installation

### node/npm

```bash
npm install curry
```

### amd

```javascript
define(['libs/curry.min'], function(curry){
    //-- assuming libs/curry.min.js is the downloaded minified version from this repo,
    //-- curry will be available here
});
```

### browser

If you're not using tools like [browserify](https://github.com/substack/node-browserify) or [require.js](http://requirejs.org), you can load curry globally:
```html
<script src="libs/curry.min.js"></script>
<script>
    <!-- curry available here -->
</script>
```
∏∏

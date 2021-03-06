var assert = require('assert'),
    _ = require('lodash'),
    Value = require('./value'),
    List = require('./list'),
    Map = require('./map'),
    Str = require('./types/str'),
    inherits = require('./inherits'),
    Valueable = require('./valueable');

var UndoConstructor = function Undo(watch) {
  var key, value, properties;

  if (!(this instanceof Undo)) {
    return new Undo(watch);
  }

  // don't want to call Value constructor from within setVal
  if (!('_raw' in this)) {
    Value.call(this, watch);
  }

  // no value condition
  if (typeof watch === 'undefined') {
    this._stack = [];
    this._index = 0;
    return;
  }

  // Value condition
  this.assertValidValue(watch);

  this._raw = watch;
  this._stack = [watch.val()];
  this._index = 0;
  this._isSetVal = false;
  this._lastSrc = void 0;
  this._max = 0;

  this._watch = this._watch.bind(this);
  this._raw.observe(this._watch);
};

var UndoProto = {
  assertValidValue: function Struct$assertValidValue(watch) {
    assert.ok(watch && watch instanceof Value, 'Undo(): entries must be Value objects');
  },
  canUndo: function Undo$canUndo() {
    return this._index > 0;
  },
  undo: function Undo$undo() {
    assert.ok(this.canUndo(), 'Undo(): no entries to undo');
    // record the value that we're updating to to avoid infinite loop in _watch
    this._index--;
    this._isSetVal = true;
    this._raw.setVal(this._stack[this._index]);
    this._notify(this._raw);
  },
  redo: function Undo$redo() {
    assert.ok(this.canRedo(), 'Undo(): no entries to redo');
    // record the value that we're updating to to avoid infinite loop in _watch
    this._index++;
    this._isSetVal = true;
    this._raw.setVal(this._stack[this._index]);
    this._notify(this._raw);
  },
  canRedo: function Undo$canRedo() {
    return this._index < this._stack.length - 1;
  },
  destroy: function Undo$destroy() {
    this._raw.unobserve(this._watch);
    Value.prototype.destroy.call(this);
  },
  setMax: function Undo$setMax(max) {
    assert.ok(typeof max === 'number' && max >= 0,
      'Undo(): max must be number >= 0');
    this._max = Math.floor(max);
    this._compact();
  },
  _watch: function Undo$private$watch(val, source) {
    // can skip updating under either of two conditions:
    // - observe() was called by our own undo/redo's use of setVal()
    // - the new value is identical to the current one
    if (this._isSetVal || val === this._stack[this._index]) {
      this._isSetVal = false;
      return;
    }
    // any change should clear the possible redo stack
    this._stack = this._stack.slice(0, this._index + 1);
    // complex types always record changes
    // changes to a different literal type also record
    this._lastSrc = source;
    this._stack.push(val);
    this._index++;  
    this._compact();
  },
  _compact: function Undo$private$compact() {
    if (this._max === 0 || this._stack.length <= this._max + 1) { return; }
    while (this._stack.length > this._max + 1) {
      this._stack.shift();
      this._index--;
    }
  },
  setVal: function(watch) {
    this.assertValidValue(watch);
    if (this._raw) {
      this._raw.unobserve(this._watch);
    }
    UndoConstructor.call(this, watch);
    this._notify(watch);
  }
};

var Undo = UndoConstructor;

Undo.prototype = Object.create(Value.prototype);
Undo.constructor = UndoConstructor;
Undo.prototype = _.extend(Undo.prototype, UndoProto);

module.exports = Undo;
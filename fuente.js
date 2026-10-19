Warning: truncated output (original token count: 1550897)
... 5155011 bytes omitted ...

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __esm = (fn, res, err2) => function __init() {
  if (err2) throw err2[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e2) {
    throw err2 = [e2], e2;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e2) {
    throw mod = 0, e2;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    if (true) {
      (function() {
        "use strict";
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
        }
        var ReactVersion = "18.3.1";
        var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.element");
        var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
        var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
        var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
        var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
        var REACT_PROVIDER_TYPE = /* @__PURE__ */ Symbol.for("react.provider");
        var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
        var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
        var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
        var REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list");
        var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
        var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
        var REACT_OFFSCREEN_TYPE = /* @__PURE__ */ Symbol.for("react.offscreen");
        var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
        var FAUX_ITERATOR_SYMBOL = "@@iterator";
        function getIteratorFn(maybeIterable) {
          if (maybeIterable === null || typeof maybeIterable !== "object") {
            return null;
          }
          var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
          if (typeof maybeIterator === "function") {
            return maybeIterator;
          }
          return null;
        }
        var ReactCurrentDispatcher = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactCurrentBatchConfig = {
          transition: null
        };
        var ReactCurrentActQueue = {
          current: null,
          // Used to reproduce behavior of `batchedUpdates` in legacy mode.
          isBatchingLegacy: false,
          didScheduleLegacyUpdate: false
        };
        var ReactCurrentOwner = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactDebugCurrentFrame = {};
        var currentExtraStackFrame = null;
        function setExtraStackFrame(stack) {
          {
            currentExtraStackFrame = stack;
          }
        }
        {
          ReactDebugCurrentFrame.setExtraStackFrame = function(stack) {
            {
              currentExtraStackFrame = stack;
            }
          };
          ReactDebugCurrentFrame.getCurrentStack = null;
          ReactDebugCurrentFrame.getStackAddendum = function() {
            var stack = "";
            if (currentExtraStackFrame) {
              stack += currentExtraStackFrame;
            }
            var impl = ReactDebugCurrentFrame.getCurrentStack;
            if (impl) {
              stack += impl() || "";
            }
            return stack;
          };
        }
        var enableScopeAPI = false;
        var enableCacheElement = false;
        var enableTransitionTracing = false;
        var enableLegacyHidden = false;
        var enableDebugTracing = false;
        var ReactSharedInternals = {
          ReactCurrentDispatcher,
          ReactCurrentBatchConfig,
          ReactCurrentOwner
        };
        {
          ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
          ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
        }
        function warn(format) {
          {
            {
              for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
              }
              printWarning("warn", format, args);
            }
          }
        }
        function error(format) {
          {
            {
              for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
              }
              printWarning("error", format, args);
            }
          }
        }
        function printWarning(level, format, args) {
          {
            var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
            var stack = ReactDebugCurrentFrame2.getStackAddendum();
            if (stack !== "") {
              format += "%s";
              args = args.concat([stack]);
            }
            var argsWithFormat = args.map(function(item) {
              return String(item);
            });
            argsWithFormat.unshift("Warning: " + format);
            Function.prototype.apply.call(console[level], console, argsWithFormat);
          }
        }
        var didWarnStateUpdateForUnmountedComponent = {};
        function warnNoop(publicInstance, callerName) {
          {
            var _constructor = publicInstance.constructor;
            var componentName = _constructor && (_constructor.displayName || _constructor.name) || "ReactClass";
            var warningKey = componentName + "." + callerName;
            if (didWarnStateUpdateForUnmountedComponent[warningKey]) {
              return;
            }
            error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, componentName);
            didWarnStateUpdateForUnmountedComponent[warningKey] = true;
          }
        }
        var ReactNoopUpdateQueue = {
          /**
           * Checks whether or not this composite component is mounted.
           * @param {ReactClass} publicInstance The instance we want to test.
           * @return {boolean} True if mounted, false otherwise.
           * @protected
           * @final
           */
          isMounted: function(publicInstance) {
            return false;
          },
          /**
           * Forces an update. This should only be invoked when it is known with
           * certainty that we are **not** in a DOM transaction.
           *
           * You may want to call this when you know that some deeper aspect of the
           * component's state has changed but `setState` was not called.
           *
           * This will not invoke `shouldComponentUpdate`, but it will invoke
           * `componentWillUpdate` and `componentDidUpdate`.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueForceUpdate: function(publicInstance, callback, callerName) {
            warnNoop(publicInstance, "forceUpdate");
          },
          /**
           * Replaces all of the state. Always use this or `setState` to mutate state.
           * You should treat `this.state` as immutable.
           *
           * There is no guarantee that `this.state` will be immediately updated, so
           * accessing `this.state` after calling this method may return the old value.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} completeState Next state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueReplaceState: function(publicInstance, completeState, callback, callerName) {
            warnNoop(publicInstance, "replaceState");
          },
          /**
           * Sets a subset of the state. This only exists because _pendingState is
           * internal. This provides a merging strategy that is not available to deep
           * properties which is confusing. TODO: Expose pendingState or don't use it
           * during the merge.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} partialState Next partial state to be merged with state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} Name of the calling function in the public API.
           * @internal
           */
          enqueueSetState: function(publicInstance, partialState, callback, callerName) {
            warnNoop(publicInstance, "setState");
          }
        };
        var assign3 = Object.assign;
        var emptyObject = {};
        {
          Object.freeze(emptyObject);
        }
        function Component(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        Component.prototype.isReactComponent = {};
        Component.prototype.setState = function(partialState, callback) {
          if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null) {
            throw new Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
          }
          this.updater.enqueueSetState(this, partialState, callback, "setState");
        };
        Component.prototype.forceUpdate = function(callback) {
          this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
        };
        {
          var deprecatedAPIs = {
            isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
            replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
          };
          var defineDeprecationWarning = function(methodName, info) {
            Object.defineProperty(Component.prototype, methodName, {
              get: function() {
                warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
                return void 0;
              }
            });
          };
          for (var fnName in deprecatedAPIs) {
            if (deprecatedAPIs.hasOwnProperty(fnName)) {
              defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
            }
          }
        }
        function ComponentDummy() {
        }
        ComponentDummy.prototype = Component.prototype;
        function PureComponent(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
        pureComponentPrototype.constructor = PureComponent;
        assign3(pureComponentPrototype, Component.prototype);
        pureComponentPrototype.isPureReactComponent = true;
        function createRef() {
          var refObject = {
            current: null
          };
          {
            Object.seal(refObject);
          }
          return refObject;
        }
        var isArrayImpl = Array.isArray;
        function isArray(a3) {
          return isArrayImpl(a3);
        }
        function typeName(value) {
          {
            var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
            var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            return type;
          }
        }
        function willCoercionThrow(value) {
          {
            try {
              testStringCoercion(value);
              return false;
            } catch (e2) {
              return true;
            }
          }
        }
        function testStringCoercion(value) {
          return "" + value;
        }
        function checkKeyStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        function getWrappedName(outerType, innerType, wrapperName) {
          var displayName = outerType.displayName;
          if (displayName) {
            return displayName;
          }
          var functionName = innerType.displayName || innerType.name || "";
          return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
        }
        function getContextName(type) {
          return type.displayName || "Context";
        }
        function getComponentNameFromType(type) {
          if (type == null) {
            return null;
          }
          {
            if (typeof type.tag === "number") {
              error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
            }
          }
          if (typeof type === "function") {
            return type.displayName || type.name || null;
          }
          if (typeof type === "string") {
            return type;
          }
          switch (type) {
            case REACT_FRAGMENT_TYPE:
              return "Fragment";
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_PROFILER_TYPE:
              return "Profiler";
            case REACT_STRICT_MODE_TYPE:
              return "StrictMode";
            case REACT_SUSPENSE_TYPE:
              return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
              return "SuspenseList";
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_CONTEXT_TYPE:
                var context = type;
                return getContextName(context) + ".Consumer";
              case REACT_PROVIDER_TYPE:
                var provider = type;
                return getContextName(provider._context) + ".Provider";
              case REACT_FORWARD_REF_TYPE:
                return getWrappedName(type, type.render, "ForwardRef");
              case REACT_MEMO_TYPE:
                var outerName = type.displayName || null;
                if (outerName !== null) {
                  return outerName;
                }
                return getComponentNameFromType(type.type) || "Memo";
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return getComponentNameFromType(init(payload));
                } catch (x3) {
                  return null;
                }
              }
            }
          }
          return null;
        }
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        var RESERVED_PROPS = {
          key: true,
          ref: true,
          __self: true,
          __source: true
        };
        var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs;
        {
          didWarnAboutStringRefs = {};
        }
        function hasValidRef(config) {
          {
            if (hasOwnProperty.call(config, "ref")) {
              var getter = Object.getOwnPropertyDescriptor(config, "ref").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config.ref !== void 0;
        }
        function hasValidKey(config) {
          {
            if (hasOwnProperty.call(config, "key")) {
              var getter = Object.getOwnPropertyDescriptor(config, "key").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config.key !== void 0;
        }
        function defineKeyPropWarningGetter(props, displayName) {
          var warnAboutAccessingKey = function() {
            {
              if (!specialPropKeyWarningShown) {
                specialPropKeyWarningShown = true;
                error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          };
          warnAboutAccessingKey.isReactWarning = true;
          Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: true
          });
        }
        function defineRefPropWarningGetter(props, displayName) {
          var warnAboutAccessingRef = function() {
            {
              if (!specialPropRefWarningShown) {
                specialPropRefWarningShown = true;
                error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          };
          warnAboutAccessingRef.isReactWarning = true;
          Object.defineProperty(props, "ref", {
            get: warnAboutAccessingRef,
            configurable: true
          });
        }
        function warnIfStringRefCannotBeAutoConverted(config) {
          {
            if (typeof config.ref === "string" && ReactCurrentOwner.current && config.__self && ReactCurrentOwner.current.stateNode !== config.__self) {
              var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
              if (!didWarnAboutStringRefs[componentName]) {
                error('Component "%s" contains the string ref "%s". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref', componentName, config.ref);
                didWarnAboutStringRefs[componentName] = true;
              }
            }
          }
        }
        var ReactElement = function(type, key, ref, self2, source, owner, props) {
          var element = {
            // This tag allows us to uniquely identify this as a React Element
            $$typeof: REACT_ELEMENT_TYPE,
            // Built-in properties that belong on the element
            type,
            key,
            ref,
            props,
            // Record the component responsible for creating this element.
            _owner: owner
          };
          {
            element._store = {};
            Object.defineProperty(element._store, "validated", {
              configurable: false,
              enumerable: false,
              writable: true,
              value: false
            });
            Object.defineProperty(element, "_self", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: self2
            });
            Object.defineProperty(element, "_source", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: source
            });
            if (Object.freeze) {
              Object.freeze(element.props);
              Object.freeze(element);
            }
          }
          return element;
        };
        function createElement4(type, config, children) {
          var propName;
          var props = {};
          var key = null;
          var ref = null;
          var self2 = null;
          var source = null;
          if (config != null) {
            if (hasValidRef(config)) {
              ref = config.ref;
              {
                warnIfStringRefCannotBeAutoConverted(config);
              }
            }
            if (hasValidKey(config)) {
              {
                checkKeyStringCoercion(config.key);
              }
              key = "" + config.key;
            }
            self2 = config.__self === void 0 ? null : config.__self;
            source = config.__source === void 0 ? null : config.__source;
            for (propName in config) {
              if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                props[propName] = config[propName];
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i4 = 0; i4 < childrenLength; i4++) {
              childArray[i4] = arguments[i4 + 2];
            }
            {
              if (Object.freeze) {
                Object.freeze(childArray);
              }
            }
            props.children = childArray;
          }
          if (type && type.defaultProps) {
            var defaultProps = type.defaultProps;
            for (propName in defaultProps) {
              if (props[propName] === void 0) {
                props[propName] = defaultProps[propName];
              }
            }
          }
          {
            if (key || ref) {
              var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
              if (key) {
                defineKeyPropWarningGetter(props, displayName);
              }
              if (ref) {
                defineRefPropWarningGetter(props, displayName);
              }
            }
          }
          return ReactElement(type, key, ref, self2, source, ReactCurrentOwner.current, props);
        }
        function cloneAndReplaceKey(oldElement, newKey) {
          var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
          return newElement;
        }
        function cloneElement(element, config, children) {
          if (element === null || element === void 0) {
            throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
          }
          var propName;
          var props = assign3({}, element.props);
          var key = element.key;
          var ref = element.ref;
          var self2 = element._self;
          var source = element._source;
          var owner = element._owner;
          if (config != null) {
            if (hasValidRef(config)) {
              ref = config.ref;
              owner = ReactCurrentOwner.current;
            }
            if (hasValidKey(config)) {
              {
                checkKeyStringCoercion(config.key);
              }
              key = "" + config.key;
            }
            var defaultProps;
            if (element.type && element.type.defaultProps) {
              defaultProps = element.type.defaultProps;
            }
            for (propName in config) {
              if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                if (config[propName] === void 0 && defaultProps !== void 0) {
                  props[propName] = defaultProps[propName];
                } else {
                  props[propName] = config[propName];
                }
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i4 = 0; i4 < childrenLength; i4++) {
              childArray[i4] = arguments[i4 + 2];
            }
            props.children = childArray;
          }
          return ReactElement(element.type, key, ref, self2, source, owner, props);
        }
        function isValidElement(object) {
          return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
        }
        var SEPARATOR = ".";
        var SUBSEPARATOR = ":";
        function escape(key) {
          var escapeRegex = /[=:]/g;
          var escaperLookup = {
            "=": "=0",
            ":": "=2"
          };
          var escapedString = key.replace(escapeRegex, function(match) {
            return escaperLookup[match];
          });
          return "$" + escapedString;
        }
        var didWarnAboutMaps = false;
        var userProvidedKeyEscapeRegex = /\/+/g;
        function escapeUserProvidedKey(text2) {
          return text2.replace(userProvidedKeyEscapeRegex, "$&/");
        }
        function getElementKey(element, index2) {
          if (typeof element === "object" && element !== null && element.key != null) {
            {
              checkKeyStringCoercion(element.key);
            }
            return escape("" + element.key);
          }
          return index2.toString(36);
        }
        function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
          var type = typeof children;
          if (type === "undefined" || type === "boolean") {
            children = null;
          }
          var invokeCallback = false;
          if (children === null) {
            invokeCallback = true;
          } else {
            switch (type) {
              case "string":
              case "number":
                invokeCallback = true;
                break;
              case "object":
                switch (children.$$typeof) {
                  case REACT_ELEMENT_TYPE:
                  case REACT_PORTAL_TYPE:
                    invokeCallback = true;
                }
            }
          }
          if (invokeCallback) {
            var _child = children;
            var mappedChild = callback(_child);
            var childKey = nameSoFar === "" ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;
            if (isArray(mappedChild)) {
              var escapedChildKey = "";
              if (childKey != null) {
                escapedChildKey = escapeUserProvidedKey(childKey) + "/";
              }
              mapIntoArray(mappedChild, array, escapedChildKey, "", function(c4) {
                return c4;
              });
            } else if (mappedChild != null) {
              if (isValidElement(mappedChild)) {
                {
                  if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) {
                    checkKeyStringCoercion(mappedChild.key);
                  }
                }
                mappedChild = cloneAndReplaceKey(
                  mappedChild,
                  // Keep both the (mapped) and old keys if they differ, just as
                  // traverseAllChildren used to do for objects as children
                  escapedPrefix + // $FlowFixMe Flow incorrectly thinks React.Portal doesn't have a key
                  (mappedChild.key && (!_child || _child.key !== mappedChild.key) ? (
                    // $FlowFixMe Flow incorrectly thinks existing element's key can be a number
                    // eslint-disable-next-line react-internal/safe-string-coercion
                    escapeUserProvidedKey("" + mappedChild.key) + "/"
                  ) : "") + childKey
                );
              }
              array.push(mappedChild);
            }
            return 1;
          }
          var child;
          var nextName;
          var subtreeCount = 0;
          var nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;
          if (isArray(children)) {
            for (var i4 = 0; i4 < children.length; i4++) {
              child = children[i4];
              nextName = nextNamePrefix + getElementKey(child, i4);
              subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
            }
          } else {
            var iteratorFn = getIteratorFn(children);
            if (typeof iteratorFn === "function") {
              var iterableChildren = children;
              {
                if (iteratorFn === iterableChildren.entries) {
                  if (!didWarnAboutMaps) {
                    warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
                  }
                  didWarnAboutMaps = true;
                }
              }
              var iterator = iteratorFn.call(iterableChildren);
              var step;
              var ii = 0;
              while (!(step = iterator.next()).done) {
                child = step.value;
                nextName = nextNamePrefix + getElementKey(child, ii++);
                subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
              }
            } else if (type === "object") {
              var childrenString = String(children);
              throw new Error("Objects are not valid as a React child (found: " + (childrenString === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString) + "). If you meant to render a collection of children, use an array instead.");
            }
          }
          return subtreeCount;
        }
        function mapChildren(children, func, context) {
          if (children == null) {
            return children;
          }
          var result = [];
          var count = 0;
          mapIntoArray(children, result, "", "", function(child) {
            return func.call(context, child, count++);
          });
          return result;
        }
        function countChildren(children) {
          var n2 = 0;
          mapChildren(children, function() {
            n2++;
          });
          return n2;
        }
        function forEachChildren(children, forEachFunc, forEachContext) {
          mapChildren(children, function() {
            forEachFunc.apply(this, arguments);
          }, forEachContext);
        }
        function toArray2(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        }
        function onlyChild(children) {
          if (!isValidElement(children)) {
            throw new Error("React.Children.only expected to receive a single React element child.");
          }
          return children;
        }
        function createContext2(defaultValue) {
          var context = {
            $$typeof: REACT_CONTEXT_TYPE,
            // As a workaround to support multiple concurrent renderers, we categorize
            // some renderers as primary and others as secondary. We only expect
            // there to be two concurrent renderers at most: React Native (primary) and
            // Fabric (secondary); React DOM (primary) and React ART (secondary).
            // Secondary renderers store their context values on separate fields.
            _currentValue: defaultValue,
            _currentValue2: defaultValue,
            // Used to track how many concurrent renderers this context currently
            // supports within in a single renderer. Such as parallel server rendering.
            _threadCount: 0,
            // These are circular
            Provider: null,
            Consumer: null,
            // Add these to use same hidden class in VM as ServerContext
            _defaultValue: null,
            _globalName: null
          };
          context.Provider = {
            $$typeof: REACT_PROVIDER_TYPE,
            _context: context
          };
          var hasWarnedAboutUsingNestedContextConsumers = false;
          var hasWarnedAboutUsingConsumerProvider = false;
          var hasWarnedAboutDisplayNameOnConsumer = false;
          {
            var Consumer = {
              $$typeof: REACT_CONTEXT_TYPE,
              _context: context
            };
            Object.defineProperties(Consumer, {
              Provider: {
                get: function() {
                  if (!hasWarnedAboutUsingConsumerProvider) {
                    hasWarnedAboutUsingConsumerProvider = true;
                    error("Rendering <Context.Consumer.Provider> is not supported and will be removed in a future major release. Did you mean to render <Context.Provider> instead?");
                  }
                  return context.Provider;
                },
                set: function(_Provider) {
                  context.Provider = _Provider;
                }
              },
              _currentValue: {
                get: function() {
                  return context._currentValue;
                },
                set: function(_currentValue) {
                  context._currentValue = _currentValue;
                }
              },
              _currentValue2: {
                get: function() {
                  return context._currentValue2;
                },
                set: function(_currentValue2) {
                  context._currentValue2 = _currentValue2;
                }
              },
              _threadCount: {
                get: function() {
                  return context._threadCount;
                },
                set: function(_threadCount) {
                  context._threadCount = _threadCount;
                }
              },
              Consumer: {
                get: function() {
                  if (!hasWarnedAboutUsingNestedContextConsumers) {
                    hasWarnedAboutUsingNestedContextConsumers = true;
                    error("Rendering <Context.Consumer.Consumer> is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
                  }
                  return context.Consumer;
                }
              },
              displayName: {
                get: function() {
                  return context.displayName;
                },
                set: function(displayName) {
                  if (!hasWarnedAboutDisplayNameOnConsumer) {
                    warn("Setting `displayName` on Context.Consumer has no effect. You should set it directly on the context with Context.displayName = '%s'.", displayName);
                    hasWarnedAboutDisplayNameOnConsumer = true;
                  }
                }
              }
            });
            context.Consumer = Consumer;
          }
          {
            context._currentRenderer = null;
            context._currentRenderer2 = null;
          }
          return context;
        }
        var Uninitialized = -1;
        var Pending = 0;
        var Resolved = 1;
        var Rejected = 2;
        function lazyInitializer(payload) {
          if (payload._status === Uninitialized) {
            var ctor = payload._result;
            var thenable = ctor();
            thenable.then(function(moduleObject2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var resolved = payload;
                resolved._status = Resolved;
                resolved._result = moduleObject2;
              }
            }, function(error2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var rejected = payload;
                rejected._status = Rejected;
                rejected._result = error2;
              }
            });
            if (payload._status === Uninitialized) {
              var pending = payload;
              pending._status = Pending;
              pending._result = thenable;
            }
          }
          if (payload._status === Resolved) {
            var moduleObject = payload._result;
            {
              if (moduleObject === void 0) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", moduleObject);
              }
            }
            {
              if (!("default" in moduleObject)) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", moduleObject);
              }
            }
            return moduleObject.default;
          } else {
            throw payload._result;
          }
        }
        function lazy(ctor) {
          var payload = {
            // We use these fields to store the result.
            _status: Uninitialized,
            _result: ctor
          };
          var lazyType = {
            $$typeof: REACT_LAZY_TYPE,
            _payload: payload,
            _init: lazyInitializer
          };
          {
            var defaultProps;
            var propTypes;
            Object.defineProperties(lazyType, {
              defaultProps: {
                configurable: true,
                get: function() {
                  return defaultProps;
                },
                set: function(newDefaultProps) {
                  error("React.lazy(...): It is not supported to assign `defaultProps` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  defaultProps = newDefaultProps;
                  Object.defineProperty(lazyType, "defaultProps", {
                    enumerable: true
                  });
                }
              },
              propTypes: {
                configurable: true,
                get: function() {
                  return propTypes;
                },
                set: function(newPropTypes) {
                  error("React.lazy(...): It is not supported to assign `propTypes` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  propTypes = newPropTypes;
                  Object.defineProperty(lazyType, "propTypes", {
                    enumerable: true
                  });
                }
              }
            });
          }
          return lazyType;
        }
        function forwardRef3(render) {
          {
            if (render != null && render.$$typeof === REACT_MEMO_TYPE) {
              error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).");
            } else if (typeof render !== "function") {
              error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render);
            } else {
              if (render.length !== 0 && render.length !== 2) {
                error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
              }
            }
            if (render != null) {
              if (render.defaultProps != null || render.propTypes != null) {
                error("forwardRef render functions do not support propTypes or defaultProps. Did you accidentally pass a React component?");
              }
            }
          }
          var elementType = {
            $$typeof: REACT_FORWARD_REF_TYPE,
            render
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: function() {
                return ownName;
              },
              set: function(name) {
                ownName = name;
                if (!render.name && !render.displayName) {
                  render.displayName = name;
                }
              }
            });
          }
          return elementType;
        }
        var REACT_MODULE_REFERENCE;
        {
          REACT_MODULE_REFERENCE = /* @__PURE__ */ Symbol.for("react.module.reference");
        }
        function isValidElementType(type) {
          if (typeof type === "string" || typeof type === "function") {
            return true;
          }
          if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) {
            return true;
          }
          if (typeof type === "object" && type !== null) {
            if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
            // types supported by any Flight configuration anywhere since
            // we don't know which Flight build this will end up being used
            // with.
            type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) {
              return true;
            }
          }
          return false;
        }
        function memo(type, compare) {
          {
            if (!isValidElementType(type)) {
              error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
            }
          }
          var elementType = {
            $$typeof: REACT_MEMO_TYPE,
            type,
            compare: compare === void 0 ? null : compare
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: function() {
                return ownName;
              },
              set: function(name) {
                ownName = name;
                if (!type.name && !type.displayName) {
                  type.displayName = name;
                }
              }
            });
          }
          return elementType;
        }
        function resolveDispatcher() {
          var dispatcher = ReactCurrentDispatcher.current;
          {
            if (dispatcher === null) {
              error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
            }
          }
          return dispatcher;
        }
        function useContext2(Context) {
          var dispatcher = resolveDispatcher();
          {
            if (Context._context !== void 0) {
              var realContext = Context._context;
              if (realContext.Consumer === Context) {
                error("Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be removed in a future major release. Did you mean to call useContext(Context) instead?");
              } else if (realContext.Provider === Context) {
                error("Calling useContext(Context.Provider) is not supported. Did you mean to call useContext(Context) instead?");
              }
            }
          }
          return dispatcher.useContext(Context);
        }
        function useState(initialState) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useState(initialState);
        }
        function useReducer(reducer, initialArg, init) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useReducer(reducer, initialArg, init);
        }
        function useRef(initialValue) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useRef(initialValue);
        }
        function useEffect(create2, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useEffect(create2, deps);
        }
        function useInsertionEffect(create2, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useInsertionEffect(create2, deps);
        }
        function useLayoutEffect(create2, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useLayoutEffect(create2, deps);
        }
        function useCallback(callback, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useCallback(callback, deps);
        }
        function useMemo2(create2, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useMemo(create2, deps);
        }
        function useImperativeHandle(ref, create2, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useImperativeHandle(ref, create2, deps);
        }
        function useDebugValue(value, formatterFn) {
          {
            var dispatcher = resolveDispatcher();
            return dispatcher.useDebugValue(value, formatterFn);
          }
        }
        function useTransition() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useTransition();
        }
        function useDeferredValue(value) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useDeferredValue(value);
        }
        function useId() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useId();
        }
        function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
        }
        var disabledDepth = 0;
        var prevLog;
        var prevInfo;
        var prevWarn;
        var prevError;
        var prevGroup;
        var prevGroupCollapsed;
        var prevGroupEnd;
        function disabledLog() {
        }
        disabledLog.__reactDisabledLog = true;
        function disableLogs() {
          {
            if (disabledDepth === 0) {
              prevLog = console.log;
              prevInfo = console.info;
              prevWarn = console.warn;
              prevError = console.error;
              prevGroup = console.group;
              prevGroupCollapsed = console.groupCollapsed;
              prevGroupEnd = console.groupEnd;
              var props = {
                configurable: true,
                enumerable: true,
                value: disabledLog,
                writable: true
              };
              Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
              });
            }
            disabledDepth++;
          }
        }
        function reenableLogs() {
          {
            disabledDepth--;
            if (disabledDepth === 0) {
              var props = {
                configurable: true,
                enumerable: true,
                writable: true
              };
              Object.defineProperties(console, {
                log: assign3({}, props, {
                  value: prevLog
                }),
                info: assign3({}, props, {
                  value: prevInfo
                }),
                warn: assign3({}, props, {
                  value: prevWarn
                }),
                error: assign3({}, props, {
                  value: prevError
                }),
                group: assign3({}, props, {
                  value: prevGroup
                }),
                groupCollapsed: assign3({}, props, {
                  value: prevGroupCollapsed
                }),
                groupEnd: assign3({}, props, {
                  value: prevGroupEnd
                })
              });
            }
            if (disabledDepth < 0) {
              error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
            }
          }
        }
        var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
        var prefix;
        function describeBuiltInComponentFrame(name, source, ownerFn) {
          {
            if (prefix === void 0) {
              try {
                throw Error();
              } catch (x3) {
                var match = x3.stack.trim().match(/\n( *(at )?)/);
                prefix = match && match[1] || "";
              }
            }
            return "\n" + prefix + name;
          }
        }
        var reentry = false;
        var componentFrameCache;
        {
          var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
          componentFrameCache = new PossiblyWeakMap();
        }
        function describeNativeComponentFrame(fn, construct2) {
          if (!fn || reentry) {
            return "";
          }
          {
            var frame = componentFrameCache.get(fn);
            if (frame !== void 0) {
              return frame;
            }
          }
          var control;
          reentry = true;
          var previousPrepareStackTrace = Error.prepareStackTrace;
          Error.prepareStackTrace = void 0;
          var previousDispatcher;
          {
            previousDispatcher = ReactCurrentDispatcher$1.current;
            ReactCurrentDispatcher$1.current = null;
            disableLogs();
          }
          try {
            if (construct2) {
              var Fake = function() {
                throw Error();
              };
              Object.defineProperty(Fake.prototype, "props", {
                set: function() {
                  throw Error();
                }
              });
              if (typeof Reflect === "object" && Reflect.construct) {
                try {
                  Reflect.construct(Fake, []);
                } catch (x3) {
                  control = x3;
                }
                Reflect.construct(fn, [], Fake);
              } else {
                try {
                  Fake.call();
                } catch (x3) {
                  control = x3;
                }
                fn.call(Fake.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x3) {
                control = x3;
              }
              fn();
            }
          } catch (sample) {
            if (sample && control && typeof sample.stack === "string") {
              var sampleLines = sample.stack.split("\n");
              var controlLines = control.stack.split("\n");
              var s3 = sampleLines.length - 1;
              var c4 = controlLines.length - 1;
              while (s3 >= 1 && c4 >= 0 && sampleLines[s3] !== controlLines[c4]) {
                c4--;
              }
              for (; s3 >= 1 && c4 >= 0; s3--, c4--) {
                if (sampleLines[s3] !== controlLines[c4]) {
                  if (s3 !== 1 || c4 !== 1) {
                    do {
                      s3--;
                      c4--;
                      if (c4 < 0 || sampleLines[s3] !== controlLines[c4]) {
                        var _frame = "\n" + sampleLines[s3].replace(" at new ", " at ");
                        if (fn.displayName && _frame.includes("<anonymous>")) {
                          _frame = _frame.replace("<anonymous>", fn.displayName);
                        }
                        {
                          if (typeof fn === "function") {
                            componentFrameCache.set(fn, _frame);
                          }
                        }
                        return _frame;
                      }
                    } while (s3 >= 1 && c4 >= 0);
                  }
                  break;
                }
              }
            }
          } finally {
            reentry = false;
            {
              ReactCurrentDispatcher$1.current = previousDispatcher;
              reenableLogs();
            }
            Error.prepareStackTrace = previousPrepareStackTrace;
          }
          var name = fn ? fn.displayName || fn.name : "";
          var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
          {
            if (typeof fn === "function") {
              componentFrameCache.set(fn, syntheticFrame);
            }
          }
          return syntheticFrame;
        }
        function describeFunctionComponentFrame(fn, source, ownerFn) {
          {
            return describeNativeComponentFrame(fn, false);
          }
        }
        function shouldConstruct(Component2) {
          var prototype = Component2.prototype;
          return !!(prototype && prototype.isReactComponent);
        }
        function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
          if (type == null) {
            return "";
          }
          if (typeof type === "function") {
            {
              return describeNativeComponentFrame(type, shouldConstruct(type));
            }
          }
          if (typeof type === "string") {
            return describeBuiltInComponentFrame(type);
          }
          switch (type) {
            case REACT_SUSPENSE_TYPE:
              return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
              return describeBuiltInComponentFrame("SuspenseList");
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_FORWARD_REF_TYPE:
                return describeFunctionComponentFrame(type.render);
              case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                } catch (x3) {
                }
              }
            }
          }
          return "";
        }
        var loggedTypeFailures = {};
        var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
        function setCurrentlyValidatingElement(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
            } else {
              ReactDebugCurrentFrame$1.setExtraStackFrame(null);
            }
          }
        }
        function checkPropTypes(typeSpecs, values, location2, componentName, element) {
          {
            var has = Function.call.bind(hasOwnProperty);
            for (var typeSpecName in typeSpecs) {
              if (has(typeSpecs, typeSpecName)) {
                var error$1 = void 0;
                try {
                  if (typeof typeSpecs[typeSpecName] !== "function") {
                    var err2 = Error((componentName || "React class") + ": " + location2 + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                    err2.name = "Invariant Violation";
                    throw err2;
                  }
                  error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location2, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
                } catch (ex) {
                  error$1 = ex;
                }
                if (error$1 && !(error$1 instanceof Error)) {
                  setCurrentlyValidatingElement(element);
                  error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location2, typeSpecName, typeof error$1);
                  setCurrentlyValidatingElement(null);
                }
                if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                  loggedTypeFailures[error$1.message] = true;
                  setCurrentlyValidatingElement(element);
                  error("Failed %s type: %s", location2, error$1.message);
                  setCurrentlyValidatingElement(null);
                }
              }
            }
          }
        }
        function setCurrentlyValidatingElement$1(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              setExtraStackFrame(stack);
            } else {
              setExtraStackFrame(null);
            }
          }
        }
        var propTypesMisspellWarningShown;
        {
          propTypesMisspellWarningShown = false;
        }
        function getDeclarationErrorAddendum() {
          if (ReactCurrentOwner.current) {
            var name = getComponentNameFromType(ReactCurrentOwner.current.type);
            if (name) {
              return "\n\nCheck the render method of `" + name + "`.";
            }
          }
          return "";
        }
        function getSourceInfoErrorAddendum(source) {
          if (source !== void 0) {
            var fileName = source.fileName.replace(/^.*[\\\/]/, "");
            var lineNumber = source.lineNumber;
            return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
          }
          return "";
        }
        function getSourceInfoErrorAddendumForProps(elementProps) {
          if (elementProps !== null && elementProps !== void 0) {
            return getSourceInfoErrorAddendum(elementProps.__source);
          }
          return "";
        }
        var ownerHasKeyUseWarning = {};
        function getCurrentComponentErrorInfo(parentType) {
          var info = getDeclarationErrorAddendum();
          if (!info) {
            var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
            if (parentName) {
              info = "\n\nCheck the top-level render call using <" + parentName + ">.";
            }
          }
          return info;
        }
        function validateExplicitKey(element, parentType) {
          if (!element._store || element._store.validated || element.key != null) {
            return;
          }
          element._store.validated = true;
          var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
          if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
            return;
          }
          ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
          var childOwner = "";
          if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
            childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
          }
          {
            setCurrentlyValidatingElement$1(element);
            error('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);
            setCurrentlyValidatingElement$1(null);
          }
        }
        function validateChildKeys(node2, parentType) {
          if (typeof node2 !== "object") {
            return;
          }
          if (isArray(node2)) {
            for (var i4 = 0; i4 < node2.length; i4++) {
              var child = node2[i4];
              if (isValidElement(child)) {
                validateExplicitKey(child, parentType);
              }
            }
          } else if (isValidElement(node2)) {
            if (node2._store) {
              node2._store.validated = true;
            }
          } else if (node2) {
            var iteratorFn = getIteratorFn(node2);
            if (typeof iteratorFn === "function") {
              if (iteratorFn !== node2.entries) {
                var iterator = iteratorFn.call(node2);
                var step;
                while (!(step = iterator.next()).done) {
                  if (isValidElement(step.value)) {
                    validateExplicitKey(step.value, parentType);
                  }
                }
              }
            }
          }
        }
        function validatePropTypes(element) {
          {
            var type = element.type;
            if (type === null || type === void 0 || typeof type === "string") {
              return;
            }
            var propTypes;
            if (typeof type === "function") {
              propTypes = type.propTypes;
            } else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
            // Inner props are checked in the reconciler.
            type.$$typeof === REACT_MEMO_TYPE)) {
              propTypes = type.propTypes;
            } else {
              return;
            }
            if (propTypes) {
              var name = getComponentNameFromType(type);
              checkPropTypes(propTypes, element.props, "prop", name, element);
            } else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
              propTypesMisspellWarningShown = true;
              var _name = getComponentNameFromType(type);
              error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", _name || "Unknown");
            }
            if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) {
              error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
            }
          }
        }
        function validateFragmentProps(fragment) {
          {
            var keys2 = Object.keys(fragment.props);
            for (var i4 = 0; i4 < keys2.length; i4++) {
              var key = keys2[i4];
              if (key !== "children" && key !== "key") {
                setCurrentlyValidatingElement$1(fragment);
                error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
                setCurrentlyValidatingElement$1(null);
                break;
              }
            }
            if (fragment.ref !== null) {
              setCurrentlyValidatingElement$1(fragment);
              error("Invalid attribute `ref` supplied to `React.Fragment`.");
              setCurrentlyValidatingElement$1(null);
            }
          }
        }
        function createElementWithValidation(type, props, children) {
          var validType = isValidElementType(type);
          if (!validType) {
            var info = "";
            if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) {
              info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
            }
            var sourceInfo = getSourceInfoErrorAddendumForProps(props);
            if (sourceInfo) {
              info += sourceInfo;
            } else {
              info += getDeclarationErrorAddendum();
            }
            var typeString;
            if (type === null) {
              typeString = "null";
            } else if (isArray(type)) {
              typeString = "array";
            } else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
              typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
              info = " Did you accidentally export a JSX literal instead of a component?";
            } else {
              typeString = typeof type;
            }
            {
              error("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
            }
          }
          var element = createElement4.apply(this, arguments);
          if (element == null) {
            return element;
          }
          if (validType) {
            for (var i4 = 2; i4 < arguments.length; i4++) {
              validateChildKeys(arguments[i4], type);
            }
          }
          if (type === REACT_FRAGMENT_TYPE) {
            validateFragmentProps(element);
          } else {
            validatePropTypes(element);
          }
          return element;
        }
        var didWarnAboutDeprecatedCreateFactory = false;
        function createFactoryWithValidation(type) {
          var validatedFactory = createElementWithValidation.bind(null, type);
          validatedFactory.type = type;
          {
            if (!didWarnAboutDeprecatedCreateFactory) {
              didWarnAboutDeprecatedCreateFactory = true;
              warn("React.createFactory() is deprecated and will be removed in a future major release. Consider using JSX or use React.createElement() directly instead.");
            }
            Object.defineProperty(validatedFactory, "type", {
              enumerable: false,
              get: function() {
                warn("Factory.type is deprecated. Access the class directly before passing it to createFactory.");
                Object.defineProperty(this, "type", {
                  value: type
                });
                return type;
              }
            });
          }
          return validatedFactory;
        }
        function cloneElementWithValidation(element, props, children) {
          var newElement = cloneElement.apply(this, arguments);
          for (var i4 = 2; i4 < arguments.length; i4++) {
            validateChildKeys(arguments[i4], newElement.type);
          }
          validatePropTypes(newElement);
          return newElement;
        }
        function startTransition(scope, options) {
          var prevTransition = ReactCurrentBatchConfig.transition;
          ReactCurrentBatchConfig.transition = {};
          var currentTransition = ReactCurrentBatchConfig.transition;
          {
            ReactCurrentBatchConfig.transition._updatedFibers = /* @__PURE__ */ new Set();
          }
          try {
            scope();
          } finally {
            ReactCurrentBatchConfig.transition = prevTransition;
            {
              if (prevTransition === null && currentTransition._updatedFibers) {
                var updatedFibersCount = currentTransition._updatedFibers.size;
                if (updatedFibersCount > 10) {
                  warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
                }
                currentTransition._updatedFibers.clear();
              }
            }
          }
        }
        var didWarnAboutMessageChannel = false;
        var enqueueTaskImpl = null;
        function enqueueTask(task) {
          if (enqueueTaskImpl === null) {
            try {
              var requireString = ("require" + Math.random()).slice(0, 7);
              var nodeRequire = module && module[requireString];
              enqueueTaskImpl = nodeRequire.call(module, "timers").setImmediate;
            } catch (_err) {
              enqueueTaskImpl = function(callback) {
                {
                  if (didWarnAboutMessageChannel === false) {
                    didWarnAboutMessageChannel = true;
                    if (typeof MessageChannel === "undefined") {
                      error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning.");
                    }
                  }
                }
                var channel = new MessageChannel();
                channel.port1.onmessage = callback;
                channel.port2.postMessage(void 0);
              };
            }
          }
          return enqueueTaskImpl(task);
        }
        var actScopeDepth = 0;
        var didWarnNoAwaitAct = false;
        function act(callback) {
          {
            var prevActScopeDepth = actScopeDepth;
            actScopeDepth++;
            if (ReactCurrentActQueue.current === null) {
              ReactCurrentActQueue.current = [];
            }
            var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
            var result;
            try {
              ReactCurrentActQueue.isBatchingLegacy = true;
              result = callback();
              if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
                var queue = ReactCurrentActQueue.current;
                if (queue !== null) {
                  ReactCurrentActQueue.didScheduleLegacyUpdate = false;
                  flushActQueue(queue);
                }
              }
            } catch (error2) {
              popActScope(prevActScopeDepth);
              throw error2;
            } finally {
              ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
            }
            if (result !== null && typeof result === "object" && typeof result.then === "function") {
              var thenableResult = result;
              var wasAwaited = false;
              var thenable = {
                then: function(resolve, reject) {
                  wasAwaited = true;
                  thenableResult.then(function(returnValue2) {
                    popActScope(prevActScopeDepth);
                    if (actScopeDepth === 0) {
                      recursivelyFlushAsyncActWork(returnValue2, resolve, reject);
                    } else {
                      resolve(returnValue2);
                    }
                  }, function(error2) {
                    popActScope(prevActScopeDepth);
                    reject(error2);
                  });
                }
              };
              {
                if (!didWarnNoAwaitAct && typeof Promise !== "undefined") {
                  Promise.resolve().then(function() {
                  }).then(function() {
                    if (!wasAwaited) {
                      didWarnNoAwaitAct = true;
                      error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);");
                    }
                  });
                }
              }
              return thenable;
            } else {
              var returnValue = result;
              popActScope(prevActScopeDepth);
              if (actScopeDepth === 0) {
                var _queue = ReactCurrentActQueue.current;
                if (_queue !== null) {
                  flushActQueue(_queue);
                  ReactCurrentActQueue.current = null;
                }
                var _thenable = {
                  then: function(resolve, reject) {
                    if (ReactCurrentActQueue.current === null) {
                      ReactCurrentActQueue.current = [];
                      recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                    } else {
                      resolve(returnValue);
                    }
                  }
                };
                return _thenable;
              } else {
                var _thenable2 = {
                  then: function(resolve, reject) {
                    resolve(returnValue);
                  }
                };
                return _thenable2;
              }
            }
          }
        }
        function popActScope(prevActScopeDepth) {
          {
            if (prevActScopeDepth !== actScopeDepth - 1) {
              error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
            }
            actScopeDepth = prevActScopeDepth;
          }
        }
        function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
          {
            var queue = ReactCurrentActQueue.current;
            if (queue !== null) {
              try {
                flushActQueue(queue);
                enqueueTask(function() {
                  if (queue.length === 0) {
                    ReactCurrentActQueue.current = null;
                    resolve(returnValue);
                  } else {
                    recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                  }
                });
              } catch (error2) {
                reject(error2);
              }
            } else {
              resolve(returnValue);
            }
          }
        }
        var isFlushing = false;
        function flushActQueue(queue) {
          {
            if (!isFlushing) {
              isFlushing = true;
              var i4 = 0;
              try {
                for (; i4 < queue.length; i4++) {
                  var callback = queue[i4];
                  do {
                    callback = callback(true);
                  } while (callback !== null);
                }
                queue.length = 0;
              } catch (error2) {
                queue = queue.slice(i4 + 1);
                throw error2;
              } finally {
                isFlushing = false;
              }
            }
          }
        }
        var createElement$1 = createElementWithValidation;
        var cloneElement$1 = cloneElementWithValidation;
        var createFactory = createFactoryWithValidation;
        var Children = {
          map: mapChildren,
          forEach: forEachChildren,
          count: countChildren,
          toArray: toArray2,
          only: onlyChild
        };
        exports.Children = Children;
        exports.Component = Component;
        exports.Fragment = REACT_FRAGMENT_TYPE;
        exports.Profiler = REACT_PROFILER_TYPE;
        exports.PureComponent = PureComponent;
        exports.StrictMode = REACT_STRICT_MODE_TYPE;
        exports.Suspense = REACT_SUSPENSE_TYPE;
        exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
        exports.act = act;
        exports.cloneElement = cloneElement$1;
        exports.createContext = createContext2;
        exports.createElement = createElement$1;
        exports.createFactory = createFactory;
        exports.createRef = createRef;
        exports.forwardRef = forwardRef3;
        exports.isValidElement = isValidElement;
        exports.lazy = lazy;
        exports.memo = memo;
        exports.startTransition = startTransition;
        exports.unstable_act = act;
        exports.useCallback = useCallback;
        exports.useContext = useContext2;
        exports.useDebugValue = useDebugValue;
        exports.useDeferredValue = useDeferredValue;
        exports.useEffect = useEffect;
        exports.useId = useId;
        exports.useImperativeHandle = useImperativeHandle;
        exports.useInsertionEffect = useInsertionEffect;
        exports.useLayoutEffect = useLayoutEffect;
        exports.useMemo = useMemo2;
        exports.useReducer = useReducer;
        exports.useRef = useRef;
        exports.useState = useState;
        exports.useSyncExternalStore = useSyncExternalStore;
        exports.useTransition = useTransition;
        exports.version = ReactVersion;
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
        }
      })();
    }
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_react_development();
    }
  }
});

// node_modules/scheduler/cjs/scheduler.development.js
var require_scheduler_development = __commonJS({
  "node_modules/scheduler/cjs/scheduler.development.js"(exports) {
    "use strict";
    if (true) {
      (function() {
        "use strict";
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
        }
        var enableSchedulerDebugging = false;
        var enableProfiling = false;
        var frameYieldMs = 5;
        function push(heap, node2) {
          var index2 = heap.length;
          heap.push(node2);
          siftUp(heap, node2, index2);
        }
        function peek(heap) {
          return heap.length === 0 ? null : heap[0];
        }
        function pop(heap) {
          if (heap.length === 0) {
            return null;
          }
          var first = heap[0];
          var last = heap.pop();
          if (last !== first) {
            heap[0] = last;
            siftDown(heap, last, 0);
          }
          return first;
        }
        function siftUp(heap, node2, i4) {
          var index2 = i4;
          while (index2 > 0) {
            var parentIndex = index2 - 1 >>> 1;
            var parent = heap[parentIndex];
            if (compare(parent, node2) > 0) {
              heap[parentIndex] = node2;
              heap[index2] = parent;
              index2 = parentIndex;
            } else {
              return;
            }
          }
        }
        function siftDown(heap, node2, i4) {
          var index2 = i4;
          var length = heap.length;
          var halfLength = length >>> 1;
          while (index2 < halfLength) {
            var leftIndex = (index2 + 1) * 2 - 1;
            var left = heap[leftIndex];
            var rightIndex = leftIndex + 1;
            var right = heap[rightIndex];
            if (compare(left, node2) < 0) {
              if (rightIndex < length && compare(right, left) < 0) {
                heap[index2] = right;
                heap[rightIndex] = node2;
                index2 = rightIndex;
              } else {
                heap[index2] = left;
                heap[leftIndex] = node2;
                index2 = leftIndex;
              }
            } else if (rightIndex < length && compare(right, node2) < 0) {
              heap[index2] = right;
              heap[rightIndex] = node2;
              index2 = rightIndex;
            } else {
              return;
            }
          }
        }
        function compare(a3, b2) {
          var diff = a3.sortIndex - b2.sortIndex;
          return diff !== 0 ? diff : a3.id - b2.id;
        }
        var ImmediatePriority = 1;
        var UserBlockingPriority = 2;
        var NormalPriority = 3;
        var LowPriority = 4;
        var IdlePriority = 5;
        function markTaskErrored(task, ms) {
        }
        var hasPerformanceNow = typeof performance === "object" && typeof performance.now === "function";
        if (hasPerformanceNow) {
          var localPerformance = performance;
          exports.unstable_now = function() {
            return localPerformance.now();
          };
        } else {
          var localDate = Date;
          var initialTime = localDate.now();
          exports.unstable_now = function() {
            return localDate.now() - initialTime;
          };
        }
        var maxSigned31BitInt = 1073741823;
        var IMMEDIATE_PRIORITY_TIMEOUT = -1;
        var USER_BLOCKING_PRIORITY_TIMEOUT = 250;
        var NORMAL_PRIORITY_TIMEOUT = 5e3;
        var LOW_PRIORITY_TIMEOUT = 1e4;
        var IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;
        var taskQueue = [];
        var timerQueue = [];
        var taskIdCounter = 1;
        var currentTask = null;
        var currentPriorityLevel = NormalPriority;
        var isPerformingWork = false;
        var isHostCallbackScheduled = false;
        var isHostTimeoutScheduled = false;
        var localSetTimeout = typeof setTimeout === "function" ? setTimeout : null;
        var localClearTimeout = typeof clearTimeout === "function" ? clearTimeout : null;
        var localSetImmediate = typeof setImmediate !== "undefined" ? setImmediate : null;
        var isInputPending = typeof navigator !== "undefined" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 ? navigator.scheduling.isInputPending.bind(navigator.scheduling) : null;
        function advanceTimers(currentTime) {
          var timer = peek(timerQueue);
          while (timer !== null) {
            if (timer.callback === null) {
              pop(timerQueue);
            } else if (timer.startTime <= currentTime) {
              pop(timerQueue);
              timer.sortIndex = timer.expirationTime;
              push(taskQueue, timer);
            } else {
              return;
            }
            timer = peek(timerQueue);
          }
        }
        function handleTimeout(currentTime) {
          isHostTimeoutScheduled = false;
          advanceTimers(currentTime);
          if (!isHostCallbackScheduled) {
            if (peek(taskQueue) !== null) {
              isHostCallbackScheduled = true;
              requestHostCallback(flushWork);
            } else {
              var firstTimer = peek(timerQueue);
              if (firstTimer !== null) {
                requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
              }
            }
          }
        }
        function flushWork(hasTimeRemaining, initialTime2) {
          isHostCallbackScheduled = false;
          if (isHostTimeoutScheduled) {
            isHostTimeoutScheduled = false;
            cancelHostTimeout();
          }
          isPerformingWork = true;
          var previousPriorityLevel = currentPriorityLevel;
          try {
            if (enableProfiling) {
              try {
                return workLoop(hasTimeRemaining, initialTime2);
              } catch (error) {
                if (currentTask !== null) {
                  var currentTime = exports.unstable_now();
                  markTaskErrored(currentTask, currentTime);
                  currentTask.isQueued = false;
                }
                throw error;
              }
            } else {
              return workLoop(hasTimeRemaining, initialTime2);
            }
          } finally {
            currentTask = null;
            currentPriorityLevel = previousPriorityLevel;
            isPerformingWork = false;
          }
        }
        function workLoop(hasTimeRemaining, initialTime2) {
          var currentTime = initialTime2;
          advanceTimers(currentTime);
          currentTask = peek(taskQueue);
          while (currentTask !== null && !enableSchedulerDebugging) {
            if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYieldToHost())) {
              break;
            }
            var callback = currentTask.callback;
            if (typeof callback === "function") {
              currentTask.callback = null;
              currentPriorityLevel = currentTask.priorityLevel;
              var didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
              var continuationCallback = callback(didUserCallbackTimeout);
              currentTime = exports.unstable_now();
              if (typeof continuationCallback === "function") {
                currentTask.callback = continuationCallback;
              } else {
                if (currentTask === peek(taskQueue)) {
                  pop(taskQueue);
                }
              }
              advanceTimers(currentTime);
            } else {
              pop(taskQueue);
            }
            currentTask = peek(taskQueue);
          }
          if (currentTask !== null) {
            return true;
          } else {
            var firstTimer = peek(timerQueue);
            if (firstTimer !== null) {
              requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
            }
            return false;
          }
        }
        function unstable_runWithPriority(priorityLevel, eventHandler) {
          switch (priorityLevel) {
            case ImmediatePriority:
            case UserBlockingPriority:
            case NormalPriority:
            case LowPriority:
            case IdlePriority:
              break;
            default:
              priorityLevel = NormalPriority;
          }
          var previousPriorityLevel = currentPriorityLevel;
          currentPriorityLevel = priorityLevel;
          try {
            return eventHandler();
          } finally {
            currentPriorityLevel = previousPriorityLevel;
          }
        }
        function unstable_next(eventHandler) {
          var priorityLevel;
          switch (currentPriorityLevel) {
            case ImmediatePriority:
            case UserBlockingPriority:
            case NormalPriority:
              priorityLevel = NormalPriority;
              break;
            default:
              priorityLevel = currentPriorityLevel;
              break;
          }
          var previousPriorityLevel = currentPriorityLevel;
          currentPriorityLevel = priorityLevel;
          try {
            return eventHandler();
          } finally {
            currentPriorityLevel = previousPriorityLevel;
          }
        }
        function unstable_wrapCallback(callback) {
          var parentPriorityLevel = currentPriorityLevel;
          return function() {
            var previousPriorityLevel = currentPriorityLevel;
            currentPriorityLevel = parentPriorityLevel;
            try {
              return callback.apply(this, arguments);
            } finally {
              currentPriorityLevel = previousPriorityLevel;
            }
          };
        }
        function unstable_scheduleCallback(priorityLevel, callback, options) {
          var currentTime = exports.unstable_now();
          var startTime2;
          if (typeof options === "object" && options !== null) {
            var delay = options.delay;
            if (typeof delay === "number" && delay > 0) {
              startTime2 = currentTime + delay;
            } else {
              startTime2 = currentTime;
            }
          } else {
            startTime2 = currentTime;
          }
          var timeout;
          switch (priorityLevel) {
            case ImmediatePriority:
              timeout = IMMEDIATE_PRIORITY_TIMEOUT;
              break;
            case UserBlockingPriority:
              timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
              break;
            case IdlePriority:
              timeout = IDLE_PRIORITY_TIMEOUT;
              break;
            case LowPriority:
              timeout = LOW_PRIORITY_TIMEOUT;
              break;
            case NormalPriority:
            default:
              timeout = NORMAL_PRIORITY_TIMEOUT;
              break;
          }
          var expirationTime = startTime2 + timeout;
          var newTask = {
            id: taskIdCounter++,
            callback,
            priorityLevel,
            startTime: startTime2,
            expirationTime,
            sortIndex: -1
          };
          if (startTime2 > currentTime) {
            newTask.sortIndex = startTime2;
            push(timerQueue, newTask);
            if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
              if (isHostTimeoutScheduled) {
                cancelHostTimeout();
              } else {
                isHostTimeoutScheduled = true;
              }
              requestHostTimeout(handleTimeout, startTime2 - currentTime);
            }
          } else {
            newTask.sortIndex = expirationTime;
            push(taskQueue, newTask);
            if (!isHostCallbackScheduled && !isPerformingWork) {
              isHostCallbackScheduled = true;
              requestHostCallback(flushWork);
            }
          }
          return newTask;
        }
        function unstable_pauseExecution() {
        }
        function unstable_continueExecution() {
          if (!isHostCallbackScheduled && !isPerformingWork) {
            isHostCallbackScheduled = true;
            requestHostCallback(flushWork);
          }
        }
        function unstable_getFirstCallbackNode() {
          return peek(taskQueue);
        }
        function unstable_cancelCallback(task) {
          task.callback = null;
        }
        function unstable_getCurrentPriorityLevel() {
          return currentPriorityLevel;
        }
        var isMessageLoopRunning = false;
        var scheduledHostCallback = null;
        var taskTimeoutID = -1;
        var frameInterval = frameYieldMs;
        var startTime = -1;
        function shouldYieldToHost() {
          var timeElapsed = exports.unstable_now() - startTime;
          if (timeElapsed < frameInterval) {
            return false;
          }
          return true;
        }
        function requestPaint() {
        }
        function forceFrameRate(fps) {
          if (fps < 0 || fps > 125) {
            console["error"]("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported");
            return;
          }
          if (fps > 0) {
            frameInterval = Math.floor(1e3 / fps);
          } else {
            frameInterval = frameYieldMs;
          }
        }
        var performWorkUntilDeadline = function() {
          if (scheduledHostCallback !== null) {
            var currentTime = exports.unstable_now();
            startTime = currentTime;
            var hasTimeRemaining = true;
            var hasMoreWork = true;
            try {
              hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
            } finally {
              if (hasMoreWork) {
                schedulePerformWorkUntilDeadline();
              } else {
                isMessageLoopRunning = false;
                scheduledHostCallback = null;
              }
            }
          } else {
            isMessageLoopRunning = false;
          }
        };
        var schedulePerformWorkUntilDeadline;
        if (typeof localSetImmediate === "function") {
          schedulePerformWorkUntilDeadline = function() {
            localSetImmediate(performWorkUntilDeadline);
          };
        } else if (typeof MessageChannel !== "undefined") {
          var channel = new MessageChannel();
          var port = channel.port2;
          channel.port1.onmessage = performWorkUntilDeadline;
          schedulePerformWorkUntilDeadline = function() {
            port.postMessage(null);
          };
        } else {
          schedulePerformWorkUntilDeadline = function() {
            localSetTimeout(performWorkUntilDeadline, 0);
          };
        }
        function requestHostCallback(callback) {
          scheduledHostCallback = callback;
          if (!isMessageLoopRunning) {
            isMessageLoopRunning = true;
            schedulePerformWorkUntilDeadline();
          }
        }
        function requestHostTimeout(callback, ms) {
          taskTimeoutID = localSetTimeout(function() {
            callback(exports.unstable_now());
          }, ms);
        }
        function cancelHostTimeout() {
          localClearTimeout(taskTimeoutID);
          taskTimeoutID = -1;
        }
        var unstable_requestPaint = requestPaint;
        var unstable_Profiling = null;
        exports.unstable_IdlePriority = IdlePriority;
        exports.unstable_ImmediatePriority = ImmediatePriority;
        exports.unstable_LowPriority = LowPriority;
        exports.unstable_NormalPriority = NormalPriority;
        exports.unstable_Profiling = unstable_Profiling;
        exports.unstable_UserBlockingPriority = UserBlockingPriority;
        exports.unstable_cancelCallback = unstable_cancelCallback;
        exports.unstable_continueExecution = unstable_continueExecution;
        exports.unstable_forceFrameRate = forceFrameRate;
        exports.unstable_getCurrentPriorityLevel = unstable_getCurrentPriorityLevel;
        exports.unstable_getFirstCallbackNode = unstable_getFirstCallbackNode;
        exports.unstable_next = unstable_next;
        exports.unstable_pauseExecution = unstable_pauseExecution;
        exports.unstable_requestPaint = unstable_requestPaint;
        exports.unstable_runWithPriority = unstable_runWithPriority;
        exports.unstable_scheduleCallback = unstable_scheduleCallback;
        exports.unstable_shouldYield = shouldYieldToHost;
        exports.unstable_wrapCallback = unstable_wrapCallback;
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
        }
      })();
    }
  }
});

// node_modules/scheduler/index.js
var require_scheduler = __commonJS({
  "node_modules/scheduler/index.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_scheduler_development();
    }
  }
});

// node_modules/react-dom/cjs/react-dom.development.js
var require_react_dom_development = __commonJS({
  "node_modules/react-dom/cjs/react-dom.development.js"(exports) {
    "use strict";
    if (true) {
      (function() {
        "use strict";
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
        }
        var React2 = require_react();
        var Scheduler = require_scheduler();
        var ReactSharedInternals = React2.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
        var suppressWarning = false;
        function setSuppressWarning(newSuppressWarning) {
          {
            suppressWarning = newSuppressWarning;
          }
        }
        function warn(format) {
          {
            if (!suppressWarning) {
              for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
              }
              printWarning("warn", format, args);
            }
          }
        }
        function error(format) {
          {
            if (!suppressWarning) {
              for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
              }
              printWarning("error", format, args);
            }
          }
        }
        function printWarning(level, format, args) {
          {
            var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
            var stack = ReactDebugCurrentFrame2.getStackAddendum();
            if (stack !== "") {
              format += "%s";
              args = args.concat([stack]);
            }
            var argsWithFormat = args.map(function(item) {
              return String(item);
            });
            argsWithFormat.unshift("Warning: " + format);
            Function.prototype.apply.call(console[level], console, argsWithFormat);
          }
        }
        var FunctionComponent = 0;
        var ClassComponent = 1;
        var IndeterminateComponent = 2;
        var HostRoot = 3;
        var HostPortal = 4;
        var HostComponent = 5;
        var HostText = 6;
        var Fragment = 7;
        var Mode = 8;
        var ContextConsumer = 9;
        var ContextProvider = 10;
        var ForwardRef = 11;
        var Profiler = 12;
        var SuspenseComponent = 13;
        var MemoComponent = 14;
        var SimpleMemoComponent = 15;
        var LazyComponent = 16;
        var IncompleteClassComponent = 17;
        var DehydratedFragment = 18;
        var SuspenseListComponent = 19;
        var ScopeComponent = 21;
        var OffscreenComponent = 22;
        var LegacyHiddenComponent = 23;
        var CacheComponent = 24;
        var TracingMarkerComponent = 25;
        var enableClientRenderFallbackOnTextMismatch = true;
        var enableNewReconciler = false;
        var enableLazyContextPropagation = false;
        var enableLegacyHidden = false;
        var enableSuspenseAvoidThisFallback = false;
        var disableCommentsAsDOMContainers = true;
        var enableCustomElementPropertySupport = false;
        var warnAboutStringRefs = true;
        var enableSchedulingProfiler = true;
        var enableProfilerTimer = true;
        var enableProfilerCommitHooks = true;
        var allNativeEvents = /* @__PURE__ */ new Set();
        var registrationNameDependencies = {};
        var possibleRegistrationNames = {};
        function registerTwoPhaseEvent(registrationName, dependencies) {
          registerDirectEvent(registrationName, dependencies);
          registerDirectEvent(registrationName + "Capture", dependencies);
        }
        function registerDirectEvent(registrationName, dependencies) {
          {
            if (registrationNameDependencies[registrationName]) {
              error("EventRegistry: More than one plugin attempted to publish the same registration name, `%s`.", registrationName);
            }
          }
          registrationNameDependencies[registrationName] = dependencies;
          {
            var lowerCasedName = registrationName.toLowerCase();
            possibleRegistrationNames[lowerCasedName] = registrationName;
            if (registrationName === "onDoubleClick") {
              possibleRegistrationNames.ondblclick = registrationName;
            }
          }
          for (var i4 = 0; i4 < dependencies.length; i4++) {
            allNativeEvents.add(dependencies[i4]);
          }
        }
        var canUseDOM = !!(typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined");
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        function typeName(value) {
          {
            var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
            var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            return type;
          }
        }
        function willCoercionThrow(value) {
          {
            try {
              testStringCoercion(value);
              return false;
            } catch (e2) {
              return true;
            }
          }
        }
        function testStringCoercion(value) {
          return "" + value;
        }
        function checkAttributeStringCoercion(value, attributeName) {
          {
            if (willCoercionThrow(value)) {
              error("The provided `%s` attribute is an unsupported type %s. This value must be coerced to a string before before using it here.", attributeName, typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        function checkKeyStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        function checkPropStringCoercion(value, propName) {
          {
            if (willCoercionThrow(value)) {
              error("The provided `%s` prop is an unsupported type %s. This value must be coerced to a string before before using it here.", propName, typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        function checkCSSPropertyStringCoercion(value, propName) {
          {
            if (willCoercionThrow(value)) {
              error("The provided `%s` CSS property is an unsupported type %s. This value must be coerced to a string before before using it here.", propName, typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        function checkHtmlStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error("The provided HTML markup uses a value of unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        function checkFormFieldValueStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error("Form field values (value, checked, defaultValue, or defaultChecked props) must be strings, not %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        var RESERVED = 0;
        var STRING = 1;
        var BOOLEANISH_STRING = 2;
        var BOOLEAN = 3;
        var OVERLOADED_BOOLEAN = 4;
        var NUMERIC = 5;
        var POSITIVE_NUMERIC = 6;
        var ATTRIBUTE_NAME_START_CHAR = ":A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
        var ATTRIBUTE_NAME_CHAR = ATTRIBUTE_NAME_START_CHAR + "\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
        var VALID_ATTRIBUTE_NAME_REGEX = new RegExp("^[" + ATTRIBUTE_NAME_START_CHAR + "][" + ATTRIBUTE_NAME_CHAR + "]*$");
        var illegalAttributeNameCache = {};
        var validatedAttributeNameCache = {};
        function isAttributeNameSafe(attributeName) {
          if (hasOwnProperty.call(validatedAttributeNameCache, attributeName)) {
            return true;
          }
          if (hasOwnProperty.call(illegalAttributeNameCache, attributeName)) {
            return false;
          }
          if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName)) {
            validatedAttributeNameCache[attributeName] = true;
            return true;
          }
          illegalAttributeNameCache[attributeName] = true;
          {
            error("Invalid attribute name: `%s`", attributeName);
          }
          return false;
        }
        function shouldIgnoreAttribute(name, propertyInfo, isCustomComponentTag) {
          if (propertyInfo !== null) {
            return propertyInfo.type === RESERVED;
          }
          if (isCustomComponentTag) {
            return false;
          }
          if (name.length > 2 && (name[0] === "o" || name[0] === "O") && (name[1] === "n" || name[1] === "N")) {
            return true;
          }
          return false;
        }
        function shouldRemoveAttributeWithWarning(name, value, propertyInfo, isCustomComponentTag) {
          if (propertyInfo !== null && propertyInfo.type === RESERVED) {
            return false;
          }
          switch (typeof value) {
            case "function":
            // $FlowIssue symbol is perfectly valid here
            case "symbol":
              return true;
            case "boolean": {
              if (isCustomComponentTag) {
                return false;
              }
              if (propertyInfo !== null) {
                return !propertyInfo.acceptsBooleans;
              } else {
                var prefix2 = name.toLowerCase().slice(0, 5);
                return prefix2 !== "data-" && prefix2 !== "aria-";
              }
            }
            default:
              return false;
          }
        }
        function shouldRemoveAttribute(name, value, propertyInfo, isCustomComponentTag) {
          if (value === null || typeof value === "undefined") {
            return true;
          }
          if (shouldRemoveAttributeWithWarning(name, value, propertyInfo, isCustomComponentTag)) {
            return true;
          }
          if (isCustomComponentTag) {
            return false;
          }
          if (propertyInfo !== null) {
            switch (propertyInfo.type) {
              case BOOLEAN:
                return !value;
              case OVERLOADED_BOOLEAN:
                return value === false;
              case NUMERIC:
                return isNaN(value);
              case POSITIVE_NUMERIC:
                return isNaN(value) || value < 1;
            }
          }
          return false;
        }
        function getPropertyInfo(name) {
          return properties.hasOwnProperty(name) ? properties[name] : null;
        }
        function PropertyInfoRecord(name, type, mustUseProperty, attributeName, attributeNamespace, sanitizeURL2, removeEmptyString) {
          this.acceptsBooleans = type === BOOLEANISH_STRING || type === BOOLEAN || type === OVERLOADED_BOOLEAN;
          this.attributeName = attributeName;
          this.attributeNamespace = attributeNamespace;
          this.mustUseProperty = mustUseProperty;
          this.propertyName = name;
          this.type = type;
          this.sanitizeURL = sanitizeURL2;
          this.removeEmptyString = removeEmptyString;
        }
        var properties = {};
        var reservedProps = [
          "children",
          "dangerouslySetInnerHTML",
          // TODO: This prevents the assignment of defaultValue to regular
          // elements (not just inputs). Now that ReactDOMInput assigns to the
          // defaultValue property -- do we need this?
          "defaultValue",
          "defaultChecked",
          "innerHTML",
          "suppressContentEditableWarning",
          "suppressHydrationWarning",
          "style"
        ];
        reservedProps.forEach(function(name) {
          properties[name] = new PropertyInfoRecord(
            name,
            RESERVED,
            false,
            // mustUseProperty
            name,
            // attributeName
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        [["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(_ref2) {
          var name = _ref2[0], attributeName = _ref2[1];
          properties[name] = new PropertyInfoRecord(
            name,
            STRING,
            false,
            // mustUseProperty
            attributeName,
            // attributeName
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        ["contentEditable", "draggable", "spellCheck", "value"].forEach(function(name) {
          properties[name] = new PropertyInfoRecord(
            name,
            BOOLEANISH_STRING,
            false,
            // mustUseProperty
            name.toLowerCase(),
            // attributeName
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        ["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(name) {
          properties[name] = new PropertyInfoRecord(
            name,
            BOOLEANISH_STRING,
            false,
            // mustUseProperty
            name,
            // attributeName
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        [
          "allowFullScreen",
          "async",
          // Note: there is a special case that prevents it from being written to the DOM
          // on the client side because the browsers are inconsistent. Instead we call focus().
          "autoFocus",
          "autoPlay",
          "controls",
          "default",
          "defer",
          "disabled",
          "disablePictureInPicture",
          "disableRemotePlayback",
          "formNoValidate",
          "hidden",
          "loop",
          "noModule",
          "noValidate",
          "open",
          "playsInline",
          "readOnly",
          "required",
          "reversed",
          "scoped",
          "seamless",
          // Microdata
          "itemScope"
        ].forEach(function(name) {
          properties[name] = new PropertyInfoRecord(
            name,
            BOOLEAN,
            false,
            // mustUseProperty
            name.toLowerCase(),
            // attributeName
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        [
          "checked",
          // Note: `option.selected` is not updated if `select.multiple` is
          // disabled with `removeAttribute`. We have special logic for handling this.
          "multiple",
          "muted",
          "selected"
          // NOTE: if you add a camelCased prop to this list,
          // you'll need to set attributeName to name.toLowerCase()
          // instead in the assignment below.
        ].forEach(function(name) {
          properties[name] = new PropertyInfoRecord(
            name,
            BOOLEAN,
            true,
            // mustUseProperty
            name,
            // attributeName
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        [
          "capture",
          "download"
          // NOTE: if you add a camelCased prop to this list,
          // you'll need to set attributeName to name.toLowerCase()
          // instead in the assignment below.
        ].forEach(function(name) {
          properties[name] = new PropertyInfoRecord(
            name,
            OVERLOADED_BOOLEAN,
            false,
            // mustUseProperty
            name,
            // attributeName
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        [
          "cols",
          "rows",
          "size",
          "span"
          // NOTE: if you add a camelCased prop to this list,
          // you'll need to set attributeName to name.toLowerCase()
          // instead in the assignment below.
        ].forEach(function(name) {
          properties[name] = new PropertyInfoRecord(
            name,
            POSITIVE_NUMERIC,
            false,
            // mustUseProperty
            name,
            // attributeName
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        ["rowSpan", "start"].forEach(function(name) {
          properties[name] = new PropertyInfoRecord(
            name,
            NUMERIC,
            false,
            // mustUseProperty
            name.toLowerCase(),
            // attributeName
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        var CAMELIZE = /[\-\:]([a-z])/g;
        var capitalize = function(token) {
          return token[1].toUpperCase();
        };
        [
          "accent-height",
          "alignment-baseline",
          "arabic-form",
          "baseline-shift",
          "cap-height",
          "clip-path",
          "clip-rule",
          "color-interpolation",
          "color-interpolation-filters",
          "color-profile",
          "color-rendering",
          "dominant-baseline",
          "enable-background",
          "fill-opacity",
          "fill-rule",
          "flood-color",
          "flood-opacity",
          "font-family",
          "font-size",
          "font-size-adjust",
          "font-stretch",
          "font-style",
          "font-variant",
          "font-weight",
          "glyph-name",
          "glyph-orientation-horizontal",
          "glyph-orientation-vertical",
          "horiz-adv-x",
          "horiz-origin-x",
          "image-rendering",
          "letter-spacing",
          "lighting-color",
          "marker-end",
          "marker-mid",
          "marker-start",
          "overline-position",
          "overline-thickness",
          "paint-order",
          "panose-1",
          "pointer-events",
          "rendering-intent",
          "shape-rendering",
          "stop-color",
          "stop-opacity",
          "strikethrough-position",
          "strikethrough-thickness",
          "stroke-dasharray",
          "stroke-dashoffset",
          "stroke-linecap",
          "stroke-linejoin",
          "stroke-miterlimit",
          "stroke-opacity",
          "stroke-width",
          "text-anchor",
          "text-decoration",
          "text-rendering",
          "underline-position",
          "underline-thickness",
          "unicode-bidi",
          "unicode-range",
          "units-per-em",
          "v-alphabetic",
          "v-hanging",
          "v-ideographic",
          "v-mathematical",
          "vector-effect",
          "vert-adv-y",
          "vert-origin-x",
          "vert-origin-y",
          "word-spacing",
          "writing-mode",
          "xmlns:xlink",
          "x-height"
          // NOTE: if you add a camelCased prop to this list,
          // you'll need to set attributeName to name.toLowerCase()
          // instead in the assignment below.
        ].forEach(function(attributeName) {
          var name = attributeName.replace(CAMELIZE, capitalize);
          properties[name] = new PropertyInfoRecord(
            name,
            STRING,
            false,
            // mustUseProperty
            attributeName,
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        [
          "xlink:actuate",
          "xlink:arcrole",
          "xlink:role",
          "xlink:show",
          "xlink:title",
          "xlink:type"
          // NOTE: if you add a camelCased prop to this list,
          // you'll need to set attributeName to name.toLowerCase()
          // instead in the assignment below.
        ].forEach(function(attributeName) {
          var name = attributeName.replace(CAMELIZE, capitalize);
          properties[name] = new PropertyInfoRecord(
            name,
            STRING,
            false,
            // mustUseProperty
            attributeName,
            "http://www.w3.org/1999/xlink",
            false,
            // sanitizeURL
            false
          );
        });
        [
          "xml:base",
          "xml:lang",
          "xml:space"
          // NOTE: if you add a camelCased prop to this list,
          // you'll need to set attributeName to name.toLowerCase()
          // instead in the assignment below.
        ].forEach(function(attributeName) {
          var name = attributeName.replace(CAMELIZE, capitalize);
          properties[name] = new PropertyInfoRecord(
            name,
            STRING,
            false,
            // mustUseProperty
            attributeName,
            "http://www.w3.org/XML/1998/namespace",
            false,
            // sanitizeURL
            false
          );
        });
        ["tabIndex", "crossOrigin"].forEach(function(attributeName) {
          properties[attributeName] = new PropertyInfoRecord(
            attributeName,
            STRING,
            false,
            // mustUseProperty
            attributeName.toLowerCase(),
            // attributeName
            null,
            // attributeNamespace
            false,
            // sanitizeURL
            false
          );
        });
        var xlinkHref = "xlinkHref";
        properties[xlinkHref] = new PropertyInfoRecord(
          "xlinkHref",
          STRING,
          false,
          // mustUseProperty
          "xlink:href",
          "http://www.w3.org/1999/xlink",
          true,
          // sanitizeURL
          false
        );
        ["src", "href", "action", "formAction"].forEach(function(attributeName) {
          properties[attributeName] = new PropertyInfoRecord(
            attributeName,
            STRING,
            false,
            // mustUseProperty
            attributeName.toLowerCase(),
            // attributeName
            null,
            // attributeNamespace
            true,
            // sanitizeURL
            true
          );
        });
        var isJavaScriptProtocol = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*\:/i;
        var didWarn = false;
        function sanitizeURL(url) {
          {
            if (!didWarn && isJavaScriptProtocol.test(url)) {
              didWarn = true;
              error("A future version of React will block javascript: URLs as a security precaution. Use event handlers instead if you can. If you need to generate unsafe HTML try using dangerouslySetInnerHTML instead. React was passed %s.", JSON.stringify(url));
            }
          }
        }
        function getValueForProperty(node2, name, expected, propertyInfo) {
          {
            if (propertyInfo.mustUseProperty) {
              var propertyName = propertyInfo.propertyName;
              return node2[propertyName];
            } else {
              {
                checkAttributeStringCoercion(expected, name);
              }
              if (propertyInfo.sanitizeURL) {
                sanitizeURL("" + expected);
              }
              var attributeName = propertyInfo.attributeName;
              var stringValue = null;
              if (propertyInfo.type === OVERLOADED_BOOLEAN) {
                if (node2.hasAttribute(attributeName)) {
                  var value = node2.getAttribute(attributeName);
                  if (value === "") {
                    return true;
                  }
                  if (shouldRemoveAttribute(name, expected, propertyInfo, false)) {
                    return value;
                  }
                  if (value === "" + expected) {
                    return expected;
                  }
                  return value;
                }
              } else if (node2.hasAttribute(attributeName)) {
                if (shouldRemoveAttribute(name, expected, propertyInfo, false)) {
                  return node2.getAttribute(attributeName);
                }
                if (propertyInfo.type === BOOLEAN) {
                  return expected;
                }
                stringValue = node2.getAttribute(attributeName);
              }
              if (shouldRemoveAttribute(name, expected, propertyInfo, false)) {
                return stringValue === null ? expected : stringValue;
              } else if (stringValue === "" + expected) {
                return expected;
              } else {
                return stringValue;
              }
            }
          }
        }
        function getValueForAttribute(node2, name, expected, isCustomComponentTag) {
          {
            if (!isAttributeNameSafe(name)) {
              return;
            }
            if (!node2.hasAttribute(name)) {
              return expected === void 0 ? void 0 : null;
            }
            var value = node2.getAttribute(name);
            {
              checkAttributeStringCoercion(expected, name);
            }
            if (value === "" + expected) {
              return expected;
            }
            return value;
          }
        }
        function setValueForProperty(node2, name, value, isCustomComponentTag) {
          var propertyInfo = getPropertyInfo(name);
          if (shouldIgnoreAttribute(name, propertyInfo, isCustomComponentTag)) {
            return;
          }
          if (shouldRemoveAttribute(name, value, propertyInfo, isCustomComponentTag)) {
            value = null;
          }
          if (isCustomComponentTag || propertyInfo === null) {
            if (isAttributeNameSafe(name)) {
              var _attributeName = name;
              if (value === null) {
                node2.removeAttribute(_attributeName);
              } else {
                {
                  checkAttributeStringCoercion(value, name);
                }
                node2.setAttribute(_attributeName, "" + value);
              }
            }
            return;
          }
          var mustUseProperty = propertyInfo.mustUseProperty;
          if (mustUseProperty) {
            var propertyName = propertyInfo.propertyName;
            if (value === null) {
              var type = propertyInfo.type;
              node2[propertyName] = type === BOOLEAN ? false : "";
            } else {
              node2[propertyName] = value;
            }
            return;
          }
          var attributeName = propertyInfo.attributeName, attributeNamespace = propertyInfo.attributeNamespace;
          if (value === null) {
            node2.removeAttribute(attributeName);
          } else {
            var _type = propertyInfo.type;
            var attributeValue;
            if (_type === BOOLEAN || _type === OVERLOADED_BOOLEAN && value === true) {
              attributeValue = "";
            } else {
              {
                {
                  checkAttributeStringCoercion(value, attributeName);
                }
                attributeValue = "" + value;
              }
              if (propertyInfo.sanitizeURL) {
                sanitizeURL(attributeValue.toString());
              }
            }
            if (attributeNamespace) {
              node2.setAttributeNS(attributeNamespace, attributeName, attributeValue);
            } else {
              node2.setAttribute(attributeName, attributeValue);
            }
          }
        }
        var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.element");
        var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
        var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
        var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
        var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
        var REACT_PROVIDER_TYPE = /* @__PURE__ */ Symbol.for("react.provider");
        var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
        var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
        var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
        var REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list");
        var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
        var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
        var REACT_SCOPE_TYPE = /* @__PURE__ */ Symbol.for("react.scope");
        var REACT_DEBUG_TRACING_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.debug_trace_mode");
        var REACT_OFFSCREEN_TYPE = /* @__PURE__ */ Symbol.for("react.offscreen");
        var REACT_LEGACY_HIDDEN_TYPE = /* @__PURE__ */ Symbol.for("react.legacy_hidden");
        var REACT_CACHE_TYPE = /* @__PURE__ */ Symbol.for("react.cache");
        var REACT_TRACING_MARKER_TYPE = /* @__PURE__ */ Symbol.for("react.tracing_marker");
        var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
        var FAUX_ITERATOR_SYMBOL = "@@iterator";
        function getIteratorFn(maybeIterable) {
          if (maybeIterable === null || typeof maybeIterable !== "object") {
            return null;
          }
          var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
          if (typeof maybeIterator === "function") {
            return maybeIterator;
          }
          return null;
        }
        var assign3 = Object.assign;
        var disabledDepth = 0;
        var prevLog;
        var prevInfo;
        var prevWarn;
        var prevError;
        var prevGroup;
        var prevGroupCollapsed;
        var prevGroupEnd;
        function disabledLog() {
        }
        disabledLog.__reactDisabledLog = true;
        function disableLogs() {
          {
            if (disabledDepth === 0) {
              prevLog = console.log;
              prevInfo = console.info;
              prevWarn = console.warn;
              prevError = console.error;
              prevGroup = console.group;
              prevGroupCollapsed = console.groupCollapsed;
              prevGroupEnd = console.groupEnd;
              var props = {
                configurable: true,
                enumerable: true,
                value: disabledLog,
                writable: true
              };
              Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
              });
            }
            disabledDepth++;
          }
        }
        function reenableLogs() {
          {
            disabledDepth--;
            if (disabledDepth === 0) {
              var props = {
                configurable: true,
                enumerable: true,
                writable: true
              };
              Object.defineProperties(console, {
                log: assign3({}, props, {
                  value: prevLog
                }),
                info: assign3({}, props, {
                  value: prevInfo
                }),
                warn: assign3({}, props, {
                  value: prevWarn
                }),
                error: assign3({}, props, {
                  value: prevError
                }),
                group: assign3({}, props, {
                  value: prevGroup
                }),
                groupCollapsed: assign3({}, props, {
                  value: prevGroupCollapsed
                }),
                groupEnd: assign3({}, props, {
                  value: prevGroupEnd
                })
              });
            }
            if (disabledDepth < 0) {
              error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
            }
          }
        }
        var ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
        var prefix;
        function describeBuiltInComponentFrame(name, source, ownerFn) {
          {
            if (prefix === void 0) {
              try {
                throw Error();
              } catch (x3) {
                var match = x3.stack.trim().match(/\n( *(at )?)/);
                prefix = match && match[1] || "";
              }
            }
            return "\n" + prefix + name;
          }
        }
        var reentry = false;
        var componentFrameCache;
        {
          var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
          componentFrameCache = new PossiblyWeakMap();
        }
        function describeNativeComponentFrame(fn, construct2) {
          if (!fn || reentry) {
            return "";
          }
          {
            var frame = componentFrameCache.get(fn);
            if (frame !== void 0) {
              return frame;
            }
          }
          var control;
          reentry = true;
          var previousPrepareStackTrace = Error.prepareStackTrace;
          Error.prepareStackTrace = void 0;
          var previousDispatcher;
          {
            previousDispatcher = ReactCurrentDispatcher.current;
            ReactCurrentDispatcher.current = null;
            disableLogs();
          }
          try {
            if (construct2) {
              var Fake = function() {
                throw Error();
              };
              Object.defineProperty(Fake.prototype, "props", {
                set: function() {
                  throw Error();
                }
              });
              if (typeof Reflect === "object" && Reflect.construct) {
                try {
                  Reflect.construct(Fake, []);
                } catch (x3) {
                  control = x3;
                }
                Reflect.construct(fn, [], Fake);
              } else {
                try {
                  Fake.call();
                } catch (x3) {
                  control = x3;
                }
                fn.call(Fake.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x3) {
                control = x3;
              }
              fn();
            }
          } catch (sample) {
            if (sample && control && typeof sample.stack === "string") {
              var sampleLines = sample.stack.split("\n");
              var controlLines = control.stack.split("\n");
              var s3 = sampleLines.length - 1;
              var c4 = controlLines.length - 1;
              while (s3 >= 1 && c4 >= 0 && sampleLines[s3] !== controlLines[c4]) {
                c4--;
              }
              for (; s3 >= 1 && c4 >= 0; s3--, c4--) {
                if (sampleLines[s3] !== controlLines[c4]) {
                  if (s3 !== 1 || c4 !== 1) {
                    do {
                      s3--;
                      c4--;
                      if (c4 < 0 || sampleLines[s3] !== controlLines[c4]) {
                        var _frame = "\n" + sampleLines[s3].replace(" at new ", " at ");
                        if (fn.displayName && _frame.includes("<anonymous>")) {
                          _frame = _frame.replace("<anonymous>", fn.displayName);
                        }
                        {
                          if (typeof fn === "function") {
                            componentFrameCache.set(fn, _frame);
                          }
                        }
                        return _frame;
                      }
                    } while (s3 >= 1 && c4 >= 0);
                  }
                  break;
                }
              }
            }
          } finally {
            reentry = false;
            {
              ReactCurrentDispatcher.current = previousDispatcher;
              reenableLogs();
            }
            Error.prepareStackTrace = previousPrepareStackTrace;
          }
          var name = fn ? fn.displayName || fn.name : "";
          var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
          {
            if (typeof fn === "function") {
              componentFrameCache.set(fn, syntheticFrame);
            }
          }
          return syntheticFrame;
        }
        function describeClassComponentFrame(ctor, source, ownerFn) {
          {
            return describeNativeComponentFrame(ctor, true);
          }
        }
        function describeFunctionComponentFrame(fn, source, ownerFn) {
          {
            return describeNativeComponentFrame(fn, false);
          }
        }
        function shouldConstruct(Component) {
          var prototype = Component.prototype;
          return !!(prototype && prototype.isReactComponent);
        }
        function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
          if (type == null) {
            return "";
          }
          if (typeof type === "function") {
            {
              return describeNativeComponentFrame(type, shouldConstruct(type));
            }
          }
          if (typeof type === "string") {
            return describeBuiltInComponentFrame(type);
          }
          switch (type) {
            case REACT_SUSPENSE_TYPE:
              return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
              return describeBuiltInComponentFrame("SuspenseList");
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_FORWARD_REF_TYPE:
                return describeFunctionComponentFrame(type.render);
              case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                } catch (x3) {
                }
              }
            }
          }
          return "";
        }
        function describeFiber(fiber) {
          var owner = fiber._debugOwner ? fiber._debugOwner.type : null;
          var source = fiber._debugSource;
          switch (fiber.tag) {
            case HostComponent:
              return describeBuiltInComponentFrame(fiber.type);
            case LazyComponent:
              return describeBuiltInComponentFrame("Lazy");
            case SuspenseComponent:
              return describeBuiltInComponentFrame("Suspense");
            case SuspenseListComponent:
              return describeBuiltInComponentFrame("SuspenseList");
            case FunctionComponent:
            case IndeterminateComponent:
            case SimpleMemoComponent:
              return describeFunctionComponentFrame(fiber.type);
            case ForwardRef:
              return describeFunctionComponentFrame(fiber.type.render);
            case ClassComponent:
              return describeClassComponentFrame(fiber.type);
            default:
              return "";
          }
        }
        function getStackByFiberInDevAndProd(workInProgress2) {
          try {
            var info = "";
            var node2 = workInProgress2;
            do {
              info += describeFiber(node2);
              node2 = node2.return;
            } while (node2);
            return info;
          } catch (x3) {
            return "\nError generating stack: " + x3.message + "\n" + x3.stack;
          }
        }
        function getWrappedName(outerType, innerType, wrapperName) {
          var displayName = outerType.displayName;
          if (displayName) {
            return displayName;
          }
          var functionName = innerType.displayName || innerType.name || "";
          return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
        }
        function getContextName(type) {
          return type.displayName || "Context";
        }
        function getComponentNameFromType(type) {
          if (type == null) {
            return null;
          }
          {
            if (typeof type.tag === "number") {
              error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
            }
          }
          if (typeof type === "function") {
            return type.displayName || type.name || null;
          }
          if (typeof type === "string") {
            return type;
          }
          switch (type) {
            case REACT_FRAGMENT_TYPE:
              return "Fragment";
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_PROFILER_TYPE:
              return "Profiler";
            case REACT_STRICT_MODE_TYPE:
              return "StrictMode";
            case REACT_SUSPENSE_TYPE:
              return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
              return "SuspenseList";
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_CONTEXT_TYPE:
                var context = type;
                return getContextName(context) + ".Consumer";
              case REACT_PROVIDER_TYPE:
                var provider = type;
                return getContextName(provider._context) + ".Provider";
              case REACT_FORWARD_REF_TYPE:
                return getWrappedName(type, type.render, "ForwardRef");
              case REACT_MEMO_TYPE:
                var outerName = type.displayName || null;
                if (outerName !== null) {
                  return outerName;
                }
                return getComponentNameFromType(type.type) || "Memo";
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return getComponentNameFromType(init(payload));
                } catch (x3) {
                  return null;
                }
              }
            }
          }
          return null;
        }
        function getWrappedName$1(outerType, innerType, wrapperName) {
          var functionName = innerType.displayName || innerType.name || "";
          return outerType.displayName || (functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName);
        }
        function getContextName$1(type) {
          return type.displayName || "Context";
        }
        function getComponentNameFromFiber(fiber) {
          var tag = fiber.tag, type = fiber.type;
          switch (tag) {
            case CacheComponent:
              return "Cache";
            case ContextConsumer:
              var context = type;
              return getContextName$1(context) + ".Consumer";
            case ContextProvider:
              var provider = type;
              return getContextName$1(provider._context) + ".Provider";
            case DehydratedFragment:
              return "DehydratedFragment";
            case ForwardRef:
              return getWrappedName$1(type, type.render, "ForwardRef");
            case Fragment:
              return "Fragment";
            case HostComponent:
              return type;
            case HostPortal:
              return "Portal";
            case HostRoot:
              return "Root";
            case HostText:
              return "Text";
            case LazyComponent:
              return getComponentNameFromType(type);
            case Mode:
              if (type === REACT_STRICT_MODE_TYPE) {
                return "StrictMode";
              }
              return "Mode";
            case OffscreenComponent:
              return "Offscreen";
            case Profiler:
              return "Profiler";
            case ScopeComponent:
              return "Scope";
            case SuspenseComponent:
              return "Suspense";
            case SuspenseListComponent:
              return "SuspenseList";
            case TracingMarkerComponent:
              return "TracingMarker";
            // The display name for this tags come from the user-provided type:
            case ClassComponent:
            case FunctionComponent:
            case IncompleteClassComponent:
            case IndeterminateComponent:
            case MemoComponent:
            case SimpleMemoComponent:
              if (typeof type === "function") {
                return type.displayName || type.name || null;
              }
              if (typeof type === "string") {
                return type;
              }
              break;
          }
          return null;
        }
        var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
        var current = null;
        var isRendering = false;
        function getCurrentFiberOwnerNameInDevOrNull() {
          {
            if (current === null) {
              return null;
            }
            var owner = current._debugOwner;
            if (owner !== null && typeof owner !== "undefined") {
              return getComponentNameFromFiber(owner);
            }
          }
          return null;
        }
        function getCurrentFiberStackInDev() {
          {
            if (current === null) {
              return "";
            }
            return getStackByFiberInDevAndProd(current);
          }
        }
        function resetCurrentFiber() {
          {
            ReactDebugCurrentFrame.getCurrentStack = null;
            current = null;
            isRendering = false;
          }
        }
        function setCurrentFiber(fiber) {
          {
            ReactDebugCurrentFrame.getCurrentStack = fiber === null ? null : getCurrentFiberStackInDev;
            current = fiber;
            isRendering = false;
          }
        }
        function getCurrentFiber() {
          {
            return current;
          }
        }
        function setIsRendering(rendering) {
          {
            isRendering = rendering;
          }
        }
        function toString2(value) {
          return "" + value;
        }
        function getToStringValue(value) {
          switch (typeof value) {
            case "boolean":
            case "number":
            case "string":
            case "undefined":
              return value;
            case "object":
              {
                checkFormFieldValueStringCoercion(value);
              }
              return value;
            default:
              return "";
          }
        }
        var hasReadOnlyValue = {
          button: true,
          checkbox: true,
          image: true,
          hidden: true,
          radio: true,
          reset: true,
          submit: true
        };
        function checkControlledValueProps(tagName, props) {
          {
            if (!(hasReadOnlyValue[props.type] || props.onChange || props.onInput || props.readOnly || props.disabled || props.value == null)) {
              error("You provided a `value` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultValue`. Otherwise, set either `onChange` or `readOnly`.");
            }
            if (!(props.onChange || props.readOnly || props.disabled || props.checked == null)) {
              error("You provided a `checked` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultChecked`. Otherwise, set either `onChange` or `readOnly`.");
            }
          }
        }
        function isCheckable(elem) {
          var type = elem.type;
          var nodeName = elem.nodeName;
          return nodeName && nodeName.toLowerCase() === "input" && (type === "checkbox" || type === "radio");
        }
        function getTracker(node2) {
          return node2._valueTracker;
        }
        function detachTracker(node2) {
          node2._valueTracker = null;
        }
        function getValueFromNode(node2) {
          var value = "";
          if (!node2) {
            return value;
          }
          if (isCheckable(node2)) {
            value = node2.checked ? "true" : "false";
          } else {
            value = node2.value;
          }
          return value;
        }
        function trackValueOnNode(node2) {
          var valueField = isCheckable(node2) ? "checked" : "value";
          var descriptor = Object.getOwnPropertyDescriptor(node2.constructor.prototype, valueField);
          {
            checkFormFieldValueStringCoercion(node2[valueField]);
          }
          var currentValue = "" + node2[valueField];
          if (node2.hasOwnProperty(valueField) || typeof descriptor === "undefined" || typeof descriptor.get !== "function" || typeof descriptor.set !== "function") {
            return;
          }
          var get3 = descriptor.get, set2 = descriptor.set;
          Object.defineProperty(node2, valueField, {
            configurable: true,
            get: function() {
              return get3.call(this);
            },
            set: function(value) {
              {
                checkFormFieldValueStringCoercion(value);
              }
              currentValue = "" + value;
              set2.call(this, value);
            }
          });
          Object.defineProperty(node2, valueField, {
            enumerable: descriptor.enumerable
          });
          var tracker = {
            getValue: function() {
              return currentValue;
            },
            setValue: function(value) {
              {
                checkFormFieldValueStringCoercion(value);
              }
              currentValue = "" + value;
            },
            stopTracking: function() {
              detachTracker(node2);
              delete node2[valueField];
            }
          };
          return tracker;
        }
        function track(node2) {
          if (getTracker(node2)) {
            return;
          }
          node2._valueTracker = trackValueOnNode(node2);
        }
        function updateValueIfChanged(node2) {
          if (!node2) {
            return false;
          }
          var tracker = getTracker(node2);
          if (!tracker) {
            return true;
          }
          var lastValue = tracker.getValue();
          var nextValue = getValueFromNode(node2);
          if (nextValue !== lastValue) {
            tracker.setValue(nextValue);
            return true;
          }
          return false;
        }
        function getActiveElement(doc) {
          doc = doc || (typeof document !== "undefined" ? document : void 0);
          if (typeof doc === "undefined") {
            return null;
          }
          try {
            return doc.activeElement || doc.body;
          } catch (e2) {
            return doc.body;
          }
        }
        var didWarnValueDefaultValue = false;
        var didWarnCheckedDefaultChecked = false;
        var didWarnControlledToUncontrolled = false;
        var didWarnUncontrolledToControlled = false;
        function isControlled(props) {
          var usesChecked = props.type === "checkbox" || props.type === "radio";
          return usesChecked ? props.checked != null : props.value != null;
        }
        function getHostProps(element, props) {
          var node2 = element;
          var checked = props.checked;
          var hostProps = assign3({}, props, {
            defaultChecked: void 0,
            defaultValue: void 0,
            value: void 0,
            checked: checked != null ? checked : node2._wrapperState.initialChecked
          });
          return hostProps;
        }
        function initWrapperState(element, props) {
          {
            checkControlledValueProps("input", props);
            if (props.checked !== void 0 && props.defaultChecked !== void 0 && !didWarnCheckedDefaultChecked) {
              error("%s contains an input of type %s with both checked and defaultChecked props. Input elements must be either controlled or uncontrolled (specify either the checked prop, or the defaultChecked prop, but not both). Decide between using a controlled or uncontrolled input element and remove one of these props. More info: https://reactjs.org/link/controlled-components", getCurrentFiberOwnerNameInDevOrNull() || "A component", props.type);
              didWarnCheckedDefaultChecked = true;
            }
            if (props.value !== void 0 && props.defaultValue !== void 0 && !didWarnValueDefaultValue) {
              error("%s contains an input of type %s with both value and defaultValue props. Input elements must be either controlled or uncontrolled (specify either the value prop, or the defaultValue prop, but not both). Decide between using a controlled or uncontrolled input element and remove one of these props. More info: https://reactjs.org/link/controlled-components", getCurrentFiberOwnerNameInDevOrNull() || "A component", props.type);
              didWarnValueDefaultValue = true;
            }
          }
          var node2 = element;
          var defaultValue = props.defaultValue == null ? "" : props.defaultValue;
          node2._wrapperState = {
            initialChecked: props.checked != null ? props.checked : props.defaultChecked,
            initialValue: getToStringValue(props.value != null ? props.value : defaultValue),
            controlled: isControlled(props)
          };
        }
        function updateChecked(element, props) {
          var node2 = element;
          var checked = props.checked;
          if (checked != null) {
            setValueForProperty(node2, "checked", checked, false);
          }
        }
        function updateWrapper(element, props) {
          var node2 = element;
          {
            var controlled = isControlled(props);
            if (!node2._wrapperState.controlled && controlled && !didWarnUncontrolledToControlled) {
              error("A component is changing an uncontrolled input to be controlled. This is likely caused by the value changing from undefined to a defined value, which should not happen. Decide between using a controlled or uncontrolled input element for the lifetime of the component. More info: https://reactjs.org/link/controlled-components");
              didWarnUncontrolledToControlled = true;
            }
            if (node2._wrapperState.controlled && !controlled && !didWarnControlledToUncontrolled) {
              error("A component is changing a controlled input to be uncontrolled. This is likely caused by the value changing from a defined to undefined, which should not happen. Decide between using a controlled or uncontrolled input element for the lifetime of the component. More info: https://reactjs.org/link/controlled-components");
              didWarnControlledToUncontrolled = true;
            }
          }
          updateChecked(element, props);
          var value = getToStringValue(props.value);
          var type = props.type;
          if (value != null) {
            if (type === "number") {
              if (value === 0 && node2.value === "" || // We explicitly want to coerce to number here if possible.
              // eslint-disable-next-line
              node2.value != value) {
                node2.value = toString2(value);
              }
            } else if (node2.value !== toString2(value)) {
              node2.value = toString2(value);
            }
          } else if (type === "submit" || type === "reset") {
            node2.removeAttribute("value");
            return;
          }
          {
            if (props.hasOwnProperty("value")) {
              setDefaultValue(node2, props.type, value);
            } else if (props.hasOwnProperty("defaultValue")) {
              setDefaultValue(node2, props.type, getToStringValue(props.defaultValue));
            }
          }
          {
            if (props.checked == null && props.defaultChecked != null) {
              node2.defaultChecked = !!props.defaultChecked;
            }
          }
        }
        function postMountWrapper(element, props, isHydrating2) {
          var node2 = element;
          if (props.hasOwnProperty("value") || props.hasOwnProperty("defaultValue")) {
            var type = props.type;
            var isButton = type === "submit" || type === "reset";
            if (isButton && (props.value === void 0 || props.value === null)) {
              return;
            }
            var initialValue = toString2(node2._wrapperState.initialValue);
            if (!isHydrating2) {
              {
                if (initialValue !== node2.value) {
                  node2.value = initialValue;
                }
              }
            }
            {
              node2.defaultValue = initialValue;
            }
          }
          var name = node2.name;
          if (name !== "") {
            node2.name = "";
          }
          {
            node2.defaultChecked = !node2.defaultChecked;
            node2.defaultChecked = !!node2._wrapperState.initialChecked;
          }
          if (name !== "") {
            node2.name = name;
          }
        }
        function restoreControlledState(element, props) {
          var node2 = element;
          updateWrapper(node2, props);
          updateNamedCousins(node2, props);
        }
        function updateNamedCousins(rootNode, props) {
          var name = props.name;
          if (props.type === "radio" && name != null) {
            var queryRoot = rootNode;
            while (queryRoot.parentNode) {
              queryRoot = queryRoot.parentNode;
            }
            {
              checkAttributeStringCoercion(name, "name");
            }
            var group = queryRoot.querySelectorAll("input[name=" + JSON.stringify("" + name) + '][type="radio"]');
            for (var i4 = 0; i4 < group.length; i4++) {
              var otherNode = group[i4];
              if (otherNode === rootNode || otherNode.form !== rootNode.form) {
                continue;
              }
              var otherProps = getFiberCurrentPropsFromNode(otherNode);
              if (!otherProps) {
                throw new Error("ReactDOMInput: Mixing React and non-React radio inputs with the same `name` is not supported.");
              }
              updateValueIfChanged(otherNode);
              updateWrapper(otherNode, otherProps);
            }
          }
        }
        function setDefaultValue(node2, type, value) {
          if (
            // Focused number inputs synchronize on blur. See ChangeEventPlugin.js
            type !== "number" || getActiveElement(node2.ownerDocument) !== node2
          ) {
            if (value == null) {
              node2.defaultValue = toString2(node2._wrapperState.initialValue);
            } else if (node2.defaultValue !== toString2(value)) {
              node2.defaultValue = toString2(value);
            }
          }
        }
        var didWarnSelectedSetOnOption = false;
        var didWarnInvalidChild = false;
        var didWarnInvalidInnerHTML = false;
        function validateProps(element, props) {
          {
            if (props.value == null) {
              if (typeof props.children === "object" && props.children !== null) {
                React2.Children.forEach(props.children, function(child) {
                  if (child == null) {
                    return;
                  }
                  if (typeof child === "string" || typeof child === "number") {
                    return;
                  }
                  if (!didWarnInvalidChild) {
                    didWarnInvalidChild = true;
                    error("Cannot infer the option value of complex children. Pass a `value` prop or use a plain string as children to <option>.");
                  }
                });
              } else if (props.dangerouslySetInnerHTML != null) {
                if (!didWarnInvalidInnerHTML) {
                  didWarnInvalidInnerHTML = true;
                  error("Pass a `value` prop if you set dangerouslyInnerHTML so React knows which value should be selected.");
                }
              }
            }
            if (props.selected != null && !didWarnSelectedSetOnOption) {
              error("Use the `defaultValue` or `value` props on <select> instead of setting `selected` on <option>.");
              didWarnSelectedSetOnOption = true;
            }
          }
        }
        function postMountWrapper$1(element, props) {
          if (props.value != null) {
            element.setAttribute("value", toString2(getToStringValue(props.value)));
          }
        }
        var isArrayImpl = Array.isArray;
        function isArray(a3) {
          return isArrayImpl(a3);
        }
        var didWarnValueDefaultValue$1;
        {
          didWarnValueDefaultValue$1 = false;
        }
        function getDeclarationErrorAddendum() {
          var ownerName = getCurrentFiberOwnerNameInDevOrNull();
          if (ownerName) {
            return "\n\nCheck the render method of `" + ownerName + "`.";
          }
          return "";
        }
        var valuePropNames = ["value", "defaultValue"];
        function checkSelectPropTypes(props) {
          {
            checkControlledValueProps("select", props);
            for (var i4 = 0; i4 < valuePropNames.length; i4++) {
              var propName = valuePropNames[i4];
              if (props[propName] == null) {
                continue;
              }
              var propNameIsArray = isArray(props[propName]);
              if (props.multiple && !propNameIsArray) {
                error("The `%s` prop supplied to <select> must be an array if `multiple` is true.%s", propName, getDeclarationErrorAddendum());
              } else if (!props.multiple && propNameIsArray) {
                error("The `%s` prop supplied to <select> must be a scalar value if `multiple` is false.%s", propName, getDeclarationErrorAddendum());
              }
            }
          }
        }
        function updateOptions(node2, multiple, propValue, setDefaultSelected) {
          var options2 = node2.options;
          if (multiple) {
            var selectedValues = propValue;
            var selectedValue = {};
            for (var i4 = 0; i4 < selectedValues.length; i4++) {
              selectedValue["$" + selectedValues[i4]] = true;
            }
            for (var _i = 0; _i < options2.length; _i++) {
              var selected = selectedValue.hasOwnProperty("$" + options2[_i].value);
              if (options2[_i].selected !== selected) {
                options2[_i].selected = selected;
              }
              if (selected && setDefaultSelected) {
                options2[_i].defaultSelected = true;
              }
            }
          } else {
            var _selectedValue = toString2(getToStringValue(propValue));
            var defaultSelected = null;
            for (var _i2 = 0; _i2 < options2.length; _i2++) {
              if (options2[_i2].value === _selectedValue) {
                options2[_i2].selected = true;
                if (setDefaultSelected) {
                  options2[_i2].defaultSelected = true;
                }
                return;
              }
              if (defaultSelected === null && !options2[_i2].disabled) {
                defaultSelected = options2[_i2];
              }
            }
            if (defaultSelected !== null) {
              defaultSelected.selected = true;
            }
          }
        }
        function getHostProps$1(element, props) {
          return assign3({}, props, {
            value: void 0
          });
        }
        function initWrapperState$1(element, props) {
          var node2 = element;
          {
            checkSelectPropTypes(props);
          }
          node2._wrapperState = {
            wasMultiple: !!props.multiple
          };
          {
            if (props.value !== void 0 && props.defaultValue !== void 0 && !didWarnValueDefaultValue$1) {
              error("Select elements must be either controlled or uncontrolled (specify either the value prop, or the defaultValue prop, but not both). Decide between using a controlled or uncontrolled select element and remove one of these props. More info: https://reactjs.org/link/controlled-components");
              didWarnValueDefaultValue$1 = true;
            }
          }
        }
        function postMountWrapper$2(element, props) {
          var node2 = element;
          node2.multiple = !!props.multiple;
          var value = props.value;
          if (value != null) {
            updateOptions(node2, !!props.multiple, value, false);
          } else if (props.defaultValue != null) {
            updateOptions(node2, !!props.multiple, props.defaultValue, true);
          }
        }
        function postUpdateWrapper(element, props) {
          var node2 = element;
          var wasMultiple = node2._wrapperState.wasMultiple;
          node2._wrapperState.wasMultiple = !!props.multiple;
          var value = props.value;
          if (value != null) {
            updateOptions(node2, !!props.multiple, value, false);
          } else if (wasMultiple !== !!props.multiple) {
            if (props.defaultValue != null) {
              updateOptions(node2, !!props.multiple, props.defaultValue, true);
            } else {
              updateOptions(node2, !!props.multiple, props.multiple ? [] : "", false);
            }
          }
        }
        function restoreControlledState$1(element, props) {
          var node2 = element;
          var value = props.value;
          if (value != null) {
            updateOptions(node2, !!props.multiple, value, false);
          }
        }
        var didWarnValDefaultVal = false;
        function getHostProps$2(element, props) {
          var node2 = element;
          if (props.dangerouslySetInnerHTML != null) {
            throw new Error("`dangerouslySetInnerHTML` does not make sense on <textarea>.");
          }
          var hostProps = assign3({}, props, {
            value: void 0,
            defaultValue: void 0,
            children: toString2(node2._wrapperState.initialValue)
          });
          return hostProps;
        }
        function initWrapperState$2(element, props) {
          var node2 = element;
          {
            checkControlledValueProps("textarea", props);
            if (props.value !== void 0 && props.defaultValue !== void 0 && !didWarnValDefaultVal) {
              error("%s contains a textarea with both value and defaultValue props. Textarea elements must be either controlled or uncontrolled (specify either the value prop, or the defaultValue prop, but not both). Decide between using a controlled or uncontrolled textarea and remove one of these props. More info: https://reactjs.org/link/controlled-components", getCurrentFiberOwnerNameInDevOrNull() || "A component");
              didWarnValDefaultVal = true;
            }
          }
          var initialValue = props.value;
          if (initialValue == null) {
            var children = props.children, defaultValue = props.defaultValue;
            if (children != null) {
              {
                error("Use the `defaultValue` or `value` props instead of setting children on <textarea>.");
              }
              {
                if (defaultValue != null) {
                  throw new Error("If you supply `defaultValue` on a <textarea>, do not pass children.");
                }
                if (isArray(children)) {
                  if (children.length > 1) {
                    throw new Error("<textarea> can only have at most one child.");
                  }
                  children = children[0];
                }
                defaultValue = children;
              }
            }
            if (defaultValue == null) {
              defaultValue = "";
            }
            initialValue = defaultValue;
          }
          node2._wrapperState = {
            initialValue: getToStringValue(initialValue)
          };
        }
        function updateWrapper$1(element, props) {
          var node2 = element;
          var value = getToStringValue(props.value);
          var defaultValue = getToStringValue(props.defaultValue);
          if (value != null) {
            var newValue = toString2(value);
            if (newValue !== node2.value) {
              node2.value = newValue;
            }
            if (props.defaultValue == null && node2.defaultValue !== newValue) {
              node2.defaultValue = newValue;
            }
          }
          if (defaultValue != null) {
            node2.defaultValue = toString2(defaultValue);
          }
        }
        function postMountWrapper$3(element, props) {
          var node2 = element;
          var textContent = node2.textContent;
          if (textContent === node2._wrapperState.initialValue) {
            if (textContent !== "" && textContent !== null) {
              node2.value = textContent;
            }
          }
        }
        function restoreControlledState$2(element, props) {
          updateWrapper$1(element, props);
        }
        var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
        var MATH_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
        var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
        function getIntrinsicNamespace(type) {
          switch (type) {
            case "svg":
              return SVG_NAMESPACE;
            case "math":
              return MATH_NAMESPACE;
            default:
              return HTML_NAMESPACE;
          }
        }
        function getChildNamespace(parentNamespace, type) {
          if (parentNamespace == null || parentNamespace === HTML_NAMESPACE) {
            return getIntrinsicNamespace(type);
          }
          if (parentNamespace === SVG_NAMESPACE && type === "foreignObject") {
            return HTML_NAMESPACE;
          }
          return parentNamespace;
        }
        var createMicrosoftUnsafeLocalFunction = function(func) {
          if (typeof MSApp !== "undefined" && MSApp.execUnsafeLocalFunction) {
            return function(arg0, arg1, arg2, arg3) {
              MSApp.execUnsafeLocalFunction(function() {
                return func(arg0, arg1, arg2, arg3);
              });
            };
          } else {
            return func;
          }
        };
        var reusableSVGContainer;
        var setInnerHTML = createMicrosoftUnsafeLocalFunction(function(node2, html2) {
          if (node2.namespaceURI === SVG_NAMESPACE) {
            if (!("innerHTML" in node2)) {
              reusableSVGContainer = reusableSVGContainer || document.createElement("div");
              reusableSVGContainer.innerHTML = "<svg>" + html2.valueOf().toString() + "</svg>";
              var svgNode = reusableSVGContainer.firstChild;
              while (node2.firstChild) {
                node2.removeChild(node2.firstChild);
              }
              while (svgNode.firstChild) {
                node2.appendChild(svgNode.firstChild);
              }
              return;
            }
          }
          node2.innerHTML = html2;
        });
        var ELEMENT_NODE = 1;
        var TEXT_NODE = 3;
        var COMMENT_NODE = 8;
        var DOCUMENT_NODE = 9;
        var DOCUMENT_FRAGMENT_NODE = 11;
        var setTextContent = function(node2, text2) {
          if (text2) {
            var firstChild = node2.firstChild;
            if (firstChild && firstChild === node2.lastChild && firstChild.nodeType === TEXT_NODE) {
              firstChild.nodeValue = text2;
              return;
            }
          }
          node2.textContent = text2;
        };
        var shorthandToLonghand = {
          animation: ["animationDelay", "animationDirection", "animationDuration", "animationFillMode", "animationIterationCount", "animationName", "animationPlayState", "animationTimingFunction"],
          background: ["backgroundAttachment", "backgroundClip", "backgroundColor", "backgroundImage", "backgroundOrigin", "backgroundPositionX", "backgroundPositionY", "backgroundRepeat", "backgroundSize"],
          backgroundPosition: ["backgroundPositionX", "backgroundPositionY"],
          border: ["borderBottomColor", "borderBottomStyle", "borderBottomWidth", "borderImageOutset", "borderImageRepeat", "borderImageSlice", "borderImageSource", "borderImageWidth", "borderLeftColor", "borderLeftStyle", "borderLeftWidth", "borderRightColor", "borderRightStyle", "borderRightWidth", "borderTopColor", "borderTopStyle", "borderTopWidth"],
          borderBlockEnd: ["borderBlockEndColor", "borderBlockEndStyle", "borderBlockEndWidth"],
          borderBlockStart: ["borderBlockStartColor", "borderBlockStartStyle", "borderBlockStartWidth"],
          borderBottom: ["borderBottomColor", "borderBottomStyle", "borderBottomWidth"],
          borderColor: ["borderBottomColor", "borderLeftColor", "borderRightColor", "borderTopColor"],
          borderImage: ["borderImageOutset", "borderImageRepeat", "borderImageSlice", "borderImageSource", "borderImageWidth"],
          borderInlineEnd: ["borderInlineEndColor", "borderInlineEndStyle", "borderInlineEndWidth"],
          borderInlineStart: ["borderInlineStartColor", "borderInlineStartStyle", "borderInlineStartWidth"],
          borderLeft: ["borderLeftColor", "borderLeftStyle", "borderLeftWidth"],
          borderRadius: ["borderBottomLeftRadius", "borderBottomRightRadius", "borderTopLeftRadius", "borderTopRightRadius"],
          borderRight: ["borderRightColor", "borderRightStyle", "borderRightWidth"],
          borderStyle: ["borderBottomStyle", "borderLeftStyle", "borderRightStyle", "borderTopStyle"],
          borderTop: ["borderTopColor", "borderTopStyle", "borderTopWidth"],
          borderWidth: ["borderBottomWidth", "borderLeftWidth", "borderRightWidth", "borderTopWidth"],
          columnRule: ["columnRuleColor", "columnRuleStyle", "columnRuleWidth"],
          columns: ["columnCount", "columnWidth"],
          flex: ["flexBasis", "flexGrow", "flexShrink"],
          flexFlow: ["flexDirection", "flexWrap"],
          font: ["fontFamily", "fontFeatureSettings", "fontKerning", "fontLanguageOverride", "fontSize", "fontSizeAdjust", "fontStretch", "fontStyle", "fontVariant", "fontVariantAlternates", "fontVariantCaps", "fontVariantEastAsian", "fontVariantLigatures", "fontVariantNumeric", "fontVariantPosition", "fontWeight", "lineHeight"],
          fontVariant: ["fontVariantAlternates", "fontVariantCaps", "fontVariantEastAsian", "fontVariantLigatures", "fontVariantNumeric", "fontVariantPosition"],
          gap: ["columnGap", "rowGap"],
          grid: ["gridAutoColumns", "gridAutoFlow", "gridAutoRows", "gridTemplateAreas", "gridTemplateColumns", "gridTemplateRows"],
          gridArea: ["gridColumnEnd", "gridColumnStart", "gridRowEnd", "gridRowStart"],
          gridColumn: ["gridColumnEnd", "gridColumnStart"],
          gridColumnGap: ["columnGap"],
          gridGap: ["columnGap", "rowGap"],
          gridRow: ["gridRowEnd", "gridRowStart"],
          gridRowGap: ["rowGap"],
          gridTemplate: ["gridTemplateAreas", "gridTemplateColumns", "gridTemplateRows"],
          listStyle: ["listStyleImage", "listStylePosition", "listStyleType"],
          margin: ["marginBottom", "marginLeft", "marginRight", "marginTop"],
          marker: ["markerEnd", "markerMid", "markerStart"],
          mask: ["maskClip", "maskComposite", "maskImage", "maskMode", "maskOrigin", "maskPositionX", "maskPositionY", "maskRepeat", "maskSize"],
          maskPosition: ["maskPositionX", "maskPositionY"],
          outline: ["outlineColor", "outlineStyle", "outlineWidth"],
          overflow: ["overflowX", "overflowY"],
          padding: ["paddingBottom", "paddingLeft", "paddingRight", "paddingTop"],
          placeContent: ["alignContent", "justifyContent"],
          placeItems: ["alignItems", "justifyItems"],
          placeSelf: ["alignSelf", "justifySelf"],
          textDecoration: ["textDecorationColor", "textDecorationLine", "textDecorationStyle"],
          textEmphasis: ["textEmphasisColor", "textEmphasisStyle"],
          transition: ["transitionDelay", "transitionDuration", "transitionProperty", "transitionTimingFunction"],
          wordWrap: ["overflowWrap"]
        };
        var isUnitlessNumber = {
          animationIterationCount: true,
          aspectRatio: true,
          borderImageOutset: true,
          borderImageSlice: true,
          borderImageWidth: true,
          boxFlex: true,
          boxFlexGroup: true,
          boxOrdinalGroup: true,
          columnCount: true,
          columns: true,
          flex: true,
          flexGrow: true,
          flexPositive: true,
          flexShrink: true,
          flexNegative: true,
          flexOrder: true,
          gridArea: true,
          gridRow: true,
          gridRowEnd: true,
          gridRowSpan: true,
          gridRowStart: true,
          gridColumn: true,
          gridColumnEnd: true,
          gridColumnSpan: true,
          gridColumnStart: true,
          fontWeight: true,
          lineClamp: true,
          lineHeight: true,
          opacity: true,
          order: true,
          orphans: true,
          tabSize: true,
          widows: true,
          zIndex: true,
          zoom: true,
          // SVG-related properties
          fillOpacity: true,
          floodOpacity: true,
          stopOpacity: true,
          strokeDasharray: true,
          strokeDashoffset: true,
          strokeMiterlimit: true,
          strokeOpacity: true,
          strokeWidth: true
        };
        function prefixKey(prefix2, key) {
          return prefix2 + key.charAt(0).toUpperCase() + key.substring(1);
        }
        var prefixes = ["Webkit", "ms", "Moz", "O"];
        Object.keys(isUnitlessNumber).forEach(function(prop) {
          prefixes.forEach(function(prefix2) {
            isUnitlessNumber[prefixKey(prefix2, prop)] = isUnitlessNumber[prop];
          });
        });
        function dangerousStyleValue(name, value, isCustomProperty) {
          var isEmpty = value == null || typeof value === "boolean" || value === "";
          if (isEmpty) {
            return "";
          }
          if (!isCustomProperty && typeof value === "number" && value !== 0 && !(isUnitlessNumber.hasOwnProperty(name) && isUnitlessNumber[name])) {
            return value + "px";
          }
          {
            checkCSSPropertyStringCoercion(value, name);
          }
          return ("" + value).trim();
        }
        var uppercasePattern = /([A-Z])/g;
        var msPattern = /^ms-/;
        function hyphenateStyleName(name) {
          return name.replace(uppercasePattern, "-$1").toLowerCase().replace(msPattern, "-ms-");
        }
        var warnValidStyle = function() {
        };
        {
          var badVendoredStyleNamePattern = /^(?:webkit|moz|o)[A-Z]/;
          var msPattern$1 = /^-ms-/;
          var hyphenPattern = /-(.)/g;
          var badStyleValueWithSemicolonPattern = /;\s*$/;
          var warnedStyleNames = {};
          var warnedStyleValues = {};
          var warnedForNaNValue = false;
          var warnedForInfinityValue = false;
          var camelize = function(string) {
            return string.replace(hyphenPattern, function(_3, character) {
              return character.toUpperCase();
            });
          };
          var warnHyphenatedStyleName = function(name) {
            if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {
              return;
            }
            warnedStyleNames[name] = true;
            error(
              "Unsupported style property %s. Did you mean %s?",
              name,
              // As Andi Smith suggests
              // (http://www.andismith.com/blog/2012/02/modernizr-prefixed/), an `-ms` prefix
              // is converted to lowercase `ms`.
              camelize(name.replace(msPattern$1, "ms-"))
            );
          };
          var warnBadVendoredStyleName = function(name) {
            if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {
              return;
            }
            warnedStyleNames[name] = true;
            error("Unsupported vendor-prefixed style property %s. Did you mean %s?", name, name.charAt(0).toUpperCase() + name.slice(1));
          };
          var warnStyleValueWithSemicolon = function(name, value) {
            if (warnedStyleValues.hasOwnProperty(value) && warnedStyleValues[value]) {
              return;
            }
            warnedStyleValues[value] = true;
            error(`Style property values shouldn't contain a semicolon. Try "%s: %s" instead.`, name, value.replace(badStyleValueWithSemicolonPattern, ""));
          };
          var warnStyleValueIsNaN = function(name, value) {
            if (warnedForNaNValue) {
              return;
            }
            warnedForNaNValue = true;
            error("`NaN` is an invalid value for the `%s` css style property.", name);
          };
          var warnStyleValueIsInfinity = function(name, value) {
            if (warnedForInfinityValue) {
              return;
            }
            warnedForInfinityValue = true;
            error("`Infinity` is an invalid value for the `%s` css style property.", name);
          };
          warnValidStyle = function(name, value) {
            if (name.indexOf("-") > -1) {
              warnHyphenatedStyleName(name);
            } else if (badVendoredStyleNamePattern.test(name)) {
              warnBadVendoredStyleName(name);
            } else if (badStyleValueWithSemicolonPattern.test(value)) {
              warnStyleValueWithSemicolon(name, value);
            }
            if (typeof value === "number") {
              if (isNaN(value)) {
                warnStyleValueIsNaN(name, value);
              } else if (!isFinite(value)) {
                warnStyleValueIsInfinity(name, value);
              }
            }
          };
        }
        var warnValidStyle$1 = warnValidStyle;
        function createDangerousStringForStyles(styles) {
          {
            var serialized = "";
            var delimiter = "";
            for (var styleName in styles) {
              if (!styles.hasOwnProperty(styleName)) {
                continue;
              }
              var styleValue = styles[styleName];
              if (styleValue != null) {
                var isCustomProperty = styleName.indexOf("--") === 0;
                serialized += delimiter + (isCustomProperty ? styleName : hyphenateStyleName(styleName)) + ":";
                serialized += dangerousStyleValue(styleName, styleValue, isCustomProperty);
                delimiter = ";";
              }
            }
            return serialized || null;
          }
        }
        function setValueForStyles(node2, styles) {
          var style2 = node2.style;
          for (var styleName in styles) {
            if (!styles.hasOwnProperty(styleName)) {
              continue;
            }
            var isCustomProperty = styleName.indexOf("--") === 0;
            {
              if (!isCustomProperty) {
                warnValidStyle$1(styleName, styles[styleName]);
              }
            }
            var styleValue = dangerousStyleValue(styleName, styles[styleName], isCustomProperty);
            if (styleName === "float") {
              styleName = "cssFloat";
            }
            if (isCustomProperty) {
              style2.setProperty(styleName, styleValue);
            } else {
              style2[styleName] = styleValue;
            }
          }
        }
        function isValueEmpty(value) {
          return value == null || typeof value === "boolean" || value === "";
        }
        function expandShorthandMap(styles) {
          var expanded = {};
          for (var key in styles) {
            var longhands = shorthandToLonghand[key] || [key];
            for (var i4 = 0; i4 < longhands.length; i4++) {
              expanded[longhands[i4]] = key;
            }
          }
          return expanded;
        }
        function validateShorthandPropertyCollisionInDev(styleUpdates, nextStyles) {
          {
            if (!nextStyles) {
              return;
            }
            var expandedUpdates = expandShorthandMap(styleUpdates);
            var expandedStyles = expandShorthandMap(nextStyles);
            var warnedAbout = {};
            for (var key in expandedUpdates) {
              var originalKey = expandedUpdates[key];
              var correctOriginalKey = expandedStyles[key];
              if (correctOriginalKey && originalKey !== correctOriginalKey) {
                var warningKey = originalKey + "," + correctOriginalKey;
                if (warnedAbout[warningKey]) {
                  continue;
                }
                warnedAbout[warningKey] = true;
                error("%s a style property during rerender (%s) when a conflicting property is set (%s) can lead to styling bugs. To avoid this, don't mix shorthand and non-shorthand properties for the same value; instead, replace the shorthand with separate values.", isValueEmpty(styleUpdates[originalKey]) ? "Removing" : "Updating", originalKey, correctOriginalKey);
              }
            }
          }
        }
        var omittedCloseTags = {
          area: true,
          base: true,
          br: true,
          col: true,
          embed: true,
          hr: true,
          img: true,
          input: true,
          keygen: true,
          link: true,
          meta: true,
          param: true,
          source: true,
          track: true,
          wbr: true
          // NOTE: menuitem's close tag should be omitted, but that causes problems.
        };
        var voidElementTags = assign3({
          menuitem: true
        }, omittedCloseTags);
        var HTML = "__html";
        function assertValidProps(tag, props) {
          if (!props) {
            return;
          }
          if (voidElementTags[tag]) {
            if (props.children != null || props.dangerouslySetInnerHTML != null) {
              throw new Error(tag + " is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`.");
            }
          }
          if (props.dangerouslySetInnerHTML != null) {
            if (props.children != null) {
              throw new Error("Can only set one of `children` or `props.dangerouslySetInnerHTML`.");
            }
            if (typeof props.dangerouslySetInnerHTML !== "object" || !(HTML in props.dangerouslySetInnerHTML)) {
              throw new Error("`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. Please visit https://reactjs.org/link/dangerously-set-inner-html for more information.");
            }
          }
          {
            if (!props.suppressContentEditableWarning && props.contentEditable && props.children != null) {
              error("A component is `contentEditable` and contains `children` managed by React. It is now your responsibility to guarantee that none of those nodes are unexpectedly modified or duplicated. This is probably not intentional.");
            }
          }
          if (props.style != null && typeof props.style !== "object") {
            throw new Error("The `style` prop expects a mapping from style properties to values, not a string. For example, style={{marginRight: spacing + 'em'}} when using JSX.");
          }
        }
        function isCustomComponent(tagName, props) {
          if (tagName.indexOf("-") === -1) {
            return typeof props.is === "string";
          }
          switch (tagName) {
            // These are reserved SVG and MathML elements.
            // We don't mind this list too much because we expect it to never grow.
            // The alternative is to track the namespace in a few places which is convoluted.
            // https://w3c.github.io/webcomponents/spec/custom/#custom-elements-core-concepts
            case "annotation-xml":
            case "color-profile":
            case "font-face":
            case "font-face-src":
            case "font-face-uri":
            case "font-face-format":
            case "font-face-name":
            case "missing-glyph":
              return false;
            default:
              return true;
          }
        }
        var possibleStandardNames = {
          // HTML
          accept: "accept",
          acceptcharset: "acceptCharset",
          "accept-charset": "acceptCharset",
          accesskey: "accessKey",
          action: "action",
          allowfullscreen: "allowFullScreen",
          alt: "alt",
          as: "as",
          async: "async",
          autocapitalize: "autoCapitalize",
          autocomplete: "autoComplete",
          autocorrect: "autoCorrect",
          autofocus: "autoFocus",
          autoplay: "autoPlay",
          autosave: "autoSave",
          capture: "capture",
          cellpadding: "cellPadding",
          cellspacing: "cellSpacing",
          challenge: "challenge",
          charset: "charSet",
          checked: "checked",
          children: "children",
          cite: "cite",
          class: "className",
          classid: "classID",
          classname: "className",
          cols: "cols",
          colspan: "colSpan",
          content: "content",
          contenteditable: "contentEditable",
          contextmenu: "contextMenu",
          controls: "controls",
          controlslist: "controlsList",
          coords: "coords",
          crossorigin: "crossOrigin",
          dangerouslysetinnerhtml: "dangerouslySetInnerHTML",
          data: "data",
          datetime: "dateTime",
          default: "default",
          defaultchecked: "defaultChecked",
          defaultvalue: "defaultValue",
          defer: "defer",
          dir: "dir",
          disabled: "disabled",
          disablepictureinpicture: "disablePictureInPicture",
          disableremoteplayback: "disableRemotePlayback",
          download: "download",
          draggable: "draggable",
          enctype: "encType",
          enterkeyhint: "enterKeyHint",
          for: "htmlFor",
          form: "form",
          formmethod: "formMethod",
          formaction: "formAction",
          formenctype: "formEncType",
          formnovalidate: "formNoValidate",
          formtarget: "formTarget",
          frameborder: "frameBorder",
          headers: "headers",
          height: "height",
          hidden: "hidden",
          high: "high",
          href: "href",
          hreflang: "hrefLang",
          htmlfor: "htmlFor",
          httpequiv: "httpEquiv",
          "http-equiv": "httpEquiv",
          icon: "icon",
          id: "id",
          imagesizes: "imageSizes",
          imagesrcset: "imageSrcSet",
          innerhtml: "innerHTML",
          inputmode: "inputMode",
          integrity: "integrity",
          is: "is",
          itemid: "itemID",
          itemprop: "itemProp",
          itemref: "itemRef",
          itemscope: "itemScope",
          itemtype: "itemType",
          keyparams: "keyParams",
          keytype: "keyType",
          kind: "kind",
          label: "label",
          lang: "lang",
          list: "list",
          loop: "loop",
          low: "low",
          manifest: "manifest",
          marginwidth: "marginWidth",
          marginheight: "marginHeight",
          max: "max",
          maxlength: "maxLength",
          media: "media",
          mediagroup: "mediaGroup",
          method: "method",
          min: "min",
          minlength: "minLength",
          multiple: "multiple",
          muted: "muted",
          name: "name",
          nomodule: "noModule",
          nonce: "nonce",
          novalidate: "noValidate",
          open: "open",
          optimum: "optimum",
          pattern: "pattern",
          placeholder: "placeholder",
          playsinline: "playsInline",
          poster: "poster",
          preload: "preload",
          profile: "profile",
          radiogroup: "radioGroup",
          readonly: "readOnly",
          referrerpolicy: "referrerPolicy",
          rel: "rel",
          required: "required",
          reversed: "reversed",
          role: "role",
          rows: "rows",
          rowspan: "rowSpan",
          sandbox: "sandbox",
          scope: "scope",
          scoped: "scoped",
          scrolling: "scrolling",
          seamless: "seamless",
          selected: "selected",
          shape: "shape",
          size: "size",
          sizes: "sizes",
          span: "span",
          spellcheck: "spellCheck",
          src: "src",
          srcdoc: "srcDoc",
          srclang: "srcLang",
          srcset: "srcSet",
          start: "start",
          step: "step",
          style: "style",
          summary: "summary",
          tabindex: "tabIndex",
          target: "target",
          title: "title",
          type: "type",
          usemap: "useMap",
          value: "value",
          width: "width",
          wmode: "wmode",
          wrap: "wrap",
          // SVG
          about: "about",
          accentheight: "accentHeight",
          "accent-height": "accentHeight",
          accumulate: "accumulate",
          additive: "additive",
          alignmentbaseline: "alignmentBaseline",
          "alignment-baseline": "alignmentBaseline",
          allowreorder: "allowReorder",
          alphabetic: "alphabetic",
          amplitude: "amplitude",
          arabicform: "arabicForm",
          "arabic-form": "arabicForm",
          ascent: "ascent",
          attributename: "attributeName",
          attributetype: "attributeType",
          autoreverse: "autoReverse",
          azimuth: "azimuth",
          basefrequency: "baseFrequency",
          baselineshift: "baselineShift",
          "baseline-shift": "baselineShift",
          baseprofile: "baseProfile",
          bbox: "bbox",
          begin: "begin",
          bias: "bias",
          by: "by",
          calcmode: "calcMode",
          capheight: "capHeight",
          "cap-height": "capHeight",
          clip: "clip",
          clippath: "clipPath",
          "clip-path": "clipPath",
          clippathunits: "clipPathUnits",
          cliprule: "clipRule",
          "clip-rule": "clipRule",
          color: "color",
          colorinterpolation: "colorInterpolation",
          "color-interpolation": "colorInterpolation",
          colorinterpolationfilters: "colorInterpolationFilters",
          "color-interpolation-filters": "colorInterpolationFilters",
          colorprofile: "colorProfile",
          "color-profile": "colorProfile",
          colorrendering: "colorRendering",
          "color-rendering": "colorRendering",
          contentscripttype: "contentScriptType",
          contentstyletype: "contentStyleType",
          cursor: "cursor",
          cx: "cx",
          cy: "cy",
          d: "d",
          datatype: "datatype",
          decelerate: "decelerate",
          descent: "descent",
          diffuseconstant: "diffuseConstant",
          direction: "direction",
          display: "display",
          divisor: "divisor",
          dominantbaseline: "dominantBaseline",
          "dominant-baseline": "dominantBaseline",
          dur: "dur",
          dx: "dx",
          dy: "dy",
          edgemode: "edgeMode",
          elevation: "elevation",
          enablebackground: "enableBackground",
          "enable-background": "enableBackground",
          end: "end",
          exponent: "exponent",
          externalresourcesrequired: "externalResourcesRequired",
          fill: "fill",
          fillopacity: "fillOpacity",
          "fill-opacity": "fillOpacity",
          fillrule: "fillRule",
          "fill-rule": "fillRule",
          filter: "filter",
          filterres: "filterRes",
          filterunits: "filterUnits",
          floodopacity: "floodOpacity",
          "flood-opacity": "floodOpacity",
          floodcolor: "floodColor",
          "flood-color": "floodColor",
          focusable: "focusable",
          fontfamily: "fontFamily",
          "font-family": "fontFamily",
          fontsize: "fontSize",
          "font-size": "fontSize",
          fontsizeadjust: "fontSizeAdjust",
          "font-size-adjust": "fontSizeAdjust",
          fontstretch: "fontStretch",
          "font-stretch": "fontStretch",
          fontstyle: "fontStyle",
          "font-style": "fontStyle",
          fontvariant: "fontVariant",
          "font-variant": "fontVariant",
          fontweight: "fontWeight",
          "font-weight": "fontWeight",
          format: "format",
          from: "from",
          fx: "fx",
          fy: "fy",
          g1: "g1",
          g2: "g2",
          glyphname: "glyphName",
          "glyph-name": "glyphName",
          glyphorientationhorizontal: "glyphOrientationHorizontal",
          "glyph-orientation-horizontal": "glyphOrientationHorizontal",
          glyphorientationvertical: "glyphOrientationVertical",
          "glyph-orientation-vertical": "glyphOrientationVertical",
          glyphref: "glyphRef",
          gradienttransform: "gradientTransform",
          gradientunits: "gradientUnits",
          hanging: "hanging",
          horizadvx: "horizAdvX",
          "horiz-adv-x": "horizAdvX",
          horizoriginx: "horizOriginX",
          "horiz-origin-x": "horizOriginX",
          ideographic: "ideographic",
          imagerendering: "imageRendering",
          "image-rendering": "imageRendering",
          in2: "in2",
          in: "in",
          inlist: "inlist",
          intercept: "intercept",
          k1: "k1",
          k2: "k2",
          k3: "k3",
          k4: "k4",
          k: "k",
          kernelmatrix: "kernelMatrix",
          kernelunitlength: "kernelUnitLength",
          kerning: "kerning",
          keypoints: "keyPoints",
          keysplines: "keySplines",
          keytimes: "keyTimes",
          lengthadjust: "lengthAdjust",
          letterspacing: "letterSpacing",
          "letter-spacing": "letterSpacing",
          lightingcolor: "lightingColor",
          "lighting-color": "lightingColor",
          limitingconeangle: "limitingConeAngle",
          local: "local",
          markerend: "markerEnd",
          "marker-end": "markerEnd",
          markerheight: "markerHeight",
          markermid: "markerMid",
          "marker-mid": "markerMid",
          markerstart: "markerStart",
          "marker-start": "markerStart",
          markerunits: "markerUnits",
          markerwidth: "markerWidth",
          mask: "mask",
          maskcontentunits: "maskContentUnits",
          maskunits: "maskUnits",
          mathematical: "mathematical",
          mode: "mode",
          numoctaves: "numOctaves",
          offset: "offset",
          opacity: "opacity",
          operator: "operator",
          order: "order",
          orient: "orient",
          orientation: "orientation",
          origin: "origin",
          overflow: "overflow",
          overlineposition: "overlinePosition",
          "overline-position": "overlinePosition",
          overlinethickness: "overlineThickness",
          "overline-thickness": "overlineThickness",
          paintorder: "paintOrder",
          "paint-order": "paintOrder",
          panose1: "panose1",
          "panose-1": "panose1",
          pathlength: "pathLength",
          patterncontentunits: "patternContentUnits",
          patterntransform: "patternTransform",
          patternunits: "patternUnits",
          pointerevents: "pointerEvents",
          "pointer-events": "pointerEvents",
          points: "points",
          pointsatx: "pointsAtX",
          pointsaty: "pointsAtY",
          pointsatz: "pointsAtZ",
          prefix: "prefix",
          preservealpha: "preserveAlpha",
          preserveaspectratio: "preserveAspectRatio",
          primitiveunits: "primitiveUnits",
          property: "property",
          r: "r",
          radius: "radius",
          refx: "refX",
          refy: "refY",
          renderingintent: "renderingIntent",
          "rendering-intent": "renderingIntent",
          repeatcount: "repeatCount",
          repeatdur: "repeatDur",
          requiredextensions: "requiredExtensions",
          requiredfeatures: "requiredFeatures",
          resource: "resource",
          restart: "restart",
          result: "result",
          results: "results",
          rotate: "rotate",
          rx: "rx",
          ry: "ry",
          scale: "scale",
          security: "security",
          seed: "seed",
          shaperendering: "shapeRendering",
          "shape-rendering": "shapeRendering",
          slope: "slope",
          spacing: "spacing",
          specularconstant: "specularConstant",
          specularexponent: "specularExponent",
          speed: "speed",
          spreadmethod: "spreadMethod",
          startoffset: "startOffset",
          stddeviation: "stdDeviation",
          stemh: "stemh",
          stemv: "stemv",
          stitchtiles: "stitchTiles",
          stopcolor: "stopColor",
          "stop-color": "stopColor",
          stopopacity: "stopOpacity",
          "stop-opacity": "stopOpacity",
          strikethroughposition: "strikethroughPosition",
          "strikethrough-position": "strikethroughPosition",
          strikethroughthickness: "strikethroughThickness",
          "strikethrough-thickness": "strikethroughThickness",
          string: "string",
          stroke: "stroke",
          strokedasharray: "strokeDasharray",
          "stroke-dasharray": "strokeDasharray",
          strokedashoffset: "strokeDashoffset",
          "stroke-dashoffset": "strokeDashoffset",
          strokelinecap: "strokeLinecap",
          "stroke-linecap": "strokeLinecap",
          strokelinejoin: "strokeLinejoin",
          "stroke-linejoin": "strokeLinejoin",
          strokemiterlimit: "strokeMiterlimit",
          "stroke-miterlimit": "strokeMiterlimit",
          strokewidth: "strokeWidth",
          "stroke-width": "strokeWidth",
          strokeopacity: "strokeOpacity",
          "stroke-opacity": "strokeOpacity",
          suppresscontenteditablewarning: "suppressContentEditableWarning",
          suppresshydrationwarning: "suppressHydrationWarning",
          surfacescale: "surfaceScale",
          systemlanguage: "systemLanguage",
          tablevalues: "tableValues",
          targetx: "targetX",
          targety: "targetY",
          textanchor: "textAnchor",
          "text-anchor": "textAnchor",
          textdecoration: "textDecoration",
          "text-decoration": "textDecoration",
          textlength: "textLength",
          textrendering: "textRendering",
          "text-rendering": "textRendering",
          to: "to",
          transform: "transform",
          typeof: "typeof",
          u1: "u1",
          u2: "u2",
          underlineposition: "underlinePosition",
          "underline-position": "underlinePosition",
          underlinethickness: "underlineThickness",
          "underline-thickness": "underlineThickness",
          unicode: "unicode",
          unicodebidi: "unicodeBidi",
          "unicode-bidi": "unicodeBidi",
          unicoderange: "unicodeRange",
          "unicode-range": "unicodeRange",
          unitsperem: "unitsPerEm",
          "units-per-em": "unitsPerEm",
          unselectable: "unselectable",
          valphabetic: "vAlphabetic",
          "v-alphabetic": "vAlphabetic",
          values: "values",
          vectoreffect: "vectorEffect",
          "vector-effect": "vectorEffect",
          version: "version",
          vertadvy: "vertAdvY",
          "vert-adv-y": "vertAdvY",
          vertoriginx: "vertOriginX",
          "vert-origin-x": "vertOriginX",
          vertoriginy: "vertOriginY",
          "vert-origin-y": "vertOriginY",
          vhanging: "vHanging",
          "v-hanging": "vHanging",
          videographic: "vIdeographic",
          "v-ideographic": "vIdeographic",
          viewbox: "viewBox",
          viewtarget: "viewTarget",
          visibility: "visibility",
          vmathematical: "vMathematical",
          "v-mathematical": "vMathematical",
          vocab: "vocab",
          widths: "widths",
          wordspacing: "wordSpacing",
          "word-spacing": "wordSpacing",
          writingmode: "writingMode",
          "writing-mode": "writingMode",
          x1: "x1",
          x2: "x2",
          x: "x",
          xchannelselector: "xChannelSelector",
          xheight: "xHeight",
          "x-height": "xHeight",
          xlinkactuate: "xlinkActuate",
          "xlink:actuate": "xlinkActuate",
          xlinkarcrole: "xlinkArcrole",
          "xlink:arcrole": "xlinkArcrole",
          xlinkhref: "xlinkHref",
          "xlink:href": "xlinkHref",
          xlinkrole: "xlinkRole",
          "xlink:role": "xlinkRole",
          xlinkshow: "xlinkShow",
          "xlink:show": "xlinkShow",
          xlinktitle: "xlinkTitle",
          "xlink:title": "xlinkTitle",
          xlinktype: "xlinkType",
          "xlink:type": "xlinkType",
          xmlbase: "xmlBase",
          "xml:base": "xmlBase",
          xmllang: "xmlLang",
          "xml:lang": "xmlLang",
          xmlns: "xmlns",
          "xml:space": "xmlSpace",
          xmlnsxlink: "xmlnsXlink",
          "xmlns:xlink": "xmlnsXlink",
          xmlspace: "xmlSpace",
          y1: "y1",
          y2: "y2",
          y: "y",
          ychannelselector: "yChannelSelector",
          z: "z",
          zoomandpan: "zoomAndPan"
        };
        var ariaProperties = {
          "aria-current": 0,
          // state
          "aria-description": 0,
          "aria-details": 0,
          "aria-disabled": 0,
          // state
          "aria-hidden": 0,
          // state
          "aria-invalid": 0,
          // state
          "aria-keyshortcuts": 0,
          "aria-label": 0,
          "aria-roledescription": 0,
          // Widget Attributes
          "aria-autocomplete": 0,
          "aria-checked": 0,
          "aria-expanded": 0,
          "aria-haspopup": 0,
          "aria-level": 0,
          "aria-modal": 0,
          "aria-multiline": 0,
          "aria-multiselectable": 0,
          "aria-orientation": 0,
          "aria-placeholder": 0,
          "aria-pressed": 0,
          "aria-readonly": 0,
          "aria-required": 0,
          "aria-selected": 0,
          "aria-sort": 0,
          "aria-valuemax": 0,
          "aria-valuemin": 0,
          "aria-valuenow": 0,
          "aria-valuetext": 0,
          // Live Region Attributes
          "aria-atomic": 0,
          "aria-busy": 0,
          "aria-live": 0,
          "aria-relevant": 0,
          // Drag-and-Drop Attributes
          "aria-dropeffect": 0,
          "aria-grabbed": 0,
          // Relationship Attributes
          "aria-activedescendant": 0,
          "aria-colcount": 0,
          "aria-colindex": 0,
          "aria-colspan": 0,
          "aria-controls": 0,
          "aria-describedby": 0,
          "aria-errormessage": 0,
          "aria-flowto": 0,
          "aria-labelledby": 0,
          "aria-owns": 0,
          "aria-posinset": 0,
          "aria-rowcount": 0,
          "aria-rowindex": 0,
          "aria-rowspan": 0,
          "aria-setsize": 0
        };
        var warnedProperties = {};
        var rARIA = new RegExp("^(aria)-[" + ATTRIBUTE_NAME_CHAR + "]*$");
        var rARIACamel = new RegExp("^(aria)[A-Z][" + ATTRIBUTE_NAME_CHAR + "]*$");
        function validateProperty(tagName, name) {
          {
            if (hasOwnProperty.call(warnedProperties, name) && warnedProperties[name]) {
              return true;
            }
            if (rARIACamel.test(name)) {
              var ariaName = "aria-" + name.slice(4).toLowerCase();
              var correctName = ariaProperties.hasOwnProperty(ariaName) ? ariaName : null;
              if (correctName == null) {
                error("Invalid ARIA attribute `%s`. ARIA attributes follow the pattern aria-* and must be lowercase.", name);
                warnedProperties[name] = true;
                return true;
              }
              if (name !== correctName) {
                error("Invalid ARIA attribute `%s`. Did you mean `%s`?", name, correctName);
                warnedProperties[name] = true;
                return true;
              }
            }
            if (rARIA.test(name)) {
              var lowerCasedName = name.toLowerCase();
              var standardName = ariaProperties.hasOwnProperty(lowerCasedName) ? lowerCasedName : null;
              if (standardName == null) {
                warnedProperties[name] = true;
                return false;
              }
              if (name !== standardName) {
                error("Unknown ARIA attribute `%s`. Did you mean `%s`?", name, standardName);
                warnedProperties[name] = true;
                return true;
              }
            }
          }
          return true;
        }
        function warnInvalidARIAProps(type, props) {
          {
            var invalidProps = [];
            for (var key in props) {
              var isValid = validateProperty(type, key);
              if (!isValid) {
                invalidProps.push(key);
              }
            }
            var unknownPropString = invalidProps.map(function(prop) {
              return "`" + prop + "`";
            }).join(", ");
            if (invalidProps.length === 1) {
              error("Invalid aria prop %s on <%s> tag. For details, see https://reactjs.org/link/invalid-aria-props", unknownPropString, type);
            } else if (invalidProps.length > 1) {
              error("Invalid aria props %s on <%s> tag. For details, see https://reactjs.org/link/invalid-aria-props", unknownPropString, type);
            }
          }
        }
        function validateProperties(type, props) {
          if (isCustomComponent(type, props)) {
            return;
          }
          warnInvalidARIAProps(type, props);
        }
        var didWarnValueNull = false;
        function validateProperties$1(type, props) {
          {
            if (type !== "input" && type !== "textarea" && type !== "select") {
              return;
            }
            if (props != null && props.value === null && !didWarnValueNull) {
              didWarnValueNull = true;
              if (type === "select" && props.multiple) {
                error("`value` prop on `%s` should not be null. Consider using an empty array when `multiple` is set to `true` to clear the component or `undefined` for uncontrolled components.", type);
              } else {
                error("`value` prop on `%s` should not be null. Consider using an empty string to clear the component or `undefined` for uncontrolled components.", type);
              }
            }
          }
        }
        var validateProperty$1 = function() {
        };
        {
          var warnedProperties$1 = {};
          var EVENT_NAME_REGEX = /^on./;
          var INVALID_EVENT_NAME_REGEX = /^on[^A-Z]/;
          var rARIA$1 = new RegExp("^(aria)-[" + ATTRIBUTE_NAME_CHAR + "]*$");
          var rARIACamel$1 = new RegExp("^(aria)[A-Z][" + ATTRIBUTE_NAME_CHAR + "]*$");
          validateProperty$1 = function(tagName, name, value, eventRegistry) {
            if (hasOwnProperty.call(warnedProperties$1, name) && warnedProperties$1[name]) {
              return true;
            }
            var lowerCasedName = name.toLowerCase();
            if (lowerCasedName === "onfocusin" || lowerCasedName === "onfocusout") {
              error("React uses onFocus and onBlur instead of onFocusIn and onFocusOut. All React events are normalized to bubble, so onFocusIn and onFocusOut are not needed/supported by React.");
              warnedProperties$1[name] = true;
              return true;
            }
            if (eventRegistry != null) {
              var registrationNameDependencies2 = eventRegistry.registrationNameDependencies, possibleRegistrationNames2 = eventRegistry.possibleRegistrationNames;
              if (registrationNameDependencies2.hasOwnProperty(name)) {
                return true;
              }
              var registrationName = possibleRegistrationNames2.hasOwnProperty(lowerCasedName) ? possibleRegistrationNames2[lowerCasedName] : null;
              if (registrationName != null) {
                error("Invalid event handler property `%s`. Did you mean `%s`?", name, registrationName);
                warnedProperties$1[name] = true;
                return true;
              }
              if (EVENT_NAME_REGEX.test(name)) {
                error("Unknown event handler property `%s`. It will be ignored.", name);
                warnedProperties$1[name] = true;
                return true;
              }
            } else if (EVENT_NAME_REGEX.test(name)) {
              if (INVALID_EVENT_NAME_REGEX.test(name)) {
                error("Invalid event handler property `%s`. React events use the camelCase naming convention, for example `onClick`.", name);
              }
              warnedProperties$1[name] = true;
              return true;
            }
            if (rARIA$1.test(name) || rARIACamel$1.test(name)) {
              return true;
            }
            if (lowerCasedName === "innerhtml") {
              error("Directly setting property `innerHTML` is not permitted. For more information, lookup documentation on `dangerouslySetInnerHTML`.");
              warnedProperties$1[name] = true;
              return true;
            }
            if (lowerCasedName === "aria") {
              error("The `aria` attribute is reserved for future use in React. Pass individual `aria-` attributes instead.");
              warnedProperties$1[name] = true;
              return true;
            }
            if (lowerCasedName === "is" && value !== null && value !== void 0 && typeof value !== "string") {
              error("Received a `%s` for a string attribute `is`. If this is expected, cast the value to a string.", typeof value);
              warnedProperties$1[name] = true;
              return true;
            }
            if (typeof value === "number" && isNaN(value)) {
              error("Received NaN for the `%s` attribute. If this is expected, cast the value to a string.", name);
              warnedProperties$1[name] = true;
              return true;
            }
            var propertyInfo = getPropertyInfo(name);
            var isReserved = propertyInfo !== null && propertyInfo.type === RESERVED;
            if (possibleStandardNames.hasOwnProperty(lowerCasedName)) {
              var standardName = possibleStandardNames[lowerCasedName];
              if (standardName !== name) {
                error("Invalid DOM property `%s`. Did you mean `%s`?", name, standardName);
                warnedProperties$1[name] = true;
                return true;
              }
            } else if (!isReserved && name !== lowerCasedName) {
              error("React does not recognize the `%s` prop on a DOM element. If you intentionally want it to appear in the DOM as a custom attribute, spell it as lowercase `%s` instead. If you accidentally passed it from a parent component, remove it from the DOM element.", name, lowerCasedName);
              warnedProperties$1[name] = true;
              return true;
            }
            if (typeof value === "boolean" && shouldRemoveAttributeWithWarning(name, value, propertyInfo, false)) {
              if (value) {
                error('Received `%s` for a non-boolean attribute `%s`.\n\nIf you want to write it to the DOM, pass a string instead: %s="%s" or %s={value.toString()}.', value, name, name, value, name);
              } else {
                error('Received `%s` for a non-boolean attribute `%s`.\n\nIf you want to write it to the DOM, pass a string instead: %s="%s" or %s={value.toString()}.\n\nIf you used to conditionally omit it with %s={condition && value}, pass %s={condition ? value : undefined} instead.', value, name, name, value, name, name, name);
              }
              warnedProperties$1[name] = true;
              return true;
            }
            if (isReserved) {
              return true;
            }
            if (shouldRemoveAttributeWithWarning(name, value, propertyInfo, false)) {
              warnedProperties$1[name] = true;
              return false;
            }
            if ((value === "false" || value === "true") && propertyInfo !== null && propertyInfo.type === BOOLEAN) {
              error("Received the string `%s` for the boolean attribute `%s`. %s Did you mean %s={%s}?", value, name, value === "false" ? "The browser will interpret it as a truthy value." : 'Although this works, it will not work as expected if you pass the string "false".', name, value);
              warnedProperties$1[name] = true;
              return true;
            }
            return true;
          };
        }
        var warnUnknownProperties = function(type, props, eventRegistry) {
          {
            var unknownProps = [];
            for (var key in props) {
              var isValid = validateProperty$1(type, key, props[key], eventRegistry);
              if (!isValid) {
                unknownProps.push(key);
              }
            }
            var unknownPropString = unknownProps.map(function(prop) {
              return "`" + prop + "`";
            }).join(", ");
            if (unknownProps.length === 1) {
              error("Invalid value for prop %s on <%s> tag. Either remove it from the element, or pass a string or number value to keep it in the DOM. For details, see https://reactjs.org/link/attribute-behavior ", unknownPropString, type);
            } else if (unknownProps.length > 1) {
              error("Invalid values for props %s on <%s> tag. Either remove them from the element, or pass a string or number value to keep them in the DOM. For details, see https://reactjs.org/link/attribute-behavior ", unknownPropString, type);
            }
          }
        };
        function validateProperties$2(type, props, eventRegistry) {
          if (isCustomComponent(type, props)) {
            return;
          }
          warnUnknownProperties(type, props, eventRegistry);
        }
        var IS_EVENT_HANDLE_NON_MANAGED_NODE = 1;
        var IS_NON_DELEGATED = 1 << 1;
        var IS_CAPTURE_PHASE = 1 << 2;
        var SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS = IS_EVENT_HANDLE_NON_MANAGED_NODE | IS_NON_DELEGATED | IS_CAPTURE_PHASE;
        var currentReplayingEvent = null;
        function setReplayingEvent(event) {
          {
            if (currentReplayingEvent !== null) {
              error("Expected currently replaying event to be null. This error is likely caused by a bug in React. Please file an issue.");
            }
          }
          currentReplayingEvent = event;
        }
        function resetReplayingEvent() {
          {
            if (currentReplayingEvent === null) {
              error("Expected currently replaying event to not be null. This error is likely caused by a bug in React. Please file an issue.");
            }
          }
          currentReplayingEvent = null;
        }
        function isReplayingEvent(event) {
          return event === currentReplayingEvent;
        }
        function getEventTarget(nativeEvent) {
          var target = nativeEvent.target || nativeEvent.srcElement || window;
          if (target.correspondingUseElement) {
            target = target.correspondingUseElement;
          }
          return target.nodeType === TEXT_NODE ? target.parentNode : target;
        }
        var restoreImpl = null;
        var restoreTarget = null;
        var restoreQueue = null;
        function restoreStateOfTarget(target) {
          var internalInstance = getInstanceFromNode(target);
          if (!internalInstance) {
            return;
          }
          if (typeof restoreImpl !== "function") {
            throw new Error("setRestoreImplementation() needs to be called to handle a target for controlled events. This error is likely caused by a bug in React. Please file an issue.");
          }
          var stateNode = internalInstance.stateNode;
          if (stateNode) {
            var _props = getFiberCurrentPropsFromNode(stateNode);
            restoreImpl(internalInstance.stateNode, internalInstance.type, _props);
          }
        }
        function setRestoreImplementation(impl) {
          restoreImpl = impl;
        }
        function enqueueStateRestore(target) {
          if (restoreTarget) {
            if (restoreQueue) {
              restoreQueue.push(target);
            } else {
              restoreQueue = [target];
            }
          } else {
            restoreTarget = target;
          }
        }
        function needsStateRestore() {
          return restoreTarget !== null || restoreQueue !== null;
        }
        function restoreStateIfNeeded() {
          if (!restoreTarget) {
            return;
          }
          var target = restoreTarget;
          var queuedTargets = restoreQueue;
          restoreTarget = null;
          restoreQueue = null;
          restoreStateOfTarget(target);
          if (queuedTargets) {
            for (var i4 = 0; i4 < queuedTargets.length; i4++) {
              restoreStateOfTarget(queuedTargets[i4]);
            }
          }
        }
        var batchedUpdatesImpl = function(fn, bookkeeping) {
          return fn(bookkeeping);
        };
        var flushSyncImpl = function() {
        };
        var isInsideEventHandler = false;
        function finishEventHandler() {
          var controlledComponentsHavePendingUpdates = needsStateRestore();
          if (controlledComponentsHavePendingUpdates) {
            flushSyncImpl();
            restoreStateIfNeeded();
          }
        }
        function batchedUpdates(fn, a3, b2) {
          if (isInsideEventHandler) {
            return fn(a3, b2);
          }
          isInsideEventHandler = true;
          try {
            return batchedUpdatesImpl(fn, a3, b2);
          } finally {
            isInsideEventHandler = false;
            finishEventHandler();
          }
        }
        function setBatchingImplementation(_batchedUpdatesImpl, _discreteUpdatesImpl, _flushSyncImpl) {
          batchedUpdatesImpl = _batchedUpdatesImpl;
          flushSyncImpl = _flushSyncImpl;
        }
        function isInteractive(tag) {
          return tag === "button" || tag === "input" || tag === "select" || tag === "textarea";
        }
        function shouldPreventMouseEvent(name, type, props) {
          switch (name) {
            case "onClick":
            case "onClickCapture":
            case "onDoubleClick":
            case "onDoubleClickCapture":
            case "onMouseDown":
            case "onMouseDownCapture":
            case "onMouseMove":
            case "onMouseMoveCapture":
            case "onMouseUp":
            case "onMouseUpCapture":
            case "onMouseEnter":
              return !!(props.disabled && isInteractive(type));
            default:
              return false;
          }
        }
        function getListener(inst, registrationName) {
          var stateNode = inst.stateNode;
          if (stateNode === null) {
            return null;
          }
          var props = getFiberCurrentPropsFromNode(stateNode);
          if (props === null) {
            return null;
          }
          var listener = props[registrationName];
          if (shouldPreventMouseEvent(registrationName, inst.type, props)) {
            return null;
          }
          if (listener && typeof listener !== "function") {
            throw new Error("Expected `" + registrationName + "` listener to be a function, instead got a value of `" + typeof listener + "` type.");
          }
          return listener;
        }
        var passiveBrowserEventsSupported = false;
        if (canUseDOM) {
          try {
            var options = {};
            Object.defineProperty(options, "passive", {
              get: function() {
                passiveBrowserEventsSupported = true;
              }
            });
            window.addEventListener("test", options, options);
            window.removeEventListener("test", options, options);
          } catch (e2) {
            passiveBrowserEventsSupported = false;
          }
        }
        function invokeGuardedCallbackProd(name, func, context, a3, b2, c4, d2, e2, f3) {
          var funcArgs = Array.prototype.slice.call(arguments, 3);
          try {
            func.apply(context, funcArgs);
          } catch (error2) {
            this.onError(error2);
          }
        }
        var invokeGuardedCallbackImpl = invokeGuardedCallbackProd;
        {
          if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof document !== "undefined" && typeof document.createEvent === "function") {
            var fakeNode = document.createElement("react");
            invokeGuardedCallbackImpl = function invokeGuardedCallbackDev(name, func, context, a3, b2, c4, d2, e2, f3) {
              if (typeof document === "undefined" || document === null) {
                throw new Error("The `document` global was defined when React was initialized, but is not defined anymore. This can happen in a test environment if a component schedules an update from an asynchronous callback, but the test has already finished running. To solve this, you can either unmount the component at the end of your test (and ensure that any asynchronous operations get canceled in `componentWillUnmount`), or you can change the test itself to be asynchronous.");
              }
              var evt = document.createEvent("Event");
              var didCall = false;
              var didError = true;
              var windowEvent = window.event;
              var windowEventDescriptor = Object.getOwnPropertyDescriptor(window, "event");
              function restoreAfterDispatch() {
                fakeNode.removeEventListener(evtType, callCallback2, false);
                if (typeof window.event !== "undefined" && window.hasOwnProperty("event")) {
                  window.event = windowEvent;
                }
              }
              var funcArgs = Array.prototype.slice.call(arguments, 3);
              function callCallback2() {
                didCall = true;
                restoreAfterDispatch();
                func.apply(context, funcArgs);
                didError = false;
              }
              var error2;
              var didSetError = false;
              var isCrossOriginError = false;
              function handleWindowError(event) {
                error2 = event.error;
                didSetError = true;
                if (error2 === null && event.colno === 0 && event.lineno === 0) {
                  isCrossOriginError = true;
                }
                if (event.defaultPrevented) {
                  if (error2 != null && typeof error2 === "object") {
                    try {
                      error2._suppressLogging = true;
                    } catch (inner) {
                    }
                  }
                }
              }
              var evtType = "react-" + (name ? name : "invokeguardedcallback");
              window.addEventListener("error", handleWindowError);
              fakeNode.addEventListener(evtType, callCallback2, false);
              evt.initEvent(evtType, false, false);
              fakeNode.dispatchEvent(evt);
              if (windowEventDescriptor) {
                Object.defineProperty(window, "event", windowEventDescriptor);
              }
              if (didCall && didError) {
                if (!didSetError) {
                  error2 = new Error(`An error was thrown inside one of your components, but React doesn't know what it was. This is likely due to browser flakiness. React does its best to preserve the "Pause on exceptions" behavior of the DevTools, which requires some DEV-mode only tricks. It's possible that these don't work in your browser. Try triggering the error in production mode, or switching to a modern browser. If you suspect that this is actually an issue with React, please file an issue.`);
                } else if (isCrossOriginError) {
                  error2 = new Error("A cross-origin error was thrown. React doesn't have access to the actual error object in development. See https://reactjs.org/link/crossorigin-error for more information.");
                }
                this.onError(error2);
              }
              window.removeEventListener("error", handleWindowError);
              if (!didCall) {
                restoreAfterDispatch();
                return invokeGuardedCallbackProd.apply(this, arguments);
              }
            };
          }
        }
        var invokeGuardedCallbackImpl$1 = invokeGuardedCallbackImpl;
        var hasError = false;
        var caughtError = null;
        var hasRethrowError = false;
        var rethrowError = null;
        var reporter = {
          onError: function(error2) {
            hasError = true;
            caughtError = error2;
          }
        };
        function invokeGuardedCallback(name, func, context, a3, b2, c4, d2, e2, f3) {
          hasError = false;
          caughtError = null;
          invokeGuardedCallbackImpl$1.apply(reporter, arguments);
        }
        function invokeGuardedCallbackAndCatchFirstError(name, func, context, a3, b2, c4, d2, e2, f3) {
          invokeGuardedCallback.apply(this, arguments);
          if (hasError) {
            var error2 = clearCaughtError();
            if (!hasRethrowError) {
              hasRethrowError = true;
              rethrowError = error2;
            }
          }
        }
        function rethrowCaughtError() {
          if (hasRethrowError) {
            var error2 = rethrowError;
            hasRethrowError = false;
            rethrowError = null;
            throw error2;
          }
        }
        function hasCaughtError() {
          return hasError;
        }
        function clearCaughtError() {
          if (hasError) {
            var error2 = caughtError;
            hasError = false;
            caughtError = null;
            return error2;
          } else {
            throw new Error("clearCaughtError was called but no error was captured. This error is likely caused by a bug in React. Please file an issue.");
          }
        }
        function get2(key) {
          return key._reactInternals;
        }
        function has(key) {
          return key._reactInternals !== void 0;
        }
        function set(key, value) {
          key._reactInternals = value;
        }
        var NoFlags = (
          /*                      */
          0
        );
        var PerformedWork = (
          /*                */
          1
        );
        var Placement = (
          /*                    */
          2
        );
        var Update = (
          /*                       */
          4
        );
        var ChildDeletion = (
          /*                */
          16
        );
        var ContentReset = (
          /*                 */
          32
        );
        var Callback = (
          /*                     */
          64
        );
        var DidCapture = (
          /*                   */
          128
        );
        var ForceClientRender = (
          /*            */
          256
        );
        var Ref = (
          /*                          */
          512
        );
        var Snapshot = (
          /*                     */
          1024
        );
        var Passive = (
          /*                      */
          2048
        );
        var Hydrating = (
          /*                    */
          4096
        );
        var Visibility = (
          /*                   */
          8192
        );
        var StoreConsistency = (
          /*             */
          16384
        );
        var LifecycleEffectMask = Passive | Update | Callback | Ref | Snapshot | StoreConsistency;
        var HostEffectMask = (
          /*               */
          32767
        );
        var Incomplete = (
          /*                   */
          32768
        );
        var ShouldCapture = (
          /*                */
          65536
        );
        var ForceUpdateForLegacySuspense = (
          /* */
          131072
        );
        var Forked = (
          /*                       */
          1048576
        );
        var RefStatic = (
          /*                    */
          2097152
        );
        var LayoutStatic = (
          /*                 */
          4194304
        );
        var PassiveStatic = (
          /*                */
          8388608
        );
        var MountLayoutDev = (
          /*               */
          16777216
        );
        var MountPassiveDev = (
          /*              */
          33554432
        );
        var BeforeMutationMask = (
          // TODO: Remove Update flag from before mutation phase by re-landing Visibility
          // flag logic (see #20043)
          Update | Snapshot | 0
        );
        var MutationMask = Placement | Update | ChildDeletion | ContentReset | Ref | Hydrating | Visibility;
        var LayoutMask = Update | Callback | Ref | Visibility;
        var PassiveMask = Passive | ChildDeletion;
        var StaticMask = LayoutStatic | PassiveStatic | RefStatic;
        var ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;
        function getNearestMountedFiber(fiber) {
          var node2 = fiber;
          var nearestMounted = fiber;
          if (!fiber.alternate) {
            var nextNode = node2;
            do {
              node2 = nextNode;
              if ((node2.flags & (Placement | Hydrating)) !== NoFlags) {
                nearestMounted = node2.return;
              }
              nextNode = node2.return;
            } while (nextNode);
          } else {
            while (node2.return) {
              node2 = node2.return;
            }
          }
          if (node2.tag === HostRoot) {
            return nearestMounted;
          }
          return null;
        }
        function getSuspenseInstanceFromFiber(fiber) {
          if (fiber.tag === SuspenseComponent) {
            var suspenseState = fiber.memoizedState;
            if (suspenseState === null) {
              var current2 = fiber.alternate;
              if (current2 !== null) {
                suspenseState = current2.memoizedState;
              }
            }
            if (suspenseState !== null) {
              return suspenseState.dehydrated;
            }
          }
          return null;
        }
        function getContainerFromFiber(fiber) {
          return fiber.tag === HostRoot ? fiber.stateNode.containerInfo : null;
        }
        function isFiberMounted(fiber) {
          return getNearestMountedFiber(fiber) === fiber;
        }
        function isMounted(component) {
          {
            var owner = ReactCurrentOwner.current;
            if (owner !== null && owner.tag === ClassComponent) {
              var ownerFiber = owner;
              var instance = ownerFiber.stateNode;
              if (!instance._warnedAboutRefsInRender) {
                error("%s is accessing isMounted inside its render() function. render() should be a pure function of props and state. It should never access something that requires stale data from the previous render, such as refs. Move this logic to componentDidMount and componentDidUpdate instead.", getComponentNameFromFiber(ownerFiber) || "A component");
              }
              instance._warnedAboutRefsInRender = true;
            }
          }
          var fiber = get2(component);
          if (!fiber) {
            return false;
          }
          return getNearestMountedFiber(fiber) === fiber;
        }
        function assertIsMounted(fiber) {
          if (getNearestMountedFiber(fiber) !== fiber) {
            throw new Error("Unable to find node on an unmounted component.");
          }
        }
        function findCurrentFiberUsingSlowPath(fiber) {
          var alternate = fiber.alternate;
          if (!alternate) {
            var nearestMounted = getNearestMountedFiber(fiber);
            if (nearestMounted === null) {
              throw new Error("Unable to find node on an unmounted component.");
            }
            if (nearestMounted !== fiber) {
              return null;
            }
            return fiber;
          }
          var a3 = fiber;
          var b2 = alternate;
          while (true) {
            var parentA = a3.return;
            if (parentA === null) {
              break;
            }
            var parentB = parentA.alternate;
            if (parentB === null) {
              var nextParent = parentA.return;
              if (nextParent !== null) {
                a3 = b2 = nextParent;
                continue;
              }
              break;
            }
            if (parentA.child === parentB.child) {
              var child = parentA.child;
              while (child) {
                if (child === a3) {
                  assertIsMounted(parentA);
                  return fiber;
                }
                if (child === b2) {
                  assertIsMounted(parentA);
                  return alternate;
                }
                child = child.sibling;
              }
              throw new Error("Unable to find node on an unmounted component.");
            }
            if (a3.return !== b2.return) {
              a3 = parentA;
              b2 = parentB;
            } else {
              var didFindChild = false;
              var _child = parentA.child;
              while (_child) {
                if (_child === a3) {
                  didFindChild = true;
                  a3 = parentA;
                  b2 = parentB;
                  break;
                }
                if (_child === b2) {
                  didFindChild = true;
                  b2 = parentA;
                  a3 = parentB;
                  break;
                }
                _child = _child.sibling;
              }
              if (!didFindChild) {
                _child = parentB.child;
                while (_child) {
                  if (_child === a3) {
                    didFindChild = true;
                    a3 = parentB;
                    b2 = parentA;
                    break;
                  }
                  if (_child === b2) {
                    didFindChild = true;
                    b2 = parentB;
                    a3 = parentA;
                    break;
                  }
                  _child = _child.sibling;
                }
                if (!didFindChild) {
                  throw new Error("Child was not found in either parent set. This indicates a bug in React related to the return pointer. Please file an issue.");
                }
              }
            }
            if (a3.alternate !== b2) {
              throw new Error("Return fibers should always be each others' alternates. This error is likely caused by a bug in React. Please file an issue.");
            }
          }
          if (a3.tag !== HostRoot) {
            throw new Error("Unable to find node on an unmounted component.");
          }
          if (a3.stateNode.current === a3) {
            return fiber;
          }
          return alternate;
        }
        function findCurrentHostFiber(parent) {
          var currentParent = findCurrentFiberUsingSlowPath(parent);
          return currentParent !== null ? findCurrentHostFiberImpl(currentParent) : null;
        }
        function findCurrentHostFiberImpl(node2) {
          if (node2.tag === HostComponent || node2.tag === HostText) {
            return node2;
          }
          var child = node2.child;
          while (child !== null) {
            var match = findCurrentHostFiberImpl(child);
            if (match !== null) {
              return match;
            }
            child = child.sibling;
          }
          return null;
        }
        function findCurrentHostFiberWithNoPortals(parent) {
          var currentParent = findCurrentFiberUsingSlowPath(parent);
          return currentParent !== null ? findCurrentHostFiberWithNoPortalsImpl(currentParent) : null;
        }
        function findCurrentHostFiberWithNoPortalsImpl(node2) {
          if (node2.tag === HostComponent || node2.tag === HostText) {
            return node2;
          }
          var child = node2.child;
          while (child !== null) {
            if (child.tag !== HostPortal) {
              var match = findCurrentHostFiberWithNoPortalsImpl(child);
              if (match !== null) {
                return match;
              }
            }
            child = child.sibling;
          }
          return null;
        }
        var scheduleCallback = Scheduler.unstable_scheduleCallback;
        var cancelCallback = Scheduler.unstable_cancelCallback;
        var shouldYield = Scheduler.unstable_shouldYield;
        var requestPaint = Scheduler.unstable_requestPaint;
        var now = Scheduler.unstable_now;
        var getCurrentPriorityLevel = Scheduler.unstable_getCurrentPriorityLevel;
        var ImmediatePriority = Scheduler.unstable_ImmediatePriority;
        var UserBlockingPriority = Scheduler.unstable_UserBlockingPriority;
        var NormalPriority = Scheduler.unstable_NormalPriority;
        var LowPriority = Scheduler.unstable_LowPriority;
        var IdlePriority = Scheduler.unstable_IdlePriority;
        var unstable_yieldValue = Scheduler.unstable_yieldValue;
        var unstable_setDisableYieldValue = Scheduler.unstable_setDisableYieldValue;
        var rendererID = null;
        var injectedHook = null;
        var injectedProfilingHooks = null;
        var hasLoggedError = false;
        var isDevToolsPresent = typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined";
        function injectInternals(internals2) {
          if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined") {
            return false;
          }
          var hook = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (hook.isDisabled) {
            return true;
          }
          if (!hook.supportsFiber) {
            {
              error("The installed version of React DevTools is too old and will not work with the current version of React. Please update React DevTools. https://reactjs.org/link/react-devtools");
            }
            return true;
          }
          try {
            if (enableSchedulingProfiler) {
              internals2 = assign3({}, internals2, {
                getLaneLabelMap,
                injectProfilingHooks
              });
            }
            rendererID = hook.inject(internals2);
            injectedHook = hook;
          } catch (err2) {
            {
              error("React instrumentation encountered an error: %s.", err2);
            }
          }
          if (hook.checkDCE) {
            return true;
          } else {
            return false;
          }
        }
        function onScheduleRoot(root2, children) {
          {
            if (injectedHook && typeof injectedHook.onScheduleFiberRoot === "function") {
              try {
                injectedHook.onScheduleFiberRoot(rendererID, root2, children);
              } catch (err2) {
                if (!hasLoggedError) {
                  hasLoggedError = true;
                  error("React instrumentation encountered an error: %s", err2);
                }
              }
            }
          }
        }
        function onCommitRoot(root2, eventPriority) {
          if (injectedHook && typeof injectedHook.onCommitFiberRoot === "function") {
            try {
              var didError = (root2.current.flags & DidCapture) === DidCapture;
              if (enableProfilerTimer) {
                var schedulerPriority;
                switch (eventPriority) {
                  case DiscreteEventPriority:
                    schedulerPriority = ImmediatePriority;
                    break;
                  case ContinuousEventPriority:
                    schedulerPriority = UserBlockingPriority;
                    break;
                  case DefaultEventPriority:
                    schedulerPriority = NormalPriority;
                    break;
                  case IdleEventPriority:
                    schedulerPriority = IdlePriority;
                    break;
                  default:
                    schedulerPriority = NormalPriority;
                    break;
                }
                injectedHook.onCommitFiberRoot(rendererID, root2, schedulerPriority, didError);
              } else {
                injectedHook.onCommitFiberRoot(rendererID, root2, void 0, didError);
              }
            } catch (err2) {
              {
                if (!hasLoggedError) {
                  hasLoggedError = true;
                  error("React instrumentation encountered an error: %s", err2);
                }
              }
            }
          }
        }
        function onPostCommitRoot(root2) {
          if (injectedHook && typeof injectedHook.onPostCommitFiberRoot === "function") {
            try {
              injectedHook.onPostCommitFiberRoot(rendererID, root2);
            } catch (err2) {
              {
                if (!hasLoggedError) {
                  hasLoggedError = true;
                  error("React instrumentation encountered an error: %s", err2);
                }
              }
            }
          }
        }
        function onCommitUnmount(fiber) {
          if (injectedHook && typeof injectedHook.onCommitFiberUnmount === "function") {
            try {
              injectedHook.onCommitFiberUnmount(rendererID, fiber);
            } catch (err2) {
              {
                if (!hasLoggedError) {
                  hasLoggedError = true;
                  error("React instrumentation encountered an error: %s", err2);
                }
              }
            }
          }
        }
        function setIsStrictModeForDevtools(newIsStrictMode) {
          {
            if (typeof unstable_yieldValue === "function") {
              unstable_setDisableYieldValue(newIsStrictMode);
              setSuppressWarning(newIsStrictMode);
            }
            if (injectedHook && typeof injectedHook.setStrictMode === "function") {
              try {
                injectedHook.setStrictMode(rendererID, newIsStrictMode);
              } catch (err2) {
                {
                  if (!hasLoggedError) {
                    hasLoggedError = true;
                    error("React instrumentation encountered an error: %s", err2);
                  }
                }
              }
            }
          }
        }
        function injectProfilingHooks(profilingHooks) {
          injectedProfilingHooks = profilingHooks;
        }
        function getLaneLabelMap() {
          {
            var map = /* @__PURE__ */ new Map();
            var lane = 1;
            for (var index3 = 0; index3 < TotalLanes; index3++) {
              var label = getLabelForLane(lane);
              map.set(lane, label);
              lane *= 2;
            }
            return map;
          }
        }
        function markCommitStarted(lanes) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markCommitStarted === "function") {
              injectedProfilingHooks.markCommitStarted(lanes);
            }
          }
        }
        function markCommitStopped() {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markCommitStopped === "function") {
              injectedProfilingHooks.markCommitStopped();
            }
          }
        }
        function markComponentRenderStarted(fiber) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentRenderStarted === "function") {
              injectedProfilingHooks.markComponentRenderStarted(fiber);
            }
          }
        }
        function markComponentRenderStopped() {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentRenderStopped === "function") {
              injectedProfilingHooks.markComponentRenderStopped();
            }
          }
        }
        function markComponentPassiveEffectMountStarted(fiber) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentPassiveEffectMountStarted === "function") {
              injectedProfilingHooks.markComponentPassiveEffectMountStarted(fiber);
            }
          }
        }
        function markComponentPassiveEffectMountStopped() {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentPassiveEffectMountStopped === "function") {
              injectedProfilingHooks.markComponentPassiveEffectMountStopped();
            }
          }
        }
        function markComponentPassiveEffectUnmountStarted(fiber) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentPassiveEffectUnmountStarted === "function") {
              injectedProfilingHooks.markComponentPassiveEffectUnmountStarted(fiber);
            }
          }
        }
        function markComponentPassiveEffectUnmountStopped() {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentPassiveEffectUnmountStopped === "function") {
              injectedProfilingHooks.markComponentPassiveEffectUnmountStopped();
            }
          }
        }
        function markComponentLayoutEffectMountStarted(fiber) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentLayoutEffectMountStarted === "function") {
              injectedProfilingHooks.markComponentLayoutEffectMountStarted(fiber);
            }
          }
        }
        function markComponentLayoutEffectMountStopped() {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentLayoutEffectMountStopped === "function") {
              injectedProfilingHooks.markComponentLayoutEffectMountStopped();
            }
          }
        }
        function markComponentLayoutEffectUnmountStarted(fiber) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentLayoutEffectUnmountStarted === "function") {
              injectedProfilingHooks.markComponentLayoutEffectUnmountStarted(fiber);
            }
          }
        }
        function markComponentLayoutEffectUnmountStopped() {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentLayoutEffectUnmountStopped === "function") {
              injectedProfilingHooks.markComponentLayoutEffectUnmountStopped();
            }
          }
        }
        function markComponentErrored(fiber, thrownValue, lanes) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentErrored === "function") {
              injectedProfilingHooks.markComponentErrored(fiber, thrownValue, lanes);
            }
          }
        }
        function markComponentSuspended(fiber, wakeable, lanes) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markComponentSuspended === "function") {
              injectedProfilingHooks.markComponentSuspended(fiber, wakeable, lanes);
            }
          }
        }
        function markLayoutEffectsStarted(lanes) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markLayoutEffectsStarted === "function") {
              injectedProfilingHooks.markLayoutEffectsStarted(lanes);
            }
          }
        }
        function markLayoutEffectsStopped() {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markLayoutEffectsStopped === "function") {
              injectedProfilingHooks.markLayoutEffectsStopped();
            }
          }
        }
        function markPassiveEffectsStarted(lanes) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markPassiveEffectsStarted === "function") {
              injectedProfilingHooks.markPassiveEffectsStarted(lanes);
            }
          }
        }
        function markPassiveEffectsStopped() {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markPassiveEffectsStopped === "function") {
              injectedProfilingHooks.markPassiveEffectsStopped();
            }
          }
        }
        function markRenderStarted(lanes) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markRenderStarted === "function") {
              injectedProfilingHooks.markRenderStarted(lanes);
            }
          }
        }
        function markRenderYielded() {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markRenderYielded === "function") {
              injectedProfilingHooks.markRenderYielded();
            }
          }
        }
        function markRenderStopped() {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markRenderStopped === "function") {
              injectedProfilingHooks.markRenderStopped();
            }
          }
        }
        function markRenderScheduled(lane) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markRenderScheduled === "function") {
              injectedProfilingHooks.markRenderScheduled(lane);
            }
          }
        }
        function markForceUpdateScheduled(fiber, lane) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markForceUpdateScheduled === "function") {
              injectedProfilingHooks.markForceUpdateScheduled(fiber, lane);
            }
          }
        }
        function markStateUpdateScheduled(fiber, lane) {
          {
            if (injectedProfilingHooks !== null && typeof injectedProfilingHooks.markStateUpdateScheduled === "function") {
              injectedProfilingHooks.markStateUpdateScheduled(fiber, lane);
            }
          }
        }
        var NoMode = (
          /*                         */
          0
        );
        var ConcurrentMode = (
          /*                 */
          1
        );
        var ProfileMode = (
          /*                    */
          2
        );
        var StrictLegacyMode = (
          /*               */
          8
        );
        var StrictEffectsMode = (
          /*              */
          16
        );
        var clz32 = Math.clz32 ? Math.clz32 : clz32Fallback;
        var log = Math.log;
        var LN2 = Math.LN2;
        function clz32Fallback(x3) {
          var asUint = x3 >>> 0;
          if (asUint === 0) {
            return 32;
          }
          return 31 - (log(asUint) / LN2 | 0) | 0;
        }
        var TotalLanes = 31;
        var NoLanes = (
          /*                        */
          0
        );
        var NoLane = (
          /*                          */
          0
        );
        var SyncLane = (
          /*                        */
          1
        );
        var InputContinuousHydrationLane = (
          /*    */
          2
        );
        var InputContinuousLane = (
          /*             */
          4
        );
        var DefaultHydrationLane = (
          /*            */
          8
        );
        var DefaultLane = (
          /*                     */
          16
        );
        var TransitionHydrationLane = (
          /*                */
          32
        );
        var TransitionLanes = (
          /*                       */
          4194240
        );
        var TransitionLane1 = (
          /*                        */
          64
        );
        var TransitionLane2 = (
          /*                        */
          128
        );
        var TransitionLane3 = (
          /*                        */
          256
        );
        var TransitionLane4 = (
          /*                        */
          512
        );
        var TransitionLane5 = (
          /*                        */
          1024
        );
        var TransitionLane6 = (
          /*                        */
          2048
        );
        var TransitionLane7 = (
          /*                        */
          4096
        );
        var TransitionLane8 = (
          /*                        */
          8192
        );
        var TransitionLane9 = (
          /*                        */
          16384
        );
        var TransitionLane10 = (
          /*                       */
          32768
        );
        var TransitionLane11 = (
          /*                       */
          65536
        );
        var TransitionLane12 = (
          /*                       */
          131072
        );
        var TransitionLane13 = (
          /*                       */
          262144
        );
        var TransitionLane14 = (
          /*                       */
          524288
        );
        var TransitionLane15 = (
          /*                       */
          1048576
        );
        var TransitionLane16 = (
          /*                       */
          2097152
        );
        var RetryLanes = (
          /*                            */
          130023424
        );
        var RetryLane1 = (
          /*                             */
          4194304
        );
        var RetryLane2 = (
          /*                             */
          8388608
        );
        var RetryLane3 = (
          /*                             */
          16777216
        );
        var RetryLane4 = (
          /*                             */
          33554432
        );
        var RetryLane5 = (
          /*                             */
          67108864
        );
        var SomeRetryLane = RetryLane1;
        var SelectiveHydrationLane = (
          /*          */
          134217728
        );
        var NonIdleLanes = (
          /*                          */
          268435455
        );
        var IdleHydrationLane = (
          /*               */
          268435456
        );
        var IdleLane = (
          /*                        */
          536870912
        );
        var OffscreenLane = (
          /*                   */
          1073741824
        );
        function getLabelForLane(lane) {
          {
            if (lane & SyncLane) {
              return "Sync";
            }
            if (lane & InputContinuousHydrationLane) {
              return "InputContinuousHydration";
            }
            if (lane & InputContinuousLane) {
              return "InputContinuous";
            }
            if (lane & DefaultHydrationLane) {
              return "DefaultHydration";
            }
            if (lane & DefaultLane) {
              return "Default";
            }
            if (lane & TransitionHydrationLane) {
              return "TransitionHydration";
            }
            if (lane & TransitionLanes) {
              return "Transition";
            }
            if (lane & RetryLanes) {
              return "Retry";
            }
            if (lane & SelectiveHydrationLane) {
              return "SelectiveHydration";
            }
            if (lane & IdleHydrationLane) {
              return "IdleHydration";
            }
            if (lane & IdleLane) {
              return "Idle";
            }
            if (lane & OffscreenLane) {
              return "Offscreen";
            }
          }
        }
        var NoTimestamp = -1;
        var nextTransitionLane = TransitionLane1;
        var nextRetryLane = RetryLane1;
        function getHighestPriorityLanes(lanes) {
          switch (getHighestPriorityLane(lanes)) {
            case SyncLane:
              return SyncLane;
            case InputContinuousHydrationLane:
              return InputContinuousHydrationLane;
            case InputContinuousLane:
              return InputContinuousLane;
            case DefaultHydrationLane:
              return DefaultHydrationLane;
            case DefaultLane:
              return DefaultLane;
            case TransitionHydrationLane:
              return TransitionHydrationLane;
            case TransitionLane1:
            case TransitionLane2:
            case TransitionLane3:
            case TransitionLane4:
            case TransitionLane5:
            case TransitionLane6:
            case TransitionLane7:
            case TransitionLane8:
            case TransitionLane9:
            case TransitionLane10:
            case TransitionLane11:
            case TransitionLane12:
            case TransitionLane13:
            case TransitionLane14:
            case TransitionLane15:
            case TransitionLane16:
              return lanes & TransitionLanes;
            case RetryLane1:
            case RetryLane2:
            case RetryLane3:
            case RetryLane4:
            case RetryLane5:
              return lanes & RetryLanes;
            case SelectiveHydrationLane:
              return SelectiveHydrationLane;
            case IdleHydrationLane:
              return IdleHydrationLane;
            case IdleLane:
              return IdleLane;
            case OffscreenLane:
              return OffscreenLane;
            default:
              {
                error("Should have found matching lanes. This is a bug in React.");
              }
              return lanes;
          }
        }
        function getNextLanes(root2, wipLanes) {
          var pendingLanes = root2.pendingLanes;
          if (pendingLanes === NoLanes) {
            return NoLanes;
          }
          var nextLanes = NoLanes;
          var suspendedLanes = root2.suspendedLanes;
          var pingedLanes = root2.pingedLanes;
          var nonIdlePendingLanes = pendingLanes & NonIdleLanes;
          if (nonIdlePendingLanes !== NoLanes) {
            var nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;
            if (nonIdleUnblockedLanes !== NoLanes) {
              nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
            } else {
              var nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes;
              if (nonIdlePingedLanes !== NoLanes) {
                nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);
              }
            }
          } else {
            var unblockedLanes = pendingLanes & ~suspendedLanes;
            if (unblockedLanes !== NoLanes) {
              nextLanes = getHighestPriorityLanes(unblockedLanes);
            } else {
              if (pingedLanes !== NoLanes) {
                nextLanes = getHighestPriorityLanes(pingedLanes);
              }
            }
          }
          if (nextLanes === NoLanes) {
            return NoLanes;
          }
          if (wipLanes !== NoLanes && wipLanes !== nextLanes && // If we already suspended with a delay, then interrupting is fine. Don't
          // bother waiting until the root is complete.
          (wipLanes & suspendedLanes) === NoLanes) {
            var nextLane = getHighestPriorityLane(nextLanes);
            var wipLane = getHighestPriorityLane(wipLanes);
            if (
              // Tests whether the next lane is equal or lower priority than the wip
              // one. This works because the bits decrease in priority as you go left.
              nextLane >= wipLane || // Default priority updates should not interrupt transition updates. The
              // only difference between default updates and transition updates is that
              // default updates do not support refresh transitions.
              nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes
            ) {
              return wipLanes;
            }
          }
          if ((nextLanes & InputContinuousLane) !== NoLanes) {
            nextLanes |= pendingLanes & DefaultLane;
          }
          var entangledLanes = root2.entangledLanes;
          if (entangledLanes !== NoLanes) {
            var entanglements = root2.entanglements;
            var lanes = nextLanes & entangledLanes;
            while (lanes > 0) {
              var index3 = pickArbitraryLaneIndex(lanes);
              var lane = 1 << index3;
              nextLanes |= entanglements[index3];
              lanes &= ~lane;
            }
          }
          return nextLanes;
        }
        function getMostRecentEventTime(root2, lanes) {
          var eventTimes = root2.eventTimes;
          var mostRecentEventTime = NoTimestamp;
          while (lanes > 0) {
            var index3 = pickArbitraryLaneIndex(lanes);
            var lane = 1 << index3;
            var eventTime = eventTimes[index3];
            if (eventTime > mostRecentEventTime) {
              mostRecentEventTime = eventTime;
            }
            lanes &= ~lane;
          }
          return mostRecentEventTime;
        }
        function computeExpirationTime(lane, currentTime) {
          switch (lane) {
            case SyncLane:
            case InputContinuousHydrationLane:
            case InputContinuousLane:
              return currentTime + 250;
            case DefaultHydrationLane:
            case DefaultLane:
            case TransitionHydrationLane:
            case TransitionLane1:
            case TransitionLane2:
            case TransitionLane3:
            case TransitionLane4:
            case TransitionLane5:
            case TransitionLane6:
            case TransitionLane7:
            case TransitionLane8:
            case TransitionLane9:
            case TransitionLane10:
            case TransitionLane11:
            case TransitionLane12:
            case TransitionLane13:
            case TransitionLane14:
            case TransitionLane15:
            case TransitionLane16:
              return currentTime + 5e3;
            case RetryLane1:
            case RetryLane2:
            case RetryLane3:
            case RetryLane4:
            case RetryLane5:
              return NoTimestamp;
            case SelectiveHydrationLane:
            case IdleHydrationLane:
            case IdleLane:
            case OffscreenLane:
              return NoTimestamp;
            default:
              {
                error("Should have found matching lanes. This is a bug in React.");
              }
              return NoTimestamp;
          }
        }
        function markStarvedLanesAsExpired(root2, currentTime) {
          var pendingLanes = root2.pendingLanes;
          var suspendedLanes = root2.suspendedLanes;
          var pingedLanes = root2.pingedLanes;
          var expirationTimes = root2.expirationTimes;
          var lanes = pendingLanes;
          while (lanes > 0) {
            var index3 = pickArbitraryLaneIndex(lanes);
            var lane = 1 << index3;
            var expirationTime = expirationTimes[index3];
            if (expirationTime === NoTimestamp) {
              if ((lane & suspendedLanes) === NoLanes || (lane & pingedLanes) !== NoLanes) {
                expirationTimes[index3] = computeExpirationTime(lane, currentTime);
              }
            } else if (expirationTime <= currentTime) {
              root2.expiredLanes |= lane;
            }
            lanes &= ~lane;
          }
        }
        function getHighestPriorityPendingLanes(root2) {
          return getHighestPriorityLanes(root2.pendingLanes);
        }
        function getLanesToRetrySynchronouslyOnError(root2) {
          var everythingButOffscreen = root2.pendingLanes & ~OffscreenLane;
          if (everythingButOffscreen !== NoLanes) {
            return everythingButOffscreen;
          }
          if (everythingButOffscreen & OffscreenLane) {
            return OffscreenLane;
          }
          return NoLanes;
        }
        function includesSyncLane(lanes) {
          return (lanes & SyncLane) !== NoLanes;
        }
        function includesNonIdleWork(lanes) {
          return (lanes & NonIdleLanes) !== NoLanes;
        }
        function includesOnlyRetries(lanes) {
          return (lanes & RetryLanes) === lanes;
        }
        function includesOnlyNonUrgentLanes(lanes) {
          var UrgentLanes = SyncLane | InputContinuousLane | DefaultLane;
          return (lanes & UrgentLanes) === NoLanes;
        }
        function includesOnlyTransitions(lanes) {
          return (lanes & TransitionLanes) === lanes;
        }
        function includesBlockingLane(root2, lanes) {
          var SyncDefaultLanes = InputContinuousHydrationLane | InputContinuousLane | DefaultHydrationLane | DefaultLane;
          return (lanes & SyncDefaultLanes) !== NoLanes;
        }
        function includesExpiredLane(root2, lanes) {
          return (lanes & root2.expiredLanes) !== NoLanes;
        }
        function isTransitionLane(lane) {
          return (lane & TransitionLanes) !== NoLanes;
        }
        function claimNextTransitionLane() {
          var lane = nextTransitionLane;
          nextTransitionLane <<= 1;
          if ((nextTransitionLane & TransitionLanes) === NoLanes) {
            nextTransitionLane = TransitionLane1;
          }
          return lane;
        }
        function claimNextRetryLane() {
          var lane = nextRetryLane;
          nextRetryLane <<= 1;
          if ((nextRetryLane & RetryLanes) === NoLanes) {
            nextRetryLane = RetryLane1;
          }
          return lane;
        }
        function getHighestPriorityLane(lanes) {
          return lanes & -lanes;
        }
        function pickArbitraryLane(lanes) {
          return getHighestPriorityLane(lanes);
        }
        function pickArbitraryLaneIndex(lanes) {
          return 31 - clz32(lanes);
        }
        function laneToIndex(lane) {
          return pickArbitraryLaneIndex(lane);
        }
        function includesSomeLane(a3, b2) {
          return (a3 & b2) !== NoLanes;
        }
        function isSubsetOfLanes(set2, subset) {
          return (set2 & subset) === subset;
        }
        function mergeLanes(a3, b2) {
          return a3 | b2;
        }
        function removeLanes(set2, subset) {
          return set2 & ~subset;
        }
        function intersectLanes(a3, b2) {
          return a3 & b2;
        }
        function laneToLanes(lane) {
          return lane;
        }
        function higherPriorityLane(a3, b2) {
          return a3 !== NoLane && a3 < b2 ? a3 : b2;
        }
        function createLaneMap(initial) {
          var laneMap = [];
          for (var i4 = 0; i4 < TotalLanes; i4++) {
            laneMap.push(initial);
          }
          return laneMap;
        }
        function markRootUpdated(root2, updateLane, eventTime) {
          root2.pendingLanes |= updateLane;
          if (updateLane !== IdleLane) {
            root2.suspendedLanes = NoLanes;
            root2.pingedLanes = NoLanes;
          }
          var eventTimes = root2.eventTimes;
          var index3 = laneToIndex(updateLane);
          eventTimes[index3] = eventTime;
        }
        function markRootSuspended(root2, suspendedLanes) {
          root2.suspendedLanes |= suspendedLanes;
          root2.pingedLanes &= ~suspendedLanes;
          var expirationTimes = root2.expirationTimes;
          var lanes = suspendedLanes;
          while (lanes > 0) {
            var index3 = pickArbitraryLaneIndex(lanes);
            var lane = 1 << index3;
            expirationTimes[index3] = NoTimestamp;
            lanes &= ~lane;
          }
        }
        function markRootPinged(root2, pingedLanes, eventTime) {
          root2.pingedLanes |= root2.suspendedLanes & pingedLanes;
        }
        function markRootFinished(root2, remainingLanes) {
          var noLongerPendingLanes = root2.pendingLanes & ~remainingLanes;
          root2.pendingLanes = remainingLanes;
          root2.suspendedLanes = NoLanes;
          root2.pingedLanes = NoLanes;
          root2.expiredLanes &= remainingLanes;
          root2.mutableReadLanes &= remainingLanes;
          root2.entangledLanes &= remainingLanes;
          var entanglements = root2.entanglements;
          var eventTimes = root2.eventTimes;
          var expirationTimes = root2.expirationTimes;
          var lanes = noLongerPendingLanes;
          while (lanes > 0) {
            var index3 = pickArbitraryLaneIndex(lanes);
            var lane = 1 << index3;
            entanglements[index3] = NoLanes;
            eventTimes[index3] = NoTimestamp;
            expirationTimes[index3] = NoTimestamp;
            lanes &= ~lane;
          }
        }
        function markRootEntangled(root2, entangledLanes) {
          var rootEntangledLanes = root2.entangledLanes |= entangledLanes;
          var entanglements = root2.entanglements;
          var lanes = rootEntangledLanes;
          while (lanes) {
            var index3 = pickArbitraryLaneIndex(lanes);
            var lane = 1 << index3;
            if (
              // Is this one of the newly entangled lanes?
              lane & entangledLanes | // Is this lane transitively entangled with the newly entangled lanes?
              entanglements[index3] & entangledLanes
            ) {
              entanglements[index3] |= entangledLanes;
            }
            lanes &= ~lane;
          }
        }
        function getBumpedLaneForHydration(root2, renderLanes2) {
          var renderLane = getHighestPriorityLane(renderLanes2);
          var lane;
          switch (renderLane) {
            case InputContinuousLane:
              lane = InputContinuousHydrationLane;
              break;
            case DefaultLane:
              lane = DefaultHydrationLane;
              break;
            case TransitionLane1:
            case TransitionLane2:
            case TransitionLane3:
            case TransitionLane4:
            case TransitionLane5:
            case TransitionLane6:
            case TransitionLane7:
            case TransitionLane8:
            case TransitionLane9:
            case TransitionLane10:
            case TransitionLane11:
            case TransitionLane12:
            case TransitionLane13:
            case TransitionLane14:
            case TransitionLane15:
            case TransitionLane16:
            case RetryLane1:
            case RetryLane2:
            case RetryLane3:
            case RetryLane4:
            case RetryLane5:
              lane = TransitionHydrationLane;
              break;
            case IdleLane:
              lane = IdleHydrationLane;
              break;
            default:
              lane = NoLane;
              break;
          }
          if ((lane & (root2.suspendedLanes | renderLanes2)) !== NoLane) {
            return NoLane;
          }
          return lane;
        }
        function addFiberToLanesMap(root2, fiber, lanes) {
          if (!isDevToolsPresent) {
            return;
          }
          var pendingUpdatersLaneMap = root2.pendingUpdatersLaneMap;
          while (lanes > 0) {
            var index3 = laneToIndex(lanes);
            var lane = 1 << index3;
            var updaters = pendingUpdatersLaneMap[index3];
            updaters.add(fiber);
            lanes &= ~lane;
          }
        }
        function movePendingFibersToMemoized(root2, lanes) {
          if (!isDevToolsPresent) {
            return;
          }
          var pendingUpdatersLaneMap = root2.pendingUpdatersLaneMap;
          var memoizedUpdaters = root2.memoizedUpdaters;
          while (lanes > 0) {
            var index3 = laneToIndex(lanes);
            var lane = 1 << index3;
            var updaters = pendingUpdatersLaneMap[index3];
            if (updaters.size > 0) {
              updaters.forEach(function(fiber) {
                var alternate = fiber.alternate;
                if (alternate === null || !memoizedUpdaters.has(alternate)) {
                  memoizedUpdaters.add(fiber);
                }
              });
              updaters.clear();
            }
            lanes &= ~lane;
          }
        }
        function getTransitionsForLanes(root2, lanes) {
          {
            return null;
          }
        }
        var DiscreteEventPriority = SyncLane;
        var ContinuousEventPriority = InputContinuousLane;
        var DefaultEventPriority = DefaultLane;
        var IdleEventPriority = IdleLane;
        var currentUpdatePriority = NoLane;
        function getCurrentUpdatePriority() {
          return currentUpdatePriority;
        }
        function setCurrentUpdatePriority(newPriority) {
          currentUpdatePriority = newPriority;
        }
        function runWithPriority(priority, fn) {
          var previousPriority = currentUpdatePriority;
          try {
            currentUpdatePriority = priority;
            return fn();
          } finally {
            currentUpdatePriority = previousPriority;
          }
        }
        function higherEventPriority(a3, b2) {
          return a3 !== 0 && a3 < b2 ? a3 : b2;
        }
        function lowerEventPriority(a3, b2) {
          return a3 === 0 || a3 > b2 ? a3 : b2;
        }
        function isHigherEventPriority(a3, b2) {
          return a3 !== 0 && a3 < b2;
        }
        function lanesToEventPriority(lanes) {
          var lane = getHighestPriorityLane(lanes);
          if (!isHigherEventPriority(DiscreteEventPriority, lane)) {
            return DiscreteEventPriority;
          }
          if (!isHigherEventPriority(ContinuousEventPriority, lane)) {
            return ContinuousEventPriority;
          }
          if (includesNonIdleWork(lane)) {
            return DefaultEventPriority;
          }
          return IdleEventPriority;
        }
        function isRootDehydrated(root2) {
          var currentState = root2.current.memoizedState;
          return currentState.isDehydrated;
        }
        var _attemptSynchronousHydration;
        function setAttemptSynchronousHydration(fn) {
          _attemptSynchronousHydration = fn;
        }
        function attemptSynchronousHydration(fiber) {
          _attemptSynchronousHydration(fiber);
        }
        var attemptContinuousHydration;
        function setAttemptContinuousHydration(fn) {
          attemptContinuousHydration = fn;
        }
        var attemptHydrationAtCurrentPriority;
        function setAttemptHydrationAtCurrentPriority(fn) {
          attemptHydrationAtCurrentPriority = fn;
        }
        var getCurrentUpdatePriority$1;
        function setGetCurrentUpdatePriority(fn) {
          getCurrentUpdatePriority$1 = fn;
        }
        var attemptHydrationAtPriority;
        function setAttemptHydrationAtPriority(fn) {
          attemptHydrationAtPriority = fn;
        }
        var hasScheduledReplayAttempt = false;
        var queuedDiscreteEvents = [];
        var queuedFocus = null;
        var queuedDrag = null;
        var queuedMouse = null;
        var queuedPointers = /* @__PURE__ */ new Map();
        var queuedPointerCaptures = /* @__PURE__ */ new Map();
        var queuedExplicitHydrationTargets = [];
        var discreteReplayableEvents = [
          "mousedown",
          "mouseup",
          "touchcancel",
          "touchend",
          "touchstart",
          "auxclick",
          "dblclick",
          "pointercancel",
          "pointerdown",
          "pointerup",
          "dragend",
          "dragstart",
          "drop",
          "compositionend",
          "compositionstart",
          "keydown",
          "keypress",
          "keyup",
          "input",
          "textInput",
          // Intentionally camelCase
          "copy",
          "cut",
          "paste",
          "click",
          "change",
          "contextmenu",
          "reset",
          "submit"
        ];
        function isDiscreteEventThatRequiresHydration(eventType) {
          return discreteReplayableEvents.indexOf(eventType) > -1;
        }
        function createQueuedReplayableEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
          return {
            blockedOn,
            domEventName,
            eventSystemFlags,
            nativeEvent,
            targetContainers: [targetContainer]
          };
        }
        function clearIfContinuousEvent(domEventName, nativeEvent) {
          switch (domEventName) {
            case "focusin":
            case "focusout":
              queuedFocus = null;
              break;
            case "dragenter":
            case "dragleave":
              queuedDrag = null;
              break;
            case "mouseover":
            case "mouseout":
              queuedMouse = null;
              break;
            case "pointerover":
            case "pointerout": {
              var pointerId = nativeEvent.pointerId;
              queuedPointers.delete(pointerId);
              break;
            }
            case "gotpointercapture":
            case "lostpointercapture": {
              var _pointerId = nativeEvent.pointerId;
              queuedPointerCaptures.delete(_pointerId);
              break;
            }
          }
        }
        function accumulateOrCreateContinuousQueuedReplayableEvent(existingQueuedEvent, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
          if (existingQueuedEvent === null || existingQueuedEvent.nativeEvent !== nativeEvent) {
            var queuedEvent = createQueuedReplayableEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent);
            if (blockedOn !== null) {
              var _fiber2 = getInstanceFromNode(blockedOn);
              if (_fiber2 !== null) {
                attemptContinuousHydration(_fiber2);
              }
            }
            return queuedEvent;
          }
          existingQueuedEvent.eventSystemFlags |= eventSystemFlags;
          var targetContainers = existingQueuedEvent.targetContainers;
          if (targetContainer !== null && targetContainers.indexOf(targetContainer) === -1) {
            targetContainers.push(targetContainer);
          }
          return existingQueuedEvent;
        }
        function queueIfContinuousEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
          switch (domEventName) {
            case "focusin": {
              var focusEvent = nativeEvent;
              queuedFocus = accumulateOrCreateContinuousQueuedReplayableEvent(queuedFocus, blockedOn, domEventName, eventSystemFlags, targetContainer, focusEvent);
              return true;
            }
            case "dragenter": {
              var dragEvent = nativeEvent;
              queuedDrag = accumulateOrCreateContinuousQueuedReplayableEvent(queuedDrag, blockedOn, domEventName, eventSystemFlags, targetContainer, dragEvent);
              return true;
            }
            case "mouseover": {
              var mouseEvent = nativeEvent;
              queuedMouse = accumulateOrCreateContinuousQueuedReplayableEvent(queuedMouse, blockedOn, domEventName, eventSystemFlags, targetContainer, mouseEvent);
              return true;
            }
            case "pointerover": {
              var pointerEvent = nativeEvent;
              var pointerId = pointerEvent.pointerId;
              queuedPointers.set(pointerId, accumulateOrCreateContinuousQueuedReplayableEvent(queuedPointers.get(pointerId) || null, blockedOn, domEventName, eventSystemFlags, targetContainer, pointerEvent));
              return true;
            }
            case "gotpointercapture": {
              var _pointerEvent = nativeEvent;
              var _pointerId2 = _pointerEvent.pointerId;
              queuedPointerCaptures.set(_pointerId2, accumulateOrCreateContinuousQueuedReplayableEvent(queuedPointerCaptures.get(_pointerId2) || null, blockedOn, domEventName, eventSystemFlags, targetContainer, _pointerEvent));
              return true;
            }
          }
          return false;
        }
        function attemptExplicitHydrationTarget(queuedTarget) {
          var targetInst = getClosestInstanceFromNode(queuedTarget.target);
          if (targetInst !== null) {
            var nearestMounted = getNearestMountedFiber(targetInst);
            if (nearestMounted !== null) {
              var tag = nearestMounted.tag;
              if (tag === SuspenseComponent) {
                var instance = getSuspenseInstanceFromFiber(nearestMounted);
                if (instance !== null) {
                  queuedTarget.blockedOn = instance;
                  attemptHydrationAtPriority(queuedTarget.priority, function() {
                    attemptHydrationAtCurrentPriority(nearestMounted);
                  });
                  return;
                }
              } else if (tag === HostRoot) {
                var root2 = nearestMounted.stateNode;
                if (isRootDehydrated(root2)) {
                  queuedTarget.blockedOn = getContainerFromFiber(nearestMounted);
                  return;
                }
              }
            }
          }
          queuedTarget.blockedOn = null;
        }
        function queueExplicitHydrationTarget(target) {
          var updatePriority = getCurrentUpdatePriority$1();
          var queuedTarget = {
            blockedOn: null,
            target,
            priority: updatePriority
          };
          var i4 = 0;
          for (; i4 < queuedExplicitHydrationTargets.length; i4++) {
            if (!isHigherEventPriority(updatePriority, queuedExplicitHydrationTargets[i4].priority)) {
              break;
            }
          }
          queuedExplicitHydrationTargets.splice(i4, 0, queuedTarget);
          if (i4 === 0) {
            attemptExplicitHydrationTarget(queuedTarget);
          }
        }
        function attemptReplayContinuousQueuedEvent(queuedEvent) {
          if (queuedEvent.blockedOn !== null) {
            return false;
          }
          var targetContainers = queuedEvent.targetContainers;
          while (targetContainers.length > 0) {
            var targetContainer = targetContainers[0];
            var nextBlockedOn = findInstanceBlockingEvent(queuedEvent.domEventName, queuedEvent.eventSystemFlags, targetContainer, queuedEvent.nativeEvent);
            if (nextBlockedOn === null) {
              {
                var nativeEvent = queuedEvent.nativeEvent;
                var nativeEventClone = new nativeEvent.constructor(nativeEvent.type, nativeEvent);
                setReplayingEvent(nativeEventClone);
                nativeEvent.target.dispatchEvent(nativeEventClone);
                resetReplayingEvent();
              }
            } else {
              var _fiber3 = getInstanceFromNode(nextBlockedOn);
              if (_fiber3 !== null) {
                attemptContinuousHydration(_fiber3);
              }
              queuedEvent.blockedOn = nextBlockedOn;
              return false;
            }
            targetContainers.shift();
          }
          return true;
        }
        function attemptReplayContinuousQueuedEventInMap(queuedEvent, key, map) {
          if (attemptReplayContinuousQueuedEvent(queuedEvent)) {
            map.delete(key);
          }
        }
        function replayUnblockedEvents() {
          hasScheduledReplayAttempt = false;
          if (queuedFocus !== null && attemptReplayContinuousQueuedEvent(queuedFocus)) {
            queuedFocus = null;
          }
          if (queuedDrag !== null && attemptReplayContinuousQueuedEvent(queuedDrag)) {
            queuedDrag = null;
          }
          if (queuedMouse !== null && attemptReplayContinuousQueuedEvent(queuedMouse)) {
            queuedMouse = null;
          }
          queuedPointers.forEach(attemptReplayContinuousQueuedEventInMap);
          queuedPointerCaptures.forEach(attemptReplayContinuousQueuedEventInMap);
        }
        function scheduleCallbackIfUnblocked(queuedEvent, unblocked) {
          if (queuedEvent.blockedOn === unblocked) {
            queuedEvent.blockedOn = null;
            if (!hasScheduledReplayAttempt) {
              hasScheduledReplayAttempt = true;
              Scheduler.unstable_scheduleCallback(Scheduler.unstable_NormalPriority, replayUnblockedEvents);
            }
          }
        }
        function retryIfBlockedOn(unblocked) {
          if (queuedDiscreteEvents.length > 0) {
            scheduleCallbackIfUnblocked(queuedDiscreteEvents[0], unblocked);
            for (var i4 = 1; i4 < queuedDiscreteEvents.length; i4++) {
              var queuedEvent = queuedDiscreteEvents[i4];
              if (queuedEvent.blockedOn === unblocked) {
                queuedEvent.blockedOn = null;
              }
            }
          }
          if (queuedFocus !== null) {
            scheduleCallbackIfUnblocked(queuedFocus, unblocked);
          }
          if (queuedDrag !== null) {
            scheduleCallbackIfUnblocked(queuedDrag, unblocked);
          }
          if (queuedMouse !== null) {
            scheduleCallbackIfUnblocked(queuedMouse, unblocked);
          }
          var unblock = function(queuedEvent2) {
            return scheduleCallbackIfUnblocked(queuedEvent2, unblocked);
          };
          queuedPointers.forEach(unblock);
          queuedPointerCaptures.forEach(unblock);
          for (var _i = 0; _i < queuedExplicitHydrationTargets.length; _i++) {
            var queuedTarget = queuedExplicitHydrationTargets[_i];
            if (queuedTarget.blockedOn === unblocked) {
              queuedTarget.blockedOn = null;
            }
          }
          while (queuedExplicitHydrationTargets.length > 0) {
            var nextExplicitTarget = queuedExplicitHydrationTargets[0];
            if (nextExplicitTarget.blockedOn !== null) {
              break;
            } else {
              attemptExplicitHydrationTarget(nextExplicitTarget);
              if (nextExplicitTarget.blockedOn === null) {
                queuedExplicitHydrationTargets.shift();
              }
            }
          }
        }
        var ReactCurrentBatchConfig = ReactSharedInternals.ReactCurrentBatchConfig;
        var _enabled = true;
        function setEnabled(enabled) {
          _enabled = !!enabled;
        }
        function isEnabled() {
          return _enabled;
        }
        function createEventListenerWrapperWithPriority(targetContainer, domEventName, eventSystemFlags) {
          var eventPriority = getEventPriority(domEventName);
          var listenerWrapper;
          switch (eventPriority) {
            case DiscreteEventPriority:
              listenerWrapper = dispatchDiscreteEvent;
              break;
            case ContinuousEventPriority:
              listenerWrapper = dispatchContinuousEvent;
              break;
            case DefaultEventPriority:
            default:
              listenerWrapper = dispatchEvent;
              break;
          }
          return listenerWrapper.bind(null, domEventName, eventSystemFlags, targetContainer);
        }
        function dispatchDiscreteEvent(domEventName, eventSystemFlags, container, nativeEvent) {
          var previousPriority = getCurrentUpdatePriority();
          var prevTransition = ReactCurrentBatchConfig.transition;
          ReactCurrentBatchConfig.transition = null;
          try {
            setCurrentUpdatePriority(DiscreteEventPriority);
            dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
          } finally {
            setCurrentUpdatePriority(previousPriority);
            ReactCurrentBatchConfig.transition = prevTransition;
          }
        }
        function dispatchContinuousEvent(domEventName, eventSystemFlags, container, nativeEvent) {
          var previousPriority = getCurrentUpdatePriority();
          var prevTransition = ReactCurrentBatchConfig.transition;
          ReactCurrentBatchConfig.transition = null;
          try {
            setCurrentUpdatePriority(ContinuousEventPriority);
            dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
          } finally {
            setCurrentUpdatePriority(previousPriority);
            ReactCurrentBatchConfig.transition = prevTransition;
          }
        }
        function dispatchEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent) {
          if (!_enabled) {
            return;
          }
          {
            dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay(domEventName, eventSystemFlags, targetContainer, nativeEvent);
          }
        }
        function dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay(domEventName, eventSystemFlags, targetContainer, nativeEvent) {
          var blockedOn = findInstanceBlockingEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent);
          if (blockedOn === null) {
            dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, return_targetInst, targetContainer);
            clearIfContinuousEvent(domEventName, nativeEvent);
            return;
          }
          if (queueIfContinuousEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent)) {
            nativeEvent.stopPropagation();
            return;
          }
          clearIfContinuousEvent(domEventName, nativeEvent);
          if (eventSystemFlags & IS_CAPTURE_PHASE && isDiscreteEventThatRequiresHydration(domEventName)) {
            while (blockedOn !== null) {
              var fiber = getInstanceFromNode(blockedOn);
              if (fiber !== null) {
                attemptSynchronousHydration(fiber);
              }
              var nextBlockedOn = findInstanceBlockingEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent);
              if (nextBlockedOn === null) {
                dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, return_targetInst, targetContainer);
              }
              if (nextBlockedOn === blockedOn) {
                break;
              }
              blockedOn = nextBlockedOn;
            }
            if (blockedOn !== null) {
              nativeEvent.stopPropagation();
            }
            return;
          }
          dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, null, targetContainer);
        }
        var return_targetInst = null;
        function findInstanceBlockingEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent) {
          return_targetInst = null;
          var nativeEventTarget = getEventTarget(nativeEvent);
          var targetInst = getClosestInstanceFromNode(nativeEventTarget);
          if (targetInst !== null) {
            var nearestMounted = getNearestMountedFiber(targetInst);
            if (nearestMounted === null) {
              targetInst = null;
            } else {
              var tag = nearestMounted.tag;
              if (tag === SuspenseComponent) {
                var instance = getSuspenseInstanceFromFiber(nearestMounted);
                if (instance !== null) {
                  return instance;
                }
                targetInst = null;
              } else if (tag === HostRoot) {
                var root2 = nearestMounted.stateNode;
                if (isRootDehydrated(root2)) {
                  return getContainerFromFiber(nearestMounted);
                }
                targetInst = null;
              } else if (nearestMounted !== targetInst) {
                targetInst = null;
              }
            }
          }
          return_targetInst = targetInst;
          return null;
        }
        function getEventPriority(domEventName) {
          switch (domEventName) {
            // Used by SimpleEventPlugin:
            case "cancel":
            case "click":
            case "close":
            case "contextmenu":
            case "copy":
            case "cut":
            case "auxclick":
            case "dblclick":
            case "dragend":
            case "dragstart":
            case "drop":
            case "focusin":
            case "focusout":
            case "input":
            case "invalid":
            case "keydown":
            case "keypress":
            case "keyup":
            case "mousedown":
            case "mouseup":
            case "paste":
            case "pause":
            case "play":
            case "pointercancel":
            case "pointerdown":
            case "pointerup":
            case "ratechange":
            case "reset":
            case "resize":
            case "seeked":
            case "submit":
            case "touchcancel":
            case "touchend":
            case "touchstart":
            case "volumechange":
            // Used by polyfills:
            // eslint-disable-next-line no-fallthrough
            case "change":
            case "selectionchange":
            case "textInput":
            case "compositionstart":
            case "compositionend":
            case "compositionupdate":
            // Only enableCreateEventHandleAPI:
            // eslint-disable-next-line no-fallthrough
            case "beforeblur":
            case "afterblur":
            // Not used by React but could be by user code:
            // eslint-disable-next-line no-fallthrough
            case "beforeinput":
            case "blur":
            case "fullscreenchange":
            case "focus":
            case "hashchange":
            case "popstate":
            case "select":
            case "selectstart":
              return DiscreteEventPriority;
            case "drag":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "mousemove":
            case "mouseout":
            case "mouseover":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "scroll":
            case "toggle":
            case "touchmove":
            case "wheel":
            // Not used by React but could be by user code:
            // eslint-disable-next-line no-fallthrough
            case "mouseenter":
            case "mouseleave":
            case "pointerenter":
            case "pointerleave":
              return ContinuousEventPriority;
            case "message": {
              var schedulerPriority = getCurrentPriorityLevel();
              switch (schedulerPriority) {
                case ImmediatePriority:
                  return DiscreteEventPriority;
                case UserBlockingPriority:
                  return ContinuousEventPriority;
                case NormalPriority:
                case LowPriority:
                  return DefaultEventPriority;
                case IdlePriority:
                  return IdleEventPriority;
                default:
                  return DefaultEventPriority;
              }
            }
            default:
              return DefaultEventPriority;
          }
        }
        function addEventBubbleListener(target, eventType, listener) {
          target.addEventListener(eventType, listener, false);
          return listener;
        }
        function addEventCaptureListener(target, eventType, listener) {
          target.addEventListener(eventType, listener, true);
          return listener;
        }
        function addEventCaptureListenerWithPassiveFlag(target, eventType, listener, passive) {
          target.addEventListener(eventType, listener, {
            capture: true,
            passive
          });
          return listener;
        }
        function addEventBubbleListenerWithPassiveFlag(target, eventType, listener, passive) {
          target.addEventListener(eventType, listener, {
            passive
          });
          return listener;
        }
        var root = null;
        var startText = null;
        var fallbackText = null;
        function initialize(nativeEventTarget) {
          root = nativeEventTarget;
          startText = getText();
          return true;
        }
        function reset() {
          root = null;
          startText = null;
          fallbackText = null;
        }
        function getData() {
          if (fallbackText) {
            return fallbackText;
          }
          var start;
          var startValue = startText;
          var startLength = startValue.length;
          var end;
          var endValue = getText();
          var endLength = endValue.length;
          for (start = 0; start < startLength; start++) {
            if (startValue[start] !== endValue[start]) {
              break;
            }
          }
          var minEnd = startLength - start;
          for (end = 1; end <= minEnd; end++) {
            if (startValue[startLength - end] !== endValue[endLength - end]) {
              break;
            }
          }
          var sliceTail = end > 1 ? 1 - end : void 0;
          fallbackText = endValue.slice(start, sliceTail);
          return fallbackText;
        }
        function getText() {
          if ("value" in root) {
            return root.value;
          }
          return root.textContent;
        }
        function getEventCharCode(nativeEvent) {
          var charCode;
          var keyCode = nativeEvent.keyCode;
          if ("charCode" in nativeEvent) {
            charCode = nativeEvent.charCode;
            if (charCode === 0 && keyCode === 13) {
              charCode = 13;
            }
          } else {
            charCode = keyCode;
          }
          if (charCode === 10) {
            charCode = 13;
          }
          if (charCode >= 32 || charCode === 13) {
            return charCode;
          }
          return 0;
        }
        function functionThatReturnsTrue() {
          return true;
        }
        function functionThatReturnsFalse() {
          return false;
        }
        function createSyntheticEvent(Interface) {
          function SyntheticBaseEvent(reactName, reactEventType, targetInst, nativeEvent, nativeEventTarget) {
            this._reactName = reactName;
            this._targetInst = targetInst;
            this.type = reactEventType;
            this.nativeEvent = nativeEvent;
            this.target = nativeEventTarget;
            this.currentTarget = null;
            for (var _propName in Interface) {
              if (!Interface.hasOwnProperty(_propName)) {
                continue;
              }
              var normalize = Interface[_propName];
              if (normalize) {
                this[_propName] = normalize(nativeEvent);
              } else {
                this[_propName] = nativeEvent[_propName];
              }
            }
            var defaultPrevented = nativeEvent.defaultPrevented != null ? nativeEvent.defaultPrevented : nativeEvent.returnValue === false;
            if (defaultPrevented) {
              this.isDefaultPrevented = functionThatReturnsTrue;
            } else {
              this.isDefaultPrevented = functionThatReturnsFalse;
            }
            this.isPropagationStopped = functionThatReturnsFalse;
            return this;
          }
          assign3(SyntheticBaseEvent.prototype, {
            preventDefault: function() {
              this.defaultPrevented = true;
              var event = this.nativeEvent;
              if (!event) {
                return;
              }
              if (event.preventDefault) {
                event.preventDefault();
              } else if (typeof event.returnValue !== "unknown") {
                event.returnValue = false;
              }
              this.isDefaultPrevented = functionThatReturnsTrue;
            },
            stopPropagation: function() {
              var event = this.nativeEvent;
              if (!event) {
                return;
              }
              if (event.stopPropagation) {
                event.stopPropagation();
              } else if (typeof event.cancelBubble !== "unknown") {
                event.cancelBubble = true;
              }
              this.isPropagationStopped = functionThatReturnsTrue;
            },
            /**
             * We release all dispatched `SyntheticEvent`s after each event loop, adding
             * them back into the pool. This allows a way to hold onto a reference that
             * won't be added back into the pool.
             */
            persist: function() {
            },
            /**
             * Checks if this event should be released back into the pool.
             *
             * @return {boolean} True if this should not be released, false otherwise.
             */
            isPersistent: functionThatReturnsTrue
          });
          return SyntheticBaseEvent;
        }
        var EventInterface = {
          eventPhase: 0,
          bubbles: 0,
          cancelable: 0,
          timeStamp: function(event) {
            return event.timeStamp || Date.now();
          },
          defaultPrevented: 0,
          isTrusted: 0
        };
        var SyntheticEvent = createSyntheticEvent(EventInterface);
        var UIEventInterface = assign3({}, EventInterface, {
          view: 0,
          detail: 0
        });
        var SyntheticUIEvent = createSyntheticEvent(UIEventInterface);
        var lastMovementX;
        var lastMovementY;
        var lastMouseEvent;
        function updateMouseMovementPolyfillState(event) {
          if (event !== lastMouseEvent) {
            if (lastMouseEvent && event.type === "mousemove") {
              lastMovementX = event.screenX - lastMouseEvent.screenX;
              lastMovementY = event.screenY - lastMouseEvent.screenY;
            } else {
              lastMovementX = 0;
              lastMovementY = 0;
            }
            lastMouseEvent = event;
          }
        }
        var MouseEventInterface = assign3({}, UIEventInterface, {
          screenX: 0,
          screenY: 0,
          clientX: 0,
          clientY: 0,
          pageX: 0,
          pageY: 0,
          ctrlKey: 0,
          shiftKey: 0,
          altKey: 0,
          metaKey: 0,
          getModifierState: getEventModifierState,
          button: 0,
          buttons: 0,
          relatedTarget: function(event) {
            if (event.relatedTarget === void 0) return event.fromElement === event.srcElement ? event.toElement : event.fromElement;
            return event.relatedTarget;
          },
          movementX: function(event) {
            if ("movementX" in event) {
              return event.movementX;
            }
            updateMouseMovementPolyfillState(event);
            return lastMovementX;
          },
          movementY: function(event) {
            if ("movementY" in event) {
              return event.movementY;
            }
            return lastMovementY;
          }
        });
        var SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);
        var DragEventInterface = assign3({}, MouseEventInterface, {
          dataTransfer: 0
        });
        var SyntheticDragEvent = createSyntheticEvent(DragEventInterface);
        var FocusEventInterface = assign3({}, UIEventInterface, {
          relatedTarget: 0
        });
        var SyntheticFocusEvent = createSyntheticEvent(FocusEventInterface);
        var AnimationEventInterface = assign3({}, EventInterface, {
          animationName: 0,
          elapsedTime: 0,
          pseudoElement: 0
        });
        var SyntheticAnimationEvent = createSyntheticEvent(AnimationEventInterface);
        var ClipboardEventInterface = assign3({}, EventInterface, {
          clipboardData: function(event) {
            return "clipboardData" in event ? event.clipboardData : window.clipboardData;
          }
        });
        var SyntheticClipboardEvent = createSyntheticEvent(ClipboardEventInterface);
        var CompositionEventInterface = assign3({}, EventInterface, {
          data: 0
        });
        var SyntheticCompositionEvent = createSyntheticEvent(CompositionEventInterface);
        var SyntheticInputEvent = SyntheticCompositionEvent;
        var normalizeKey = {
          Esc: "Escape",
          Spacebar: " ",
          Left: "ArrowLeft",
          Up: "ArrowUp",
          Right: "ArrowRight",
          Down: "ArrowDown",
          Del: "Delete",
          Win: "OS",
          Menu: "ContextMenu",
          Apps: "ContextMenu",
          Scroll: "ScrollLock",
          MozPrintableKey: "Unidentified"
        };
        var translateToKey = {
          "8": "Backspace",
          "9": "Tab",
          "12": "Clear",
          "13": "Enter",
          "16": "Shift",
          "17": "Control",
          "18": "Alt",
          "19": "Pause",
          "20": "CapsLock",
          "27": "Escape",
          "32": " ",
          "33": "PageUp",
          "34": "PageDown",
          "35": "End",
          "36": "Home",
          "37": "ArrowLeft",
          "38": "ArrowUp",
          "39": "ArrowRight",
          "40": "ArrowDown",
          "45": "Insert",
          "46": "Delete",
          "112": "F1",
          "113": "F2",
          "114": "F3",
          "115": "F4",
          "116": "F5",
          "117": "F6",
          "118": "F7",
          "119": "F8",
          "120": "F9",
          "121": "F10",
          "122": "F11",
          "123": "F12",
          "144": "NumLock",
          "145": "ScrollLock",
          "224": "Meta"
        };
        function getEventKey(nativeEvent) {
          if (nativeEvent.key) {
            var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
            if (key !== "Unidentified") {
              return key;
            }
          }
          if (nativeEvent.type === "keypress") {
            var charCode = getEventCharCode(nativeEvent);
            return charCode === 13 ? "Enter" : String.fromCharCode(charCode);
          }
          if (nativeEvent.type === "keydown" || nativeEvent.type === "keyup") {
            return translateToKey[nativeEvent.keyCode] || "Unidentified";
          }
          return "";
        }
        var modifierKeyToProp = {
          Alt: "altKey",
          Control: "ctrlKey",
          Meta: "metaKey",
          Shift: "shiftKey"
        };
        function modifierStateGetter(keyArg) {
          var syntheticEvent = this;
          var nativeEvent = syntheticEvent.nativeEvent;
          if (nativeEvent.getModifierState) {
            return nativeEvent.getModifierState(keyArg);
          }
          var keyProp = modifierKeyToProp[keyArg];
          return keyProp ? !!nativeEvent[keyProp] : false;
        }
        function getEventModifierState(nativeEvent) {
          return modifierStateGetter;
        }
        var KeyboardEventInterface = assign3({}, UIEventInterface, {
          key: getEventKey,
          code: 0,
          location: 0,
          ctrlKey: 0,
          shiftKey: 0,
          altKey: 0,
          metaKey: 0,
          repeat: 0,
          locale: 0,
          getModifierState: getEventModifierState,
          // Legacy Interface
          charCode: function(event) {
            if (event.type === "keypress") {
              return getEventCharCode(event);
            }
            return 0;
          },
          keyCode: function(event) {
            if (event.type === "keydown" || event.type === "keyup") {
              return event.keyCode;
            }
            return 0;
          },
          which: function(event) {
            if (event.type === "keypress") {
              return getEventCharCode(event);
            }
            if (event.type === "keydown" || event.type === "keyup") {
              return event.keyCode;
            }
            return 0;
          }
        });
        var SyntheticKeyboardEvent = createSyntheticEvent(KeyboardEventInterface);
        var PointerEventInterface = assign3({}, MouseEventInterface, {
          pointerId: 0,
          width: 0,
          height: 0,
          pressure: 0,
          tangentialPressure: 0,
          tiltX: 0,
          tiltY: 0,
          twist: 0,
          pointerType: 0,
          isPrimary: 0
        });
        var SyntheticPointerEvent = createSyntheticEvent(PointerEventInterface);
        var TouchEventInterface = assign3({}, UIEventInterface, {
          touches: 0,
          targetTouches: 0,
          changedTouches: 0,
          altKey: 0,
          metaKey: 0,
          ctrlKey: 0,
          shiftKey: 0,
          getModifierState: getEventModifierState
        });
        var SyntheticTouchEvent = createSyntheticEvent(TouchEventInterface);
        var TransitionEventInterface = assign3({}, EventInterface, {
          propertyName: 0,
          elapsedTime: 0,
          pseudoElement: 0
        });
        var SyntheticTransitionEvent = createSyntheticEvent(TransitionEventInterface);
        var WheelEventInterface = assign3({}, MouseEventInterface, {
          deltaX: function(event) {
            return "deltaX" in event ? event.deltaX : (
              // Fallback to `wheelDeltaX` for Webkit and normalize (right is positive).
              "wheelDeltaX" in event ? -event.wheelDeltaX : 0
            );
          },
          deltaY: function(event) {
            return "deltaY" in event ? event.deltaY : (
              // Fallback to `wheelDeltaY` for Webkit and normalize (down is positive).
              "wheelDeltaY" in event ? -event.wheelDeltaY : (
                // Fallback to `wheelDelta` for IE<9 and normalize (down is positive).
                "wheelDelta" in event ? -event.wheelDelta : 0
              )
            );
          },
          deltaZ: 0,
          // Browsers without "deltaMode" is reporting in raw wheel delta where one
          // notch on the scroll is always +/- 120, roughly equivalent to pixels.
          // A good approximation of DOM_DELTA_LINE (1) is 5% of viewport size or
          // ~40 pixels, for DOM_DELTA_SCREEN (2) it is 87.5% of viewport size.
          deltaMode: 0
        });
        var SyntheticWheelEvent = createSyntheticEvent(WheelEventInterface);
        var END_KEYCODES = [9, 13, 27, 32];
        var START_KEYCODE = 229;
        var canUseCompositionEvent = canUseDOM && "CompositionEvent" in window;
        var documentMode = null;
        if (canUseDOM && "documentMode" in document) {
          documentMode = document.documentMode;
        }
        var canUseTextInputEvent = canUseDOM && "TextEvent" in window && !documentMode;
        var useFallbackCompositionData = canUseDOM && (!canUseCompositionEvent || documentMode && documentMode > 8 && documentMode <= 11);
        var SPACEBAR_CODE = 32;
        var SPACEBAR_CHAR = String.fromCharCode(SPACEBAR_CODE);
        function registerEvents() {
          registerTwoPhaseEvent("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
          registerTwoPhaseEvent("onCompositionEnd", ["compositionend", "focusout", "keydown", "keypress", "keyup", "mousedown"]);
          registerTwoPhaseEvent("onCompositionStart", ["compositionstart", "focusout", "keydown", "keypress", "keyup", "mousedown"]);
          registerTwoPhaseEvent("onCompositionUpdate", ["compositionupdate", "focusout", "keydown", "keypress", "keyup", "mousedown"]);
        }
        var hasSpaceKeypress = false;
        function isKeypressCommand(nativeEvent) {
          return (nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) && // ctrlKey && altKey is equivalent to AltGr, and is not a command.
          !(nativeEvent.ctrlKey && nativeEvent.altKey);
        }
        function getCompositionEventType(domEventName) {
          switch (domEventName) {
            case "compositionstart":
              return "onCompositionStart";
            case "compositionend":
              return "onCompositionEnd";
            case "compositionupdate":
              return "onCompositionUpdate";
          }
        }
        function isFallbackCompositionStart(domEventName, nativeEvent) {
          return domEventName === "keydown" && nativeEvent.keyCode === START_KEYCODE;
        }
        function isFallbackCompositionEnd(domEventName, nativeEvent) {
          switch (domEventName) {
            case "keyup":
              return END_KEYCODES.indexOf(nativeEvent.keyCode) !== -1;
            case "keydown":
              return nativeEvent.keyCode !== START_KEYCODE;
            case "keypress":
            case "mousedown":
            case "focusout":
              return true;
            default:
              return false;
          }
        }
        function getDataFromCustomEvent(nativeEvent) {
          var detail = nativeEvent.detail;
          if (typeof detail === "object" && "data" in detail) {
            return detail.data;
          }
          return null;
        }
        function isUsingKoreanIME(nativeEvent) {
          return nativeEvent.locale === "ko";
        }
        var isComposing = false;
        function extractCompositionEvent(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget) {
          var eventType;
          var fallbackData;
          if (canUseCompositionEvent) {
            eventType = getCompositionEventType(domEventName);
          } else if (!isComposing) {
            if (isFallbackCompositionStart(domEventName, nativeEvent)) {
              eventType = "onCompositionStart";
            }
          } else if (isFallbackCompositionEnd(domEventName, nativeEvent)) {
            eventType = "onCompositionEnd";
          }
          if (!eventType) {
            return null;
          }
          if (useFallbackCompositionData && !isUsingKoreanIME(nativeEvent)) {
            if (!isComposing && eventType === "onCompositionStart") {
              isComposing = initialize(nativeEventTarget);
            } else if (eventType === "onCompositionEnd") {
              if (isComposing) {
                fallbackData = getData();
              }
            }
          }
          var listeners = accumulateTwoPhaseListeners(targetInst, eventType);
          if (listeners.length > 0) {
            var event = new SyntheticCompositionEvent(eventType, domEventName, null, nativeEvent, nativeEventTarget);
            dispatchQueue.push({
              event,
              listeners
            });
            if (fallbackData) {
              event.data = fallbackData;
            } else {
              var customData = getDataFromCustomEvent(nativeEvent);
              if (customData !== null) {
                event.data = customData;
              }
            }
          }
        }
        function getNativeBeforeInputChars(domEventName, nativeEvent) {
          switch (domEventName) {
            case "compositionend":
              return getDataFromCustomEvent(nativeEvent);
            case "keypress":
              var which = nativeEvent.which;
              if (which !== SPACEBAR_CODE) {
                return null;
              }
              hasSpaceKeypress = true;
              return SPACEBAR_CHAR;
            case "textInput":
              var chars = nativeEvent.data;
              if (chars === SPACEBAR_CHAR && hasSpaceKeypress) {
                return null;
              }
              return chars;
            default:
              return null;
          }
        }
        function getFallbackBeforeInputChars(domEventName, nativeEvent) {
          if (isComposing) {
            if (domEventName === "compositionend" || !canUseCompositionEvent && isFallbackCompositionEnd(domEventName, nativeEvent)) {
              var chars = getData();
              reset();
              isComposing = false;
              return chars;
            }
            return null;
          }
          switch (domEventName) {
            case "paste":
              return null;
            case "keypress":
              if (!isKeypressCommand(nativeEvent)) {
                if (nativeEvent.char && nativeEvent.char.length > 1) {
                  return nativeEvent.char;
                } else if (nativeEvent.which) {
                  return String.fromCharCode(nativeEvent.which);
                }
              }
              return null;
            case "compositionend":
              return useFallbackCompositionData && !isUsingKoreanIME(nativeEvent) ? null : nativeEvent.data;
            default:
              return null;
          }
        }
        function extractBeforeInputEvent(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget) {
          var chars;
          if (canUseTextInputEvent) {
            chars = getNativeBeforeInputChars(domEventName, nativeEvent);
          } else {
            chars = getFallbackBeforeInputChars(domEventName, nativeEvent);
          }
          if (!chars) {
            return null;
          }
          var listeners = accumulateTwoPhaseListeners(targetInst, "onBeforeInput");
          if (listeners.length > 0) {
            var event = new SyntheticInputEvent("onBeforeInput", "beforeinput", null, nativeEvent, nativeEventTarget);
            dispatchQueue.push({
              event,
              listeners
            });
            event.data = chars;
          }
        }
        function extractEvents(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget, eventSystemFlags, targetContainer) {
          extractCompositionEvent(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget);
          extractBeforeInputEvent(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget);
        }
        var supportedInputTypes = {
          color: true,
          date: true,
          datetime: true,
          "datetime-local": true,
          email: true,
          month: true,
          number: true,
          password: true,
          range: true,
          search: true,
          tel: true,
          text: true,
          time: true,
          url: true,
          week: true
        };
        function isTextInputElement(elem) {
          var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
          if (nodeName === "input") {
            return !!supportedInputTypes[elem.type];
          }
          if (nodeName === "textarea") {
            return true;
          }
          return false;
        }
        function isEventSupported(eventNameSuffix) {
          if (!canUseDOM) {
            return false;
          }
          var eventName = "on" + eventNameSuffix;
          var isSupported = eventName in document;
          if (!isSupported) {
            var element = document.createElement("div");
            element.setAttribute(eventName, "return;");
            isSupported = typeof element[eventName] === "function";
          }
          return isSupported;
        }
        function registerEvents$1() {
          registerTwoPhaseEvent("onChange", ["change", "click", "focusin", "focusout", "input", "keydown", "keyup", "selectionchange"]);
        }
        function createAndAccumulateChangeEvent(dispatchQueue, inst, nativeEvent, target) {
          enqueueStateRestore(target);
          var listeners = accumulateTwoPhaseListeners(inst, "onChange");
          if (listeners.length > 0) {
            var event = new SyntheticEvent("onChange", "change", null, nativeEvent, target);
            dispatchQueue.push({
              event,
              listeners
            });
          }
        }
        var activeElement = null;
        var activeElementInst = null;
        function shouldUseChangeEvent(elem) {
          var nodeName = elem.nodeName && elem.nodeName.toLowerCase();
          return nodeName === "select" || nodeName === "input" && elem.type === "file";
        }
        function manualDispatchChangeEvent(nativeEvent) {
          var dispatchQueue = [];
          createAndAccumulateChangeEvent(dispatchQueue, activeElementInst, nativeEvent, getEventTarget(nativeEvent));
          batchedUpdates(runEventInBatch, dispatchQueue);
        }
        function runEventInBatch(dispatchQueue) {
          processDispatchQueue(dispatchQueue, 0);
        }
        function getInstIfValueChanged(targetInst) {
          var targetNode = getNodeFromInstance(targetInst);
          if (updateValueIfChanged(targetNode)) {
            return targetInst;
          }
        }
        function getTargetInstForChangeEvent(domEventName, targetInst) {
          if (domEventName === "change") {
            return targetInst;
          }
        }
        var isInputEventSupported = false;
        if (canUseDOM) {
          isInputEventSupported = isEventSupported("input") && (!document.documentMode || document.documentMode > 9);
        }
        function startWatchingForValueChange(target, targetInst) {
          activeElement = target;
          activeElementInst = targetInst;
          activeElement.attachEvent("onpropertychange", handlePropertyChange);
        }
        function stopWatchingForValueChange() {
          if (!activeElement) {
            return;
          }
          activeElement.detachEvent("onpropertychange", handlePropertyChange);
          activeElement = null;
          activeElementInst = null;
        }
        function handlePropertyChange(nativeEvent) {
          if (nativeEvent.propertyName !== "value") {
            return;
          }
          if (getInstIfValueChanged(activeElementInst)) {
            manualDispatchChangeEvent(nativeEvent);
          }
        }
        function handleEventsForInputEventPolyfill(domEventName, target, targetInst) {
          if (domEventName === "focusin") {
            stopWatchingForValueChange();
            startWatchingForValueChange(target, targetInst);
          } else if (domEventName === "focusout") {
            stopWatchingForValueChange();
          }
        }
        function getTargetInstForInputEventPolyfill(domEventName, targetInst) {
          if (domEventName === "selectionchange" || domEventName === "keyup" || domEventName === "keydown") {
            return getInstIfValueChanged(activeElementInst);
          }
        }
        function shouldUseClickEvent(elem) {
          var nodeName = elem.nodeName;
          return nodeName && nodeName.toLowerCase() === "input" && (elem.type === "checkbox" || elem.type === "radio");
        }
        function getTargetInstForClickEvent(domEventName, targetInst) {
          if (domEventName === "click") {
            return getInstIfValueChanged(targetInst);
          }
        }
        function getTargetInstForInputOrChangeEvent(domEventName, targetInst) {
          if (domEventName === "input" || domEventName === "change") {
            return getInstIfValueChanged(targetInst);
          }
        }
        function handleControlledInputBlur(node2) {
          var state = node2._wrapperState;
          if (!state || !state.controlled || node2.type !== "number") {
            return;
          }
          {
            setDefaultValue(node2, "number", node2.value);
          }
        }
        function extractEvents$1(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget, eventSystemFlags, targetContainer) {
          var targetNode = targetInst ? getNodeFromInstance(targetInst) : window;
          var getTargetInstFunc, handleEventFunc;
          if (shouldUseChangeEvent(targetNode)) {
            getTargetInstFunc = getTargetInstForChangeEvent;
          } else if (isTextInputElement(targetNode)) {
            if (isInputEventSupported) {
              getTargetInstFunc = getTargetInstForInputOrChangeEvent;
            } else {
              getTargetInstFunc = getTargetInstForInputEventPolyfill;
              handleEventFunc = handleEventsForInputEventPolyfill;
            }
          } else if (shouldUseClickEvent(targetNode)) {
            getTargetInstFunc = getTargetInstForClickEvent;
          }
          if (getTargetInstFunc) {
            var inst = getTargetInstFunc(domEventName, targetInst);
            if (inst) {
              createAndAccumulateChangeEvent(dispatchQueue, inst, nativeEvent, nativeEventTarget);
              return;
            }
          }
          if (handleEventFunc) {
            handleEventFunc(domEventName, targetNode, targetInst);
          }
          if (domEventName === "focusout") {
            handleControlledInputBlur(targetNode);
          }
        }
        function registerEvents$2() {
          registerDirectEvent("onMouseEnter", ["mouseout", "mouseover"]);
          registerDirectEvent("onMouseLeave", ["mouseout", "mouseover"]);
          registerDirectEvent("onPointerEnter", ["pointerout", "pointerover"]);
          registerDirectEvent("onPointerLeave", ["pointerout", "pointerover"]);
        }
        function extractEvents$2(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget, eventSystemFlags, targetContainer) {
          var isOverEvent = domEventName === "mouseover" || domEventName === "pointerover";
          var isOutEvent = domEventName === "mouseout" || domEventName === "pointerout";
          if (isOverEvent && !isReplayingEvent(nativeEvent)) {
            var related = nativeEvent.relatedTarget || nativeEvent.fromElement;
            if (related) {
              if (getClosestInstanceFromNode(related) || isContainerMarkedAsRoot(related)) {
                return;
              }
            }
          }
          if (!isOutEvent && !isOverEvent) {
            return;
          }
          var win;
          if (nativeEventTarget.window === nativeEventTarget) {
            win = nativeEventTarget;
          } else {
            var doc = nativeEventTarget.ownerDocument;
            if (doc) {
              win = doc.defaultView || doc.parentWindow;
            } else {
              win = window;
            }
          }
          var from;
          var to;
          if (isOutEvent) {
            var _related = nativeEvent.relatedTarget || nativeEvent.toElement;
            from = targetInst;
            to = _related ? getClosestInstanceFromNode(_related) : null;
            if (to !== null) {
              var nearestMounted = getNearestMountedFiber(to);
              if (to !== nearestMounted || to.tag !== HostComponent && to.tag !== HostText) {
                to = null;
              }
            }
          } else {
            from = null;
            to = targetInst;
          }
          if (from === to) {
            return;
          }
          var SyntheticEventCtor = SyntheticMouseEvent;
          var leaveEventType = "onMouseLeave";
          var enterEventType = "onMouseEnter";
          var eventTypePrefix = "mouse";
          if (domEventName === "pointerout" || domEventName === "pointerover") {
            SyntheticEventCtor = SyntheticPointerEvent;
            leaveEventType = "onPointerLeave";
            enterEventType = "onPointerEnter";
            eventTypePrefix = "pointer";
          }
          var fromNode = from == null ? win : getNodeFromInstance(from);
          var toNode = to == null ? win : getNodeFromInstance(to);
          var leave = new SyntheticEventCtor(leaveEventType, eventTypePrefix + "leave", from, nativeEvent, nativeEventTarget);
          leave.target = fromNode;
          leave.relatedTarget = toNode;
          var enter = null;
          var nativeTargetInst = getClosestInstanceFromNode(nativeEventTarget);
          if (nativeTargetInst === targetInst) {
            var enterEvent = new SyntheticEventCtor(enterEventType, eventTypePrefix + "enter", to, nativeEvent, nativeEventTarget);
            enterEvent.target = toNode;
            enterEvent.relatedTarget = fromNode;
            enter = enterEvent;
          }
          accumulateEnterLeaveTwoPhaseListeners(dispatchQueue, leave, enter, from, to);
        }
        function is(x3, y3) {
          return x3 === y3 && (x3 !== 0 || 1 / x3 === 1 / y3) || x3 !== x3 && y3 !== y3;
        }
        var objectIs = typeof Object.is === "function" ? Object.is : is;
        function shallowEqual(objA, objB) {
          if (objectIs(objA, objB)) {
            return true;
          }
          if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
            return false;
          }
          var keysA = Object.keys(objA);
          var keysB = Object.keys(objB);
          if (keysA.length !== keysB.length) {
            return false;
          }
          for (var i4 = 0; i4 < keysA.length; i4++) {
            var currentKey = keysA[i4];
            if (!hasOwnProperty.call(objB, currentKey) || !objectIs(objA[currentKey], objB[currentKey])) {
              return false;
            }
          }
          return true;
        }
        function getLeafNode(node2) {
          while (node2 && node2.firstChild) {
            node2 = node2.firstChild;
          }
          return node2;
        }
        function getSiblingNode(node2) {
          while (node2) {
            if (node2.nextSibling) {
              return node2.nextSibling;
            }
            node2 = node2.parentNode;
          }
        }
        function getNodeForCharacterOffset(root2, offset) {
          var node2 = getLeafNode(root2);
          var nodeStart = 0;
          var nodeEnd = 0;
          while (node2) {
            if (node2.nodeType === TEXT_NODE) {
              nodeEnd = nodeStart + node2.textContent.length;
              if (nodeStart <= offset && nodeEnd >= offset) {
                return {
                  node: node2,
                  offset: offset - nodeStart
                };
              }
              nodeStart = nodeEnd;
            }
            node2 = getLeafNode(getSiblingNode(node2));
          }
        }
        function getOffsets(outerNode) {
          var ownerDocument = outerNode.ownerDocument;
          var win = ownerDocument && ownerDocument.defaultView || window;
          var selection = win.getSelection && win.getSelection();
          if (!selection || selection.rangeCount === 0) {
            return null;
          }
          var anchorNode = selection.anchorNode, anchorOffset = selection.anchorOffset, focusNode = selection.focusNode, focusOffset = selection.focusOffset;
          try {
            anchorNode.nodeType;
            focusNode.nodeType;
          } catch (e2) {
            return null;
          }
          return getModernOffsetsFromPoints(outerNode, anchorNode, anchorOffset, focusNode, focusOffset);
        }
        function getModernOffsetsFromPoints(outerNode, anchorNode, anchorOffset, focusNode, focusOffset) {
          var length = 0;
          var start = -1;
          var end = -1;
          var indexWithinAnchor = 0;
          var indexWithinFocus = 0;
          var node2 = outerNode;
          var parentNode = null;
          outer: while (true) {
            var next = null;
            while (true) {
              if (node2 === anchorNode && (anchorOffset === 0 || node2.nodeType === TEXT_NODE)) {
                start = length + anchorOffset;
              }
              if (node2 === focusNode && (focusOffset === 0 || node2.nodeType === TEXT_NODE)) {
                end = length + focusOffset;
              }
              if (node2.nodeType === TEXT_NODE) {
                length += node2.nodeValue.length;
              }
              if ((next = node2.firstChild) === null) {
                break;
              }
              parentNode = node2;
              node2 = next;
            }
            while (true) {
              if (node2 === outerNode) {
                break outer;
              }
              if (parentNode === anchorNode && ++indexWithinAnchor === anchorOffset) {
                start = length;
              }
              if (parentNode === focusNode && ++indexWithinFocus === focusOffset) {
                end = length;
              }
              if ((next = node2.nextSibling) !== null) {
                break;
              }
              node2 = parentNode;
              parentNode = node2.parentNode;
            }
            node2 = next;
          }
          if (start === -1 || end === -1) {
            return null;
          }
          return {
            start,
            end
          };
        }
        function setOffsets(node2, offsets) {
          var doc = node2.ownerDocument || document;
          var win = doc && doc.defaultView || window;
          if (!win.getSelection) {
            return;
          }
          var selection = win.getSelection();
          var length = node2.textContent.length;
          var start = Math.min(offsets.start, length);
          var end = offsets.end === void 0 ? start : Math.min(offsets.end, length);
          if (!selection.extend && start > end) {
            var temp = end;
            end = start;
            start = temp;
          }
          var startMarker = getNodeForCharacterOffset(node2, start);
          var endMarker = getNodeForCharacterOffset(node2, end);
          if (startMarker && endMarker) {
            if (selection.rangeCount === 1 && selection.anchorNode === startMarker.node && selection.anchorOffset === startMarker.offset && selection.focusNode === endMarker.node && selection.focusOffset === endMarker.offset) {
              return;
            }
            var range = doc.createRange();
            range.setStart(startMarker.node, startMarker.offset);
            selection.removeAllRanges();
            if (start > end) {
              selection.addRange(range);
              selection.extend(endMarker.node, endMarker.offset);
            } else {
              range.setEnd(endMarker.node, endMarker.offset);
              selection.addRange(range);
            }
          }
        }
        function isTextNode(node2) {
          return node2 && node2.nodeType === TEXT_NODE;
        }
        function containsNode(outerNode, innerNode) {
          if (!outerNode || !innerNode) {
            return false;
          } else if (outerNode === innerNode) {
            return true;
          } else if (isTextNode(outerNode)) {
            return false;
          } else if (isTextNode(innerNode)) {
            return containsNode(outerNode, innerNode.parentNode);
          } else if ("contains" in outerNode) {
            return outerNode.contains(innerNode);
          } else if (outerNode.compareDocumentPosition) {
            return !!(outerNode.compareDocumentPosition(innerNode) & 16);
          } else {
            return false;
          }
        }
        function isInDocument(node2) {
          return node2 && node2.ownerDocument && containsNode(node2.ownerDocument.documentElement, node2);
        }
        function isSameOriginFrame(iframe) {
          try {
            return typeof iframe.contentWindow.location.href === "string";
          } catch (err2) {
            return false;
          }
        }
        function getActiveElementDeep() {
          var win = window;
          var element = getActiveElement();
          while (element instanceof win.HTMLIFrameElement) {
            if (isSameOriginFrame(element)) {
              win = element.contentWindow;
            } else {
              return element;
            }
            element = getActiveElement(win.document);
          }
          return element;
        }
        function hasSelectionCapabilities(elem) {
          var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
          return nodeName && (nodeName === "input" && (elem.type === "text" || elem.type === "search" || elem.type === "tel" || elem.type === "url" || elem.type === "password") || nodeName === "textarea" || elem.contentEditable === "true");
        }
        function getSelectionInformation() {
          var focusedElem = getActiveElementDeep();
          return {
            focusedElem,
            selectionRange: hasSelectionCapabilities(focusedElem) ? getSelection(focusedElem) : null
          };
        }
        function restoreSelection(priorSelectionInformation) {
          var curFocusedElem = getActiveElementDeep();
          var priorFocusedElem = priorSelectionInformation.focusedElem;
          var priorSelectionRange = priorSelectionInformation.selectionRange;
          if (curFocusedElem !== priorFocusedElem && isInDocument(priorFocusedElem)) {
            if (priorSelectionRange !== null && hasSelectionCapabilities(priorFocusedElem)) {
              setSelection(priorFocusedElem, priorSelectionRange);
            }
            var ancestors = [];
            var ancestor = priorFocusedElem;
            while (ancestor = ancestor.parentNode) {
              if (ancestor.nodeType === ELEMENT_NODE) {
                ancestors.push({
                  element: ancestor,
                  left: ancestor.scrollLeft,
                  top: ancestor.scrollTop
                });
              }
            }
            if (typeof priorFocusedElem.focus === "function") {
              priorFocusedElem.focus();
            }
            for (var i4 = 0; i4 < ancestors.length; i4++) {
              var info = ancestors[i4];
              info.element.scrollLeft = info.left;
              info.element.scrollTop = info.top;
            }
          }
        }
        function getSelection(input) {
          var selection;
          if ("selectionStart" in input) {
            selection = {
              start: input.selectionStart,
              end: input.selectionEnd
            };
          } else {
            selection = getOffsets(input);
          }
          return selection || {
            start: 0,
            end: 0
          };
        }
        function setSelection(input, offsets) {
          var start = offsets.start;
          var end = offsets.end;
          if (end === void 0) {
            end = start;
          }
          if ("selectionStart" in input) {
            input.selectionStart = start;
            input.selectionEnd = Math.min(end, input.value.length);
          } else {
            setOffsets(input, offsets);
          }
        }
        var skipSelectionChangeEvent = canUseDOM && "documentMode" in document && document.documentMode <= 11;
        function registerEvents$3() {
          registerTwoPhaseEvent("onSelect", ["focusout", "contextmenu", "dragend", "focusin", "keydown", "keyup", "mousedown", "mouseup", "selectionchange"]);
        }
        var activeElement$1 = null;
        var activeElementInst$1 = null;
        var lastSelection = null;
        var mouseDown = false;
        function getSelection$1(node2) {
          if ("selectionStart" in node2 && hasSelectionCapabilities(node2)) {
            return {
              start: node2.selectionStart,
              end: node2.selectionEnd
            };
          } else {
            var win = node2.ownerDocument && node2.ownerDocument.defaultView || window;
            var selection = win.getSelection();
            return {
              anchorNode: selection.anchorNode,
              anchorOffset: selection.anchorOffset,
              focusNode: selection.focusNode,
              focusOffset: selection.focusOffset
            };
          }
        }
        function getEventTargetDocument(eventTarget) {
          return eventTarget.window === eventTarget ? eventTarget.document : eventTarget.nodeType === DOCUMENT_NODE ? eventTarget : eventTarget.ownerDocument;
        }
        function constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget) {
          var doc = getEventTargetDocument(nativeEventTarget);
          if (mouseDown || activeElement$1 == null || activeElement$1 !== getActiveElement(doc)) {
            return;
          }
          var currentSelection = getSelection$1(activeElement$1);
          if (!lastSelection || !shallowEqual(lastSelection, currentSelection)) {
            lastSelection = currentSelection;
            var listeners = accumulateTwoPhaseListeners(activeElementInst$1, "onSelect");
            if (listeners.length > 0) {
              var event = new SyntheticEvent("onSelect", "select", null, nativeEvent, nativeEventTarget);
              dispatchQueue.push({
                event,
                listeners
              });
              event.target = activeElement$1;
            }
          }
        }
        function extractEvents$3(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget, eventSystemFlags, targetContainer) {
          var targetNode = targetInst ? getNodeFromInstance(targetInst) : window;
          switch (domEventName) {
            // Track the input node that has focus.
            case "focusin":
              if (isTextInputElement(targetNode) || targetNode.contentEditable === "true") {
                activeElement$1 = targetNode;
                activeElementInst$1 = targetInst;
                lastSelection = null;
              }
              break;
            case "focusout":
              activeElement$1 = null;
              activeElementInst$1 = null;
              lastSelection = null;
              break;
            // Don't fire the event while the user is dragging. This matches the
            // semantics of the native select event.
            case "mousedown":
              mouseDown = true;
              break;
            case "contextmenu":
            case "mouseup":
            case "dragend":
              mouseDown = false;
              constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
              break;
            // Chrome and IE fire non-standard event when selection is changed (and
            // sometimes when it hasn't). IE's event fires out of order with respect
            // to key and input events on deletion, so we discard it.
            //
            // Firefox doesn't support selectionchange, so check selection status
            // after each key entry. The selection changes after keydown and before
            // keyup, but we check on keydown as well in the case of holding down a
            // key, when multiple keydown events are fired but only one keyup is.
            // This is also our approach for IE handling, for the reason above.
            case "selectionchange":
              if (skipSelectionChangeEvent) {
                break;
              }
            // falls through
            case "keydown":
            case "keyup":
              constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
          }
        }
        function makePrefixMap(styleProp, eventName) {
          var prefixes2 = {};
          prefixes2[styleProp.toLowerCase()] = eventName.toLowerCase();
          prefixes2["Webkit" + styleProp] = "webkit" + eventName;
          prefixes2["Moz" + styleProp] = "moz" + eventName;
          return prefixes2;
        }
        var vendorPrefixes = {
          animationend: makePrefixMap("Animation", "AnimationEnd"),
          animationiteration: makePrefixMap("Animation", "AnimationIteration"),
          animationstart: makePrefixMap("Animation", "AnimationStart"),
          transitionend: makePrefixMap("Transition", "TransitionEnd")
        };
        var prefixedEventNames = {};
        var style = {};
        if (canUseDOM) {
          style = document.createElement("div").style;
          if (!("AnimationEvent" in window)) {
            delete vendorPrefixes.animationend.animation;
            delete vendorPrefixes.animationiteration.animation;
            delete vendorPrefixes.animationstart.animation;
          }
          if (!("TransitionEvent" in window)) {
            delete vendorPrefixes.transitionend.transition;
          }
        }
        function getVendorPrefixedEventName(eventName) {
          if (prefixedEventNames[eventName]) {
            return prefixedEventNames[eventName];
          } else if (!vendorPrefixes[eventName]) {
            return eventName;
          }
          var prefixMap = vendorPrefixes[eventName];
          for (var styleProp in prefixMap) {
            if (prefixMap.hasOwnProperty(styleProp) && styleProp in style) {
              return prefixedEventNames[eventName] = prefixMap[styleProp];
            }
          }
          return eventName;
        }
        var ANIMATION_END = getVendorPrefixedEventName("animationend");
        var ANIMATION_ITERATION = getVendorPrefixedEventName("animationiteration");
        var ANIMATION_START = getVendorPrefixedEventName("animationstart");
        var TRANSITION_END = getVendorPrefixedEventName("transitionend");
        var topLevelEventsToReactNames = /* @__PURE__ */ new Map();
        var simpleEventPluginEvents = ["abort", "auxClick", "cancel", "canPlay", "canPlayThrough", "click", "close", "contextMenu", "copy", "cut", "drag", "dragEnd", "dragEnter", "dragExit", "dragLeave", "dragOver", "dragStart", "drop", "durationChange", "emptied", "encrypted", "ended", "error", "gotPointerCapture", "input", "invalid", "keyDown", "keyPress", "keyUp", "load", "loadedData", "loadedMetadata", "loadStart", "lostPointerCapture", "mouseDown", "mouseMove", "mouseOut", "mouseOver", "mouseUp", "paste", "pause", "play", "playing", "pointerCancel", "pointerDown", "pointerMove", "pointerOut", "pointerOver", "pointerUp", "progress", "rateChange", "reset", "resize", "seeked", "seeking", "stalled", "submit", "suspend", "timeUpdate", "touchCancel", "touchEnd", "touchStart", "volumeChange", "scroll", "toggle", "touchMove", "waiting", "wheel"];
        function registerSimpleEvent(domEventName, reactName) {
          topLevelEventsToReactNames.set(domEventName, reactName);
          registerTwoPhaseEvent(reactName, [domEventName]);
        }
        function registerSimpleEvents() {
          for (var i4 = 0; i4 < simpleEventPluginEvents.length; i4++) {
            var eventName = simpleEventPluginEvents[i4];
            var domEventName = eventName.toLowerCase();
            var capitalizedEvent = eventName[0].toUpperCase() + eventName.slice(1);
            registerSimpleEvent(domEventName, "on" + capitalizedEvent);
          }
          registerSimpleEvent(ANIMATION_END, "onAnimationEnd");
          registerSimpleEvent(ANIMATION_ITERATION, "onAnimationIteration");
          registerSimpleEvent(ANIMATION_START, "onAnimationStart");
          registerSimpleEvent("dblclick", "onDoubleClick");
          registerSimpleEvent("focusin", "onFocus");
          registerSimpleEvent("focusout", "onBlur");
          registerSimpleEvent(TRANSITION_END, "onTransitionEnd");
        }
        function extractEvents$4(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget, eventSystemFlags, targetContainer) {
          var reactName = topLevelEventsToReactNames.get(domEventName);
          if (reactName === void 0) {
            return;
          }
          var SyntheticEventCtor = SyntheticEvent;
          var reactEventType = domEventName;
          switch (domEventName) {
            case "keypress":
              if (getEventCharCode(nativeEvent) === 0) {
                return;
              }
            /* falls through */
            case "keydown":
            case "keyup":
              SyntheticEventCtor = SyntheticKeyboardEvent;
              break;
            case "focusin":
              reactEventType = "focus";
              SyntheticEventCtor = SyntheticFocusEvent;
              break;
            case "focusout":
              reactEventType = "blur";
              SyntheticEventCtor = SyntheticFocusEvent;
              break;
            case "beforeblur":
            case "afterblur":
              SyntheticEventCtor = SyntheticFocusEvent;
              break;
            case "click":
              if (nativeEvent.button === 2) {
                return;
              }
            /* falls through */
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            // TODO: Disabled elements should not respond to mouse events
            /* falls through */
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              SyntheticEventCtor = SyntheticMouseEvent;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              SyntheticEventCtor = SyntheticDragEvent;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              SyntheticEventCtor = SyntheticTouchEvent;
              break;
            case ANIMATION_END:
            case ANIMATION_ITERATION:
            case ANIMATION_START:
              SyntheticEventCtor = SyntheticAnimationEvent;
              break;
            case TRANSITION_END:
              SyntheticEventCtor = SyntheticTransitionEvent;
              break;
            case "scroll":
              SyntheticEventCtor = SyntheticUIEvent;
              break;
            case "wheel":
              SyntheticEventCtor = SyntheticWheelEvent;
              break;
            case "copy":
            case "cut":
            case "paste":
              SyntheticEventCtor = SyntheticClipboardEvent;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              SyntheticEventCtor = SyntheticPointerEvent;
              break;
          }
          var inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
          {
            var accumulateTargetOnly = !inCapturePhase && // TODO: ideally, we'd eventually add all events from
            // nonDelegatedEvents list in DOMPluginEventSystem.
            // Then we can remove this special list.
            // This is a breaking change that can wait until React 18.
            domEventName === "scroll";
            var _listeners = accumulateSinglePhaseListeners(targetInst, reactName, nativeEvent.type, inCapturePhase, accumulateTargetOnly);
            if (_listeners.length > 0) {
              var _event = new SyntheticEventCtor(reactName, reactEventType, null, nativeEvent, nativeEventTarget);
              dispatchQueue.push({
                event: _event,
                listeners: _listeners
              });
            }
          }
        }
        registerSimpleEvents();
        registerEvents$2();
        registerEvents$1();
        registerEvents$3();
        registerEvents();
        function extractEvents$5(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget, eventSystemFlags, targetContainer) {
          extractEvents$4(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget, eventSystemFlags);
          var shouldProcessPolyfillPlugins = (eventSystemFlags & SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS) === 0;
          if (shouldProcessPolyfillPlugins) {
            extractEvents$2(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget);
            extractEvents$1(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget);
            extractEvents$3(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget);
            extractEvents(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget);
          }
        }
        var mediaEventTypes = ["abort", "canplay", "canplaythrough", "durationchange", "emptied", "encrypted", "ended", "error", "loadeddata", "loadedmetadata", "loadstart", "pause", "play", "playing", "progress", "ratechange", "resize", "seeked", "seeking", "stalled", "suspend", "timeupdate", "volumechange", "waiting"];
        var nonDelegatedEvents = new Set(["cancel", "close", "invalid", "load", "scroll", "toggle"].concat(mediaEventTypes));
        function executeDispatch(event, listener, currentTarget) {
          var type = event.type || "unknown-event";
          event.currentTarget = currentTarget;
          invokeGuardedCallbackAndCatchFirstError(type, listener, void 0, event);
          event.currentTarget = null;
        }
        function processDispatchQueueItemsInOrder(event, dispatchListeners, inCapturePhase) {
          var previousInstance;
          if (inCapturePhase) {
            for (var i4 = dispatchListeners.length - 1; i4 >= 0; i4--) {
              var _dispatchListeners$i = dispatchListeners[i4], instance = _dispatchListeners$i.instance, currentTarget = _dispatchListeners$i.currentTarget, listener = _dispatchListeners$i.listener;
              if (instance !== previousInstance && event.isPropagationStopped()) {
                return;
              }
              executeDispatch(event, listener, currentTarget);
              previousInstance = instance;
            }
          } else {
            for (var _i = 0; _i < dispatchListeners.length; _i++) {
              var _dispatchListeners$_i = dispatchListeners[_i], _instance = _dispatchListeners$_i.instance, _currentTarget = _dispatchListeners$_i.currentTarget, _listener = _dispatchListeners$_i.listener;
              if (_instance !== previousInstance && event.isPropagationStopped()) {
                return;
              }
              executeDispatch(event, _listener, _currentTarget);
              previousInstance = _instance;
            }
          }
        }
        function processDispatchQueue(dispatchQueue, eventSystemFlags) {
          var inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
          for (var i4 = 0; i4 < dispatchQueue.length; i4++) {
            var _dispatchQueue$i = dispatchQueue[i4], event = _dispatchQueue$i.event, listeners = _dispatchQueue$i.listeners;
            processDispatchQueueItemsInOrder(event, listeners, inCapturePhase);
          }
          rethrowCaughtError();
        }
        function dispatchEventsForPlugins(domEventName, eventSystemFlags, nativeEvent, targetInst, targetContainer) {
          var nativeEventTarget = getEventTarget(nativeEvent);
          var dispatchQueue = [];
          extractEvents$5(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget, eventSystemFlags);
          processDispatchQueue(dispatchQueue, eventSystemFlags);
        }
        function listenToNonDelegatedEvent(domEventName, targetElement) {
          {
            if (!nonDelegatedEvents.has(domEventName)) {
              error('Did not expect a listenToNonDelegatedEvent() call for "%s". This is a bug in React. Please file an issue.', domEventName);
            }
          }
          var isCapturePhaseListener = false;
          var listenerSet = getEventListenerSet(targetElement);
          var listenerSetKey = getListenerSetKey(domEventName, isCapturePhaseListener);
          if (!listenerSet.has(listenerSetKey)) {
            addTrappedEventListener(targetElement, domEventName, IS_NON_DELEGATED, isCapturePhaseListener);
            listenerSet.add(listenerSetKey);
          }
        }
        function listenToNativeEvent(domEventName, isCapturePhaseListener, target) {
          {
            if (nonDelegatedEvents.has(domEventName) && !isCapturePhaseListener) {
              error('Did not expect a listenToNativeEvent() call for "%s" in the bubble phase. This is a bug in React. Please file an issue.', domEventName);
            }
          }
          var eventSystemFlags = 0;
          if (isCapturePhaseListener) {
            eventSystemFlags |= IS_CAPTURE_PHASE;
          }
          addTrappedEventListener(target, domEventName, eventSystemFlags, isCapturePhaseListener);
        }
        var listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);
        function listenToAllSupportedEvents(rootContainerElement) {
          if (!rootContainerElement[listeningMarker]) {
            rootContainerElement[listeningMarker] = true;
            allNativeEvents.forEach(function(domEventName) {
              if (domEventName !== "selectionchange") {
                if (!nonDelegatedEvents.has(domEventName)) {
                  listenToNativeEvent(domEventName, false, rootContainerElement);
                }
                listenToNativeEvent(domEventName, true, rootContainerElement);
              }
            });
            var ownerDocument = rootContainerElement.nodeType === DOCUMENT_NODE ? rootContainerElement : rootContainerElement.ownerDocument;
            if (ownerDocument !== null) {
              if (!ownerDocument[listeningMarker]) {
                ownerDocument[listeningMarker] = true;
                listenToNativeEvent("selectionchange", false, ownerDocument);
              }
            }
          }
        }
        function addTrappedEventListener(targetContainer, domEventName, eventSystemFlags, isCapturePhaseListener, isDeferredListenerForLegacyFBSupport) {
          var listener = createEventListenerWrapperWithPriority(targetContainer, domEventName, eventSystemFlags);
          var isPassiveListener = void 0;
          if (passiveBrowserEventsSupported) {
            if (domEventName === "touchstart" || domEventName === "touchmove" || domEventName === "wheel") {
              isPassiveListener = true;
            }
          }
          targetContainer = targetContainer;
          var unsubscribeListener;
          if (isCapturePhaseListener) {
            if (isPassiveListener !== void 0) {
              unsubscribeListener = addEventCaptureListenerWithPassiveFlag(targetContainer, domEventName, listener, isPassiveListener);
            } else {
              unsubscribeListener = addEventCaptureListener(targetContainer, domEventName, listener);
            }
          } else {
            if (isPassiveListener !== void 0) {
              unsubscribeListener = addEventBubbleListenerWithPassiveFlag(targetContainer, domEventName, listener, isPassiveListener);
            } else {
              unsubscribeListener = addEventBubbleListener(targetContainer, domEventName, listener);
            }
          }
        }
        function isMatchingRootContainer(grandContainer, targetContainer) {
          return grandContainer === targetContainer || grandContainer.nodeType === COMMENT_NODE && grandContainer.parentNode === targetContainer;
        }
        function dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, targetInst, targetContainer) {
          var ancestorInst = targetInst;
          if ((eventSystemFlags & IS_EVENT_HANDLE_NON_MANAGED_NODE) === 0 && (eventSystemFlags & IS_NON_DELEGATED) === 0) {
            var targetContainerNode = targetContainer;
            if (targetInst !== null) {
              var node2 = targetInst;
              mainLoop: while (true) {
                if (node2 === null) {
                  return;
                }
                var nodeTag = node2.tag;
                if (nodeTag === HostRoot || nodeTag === HostPortal) {
                  var container = node2.stateNode.containerInfo;
                  if (isMatchingRootContainer(container, targetContainerNode)) {
                    break;
                  }
                  if (nodeTag === HostPortal) {
                    var grandNode = node2.return;
                    while (grandNode !== null) {
                      var grandTag = grandNode.tag;
                      if (grandTag === HostRoot || grandTag === HostPortal) {
                        var grandContainer = grandNode.stateNode.containerInfo;
                        if (isMatchingRootContainer(grandContainer, targetContainerNode)) {
                          return;
                        }
                      }
                      grandNode = grandNode.return;
                    }
                  }
                  while (container !== null) {
                    var parentNode = getClosestInstanceFromNode(container);
                    if (parentNode === null) {
                      return;
                    }
                    var parentTag = parentNode.tag;
                    if (parentTag === HostComponent || parentTag === HostText) {
                      node2 = ancestorInst = parentNode;
                      continue mainLoop;
                    }
                    container = container.parentNode;
                  }
                }
                node2 = node2.return;
              }
            }
          }
          batchedUpdates(function() {
            return dispatchEventsForPlugins(domEventName, eventSystemFlags, nativeEvent, ancestorInst);
          });
        }
        function createDispatchListener(instance, listener, currentTarget) {
          return {
            instance,
            listener,
            currentTarget
          };
        }
        function accumulateSinglePhaseListeners(targetFiber, reactName, nativeEventType, inCapturePhase, accumulateTargetOnly, nativeEvent) {
          var captureName = reactName !== null ? reactName + "Capture" : null;
          var reactEventName = inCapturePhase ? captureName : reactName;
          var listeners = [];
          var instance = targetFiber;
          var lastHostComponent = null;
          while (instance !== null) {
            var _instance2 = instance, stateNode = _instance2.stateNode, tag = _instance2.tag;
            if (tag === HostComponent && stateNode !== null) {
              lastHostComponent = stateNode;
              if (reactEventName !== null) {
                var listener = getListener(instance, reactEventName);
                if (listener != null) {
                  listeners.push(createDispatchListener(instance, listener, lastHostComponent));
                }
              }
            }
            if (accumulateTargetOnly) {
              break;
            }
            instance = instance.return;
          }
          return listeners;
        }
        function accumulateTwoPhaseListeners(targetFiber, reactName) {
          var captureName = reactName + "Capture";
          var listeners = [];
          var instance = targetFiber;
          while (instance !== null) {
            var _instance3 = instance, stateNode = _instance3.stateNode, tag = _instance3.tag;
            if (tag === HostComponent && stateNode !== null) {
              var currentTarget = stateNode;
              var captureListener = getListener(instance, captureName);
              if (captureListener != null) {
                listeners.unshift(createDispatchListener(instance, captureListener, currentTarget));
              }
              var bubbleListener = getListener(instance, reactName);
              if (bubbleListener != null) {
                listeners.push(createDispatchListener(instance, bubbleListener, currentTarget));
              }
            }
            instance = instance.return;
          }
          return listeners;
        }
        function getParent(inst) {
          if (inst === null) {
            return null;
          }
          do {
            inst = inst.return;
          } while (inst && inst.tag !== HostComponent);
          if (inst) {
            return inst;
          }
          return null;
        }
        function getLowestCommonAncestor(instA, instB) {
          var nodeA = instA;
          var nodeB = instB;
          var depthA = 0;
          for (var tempA = nodeA; tempA; tempA = getParent(tempA)) {
            depthA++;
          }
          var depthB = 0;
          for (var tempB = nodeB; tempB; tempB = getParent(tempB)) {
            depthB++;
          }
          while (depthA - depthB > 0) {
            nodeA = getParent(nodeA);
            depthA--;
          }
          while (depthB - depthA > 0) {
            nodeB = getParent(nodeB);
            depthB--;
          }
          var depth = depthA;
          while (depth--) {
            if (nodeA === nodeB || nodeB !== null && nodeA === nodeB.alternate) {
              return nodeA;
            }
            nodeA = getParent(nodeA);
            nodeB = getParent(nodeB);
          }
          return null;
        }
        function accumulateEnterLeaveListenersForEvent(dispatchQueue, event, target, common2, inCapturePhase) {
          var registrationName = event._reactName;
          var listeners = [];
          var instance = target;
          while (instance !== null) {
            if (instance === common2) {
              break;
            }
            var _instance4 = instance, alternate = _instance4.alternate, stateNode = _instance4.stateNode, tag = _instance4.tag;
            if (alternate !== null && alternate === common2) {
              break;
            }
            if (tag === HostComponent && stateNode !== null) {
              var currentTarget = stateNode;
              if (inCapturePhase) {
                var captureListener = getListener(instance, registrationName);
                if (captureListener != null) {
                  listeners.unshift(createDispatchListener(instance, captureListener, currentTarget));
                }
              } else if (!inCapturePhase) {
                var bubbleListener = getListener(instance, registrationName);
                if (bubbleListener != null) {
                  listeners.push(createDispatchListener(instance, bubbleListener, currentTarget));
                }
              }
            }
            instance = instance.return;
          }
          if (listeners.length !== 0) {
            dispatchQueue.push({
              event,
              listeners
            });
          }
        }
        function accumulateEnterLeaveTwoPhaseListeners(dispatchQueue, leaveEvent, enterEvent, from, to) {
          var common2 = from && to ? getLowestCommonAncestor(from, to) : null;
          if (from !== null) {
            accumulateEnterLeaveListenersForEvent(dispatchQueue, leaveEvent, from, common2, false);
          }
          if (to !== null && enterEvent !== null) {
            accumulateEnterLeaveListenersForEvent(dispatchQueue, enterEvent, to, common2, true);
          }
        }
        function getListenerSetKey(domEventName, capture) {
          return domEventName + "__" + (capture ? "capture" : "bubble");
        }
        var didWarnInvalidHydration = false;
        var DANGEROUSLY_SET_INNER_HTML = "dangerouslySetInnerHTML";
        var SUPPRESS_CONTENT_EDITABLE_WARNING = "suppressContentEditableWarning";
        var SUPPRESS_HYDRATION_WARNING = "suppressHydrationWarning";
        var AUTOFOCUS = "autoFocus";
        var CHILDREN = "children";
        var STYLE = "style";
        var HTML$1 = "__html";
        var warnedUnknownTags;
        var validatePropertiesInDevelopment;
        var warnForPropDifference;
        var warnForExtraAttributes;
        var warnForInvalidEventListener;
        var canDiffStyleForHydrationWarning;
        var normalizeHTML;
        {
          warnedUnknownTags = {
            // There are working polyfills for <dialog>. Let people use it.
            dialog: true,
            // Electron ships a custom <webview> tag to display external web content in
            // an isolated frame and process.
            // This tag is not present in non Electron environments such as JSDom which
            // is often used for testing purposes.
            // @see https://electronjs.org/docs/api/webview-tag
            webview: true
          };
          validatePropertiesInDevelopment = function(type, props) {
            validateProperties(type, props);
            validateProperties$1(type, props);
            validateProperties$2(type, props, {
              registrationNameDependencies,
              possibleRegistrationNames
            });
          };
          canDiffStyleForHydrationWarning = canUseDOM && !document.documentMode;
          warnForPropDifference = function(propName, serverValue, clientValue) {
            if (didWarnInvalidHydration) {
              return;
            }
            var normalizedClientValue = normalizeMarkupForTextOrAttribute(clientValue);
            var normalizedServerValue = normalizeMarkupForTextOrAttribute(serverValue);
            if (normalizedServerValue === normalizedClientValue) {
              return;
            }
            didWarnInvalidHydration = true;
            error("Prop `%s` did not match. Server: %s Client: %s", propName, JSON.stringify(normalizedServerValue), JSON.stringify(normalizedClientValue));
          };
          warnForExtraAttributes = function(attributeNames) {
            if (didWarnInvalidHydration) {
              return;
            }
            didWarnInvalidHydration = true;
            var names = [];
            attributeNames.forEach(function(name) {
              names.push(name);
            });
            error("Extra attributes from the server: %s", names);
          };
          warnForInvalidEventListener = function(registrationName, listener) {
            if (listener === false) {
              error("Expected `%s` listener to be a function, instead got `false`.\n\nIf you used to conditionally omit it with %s={condition && value}, pass %s={condition ? value : undefined} instead.", registrationName, registrationName, registrationName);
            } else {
              error("Expected `%s` listener to be a function, instead got a value of `%s` type.", registrationName, typeof listener);
            }
          };
          normalizeHTML = function(parent, html2) {
            var testElement = parent.namespaceURI === HTML_NAMESPACE ? parent.ownerDocument.createElement(parent.tagName) : parent.ownerDocument.createElementNS(parent.namespaceURI, parent.tagName);
            testElement.innerHTML = html2;
            return testElement.innerHTML;
          };
        }
        var NORMALIZE_NEWLINES_REGEX = /\r\n?/g;
        var NORMALIZE_NULL_AND_REPLACEMENT_REGEX = /\u0000|\uFFFD/g;
        function normalizeMarkupForTextOrAttribute(markup) {
          {
            checkHtmlStringCoercion(markup);
          }
          var markupString = typeof markup === "string" ? markup : "" + markup;
          return markupString.replace(NORMALIZE_NEWLINES_REGEX, "\n").replace(NORMALIZE_NULL_AND_REPLACEMENT_REGEX, "");
        }
        function checkForUnmatchedText(serverText, clientText, isConcurrentMode, shouldWarnDev) {
          var normalizedClientText = normalizeMarkupForTextOrAttribute(clientText);
          var normalizedServerText = normalizeMarkupForTextOrAttribute(serverText);
          if (normalizedServerText === normalizedClientText) {
            return;
          }
          if (shouldWarnDev) {
            {
              if (!didWarnInvalidHydration) {
                didWarnInvalidHydration = true;
                error('Text content did not match. Server: "%s" Client: "%s"', normalizedServerText, normalizedClientText);
              }
            }
          }
          if (isConcurrentMode && enableClientRenderFallbackOnTextMismatch) {
            throw new Error("Text content does not match server-rendered HTML.");
          }
        }
        function getOwnerDocumentFromRootContainer(rootContainerElement) {
          return rootContainerElement.nodeType === DOCUMENT_NODE ? rootContainerElement : rootContainerElement.ownerDocument;
        }
        function noop3() {
        }
        function trapClickOnNonInteractiveElement(node2) {
          node2.onclick = noop3;
        }
        function setInitialDOMProperties(tag, domElement, rootContainerElement, nextProps, isCustomComponentTag) {
          for (var propKey in nextProps) {
            if (!nextProps.hasOwnProperty(propKey)) {
              continue;
            }
            var nextProp = nextProps[propKey];
            if (propKey === STYLE) {
              {
                if (nextProp) {
                  Object.freeze(nextProp);
                }
              }
              setValueForStyles(domElement, nextProp);
            } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
              var nextHtml = nextProp ? nextProp[HTML$1] : void 0;
              if (nextHtml != null) {
                setInnerHTML(domElement, nextHtml);
              }
            } else if (propKey === CHILDREN) {
              if (typeof nextProp === "string") {
                var canSetTextContent = tag !== "textarea" || nextProp !== "";
                if (canSetTextContent) {
                  setTextContent(domElement, nextProp);
                }
              } else if (typeof nextProp === "number") {
                setTextContent(domElement, "" + nextProp);
              }
            } else if (propKey === SUPPRESS_CONTENT_EDITABLE_WARNING || propKey === SUPPRESS_HYDRATION_WARNING) ;
            else if (propKey === AUTOFOCUS) ;
            else if (registrationNameDependencies.hasOwnProperty(propKey)) {
              if (nextProp != null) {
                if (typeof nextProp !== "function") {
                  warnForInvalidEventListener(propKey, nextProp);
                }
                if (propKey === "onScroll") {
                  listenToNonDelegatedEvent("scroll", domElement);
                }
              }
            } else if (nextProp != null) {
              setValueForProperty(domElement, propKey, nextProp, isCustomComponentTag);
            }
          }
        }
        function updateDOMProperties(domElement, updatePayload, wasCustomComponentTag, isCustomComponentTag) {
          for (var i4 = 0; i4 < updatePayload.length; i4 += 2) {
            var propKey = updatePayload[i4];
            var propValue = updatePayload[i4 + 1];
            if (propKey === STYLE) {
              setValueForStyles(domElement, propValue);
            } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
              setInnerHTML(domElement, propValue);
            } else if (propKey === CHILDREN) {
              setTextContent(domElement, propValue);
            } else {
              setValueForProperty(domElement, propKey, propValue, isCustomComponentTag);
            }
          }
        }
        function createElement4(type, props, rootContainerElement, parentNamespace) {
          var isCustomComponentTag;
          var ownerDocument = getOwnerDocumentFromRootContainer(rootContainerElement);
          var domElement;
          var namespaceURI = parentNamespace;
          if (namespaceURI === HTML_NAMESPACE) {
            namespaceURI = getIntrinsicNamespace(type);
          }
          if (namespaceURI === HTML_NAMESPACE) {
            {
              isCustomComponentTag = isCustomComponent(type, props);
              if (!isCustomComponentTag && type !== type.toLowerCase()) {
                error("<%s /> is using incorrect casing. Use PascalCase for React components, or lowercase for HTML elements.", type);
              }
            }
            if (type === "script") {
              var div = ownerDocument.createElement("div");
              div.innerHTML = "<script><\/script>";
              var firstChild = div.firstChild;
              domElement = div.removeChild(firstChild);
            } else if (typeof props.is === "string") {
              domElement = ownerDocument.createElement(type, {
                is: props.is
              });
            } else {
              domElement = ownerDocument.createElement(type);
              if (type === "select") {
                var node2 = domElement;
                if (props.multiple) {
                  node2.multiple = true;
                } else if (props.size) {
                  node2.size = props.size;
                }
              }
            }
          } else {
            domElement = ownerDocument.createElementNS(namespaceURI, type);
          }
          {
            if (namespaceURI === HTML_NAMESPACE) {
              if (!isCustomComponentTag && Object.prototype.toString.call(domElement) === "[object HTMLUnknownElement]" && !hasOwnProperty.call(warnedUnknownTags, type)) {
                warnedUnknownTags[type] = true;
                error("The tag <%s> is unrecognized in this browser. If you meant to render a React component, start its name with an uppercase letter.", type);
              }
            }
          }
          return domElement;
        }
        function createTextNode(text2, rootContainerElement) {
          return getOwnerDocumentFromRootContainer(rootContainerElement).createTextNode(text2);
        }
        function setInitialProperties(domElement, tag, rawProps, rootContainerElement) {
          var isCustomComponentTag = isCustomComponent(tag, rawProps);
          {
            validatePropertiesInDevelopment(tag, rawProps);
          }
          var props;
          switch (tag) {
            case "dialog":
              listenToNonDelegatedEvent("cancel", domElement);
              listenToNonDelegatedEvent("close", domElement);
              props = rawProps;
              break;
            case "iframe":
            case "object":
            case "embed":
              listenToNonDelegatedEvent("load", domElement);
              props = rawProps;
              break;
            case "video":
            case "audio":
              for (var i4 = 0; i4 < mediaEventTypes.length; i4++) {
                listenToNonDelegatedEvent(mediaEventTypes[i4], domElement);
              }
              props = rawProps;
              break;
            case "source":
              listenToNonDelegatedEvent("error", domElement);
              props = rawProps;
              break;
            case "img":
            case "image":
            case "link":
              listenToNonDelegatedEvent("error", domElement);
              listenToNonDelegatedEvent("load", domElement);
              props = rawProps;
              break;
            case "details":
              listenToNonDelegatedEvent("toggle", domElement);
              props = rawProps;
              break;
            case "input":
              initWrapperState(domElement, rawProps);
              props = getHostProps(domElement, rawProps);
              listenToNonDelegatedEvent("invalid", domElement);
              break;
            case "option":
              validateProps(domElement, rawProps);
              props = rawProps;
              break;
            case "select":
              initWrapperState$1(domElement, rawProps);
              props = getHostProps$1(domElement, rawProps);
              listenToNonDelegatedEvent("invalid", domElement);
              break;
            case "textarea":
              initWrapperState$2(domElement, rawProps);
              props = getHostProps$2(domElement, rawProps);
              listenToNonDelegatedEvent("invalid", domElement);
              break;
            default:
              props = rawProps;
          }
          assertValidProps(tag, props);
          setInitialDOMProperties(tag, domElement, rootContainerElement, props, isCustomComponentTag);
          switch (tag) {
            case "input":
              track(domElement);
              postMountWrapper(domElement, rawProps, false);
              break;
            case "textarea":
              track(domElement);
              postMountWrapper$3(domElement);
              break;
            case "option":
              postMountWrapper$1(domElement, rawProps);
              break;
            case "select":
              postMountWrapper$2(domElement, rawProps);
              break;
            default:
              if (typeof props.onClick === "function") {
                trapClickOnNonInteractiveElement(domElement);
              }
              break;
          }
        }
        function diffProperties(domElement, tag, lastRawProps, nextRawProps, rootContainerElement) {
          {
            validatePropertiesInDevelopment(tag, nextRawProps);
          }
          var updatePayload = null;
          var lastProps;
          var nextProps;
          switch (tag) {
            case "input":
              lastProps = getHostProps(domElement, lastRawProps);
              nextProps = getHostProps(domElement, nextRawProps);
              updatePayload = [];
              break;
            case "select":
              lastProps = getHostProps$1(domElement, lastRawProps);
              nextProps = getHostProps$1(domElement, nextRawProps);
              updatePayload = [];
              break;
            case "textarea":
              lastProps = getHostProps$2(domElement, lastRawProps);
              nextProps = getHostProps$2(domElement, nextRawProps);
              updatePayload = [];
              break;
            default:
              lastProps = lastRawProps;
              nextProps = nextRawProps;
              if (typeof lastProps.onClick !== "function" && typeof nextProps.onClick === "function") {
                trapClickOnNonInteractiveElement(domElement);
              }
              break;
          }
          assertValidProps(tag, nextProps);
          var propKey;
          var styleName;
          var styleUpdates = null;
          for (propKey in lastProps) {
            if (nextProps.hasOwnProperty(propKey) || !lastProps.hasOwnProperty(propKey) || lastProps[propKey] == null) {
              continue;
            }
            if (propKey === STYLE) {
              var lastStyle = lastProps[propKey];
              for (styleName in lastStyle) {
                if (lastStyle.hasOwnProperty(styleName)) {
                  if (!styleUpdates) {
                    styleUpdates = {};
                  }
                  styleUpdates[styleName] = "";
                }
              }
            } else if (propKey === DANGEROUSLY_SET_INNER_HTML || propKey === CHILDREN) ;
            else if (propKey === SUPPRESS_CONTENT_EDITABLE_WARNING || propKey === SUPPRESS_HYDRATION_WARNING) ;
            else if (propKey === AUTOFOCUS) ;
            else if (registrationNameDependencies.hasOwnProperty(propKey)) {
              if (!updatePayload) {
                updatePayload = [];
              }
            } else {
              (updatePayload = updatePayload || []).push(propKey, null);
            }
          }
          for (propKey in nextProps) {
            var nextProp = nextProps[propKey];
            var lastProp = lastProps != null ? lastProps[propKey] : void 0;
            if (!nextProps.hasOwnProperty(propKey) || nextProp === lastProp || nextProp == null && lastProp == null) {
              continue;
            }
            if (propKey === STYLE) {
              {
                if (nextProp) {
                  Object.freeze(nextProp);
                }
              }
              if (lastProp) {
                for (styleName in lastProp) {
                  if (lastProp.hasOwnProperty(styleName) && (!nextProp || !nextProp.hasOwnProperty(styleName))) {
                    if (!styleUpdates) {
                      styleUpdates = {};
                    }
                    styleUpdates[styleName] = "";
                  }
                }
                for (styleName in nextProp) {
                  if (nextProp.hasOwnProperty(styleName) && lastProp[styleName] !== nextProp[styleName]) {
                    if (!styleUpdates) {
                      styleUpdates = {};
                    }
                    styleUpdates[styleName] = nextProp[styleName];
                  }
                }
              } else {
                if (!styleUpdates) {
                  if (!updatePayload) {
                    updatePayload = [];
                  }
                  updatePayload.push(propKey, styleUpdates);
                }
                styleUpdates = nextProp;
              }
            } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
              var nextHtml = nextProp ? nextProp[HTML$1] : void 0;
              var lastHtml = lastProp ? lastProp[HTML$1] : void 0;
              if (nextHtml != null) {
                if (lastHtml !== nextHtml) {
                  (updatePayload = updatePayload || []).push(propKey, nextHtml);
                }
              }
            } else if (propKey === CHILDREN) {
              if (typeof nextProp === "string" || typeof nextProp === "number") {
                (updatePayload = updatePayload || []).push(propKey, "" + nextProp);
              }
            } else if (propKey === SUPPRESS_CONTENT_EDITABLE_WARNING || propKey === SUPPRESS_HYDRATION_WARNING) ;
            else if (registrationNameDependencies.hasOwnProperty(propKey)) {
              if (nextProp != null) {
                if (typeof nextProp !== "function") {
                  warnForInvalidEventListener(propKey, nextProp);
                }
                if (propKey === "onScroll") {
                  listenToNonDelegatedEvent("scroll", domElement);
                }
              }
              if (!updatePayload && lastProp !== nextProp) {
                updatePayload = [];
              }
            } else {
              (updatePayload = updatePayload || []).push(propKey, nextProp);
            }
          }
          if (styleUpdates) {
            {
              validateShorthandPropertyCollisionInDev(styleUpdates, nextProps[STYLE]);
            }
            (updatePayload = updatePayload || []).push(STYLE, styleUpdates);
          }
          return updatePayload;
        }
        function updateProperties(domElement, updatePayload, tag, lastRawProps, nextRawProps) {
          if (tag === "input" && nextRawProps.type === "radio" && nextRawProps.name != null) {
            updateChecked(domElement, nextRawProps);
          }
          var wasCustomComponentTag = isCustomComponent(tag, lastRawProps);
          var isCustomComponentTag = isCustomComponent(tag, nextRawProps);
          updateDOMProperties(domElement, updatePayload, wasCustomComponentTag, isCustomComponentTag);
          switch (tag) {
            case "input":
              updateWrapper(domElement, nextRawProps);
              break;
            case "textarea":
              updateWrapper$1(domElement, nextRawProps);
              break;
            case "select":
              postUpdateWrapper(domElement, nextRawProps);
              break;
          }
        }
        function getPossibleStandardName(propName) {
          {
            var lowerCasedName = propName.toLowerCase();
            if (!possibleStandardNames.hasOwnProperty(lowerCasedName)) {
              return null;
            }
            return possibleStandardNames[lowerCasedName] || null;
          }
        }
        function diffHydratedProperties(domElement, tag, rawProps, parentNamespace, rootContainerElement, isConcurrentMode, shouldWarnDev) {
          var isCustomComponentTag;
          var extraAttributeNames;
          {
            isCustomComponentTag = isCustomComponent(tag, rawProps);
            validatePropertiesInDevelopment(tag, rawProps);
          }
          switch (tag) {
            case "dialog":
              listenToNonDelegatedEvent("cancel", domElement);
              listenToNonDelegatedEvent("close", domElement);
              break;
            case "ifr…62152 tokens truncated… = (0, import_react4.useState)("");
  const [motivoAutorizacionA09, setMotivoAutorizacionA09] = (0, import_react4.useState)("");
  const [autorizacionesA09, setAutorizacionesA09] = (0, import_react4.useState)([]);
  const [descuentosAplicadosA09, setDescuentosAplicadosA09] = (0, import_react4.useState)([]);
  const [auditoriaDescuentosA09, setAuditoriaDescuentosA09] = (0, import_react4.useState)({ solicitudes: [], intentos: [], aplicaciones: [], eventos: [], efectosCaja: [], efectosStock: [], fiscalizacion: [] });
  const [errorAuditoriaDescuentosA09, setErrorAuditoriaDescuentosA09] = (0, import_react4.useState)("");
  const [cargandoAutorizacionesA09, setCargandoAutorizacionesA09] = (0, import_react4.useState)(false);
  const [procesandoDescuentoA09, setProcesandoDescuentoA09] = (0, import_react4.useState)(false);
  const [errorDescuentoA09, setErrorDescuentoA09] = (0, import_react4.useState)("");
  const [mensajeDescuentoA09, setMensajeDescuentoA09] = (0, import_react4.useState)("");
  const [motivoOperacionA05, setMotivoOperacionA05] = (0, import_react4.useState)("");
  const [accionEnCursoA05, setAccionEnCursoA05] = (0, import_react4.useState)("");
  const [errorVenta, setErrorVenta] = (0, import_react4.useState)("");
  const [configurandoA04, setConfigurandoA04] = (0, import_react4.useState)(null);
  const [seleccionesA04, setSeleccionesA04] = (0, import_react4.useState)({});
  const [errorA04, setErrorA04] = (0, import_react4.useState)("");
  const [cargandoA04, setCargandoA04] = (0, import_react4.useState)(false);

  (0, import_react4.useEffect)(() => {
    const empresaId = configEmpresa?.id || null;
    const localId = local?.id || null;
    omitirPersistenciaInicialA06Ref.current = true;
    const lectura = leerBorradorTpvA06(empresaId, localId);
    setEstadoBorradorA06(lectura);
    setCarrito(lectura.estado === "ACTIVO" ? lectura.lineas : []);
    setBorradorCargadoA06(true);
    setConflictoA06(null);
  }, [local?.id, configEmpresa?.id]);

  (0, import_react4.useEffect)(() => {
    if (!borradorCargadoA06) return;
    if (omitirPersistenciaInicialA06Ref.current) {
      omitirPersistenciaInicialA06Ref.current = false;
      return;
    }
    const empresaId = configEmpresa?.id || null;
    const localId = local?.id || null;
    setEstadoBorradorA06(guardarBorradorTpvA06(empresaId, localId, carrito));
  }, [carrito, borradorCargadoA06, local?.id, configEmpresa?.id]);

  (0, import_react4.useEffect)(() => {
    let activo = true;
    const localPersistido = typeof leerPedidoOperativoA05 === "function" ? leerPedidoOperativoA05() : null;
    Promise.resolve(localPersistido).then((pedido) => {
      if (activo) setPedidoOperativoA05(pedido || null);
    });
    if (typeof recuperarCuentaA06 === "function") {
      Promise.resolve(recuperarCuentaA06()).then((resultado) => {
        if (!activo || !resultado) return;
        if (resultado.ok && resultado.pedidoId) {
          setPedidoOperativoA05(resultado);
          setErrorA05("");
        } else if (resultado.error) {
          setErrorA05(resultado.error);
        }
      }).catch(() => {
      });
    }
    return () => {
      activo = false;
    };
  }, [local?.id, configEmpresa?.id, leerPedidoOperativoA05, recuperarCuentaA06]);

  async function refrescarSalaA07() {
    if (typeof cargarMapaSalaA07 !== "function") return;
    if (!pedidoOperativoA05?.cuentaId) {
      setMapaSalaA07(null);
      setErrorSalaA07("");
      return;
    }
    setCargandoSalaA07(true);
    const resultado = await cargarMapaSalaA07();
    setCargandoSalaA07(false);
    if (!resultado?.ok) {
      setMapaSalaA07(null);
      setErrorSalaA07(resultado?.error || "No se pudo cargar la sala.");
      return;
    }
    setMapaSalaA07(resultado);
    setErrorSalaA07("");
  }

  (0, import_react4.useEffect)(() => {
    if (!pedidoOperativoA05?.cuentaId) {
      setMapaSalaA07(null);
      setErrorSalaA07("");
      setMesaSeleccionadaA07(null);
      setMotivoTrasladoA07("");
      setRelevoAbiertoA07(false);
      setResponsablesA07([]);
      setResponsableSeleccionadoA07("");
      setMotivoResponsableA07("");
      setRepartoAbiertoA08(false);
      setEstadoRepartoA08(null);
      setLineaSeleccionadaA08("");
      setCantidadRepartoA08("");
      setCuentaDestinoA08("");
      setComensalRepartoA08("");
      setErrorRepartoA08("");
      setMensajeRepartoA08("");
      return;
    }
    refrescarSalaA07();
  }, [pedidoOperativoA05?.cuentaId, pedidoOperativoA05?.cuentaVersion, local?.id, configEmpresa?.id]);

  (0, import_react4.useEffect)(() => {
    setRepartoAbiertoA08(false);
    setEstadoRepartoA08(null);
    setLineaSeleccionadaA08("");
    setCantidadRepartoA08("");
    setCuentaDestinoA08("");
    setComensalRepartoA08("");
    setErrorRepartoA08("");
    setMensajeRepartoA08("");
  }, [pedidoOperativoA05?.cuentaId, local?.id, configEmpresa?.id]);

  (0, import_react4.useEffect)(() => {
    setDescuentoAbiertoA09(false);
    setTipoDescuentoA09("PERCENT");
    setValorDescuentoA09("");
    setMotivoDescuentoA09("");
    setMotivoAutorizacionA09("");
    setAutorizacionesA09([]);
    setErrorDescuentoA09("");
    setMensajeDescuentoA09("");
  }, [pedidoOperativoA05?.cuentaId, local?.id, configEmpresa?.id]);

  function etiquetaResponsableA07(userId) {
    const id = String(userId || "");
    if (!id) return "Sin responsable";
    const candidato = responsablesA07.find((r22) => String(r22.user_id || "") === id);
    if (candidato?.nombre) return candidato.nombre;
    if (mapaSalaA07?.currentUserId && id === String(mapaSalaA07.currentUserId) && nombreResponsableActualA07) {
      return nombreResponsableActualA07;
    }
    return "Usuario …" + id.slice(-8);
  }

  async function confirmarAsignacionMesaA07() {
    if (!mesaSeleccionadaA07 || typeof asignarMesaCuentaA07 !== "function") return;
    const n = Number(comensalesA07);
    if (!Number.isSafeInteger(n) || n < 1 || n > 999) {
      setErrorSalaA07("Indica un número de comensales entre 1 y 999.");
      return;
    }
    setAsignandoMesaA07(true);
    setErrorSalaA07("");
    const resultado = await asignarMesaCuentaA07(mesaSeleccionadaA07.mesa_id, n, mesaSeleccionadaA07.version);
    setAsignandoMesaA07(false);
    if (!resultado?.ok) {
      setErrorSalaA07(resultado?.error || "No se pudo asignar la mesa.");
      if (resultado?.conflict) await refrescarSalaA07();
      return;
    }
    if (resultado.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);
    if (resultado.mapa?.zonas) setMapaSalaA07(resultado.mapa);
    else await refrescarSalaA07();
    setMesaSeleccionadaA07(null);
  }

  async function confirmarTrasladoMesaA07() {
    if (!mesaSeleccionadaA07 || typeof moverMesaCuentaA07 !== "function") return;
    const n = Number(comensalesA07);
    const motivo = motivoTrasladoA07.trim();
    if (!Number.isSafeInteger(n) || n < 1 || n > 999 || !motivo) {
      setErrorSalaA07("Indica comensales y un motivo del traslado.");
      return;
    }
    setMoviendoMesaA07(true);
    setErrorSalaA07("");
    const resultado = await moverMesaCuentaA07(mesaSeleccionadaA07.mesa_id, n, motivo, mesaSeleccionadaA07.version);
    setMoviendoMesaA07(false);
    if (!resultado?.ok) {
      setErrorSalaA07(resultado?.error || "No se pudo trasladar la cuenta.");
      if (resultado?.conflict) await refrescarSalaA07();
      return;
    }
    if (resultado.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);
    if (resultado.mapa?.zonas) setMapaSalaA07(resultado.mapa);
    else await refrescarSalaA07();
    setMesaSeleccionadaA07(null);
    setMotivoTrasladoA07("");
  }

  async function abrirRelevoResponsableA07() {
    if (typeof listarResponsablesCuentaA07 !== "function") return;
    setCargandoResponsablesA07(true);
    setErrorSalaA07("");
    const resultado = await listarResponsablesCuentaA07();
    setCargandoResponsablesA07(false);
    if (!resultado?.ok) {
      setErrorSalaA07(resultado?.error || "No se pudieron cargar los responsables.");
      return;
    }
    setResponsablesA07(resultado.responsables || []);
    const actual = String(pedidoOperativoA05?.responsableActual || mapaSalaA07?.responsableActual || "");
    const primero = (resultado.responsables || []).find((r22) => String(r22.user_id || "") !== actual);
    setResponsableSeleccionadoA07(primero?.user_id || "");
    setRelevoAbiertoA07(true);
  }

  async function confirmarRelevoResponsableA07() {
    if (typeof cambiarResponsableCuentaA07 !== "function") return;
    const motivo = motivoResponsableA07.trim();
    if (!responsableSeleccionadoA07 || !motivo) {
      setErrorSalaA07("Selecciona un nuevo responsable e indica el motivo.");
      return;
    }
    setCambiandoResponsableA07(true);
    setErrorSalaA07("");
    const resultado = await cambiarResponsableCuentaA07(responsableSeleccionadoA07, motivo);
    setCambiandoResponsableA07(false);
    if (!resultado?.ok) {
      setErrorSalaA07(resultado?.error || "No se pudo cambiar el responsable.");
      if (resultado?.conflict) await refrescarSalaA07();
      return;
    }
    if (resultado.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);
    if (resultado.mapa?.zonas) setMapaSalaA07(resultado.mapa);
    else await refrescarSalaA07();
    setRelevoAbiertoA07(false);
    setMotivoResponsableA07("");
  }

  function cantidadMovibleA08(linea) {
    const cantidad = Number(linea?.cantidad) || 0;
    const fiscalizada = Number(linea?.cantidad_fiscalizada) || 0;
    return Math.max(0, cantidad - fiscalizada);
  }

  function lineasMoviblesA08(estado = estadoRepartoA08) {
    const lineas = Array.isArray(estado?.origen?.reparto?.lineas) ? estado.origen.reparto.lineas : [];
    return lineas.filter((linea) =>
      !["BORRADOR", "CANCELADA"].includes(String(linea?.estado_linea || ""))
      && cantidadMovibleA08(linea) > 0
    );
  }

  function aplicarEstadoRepartoA08(estado) {
    setEstadoRepartoA08(estado || null);
    const lineas = lineasMoviblesA08(estado);
    const primera = lineas[0] || null;
    const destinos = Array.isArray(estado?.destinos) ? estado.destinos : [];
    setLineaSeleccionadaA08(primera?.source_line_id || "");
    setCantidadRepartoA08(primera ? String(cantidadMovibleA08(primera)) : "");
    setCuentaDestinoA08(destinos[0]?.cuenta_id || "");
  }

  async function abrirRepartoProductosA08() {
    if (typeof listarCuentasRepartoA08 !== "function") return;
    setCargandoRepartoA08(true);
    setErrorRepartoA08("");
    setMensajeRepartoA08("");
    const resultado = await listarCuentasRepartoA08();
    setCargandoRepartoA08(false);
    if (!resultado?.ok) {
      setErrorRepartoA08(resultado?.error || "No se pudo cargar el reparto de la cuenta.");
      return;
    }
    aplicarEstadoRepartoA08(resultado);
    setRepartoAbiertoA08(true);
  }

  function seleccionarLineaRepartoA08(lineaId) {
    setLineaSeleccionadaA08(lineaId);
    const linea = lineasMoviblesA08().find((item) => String(item.source_line_id || "") === String(lineaId || ""));
    setCantidadRepartoA08(linea ? String(cantidadMovibleA08(linea)) : "");
    setErrorRepartoA08("");
    setMensajeRepartoA08("");
  }

  async function confirmarRepartoProductoA08() {
    if (typeof moverCantidadLineaCuentaA08 !== "function" || moviendoLineaA08) return;
    const lineas = lineasMoviblesA08();
    const linea = lineas.find((item) => String(item.source_line_id || "") === String(lineaSeleccionadaA08 || ""));
    const destinos = Array.isArray(estadoRepartoA08?.destinos) ? estadoRepartoA08.destinos : [];
    const destino = destinos.find((item) => String(item.cuenta_id || "") === String(cuentaDestinoA08 || ""));
    const cantidad = Number(cantidadRepartoA08);
    const disponible = cantidadMovibleA08(linea);
    if (!linea || !destino || !Number.isFinite(cantidad) || cantidad <= 0 || cantidad > disponible) {
      setErrorRepartoA08("Selecciona una línea, una cantidad disponible y una cuenta destino.");
      return;
    }

    setMoviendoLineaA08(true);
    setErrorRepartoA08("");
    setMensajeRepartoA08("");
    const resultado = await moverCantidadLineaCuentaA08(
      linea.source_line_id,
      cantidad,
      destino.cuenta_id,
      estadoRepartoA08?.origen?.version,
      destino.version,
      linea.linea_version,
      comensalRepartoA08
    );
    setMoviendoLineaA08(false);

    if (!resultado?.ok) {
      if (resultado?.conflict && typeof listarCuentasRepartoA08 === "function") {
        const fresco = await listarCuentasRepartoA08();
        if (fresco?.ok) aplicarEstadoRepartoA08(fresco);
      }
      setErrorRepartoA08(resultado?.error || "No se pudo repartir el producto.");
      return;
    }

    if (resultado.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);
    if (resultado.estado?.ok) aplicarEstadoRepartoA08(resultado.estado);
    setComensalRepartoA08("");
    setMensajeRepartoA08("Producto repartido correctamente. Ambas cuentas se han recargado desde el servidor.");
  }

  function etiquetaCuentaDestinoA08(cuenta) {
    const ubicacion = cuenta?.ubicacion || {};
    const sitio = ubicacion.mesa_nombre || ubicacion.mesa_codigo || "Cuenta abierta";
    const modalidad = String(cuenta?.modalidad || "TPV");
    const total = Number(cuenta?.total_comercial) || 0;
    return sitio + " · " + modalidad + " · €" + fmt(total);
  }

  async function listarDescuentosAplicadosA09() {
    const localId = local?.id || null;
    const empresaId = configEmpresa?.id || null;
    if (!localId) return { ok: false, error: "Selecciona un local antes de revisar el stack de descuentos." };
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    try {
      const contexto = leerContextoCuentaA02(empresaId, localId);
      if (!contexto?.cuentaId) throw new Error("contexto_cuenta_persistido_invalido");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "Los descuentos necesitan conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const { data, error } = await supabase
        .from("abc_descuentos_aplicados")
        .select("operation_id,cuenta_id,tipo,importe,motivo,created_at,source_line_id,reparto_id")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .eq("cuenta_id", contexto.cuentaId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return { ok: true, descuentos: Array.isArray(data) ? data : [] };
    } catch (error) {
      return { ok: false, error: respuestaErrorA06(error).error };
    }
  }

  async function listarAuditoriaDescuentosA09() {
    const localId = local?.id || null;
    const empresaId = configEmpresa?.id || null;
    if (!localId) return { ok: false, error: "Selecciona un local antes de revisar la auditoría de descuentos." };
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    try {
      const contexto = leerContextoCuentaA02(empresaId, localId);
      if (!contexto?.cuentaId) throw new Error("contexto_cuenta_persistido_invalido");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "La auditoría de descuentos necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const [autorizaciones, intentos, eventos] = await Promise.all([
        supabase
          .from("abc_descuento_autorizaciones")
          .select("operation_id,cuenta_id,motivo,snapshot,estado,solicitante_id,autorizador_id,motivo_autorizacion,solicitada_at,autorizada_at,aplicada_at,resultado")
          .eq("empresa_id", empresaId)
          .eq("local_id", localId)
          .eq("cuenta_id", contexto.cuentaId)
          .order("solicitada_at", { ascending: false })
          .limit(100),
        supabase
          .from("abc_descuento_aprobacion_intentos")
          .select("operation_id,attempt_id,solicitante_id,autorizador_id,decision,motivo,resultado,occurred_at")
          .eq("empresa_id", empresaId)
          .eq("local_id", localId)
          .order("occurred_at", { ascending: false })
          .limit(200),
        supabase.rpc("abc_listar_eventos_descuento_cuenta", {
          p_empresa_id: empresaId,
          p_local_id: localId,
          p_cuenta_id: contexto.cuentaId
        })
      ]);
      for (const response of [autorizaciones, intentos, eventos]) {
        if (response.error) throw response.error;
      }
      const solicitudes = Array.isArray(autorizaciones.data) ? autorizaciones.data : [];
      const operationIds = new Set(solicitudes.map((row) => String(row?.operation_id || "")).filter(Boolean));
      return {
        ok: true,
        solicitudes,
        intentos: (Array.isArray(intentos.data) ? intentos.data : []).filter((row) => operationIds.has(String(row?.operation_id || ""))),
        eventos: Array.isArray(eventos.data) ? eventos.data : []
      };
    } catch (error) {
      return { ok: false, error: respuestaErrorA06(error).error };
    }
  }

  async function listarEfectosCajaA09() {
    const localId = local?.id || null;
    const empresaId = configEmpresa?.id || null;
    if (!localId) return { ok: false, error: "Selecciona un local antes de revisar los efectos de caja." };
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    try {
      const contexto = leerContextoCuentaA02(empresaId, localId);
      if (!contexto?.cuentaId) throw new Error("contexto_cuenta_persistido_invalido");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "La conciliación monetaria necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const checkoutsResponse = await supabase
        .from("checkouts")
        .select("id,estado,currency_code,operating_day,created_at,completed_at")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .eq("cuenta_id", contexto.cuentaId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (checkoutsResponse.error) throw checkoutsResponse.error;
      const checkouts = Array.isArray(checkoutsResponse.data) ? checkoutsResponse.data : [];
      const checkoutIds = checkouts.map((row) => row?.id).filter(Boolean);
      if (checkoutIds.length === 0) return { ok: true, efectos: [] };
      const pagosResponse = await supabase
        .from("pagos")
        .select("id,checkout_id,medio,estado,importe_objetivo,importe_recibido,cambio_entregado,payment_currency_code,created_at,resolved_at")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .in("checkout_id", checkoutIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (pagosResponse.error) throw pagosResponse.error;
      const pagos = Array.isArray(pagosResponse.data) ? pagosResponse.data : [];
      const pagoIds = pagos.map((row) => row?.id).filter(Boolean);
      if (pagoIds.length === 0) return { ok: true, efectos: [] };
      const cajaResponse = await supabase
        .from("caja_operaciones")
        .select("operation_id,origen_id,tipo,importe,efecto_efectivo,medio_pago,concepto,fecha,currency_code,operating_day,abc_command_id,created_at")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .eq("origen_tipo", "ABC_PAGO")
        .in("origen_id", pagoIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cajaResponse.error) throw cajaResponse.error;
      const checkoutById = new Map(checkouts.map((row) => [String(row?.id || ""), row]));
      const pagoById = new Map(pagos.map((row) => [String(row?.id || ""), row]));
      return {
        ok: true,
        efectos: (Array.isArray(cajaResponse.data) ? cajaResponse.data : []).map((row) => {
          const pago = pagoById.get(String(row?.origen_id || ""));
          const checkout = pago ? checkoutById.get(String(pago?.checkout_id || "")) : null;
          return { ...row, pago, checkout };
        })
      };
    } catch (error) {
      return { ok: false, error: respuestaErrorA06(error).error };
    }
  }

  async function listarEfectosStockA09() {
    const localId = local?.id || null;
    const empresaId = configEmpresa?.id || null;
    if (!localId) return { ok: false, error: "Selecciona un local antes de revisar líneas y producto." };
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    try {
      const contexto = leerContextoCuentaA02(empresaId, localId);
      if (!contexto?.cuentaId) throw new Error("contexto_cuenta_persistido_invalido");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "La integridad de stock necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const pedidosResponse = await supabase
        .from("pedidos_tpv")
        .select("id,estado,version,created_at")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .eq("cuenta_id", contexto.cuentaId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (pedidosResponse.error) throw pedidosResponse.error;
      const pedidoIds = (Array.isArray(pedidosResponse.data) ? pedidosResponse.data : []).map((row) => row?.id).filter(Boolean);
      if (pedidoIds.length === 0) return { ok: true, lineas: [] };
      const lineasResponse = await supabase
        .from("pedido_lineas")
        .select("id,pedido_id,producto_id,cantidad,unidad,estado,version,descuento_total,base,impuestos,total")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .in("pedido_id", pedidoIds)
        .order("id", { ascending: true })
        .limit(200);
      if (lineasResponse.error) throw lineasResponse.error;
      const lineas = Array.isArray(lineasResponse.data) ? lineasResponse.data : [];
      const lineaIds = lineas.map((row) => row?.id).filter(Boolean);
      if (lineaIds.length === 0) return { ok: true, lineas: [] };
      const descuentosResponse = await supabase
        .from("abc_descuentos_aplicados")
        .select("operation_id,source_line_id,tipo,importe,created_at")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .eq("cuenta_id", contexto.cuentaId)
        .in("source_line_id", lineaIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (descuentosResponse.error) throw descuentosResponse.error;
      const descuentosPorLinea = new Map();
      for (const descuento of Array.isArray(descuentosResponse.data) ? descuentosResponse.data : []) {
        const key = String(descuento?.source_line_id || "");
        if (!key) continue;
        const rows = descuentosPorLinea.get(key) || [];
        rows.push(descuento);
        descuentosPorLinea.set(key, rows);
      }
      return {
        ok: true,
        lineas: lineas.map((linea) => ({
          ...linea,
          descuentos: descuentosPorLinea.get(String(linea?.id || "")) || []
        }))
      };
    } catch (error) {
      return { ok: false, error: respuestaErrorA06(error).error };
    }
  }

  async function listarFiscalizacionA09() {
    const localId = local?.id || null;
    const empresaId = configEmpresa?.id || null;
    if (!localId) return { ok: false, error: "Selecciona un local antes de revisar la fiscalización." };
    if (!empresaId) return { ok: false, error: "No se pudo determinar la empresa activa." };
    try {
      const contexto = leerContextoCuentaA02(empresaId, localId);
      if (!contexto?.cuentaId) throw new Error("contexto_cuenta_persistido_invalido");
      const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
      if (!hayConexion) return { ok: false, error: "La fiscalización necesita conexión con el servidor." };
      const supabase = await window.getSupabaseClient();
      const ventasResponse = await supabase
        .from("ventas_fiscales")
        .select("id,estado,subtotal,descuento_total,impuestos_total,total,currency_code,created_at")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .eq("cuenta_id", contexto.cuentaId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (ventasResponse.error) throw ventasResponse.error;
      const ventas = Array.isArray(ventasResponse.data) ? ventasResponse.data : [];
      const ventaIds = ventas.map((row) => row?.id).filter(Boolean);
      if (ventaIds.length === 0) return { ok: true, fiscalizaciones: [] };
      const lineasResponse = await supabase
        .from("venta_fiscal_lineas")
        .select("id,venta_fiscal_id,source_line_id,cantidad,descuento,base,impuesto,total,currency_code,created_at")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .in("venta_fiscal_id", ventaIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (lineasResponse.error) throw lineasResponse.error;
      const ventaById = new Map(ventas.map((row) => [String(row?.id || ""), row]));
      return {
        ok: true,
        fiscalizaciones: (Array.isArray(lineasResponse.data) ? lineasResponse.data : []).map((row) => ({
          ...row,
          venta: ventaById.get(String(row?.venta_fiscal_id || "")) || null
        }))
      };
    } catch (error) {
      return { ok: false, error: respuestaErrorA06(error).error };
    }
  }

  function agruparDescuentosAplicadosA09(rows) {
    const grouped = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const operationId = String(row?.operation_id || "").trim();
      if (!operationId) continue;
      const current = grouped.get(operationId) || {
        operationId,
        tipo: String(row?.tipo || ""),
        importe: 0,
        motivo: String(row?.motivo || ""),
        createdAt: row?.created_at || null,
        repartos: new Set(),
        lineas: new Set()
      };
      current.importe += Number(row?.importe) || 0;
      if (row?.reparto_id) current.repartos.add(String(row.reparto_id));
      if (row?.source_line_id) current.lineas.add(String(row.source_line_id));
      grouped.set(operationId, current);
    }
    return [...grouped.values()]
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map((row) => ({
        operationId: row.operationId,
        tipo: row.tipo,
        importe: row.importe,
        motivo: row.motivo,
        createdAt: row.createdAt,
        repartos: row.repartos.size,
        lineas: row.lineas.size
      }));
  }

  async function cargarAutorizacionesA09() {
    if (typeof listarAutorizacionesDescuentoA09 !== "function") return;
    setCargandoAutorizacionesA09(true);
    setErrorAuditoriaDescuentosA09("");
    setAuditoriaDescuentosA09({ solicitudes: [], intentos: [], aplicaciones: [], eventos: [], efectosCaja: [], efectosStock: [], fiscalizacion: [] });
    const [resultado, resultadoStack, resultadoAuditoria, resultadoCaja, resultadoStock, resultadoFiscal] = await Promise.all([
      listarAutorizacionesDescuentoA09(),
      listarDescuentosAplicadosA09(),
      listarAuditoriaDescuentosA09(),
      listarEfectosCajaA09(),
      listarEfectosStockA09(),
      listarFiscalizacionA09()
    ]);
    setCargandoAutorizacionesA09(false);
    if (!resultado?.ok) {
      setErrorDescuentoA09(resultado?.error || "No se pudieron cargar las autorizaciones.");
      return;
    }
    if (!resultadoStack?.ok) {
      setErrorDescuentoA09(resultadoStack?.error || "No se pudo cargar el stack de descuentos.");
      setAutorizacionesA09(Array.isArray(resultado.solicitudes) ? resultado.solicitudes : []);
      setDescuentosAplicadosA09([]);
      return;
    }
    setAutorizacionesA09(Array.isArray(resultado.solicitudes) ? resultado.solicitudes : []);
    setDescuentosAplicadosA09(agruparDescuentosAplicadosA09(resultadoStack.descuentos));
    if (!resultadoAuditoria?.ok) {
      setErrorAuditoriaDescuentosA09(resultadoAuditoria?.error || "No se pudo cargar la auditoría de descuentos.");
      setAuditoriaDescuentosA09({ solicitudes: [], intentos: [], aplicaciones: resultadoStack.descuentos || [], eventos: [], efectosCaja: resultadoCaja?.ok ? resultadoCaja.efectos || [] : [], efectosStock: resultadoStock?.ok ? resultadoStock.lineas || [] : [], fiscalizacion: resultadoFiscal?.ok ? resultadoFiscal.fiscalizaciones || [] : [] });
    } else {
      setAuditoriaDescuentosA09({ ...resultadoAuditoria, aplicaciones: resultadoStack.descuentos || [], efectosCaja: resultadoCaja?.ok ? resultadoCaja.efectos || [] : [], efectosStock: resultadoStock?.ok ? resultadoStock.lineas || [] : [], fiscalizacion: resultadoFiscal?.ok ? resultadoFiscal.fiscalizaciones || [] : [] });
    }
    if (!resultadoCaja?.ok) setErrorAuditoriaDescuentosA09(resultadoCaja?.error || "No se pudieron cargar los efectos de caja.");
    if (!resultadoStock?.ok) setErrorAuditoriaDescuentosA09(resultadoStock?.error || "No se pudo cargar la integridad de stock.");
    if (!resultadoFiscal?.ok) setErrorAuditoriaDescuentosA09(resultadoFiscal?.error || "No se pudo cargar la fiscalización.");
  }

  async function abrirDescuentoCuentaA09() {
    setDescuentoAbiertoA09(true);
    setErrorDescuentoA09("");
    setMensajeDescuentoA09("");
    await cargarAutorizacionesA09();
  }

  function solicitudDesdeAutorizacionA09(row) {
    const op = row?.snapshot?.operation || {};
    return {
      operationId: op.operation_id,
      cuentaId: op.cuenta_id,
      tipo: op.tipo,
      valor: String(op.tipo || "") === "COURTESY" ? null : op.valor,
      motivo: op.motivo,
      expectedCuentaVersion: op.expected_cuenta_version,
      terminalId: op.terminal_id,
      sessionId: op.session_id,
      operatingDay: op.operating_day,
      requiereEscalado: op.requiere_escalado === true,
      requiereDobleAprobacion: op.requiere_escalado !== true,
      approvalHash: row?.snapshot_hash || ""
    };
  }

  async function enviarDescuentoA09(solicitud = null) {
    if (typeof aplicarDescuentoCuentaA09 !== "function" || procesandoDescuentoA09) return;
    setProcesandoDescuentoA09(true);
    setErrorDescuentoA09("");
    setMensajeDescuentoA09("");
    const resultado = await aplicarDescuentoCuentaA09({
      tipo: solicitud?.tipo || tipoDescuentoA09,
      valor: solicitud ? solicitud.valor : valorDescuentoA09,
      motivo: solicitud?.motivo || motivoDescuentoA09,
      solicitud
    });
    setProcesandoDescuentoA09(false);
    if (!resultado?.ok) {
      if (resultado?.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);
      setErrorDescuentoA09(resultado?.error || "No se pudo procesar el descuento.");
      await cargarAutorizacionesA09();
      return;
    }
    if (resultado.pending) {
      const requiereEscalado = resultado?.resultado?.snapshot?.operation?.requiere_escalado === true;
      setMensajeDescuentoA09(requiereEscalado
        ? "Solicitud de escalado pendiente. Supera el límite de tu rol y debe autorizarla otra persona con capacidad suficiente."
        : "Solicitud de doble autorización pendiente. La política exige que otra persona la apruebe; la aprobación no aplica el descuento por sí sola.");
    } else if (resultado.applied) {
      if (resultado?.cuenta?.pedidoId) setPedidoOperativoA05(resultado.cuenta);
      setValorDescuentoA09("");
      setMotivoDescuentoA09("");
      setMensajeDescuentoA09("Descuento aplicado y cuenta recargada desde el servidor.");
    }
    await cargarAutorizacionesA09();
  }

  async function decidirAutorizacionA09(row, decision) {
    if (typeof resolverAutorizacionDescuentoA09 !== "function" || procesandoDescuentoA09) return;
    if (!motivoAutorizacionA09.trim()) {
      setErrorDescuentoA09("Escribe el motivo de la aprobación o rechazo.");
      return;
    }
    setProcesandoDescuentoA09(true);
    setErrorDescuentoA09("");
    setMensajeDescuentoA09("");
    const resultado = await resolverAutorizacionDescuentoA09(row, decision, motivoAutorizacionA09);
    setProcesandoDescuentoA09(false);
    if (!resultado?.ok) {
      setErrorDescuentoA09(resultado?.error || "No se pudo resolver la autorización.");
      await cargarAutorizacionesA09();
      return;
    }
    setMotivoAutorizacionA09("");
    setMensajeDescuentoA09(resultado.estado === "APROBADA"
      ? "Solicitud aprobada. El solicitante debe reintentar la aplicación con la solicitud original."
      : "Solicitud rechazada.");
    await cargarAutorizacionesA09();
  }

  const vendibles = (0, import_react4.useMemo)(
    () => productos.filter((p22) => p22.activo !== false && (p22.tipo === "elaborado" || Number(p22.precioVenta) > 0) && (p22._pm07Servidor ? Number(p22.stock) || 0 : Number(p22.stockPisoVenta) || 0) > 0),
    [productos]
  );
  const categorias = (0, import_react4.useMemo)(() => {
    const set = new Set(vendibles.map((p22) => p22.categoria).filter(Boolean));
    return ["Todos", ...[...set].sort()];
  }, [vendibles]);
  const visibles = (0, import_react4.useMemo)(() => {
    const base = categoria === "Todos" ? vendibles : vendibles.filter((p22) => p22.categoria === categoria);
    const q2 = busqueda.trim().toLowerCase();
    if (!q2) return base;
    return base.filter((p22) => p22.nombre.toLowerCase().includes(q2) || (p22.codigoBarras || "").toLowerCase().includes(q2));
  }, [vendibles, categoria, busqueda]);
  function manejarEnterEscaneo(e2) {
    if (e2.key !== "Enter") return;
    const q2 = busqueda.trim().toLowerCase();
    if (!q2) return;
    const exacto = vendibles.find((p22) => (p22.codigoBarras || "").toLowerCase() === q2);
    if (exacto) {
      agregar(exacto);
      setBusqueda("");
      setAvisoEscaneo(`\u2713 ${exacto.nombre}`);
      setTimeout(() => setAvisoEscaneo(""), 1500);
    } else if (visibles.length === 1) {
      agregar(visibles[0]);
      setBusqueda("");
      setAvisoEscaneo(`\u2713 ${visibles[0].nombre}`);
      setTimeout(() => setAvisoEscaneo(""), 1500);
    }
  }
  function claveCarritoA04(productoId, configuracionA04) {
    if (!configuracionA04) return String(productoId);
    const firma = (configuracionA04.selecciones || []).map((s22) => `${s22.grupo_id}:${s22.opcion_id}:${s22.cantidad}:${s22.expected_group_version}:${s22.expected_product_group_version}:${s22.expected_option_version}`).sort().join("|");
    return `${productoId}::a04::${configuracionA04.expectedProductVersion}::${firma}`;
  }
  function agregarLineaCarritoA04(producto, configuracionA04 = null) {
    const claveCarrito = claveCarritoA04(producto.id, configuracionA04);
    setCarrito((s22) => {
      const existe = s22.find((l22) => (l22.claveCarrito || l22.productoId) === claveCarrito);
      if (existe) return s22.map((l22) => (l22.claveCarrito || l22.productoId) === claveCarrito ? { ...l22, cantidad: (Number(l22.cantidad) || 0) + 1 } : l22);
      return [...s22, { claveCarrito, productoId: producto.id, cantidad: 1, configuracionA04 }];
    });
  }
  async function agregar(producto) {
    if (cargandoA04) return;
    setErrorVenta("");
    setErrorA04("");
    const empresaId = configEmpresa?.id || producto?.empresaId || null;
    const localId = local?.id || producto?.localId || null;
    if (!empresaId || !localId) {
      setErrorVenta("No se pudo determinar empresa y local para cargar las variantes del producto.");
      return;
    }
    const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
    if (!hayConexion) {
      setErrorVenta("El TPV necesita conexión con el servidor para comprobar variantes y modificadores.");
      return;
    }
    setCargandoA04(true);
    try {
      const supabase = await window.getSupabaseClient();
      const { data: catalogos, error: catalogoError } = await supabase
        .from("catalogo_tpv_productos")
        .select("producto_id,currency_code,precio_unitario,impuesto_pct,version,activo")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .eq("producto_id", producto.id)
        .eq("activo", true)
        .limit(2);
      if (catalogoError) throw catalogoError;
      if (!Array.isArray(catalogos) || catalogos.length !== 1) throw new Error(catalogos && catalogos.length > 1 ? "moneda_tpv_ambigua" : "producto_tpv_no_disponible");
      const catalogo = catalogos[0];
      const { data: enlaces, error: enlacesError } = await supabase
        .from("catalogo_tpv_producto_grupos")
        .select("grupo_id,min_selecciones,max_selecciones,orden,version,activo")
        .eq("empresa_id", empresaId)
        .eq("local_id", localId)
        .eq("producto_id", producto.id)
        .eq("currency_code", catalogo.currency_code)
        .eq("activo", true)
        .order("orden", { ascending: true });
      if (enlacesError) throw enlacesError;
      if (!Array.isArray(enlaces) || enlaces.length === 0) {
        agregarLineaCarritoA04(producto, null);
        return;
      }
      const idsGrupos = [...new Set(enlaces.map((x3) => x3.grupo_id).filter(Boolean))];
      const [{ data: grupos, error: gruposError }, { data: opciones, error: opcionesError }] = await Promise.all([
        supabase
          .from("catalogo_tpv_grupos_opciones")
          .select("id,nombre,tipo_grupo,orden,version,activo")
          .eq("empresa_id", empresaId)
          .eq("local_id", localId)
          .eq("activo", true)
          .in("id", idsGrupos),
        supabase
          .from("catalogo_tpv_opciones")
          .select("id,grupo_id,nombre,tipo_opcion,delta_precio,hereda_impuesto,impuesto_pct,max_cantidad,orden,version,activo")
          .eq("empresa_id", empresaId)
          .eq("local_id", localId)
          .eq("currency_code", catalogo.currency_code)
          .eq("activo", true)
          .in("grupo_id", idsGrupos)
          .order("orden", { ascending: true })
      ]);
      if (gruposError) throw gruposError;
      if (opcionesError) throw opcionesError;
      const mapaGrupos = new Map((grupos || []).map((g2) => [g2.id, g2]));
      const gruposUi = enlaces.map((enlace) => {
        const grupo = mapaGrupos.get(enlace.grupo_id);
        if (!grupo) throw new Error("configuracion_a04_cliente_invalida");
        const opcionesGrupo = (opciones || []).filter((o2) => o2.grupo_id === grupo.id).map((o2) => ({
          id: o2.id,
          nombre: o2.nombre,
          tipoOpcion: o2.tipo_opcion,
          deltaPrecio: Number(o2.delta_precio) || 0,
          heredaImpuesto: !!o2.hereda_impuesto,
          impuestoPct: o2.impuesto_pct == null ? null : Number(o2.impuesto_pct),
          maxCantidad: Math.max(1, Number(o2.max_cantidad) || 1),
          version: Number(o2.version)
        }));
        if (Number(enlace.min_selecciones) > 0 && opcionesGrupo.length === 0) throw new Error("configuracion_a04_cliente_invalida");
        return {
          id: grupo.id,
          nombre: grupo.nombre,
          tipoGrupo: grupo.tipo_grupo,
          minSelecciones: Number(enlace.min_selecciones) || 0,
          maxSelecciones: Math.max(1, Number(enlace.max_selecciones) || 1),
          version: Number(grupo.version),
          productGroupVersion: Number(enlace.version),
          opciones: opcionesGrupo
        };
      });
      const inicial = {};
      for (const grupo of gruposUi) {
        if (grupo.minSelecciones === 1 && grupo.opciones.length === 1) {
          inicial[grupo.id] = { [grupo.opciones[0].id]: 1 };
        }
      }
      setSeleccionesA04(inicial);
      setConfigurandoA04({
        producto,
        catalogo: {
          currencyCode: catalogo.currency_code,
          precioUnitario: Number(catalogo.precio_unitario) || 0,
          impuestoPct: Number(catalogo.impuesto_pct) || 0,
          version: Number(catalogo.version)
        },
        grupos: gruposUi
      });
    } catch (error) {
      const msg = String(error?.message || error || "");
      if (msg.includes("moneda_tpv_ambigua")) setErrorVenta("El producto tiene más de una moneda TPV activa y no puede configurarse de forma inequívoca.");
      else if (msg.includes("producto_tpv_no_disponible")) setErrorVenta("El producto no está disponible todavía en el catálogo TPV del servidor.");
      else setErrorVenta("No se pudieron cargar las variantes y modificadores del producto.");
    } finally {
      setCargandoA04(false);
    }
  }
  function cambiarSeleccionA04(grupo, opcion, delta) {
    setSeleccionesA04((anterior) => {
      const actualGrupo = { ...(anterior[grupo.id] || {}) };
      if (grupo.tipoGrupo === "VARIANTE") {
        return { ...anterior, [grupo.id]: { [opcion.id]: 1 } };
      }
      const actual = Number(actualGrupo[opcion.id]) || 0;
      const siguiente = Math.max(0, Math.min(opcion.maxCantidad, actual + delta));
      const otros = Object.entries(actualGrupo).reduce((acc, [id, cantidad]) => id === opcion.id ? acc : acc + (Number(cantidad) || 0), 0);
      if (otros + siguiente > grupo.maxSelecciones) return anterior;
      if (siguiente === 0) delete actualGrupo[opcion.id];
      else actualGrupo[opcion.id] = siguiente;
      return { ...anterior, [grupo.id]: actualGrupo };
    });
  }
  function confirmarConfiguracionA04() {
    if (!configurandoA04) return;
    const selecciones = [];
    const etiquetas = [];
    let precioUnitarioPreview = configurandoA04.catalogo.precioUnitario * (1 + configurandoA04.catalogo.impuestoPct / 100);
    for (const grupo of configurandoA04.grupos) {
      const elegidas = seleccionesA04[grupo.id] || {};
      const totalGrupo = Object.values(elegidas).reduce((acc, cantidad) => acc + (Number(cantidad) || 0), 0);
      if (totalGrupo < grupo.minSelecciones) {
        setErrorA04(`Selecciona al menos ${grupo.minSelecciones} opción(es) en ${grupo.nombre}.`);
        return;
      }
      if (totalGrupo > grupo.maxSelecciones) {
        setErrorA04(`El grupo ${grupo.nombre} admite como máximo ${grupo.maxSelecciones} selección(es).`);
        return;
      }
      for (const opcion of grupo.opciones) {
        const cantidad = Number(elegidas[opcion.id]) || 0;
        if (cantidad <= 0) continue;
        if (cantidad > opcion.maxCantidad) {
          setErrorA04(`${opcion.nombre} admite como máximo ${opcion.maxCantidad}.`);
          return;
        }
        selecciones.push({
          grupo_id: grupo.id,
          opcion_id: opcion.id,
          cantidad,
          expected_group_version: grupo.version,
          expected_product_group_version: grupo.productGroupVersion,
          expected_option_version: opcion.version
        });
        etiquetas.push(`${grupo.nombre}: ${opcion.nombre}${cantidad > 1 ? " x" + cantidad : ""}`);
        const impuesto = opcion.heredaImpuesto ? configurandoA04.catalogo.impuestoPct : Number(opcion.impuestoPct) || 0;
        precioUnitarioPreview += cantidad * opcion.deltaPrecio * (1 + impuesto / 100);
      }
    }
    const configuracionA04 = {
      expectedProductVersion: configurandoA04.catalogo.version,
      selecciones,
      etiquetas,
      precioUnitarioPreview,
      currencyCode: configurandoA04.catalogo.currencyCode
    };
    agregarLineaCarritoA04(configurandoA04.producto, configuracionA04);
    setConfigurandoA04(null);
    setSeleccionesA04({});
    setErrorA04("");
  }
  function cambiarCantidad(claveCarrito, delta) {
    setCarrito(
      (s22) => s22.map((l22) => (l22.claveCarrito || l22.productoId) === claveCarrito ? { ...l22, cantidad: Math.max(1, (Number(l22.cantidad) || 0) + delta) } : l22).filter((l22) => l22.cantidad > 0)
    );
  }
  function fijarCantidad(claveCarrito, valor) {
    setCarrito((s22) => s22.map((l22) => (l22.claveCarrito || l22.productoId) === claveCarrito ? { ...l22, cantidad: valor } : l22));
  }
  function normalizarCantidad(claveCarrito) {
    setCarrito(
      (s22) => s22.map((l22) => {
        if ((l22.claveCarrito || l22.productoId) !== claveCarrito) return l22;
        const n2 = Number(l22.cantidad);
        return { ...l22, cantidad: !n2 || n2 <= 0 ? 1 : n2 };
      })
    );
  }
  function quitar(claveCarrito) {
    setCarrito((s22) => s22.filter((l22) => (l22.claveCarrito || l22.productoId) !== claveCarrito));
  }
  function vaciarCarrito() {
    setCarrito([]);
  }
  const lineasCarrito = carrito.map((l22) => {
    const p22 = productos.find((x3) => x3.id === l22.productoId);
    if (!p22) return null;
    const precioBaseConIva = precioNeto(p22) * (1 + ivaDe(p22) / 100);
    const previewA04 = Number(l22.configuracionA04?.precioUnitarioPreview);
    const precioConIva = Number.isFinite(previewA04) && previewA04 >= 0 ? previewA04 : precioBaseConIva;
    const cant = Number(l22.cantidad) || 0;
    return { ...l22, cantidadNum: cant, producto: p22, precioUnitario: precioConIva, subtotal: precioConIva * cant };
  }).filter(Boolean);
  const total = lineasCarrito.reduce((a22, l22) => a22 + l22.subtotal, 0);
  const cantidadesProductoA04 = lineasCarrito.reduce((mapa, l22) => {
    mapa.set(l22.productoId, (mapa.get(l22.productoId) || 0) + l22.cantidadNum);
    return mapa;
  }, /* @__PURE__ */ new Map());
  const faltaStock = [...cantidadesProductoA04.entries()].map(([productoId, cantidadNum]) => {
    const producto = productos.find((p22) => p22.id === productoId);
    return producto ? { producto, cantidadNum } : null;
  }).filter((l22) => l22 && l22.cantidadNum > (l22.producto._pm07Servidor ? Number(l22.producto.stock) || 0 : Number(l22.producto.stockPisoVenta) || 0));
  const restoEfectivoMixto = medioPago === "Mixto" ? Math.max(0, total - (Number(importeTarjetaMixto) || 0)) : null;
  const baseParaCambio = medioPago === "Mixto" ? restoEfectivoMixto : total;
  const cambio = (medioPago === "Efectivo" || medioPago === "Mixto") && efectivoRecibido !== "" ? Number(efectivoRecibido) - baseParaCambio : null;
  function abrirCobro() {
    if (lineasCarrito.length === 0) return;
    setMedioPago("Efectivo");
    setEfectivoRecibido("");
    setImporteTarjetaMixto("");
    setErrorVenta("");
    setShowCobro(true);
  }
  function renderConfiguradorA04() {
    if (!configurandoA04) return null;
    const h4 = import_react4.default.createElement;
    return h4(
      Modal,
      { onClose: () => {
        setConfigurandoA04(null);
        setSeleccionesA04({});
        setErrorA04("");
      }, title: `Configurar ${configurandoA04.producto.nombre}` },
      h4("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Elige variantes y modificadores. El precio e IVA definitivos se recalculan y validan en el servidor al guardar el pedido."),
      configurandoA04.grupos.map((grupo) => {
        const elegidas = seleccionesA04[grupo.id] || {};
        const totalGrupo = Object.values(elegidas).reduce((acc, cantidad) => acc + (Number(cantidad) || 0), 0);
        return h4(
          Card,
          { key: grupo.id, className: "mb-3" },
          h4("div", { className: "flex justify-between gap-2 mb-2" },
            h4("div", { className: "font-semibold text-[13px]" }, grupo.nombre),
            h4("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, `${totalGrupo}/${grupo.maxSelecciones}${grupo.minSelecciones > 0 ? " · mínimo " + grupo.minSelecciones : ""}`)
          ),
          grupo.opciones.map((opcion) => {
            const cantidad = Number(elegidas[opcion.id]) || 0;
            const seleccionada = cantidad > 0;
            return h4(
              "div",
              { key: opcion.id, className: "flex items-center justify-between gap-2 py-1.5", style: { borderTop: `1px solid ${C2.line}` } },
              h4("button", {
                type: "button",
                onClick: () => cambiarSeleccionA04(grupo, opcion, grupo.tipoGrupo === "VARIANTE" ? 1 : seleccionada ? -cantidad : 1),
                className: "text-left flex-1 text-[12px] rounded-md px-2 py-2",
                style: { background: seleccionada ? C2.accentSoft : C2.surface, color: C2.ink }
              }, `${seleccionada ? "\u2713 " : ""}${opcion.nombre}${opcion.deltaPrecio ? " · " + (opcion.deltaPrecio > 0 ? "+" : "") + fmt(opcion.deltaPrecio) + " " + configurandoA04.catalogo.currencyCode : ""}`),
              grupo.tipoGrupo === "MODIFICADOR" && seleccionada && opcion.maxCantidad > 1 ? h4(
                "div",
                { className: "flex items-center gap-1" },
                h4("button", { type: "button", onClick: () => cambiarSeleccionA04(grupo, opcion, -1), className: "rounded-md px-3 py-2", style: { border: `1px solid ${C2.line}` } }, "\u2212"),
                h4("span", { className: "mono text-[12px] w-6 text-center" }, cantidad),
                h4("button", { type: "button", onClick: () => cambiarSeleccionA04(grupo, opcion, 1), className: "rounded-md px-3 py-2", style: { border: `1px solid ${C2.line}` } }, "+")
              ) : null
            );
          })
        );
      }),
      errorA04 ? h4("div", { role: "alert", className: "text-[12px] mb-3 p-2 rounded-lg", style: { background: C2.redSoft || "#FCE8E6", color: C2.red } }, errorA04) : null,
      h4("div", { className: "flex gap-2" },
        h4(Btn, { onClick: confirmarConfiguracionA04 }, "Añadir al carrito"),
        h4(Btn, { variant: "ghost", onClick: () => {
          setConfigurandoA04(null);
          setSeleccionesA04({});
          setErrorA04("");
        } }, "Cancelar")
      )
    );
  }
  async function gestionarConflictoA06(resultado, origen) {
    if (!resultado?.conflict) return false;
    let recuperado = null;
    if (typeof recuperarCuentaA06 === "function") {
      try {
        recuperado = await recuperarCuentaA06();
      } catch (error) {
      }
    }
    if (recuperado?.ok && recuperado.pedidoId) {
      setPedidoOperativoA05(recuperado);
      setConfirmacion((actual) => actual && actual.pedidoId === recuperado.pedidoId ? {
        ...actual,
        pedidoVersion: recuperado.pedidoVersion,
        pedidoEstado: recuperado.pedidoEstado,
        lineas: recuperado.lineas
      } : actual);
    }
    setConflictoA06({
      origen,
      mensaje: resultado.error || "La cuenta cambió en otro terminal.",
      revisionServidor: recuperado?.revision || null,
      recuperado: !!(recuperado?.ok && recuperado.pedidoId)
    });
    return true;
  }


  async function refrescarCobroF4() {
    if (typeof leerEstadoCobroF4 !== "function" || !pedidoOperativoA05?.cuentaId) {
      setEstadoCobroF4(null);
      return;
    }
    setCargandoCobroF4(true);
    const resultado = await leerEstadoCobroF4();
    setCargandoCobroF4(false);
    if (!resultado?.ok) {
      setErrorCobroF4(resultado?.error || "No se pudo consultar el estado del cobro.");
      return;
    }
    setEstadoCobroF4(resultado);
    setErrorCobroF4("");
  }
  async function ejecutarCobroF4(medio, opciones = {}) {
    if (procesandoCobroF4 || typeof iniciarCobroCuentaF4 !== "function") return;
    setProcesandoCobroF4(true);
    setErrorCobroF4("");
    setMensajeCobroF4("");
    const resultado = await iniciarCobroCuentaF4(medio, opciones);
    setProcesandoCobroF4(false);
    if (!resultado?.ok) {
      setErrorCobroF4(resultado?.error || "No se pudo iniciar el cobro.");
      await refrescarCobroF4();
      return;
    }
    setEstadoCobroF4(resultado);
    setMensajeCobroF4(resultado.mensaje || (medio === "EFECTIVO" ? "Cobro en efectivo confirmado por el servidor." : "Intento de tarjeta registrado."));
  }
  async function recuperarCobroF4UI() {
    if (procesandoCobroF4 || typeof reintentarCobroF4 !== "function") return;
    setProcesandoCobroF4(true);
    setErrorCobroF4("");
    setMensajeCobroF4("");
    const resultado = await reintentarCobroF4();
    setProcesandoCobroF4(false);
    if (!resultado?.ok) {
      setErrorCobroF4(resultado?.error || "No se pudo recuperar el cobro.");
      return;
    }
    setEstadoCobroF4(resultado);
    setMensajeCobroF4(resultado.mensaje || "Estado de cobro recuperado sin crear otro intento.");
  }
  function cambiarFormularioIncidenciaB04(campo, valor) {
    setFormularioIncidenciaB04((actual) => ({ ...actual, [campo]: valor }));
  }
  function numeroIncidenciaB04(valor) {
    if (valor === "" || valor === null || valor === void 0) return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }
  async function abrirIncidenciaB04UI() {
    if (procesandoIncidenciaB04) return;
    const ultimoIntento = Array.isArray(estadoCobroF4?.intentos) ? estadoCobroF4.intentos[0] : null;
    if (!ultimoIntento?.id) {
      setErrorCobroF4("No se encontró un intento incierto para abrir la incidencia.");
      return;
    }
    if (!String(formularioIncidenciaB04.motivo || "").trim()) {
      setErrorCobroF4("Indica el motivo de la incidencia.");
      return;
    }
    setProcesandoIncidenciaB04(true);
    setErrorCobroF4("");
    setMensajeCobroF4("");
    const resultado = await abrirIncidenciaCobroF4({
      intentoId: ultimoIntento.id,
      motivo: formularioIncidenciaB04.motivo,
      providerCode: formularioIncidenciaB04.providerCode,
      providerReference: formularioIncidenciaB04.providerReference,
      evidencia: formularioIncidenciaB04.evidencia
    });
    setProcesandoIncidenciaB04(false);
    if (!resultado?.ok) {
      setErrorCobroF4(resultado?.error || "No se pudo abrir la incidencia.");
      return;
    }
    setEstadoCobroF4(resultado.estado || estadoCobroF4);
    setMensajeCobroF4("Incidencia B04 abierta. El saldo queda bloqueado hasta resolverla.");
  }
  async function resolverIncidenciaB04UI(incidencia) {
    if (procesandoIncidenciaB04 || !incidencia?.id) return;
    const estado = String(formularioIncidenciaB04.estado || "").toUpperCase();
    const autorizado = numeroIncidenciaB04(formularioIncidenciaB04.autorizado);
    const capturado = numeroIncidenciaB04(formularioIncidenciaB04.capturado);
    const liquidado = numeroIncidenciaB04(formularioIncidenciaB04.liquidado);
    if (!formularioIncidenciaB04.providerCode || !formularioIncidenciaB04.providerReference) {
      setErrorCobroF4("Indica el código y la referencia del proveedor.");
      return;
    }
    if (estado === "CONFIRMADO" && (capturado === null || capturado <= 0)) {
      setErrorCobroF4("Para confirmar, indica el importe capturado.");
      return;
    }
    setProcesandoIncidenciaB04(true);
    setErrorCobroF4("");
    setMensajeCobroF4("");
    const resultado = await resolverIncidenciaCobroF4({
      incidenciaId: incidencia.id,
      estado,
      providerCode: formularioIncidenciaB04.providerCode,
      providerReference: formularioIncidenciaB04.providerReference,
      authorizedAmount: autorizado,
      capturedAmount: capturado,
      settledAmount: liquidado,
      evidencia: formularioIncidenciaB04.evidencia
    });
    setProcesandoIncidenciaB04(false);
    if (!resultado?.ok) {
      setErrorCobroF4(resultado?.error || "No se pudo resolver la incidencia.");
      return;
    }
    setEstadoCobroF4(resultado.estado || estadoCobroF4);
    setMensajeCobroF4("Incidencia B04 resuelta. El estado del cobro se ha actualizado en el servidor.");
  }
  function etiquetaEstadoIntentoF4(estado) {
    const valor = String(estado || "");
    if (valor === "CONFIRMADO") return "Confirmado";
    if (valor === "AUTORIZADO") return "Autorizado";
    if (valor === "RECHAZADO") return "Rechazado";
    if (valor === "CANCELADO") return "Cancelado";
    if (valor === "DESCONOCIDO") return "Resultado desconocido";
    return "Pendiente";
  }
  function renderCobroF4() {
    if (!pedidoOperativoA05?.cuentaId) return null;
    const pedidoListo = ["ENVIADO", "SERVIDO"].includes(String(pedidoOperativoA05.pedidoEstado || pedidoOperativoA05.estado || ""));
    const estado = estadoCobroF4;
    const tieneCheckout = Array.isArray(estado?.checkouts) && estado.checkouts.length>0;
    const totalPedido = (pedidoOperativoA05.lineas || []).reduce((acc, linea) => acc + (Number(linea.total) || 0), 0);
    const totalVisible = tieneCheckout ? Number(estado?.total) || 0 : totalPedido;
    const confirmadoVisible = Number(estado?.confirmado) || 0;
    const saldoVisible = tieneCheckout ? Number(estado?.saldo) || 0 : Math.max(0,totalPedido-confirmadoVisible);
    const ultimoIntento = Array.isArray(estado?.intentos) ? estado.intentos[0] : null;
    const bloqueado = !!estado?.cobroIncierto;
    const importeVisible = importeCobroF4 === "" ? saldoVisible : Number(importeCobroF4);
    const recibidoVisible = efectivoRecibidoCobroF4 === "" ? null : Number(efectivoRecibidoCobroF4);
    const cambioVisible = recibidoVisible !== null && Number.isFinite(recibidoVisible) && Number.isFinite(importeVisible)
      ? recibidoVisible - importeVisible : null;
    const incidencias = Array.isArray(estado?.incidencias) ? estado.incidencias : [];
    const incidenciaActiva = incidencias.find((incidencia) => incidencia.estado === "ABIERTA") || null;
    const form = formularioIncidenciaB04;
    return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Cobro · F4"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: refrescarCobroF4, disabled: cargandoCobroF4 || procesandoCobroF4 }, cargandoCobroF4 ? "Actualizando…" : "Actualizar")
      ),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, "B05: el importe restante, el cambio y la caja se calculan y validan en servidor. Para un pago mixto, cobra una parte en efectivo y completa después con tarjeta."),
      !pedidoListo ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] p-2 rounded-lg", style: { background: C2.amberSoft } }, "Envía el pedido antes de cobrar.") : null,
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-3 gap-2 mb-2" },
        /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px]", style: { color: C2.inkSoft } }, "Total"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono font-semibold text-[12px]" }, "€", fmt(totalVisible))),
        /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px]", style: { color: C2.inkSoft } }, "Confirmado"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono font-semibold text-[12px]" }, "€", fmt(confirmadoVisible))),
        /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px]", style: { color: C2.inkSoft } }, "Pendiente"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono font-semibold text-[12px]" }, "€", fmt(saldoVisible)))
      ),
      estado?.estado ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mb-2" }, "Cuenta: ", /* @__PURE__ */ import_react4.default.createElement("b", null, tieneCheckout ? estado.estado : "LISTA PARA PREPARAR"), ultimoIntento ? " · Último intento: " + etiquetaEstadoIntentoF4(ultimoIntento.estado) : "") : null,
      bloqueado ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[11.5px] p-2 rounded-lg mb-2", style: { background: C2.amberSoft, color: C2.ink } }, "Existe un intento pendiente, autorizado o desconocido. No se permite iniciar otro cobro sobre ese saldo.") : null,
      bloqueado && !incidenciaActiva ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "p-2 rounded-lg mb-2", style: { border: `1px solid ${C2.line}`, background: C2.surface } },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] font-semibold mb-1" }, "Abrir incidencia B04"),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, "Registra el corte de respuesta y conserva la referencia del proveedor. La autorización se valida en el servidor."),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.motivo, onChange: (e2) => cambiarFormularioIncidenciaB04("motivo", e2.target.value), placeholder: "Respuesta del proveedor perdida" })),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 gap-2" },
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Código proveedor" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.providerCode, onChange: (e2) => cambiarFormularioIncidenciaB04("providerCode", e2.target.value), placeholder: ultimoIntento?.provider_code || "SIMULADOR" })),
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Referencia proveedor" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.providerReference, onChange: (e2) => cambiarFormularioIncidenciaB04("providerReference", e2.target.value), placeholder: ultimoIntento?.provider_reference || "referencia" }))
        ),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Evidencia (JSON opcional o nota)" }, /* @__PURE__ */ import_react4.default.createElement("textarea", { value: form.evidencia, onChange: (e2) => cambiarFormularioIncidenciaB04("evidencia", e2.target.value), rows: 2, className: "w-full rounded-lg px-3 py-2 text-[12px]", placeholder: "terminal, hora del corte, ticket interno…", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } })),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: abrirIncidenciaB04UI, disabled: procesandoIncidenciaB04 }, procesandoIncidenciaB04 ? "Guardando…" : "Abrir incidencia")
      ) : null,
      incidenciaActiva ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "p-2 rounded-lg mb-2", style: { border: `1px solid ${C2.line}`, background: C2.surface } },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] font-semibold mb-1" }, "Incidencia B04 abierta"),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, incidenciaActiva.motivo, " · ", incidenciaActiva.provider_reference || "sin referencia"),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 gap-2" },
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Resultado verificado" }, /* @__PURE__ */ import_react4.default.createElement("select", { value: form.estado, onChange: (e2) => cambiarFormularioIncidenciaB04("estado", e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[12px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } }, /* @__PURE__ */ import_react4.default.createElement("option", { value: "CONFIRMADO" }, "Confirmado"), /* @__PURE__ */ import_react4.default.createElement("option", { value: "RECHAZADO" }, "Rechazado"), /* @__PURE__ */ import_react4.default.createElement("option", { value: "CANCELADO" }, "Cancelado"))),
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Código proveedor" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.providerCode, onChange: (e2) => cambiarFormularioIncidenciaB04("providerCode", e2.target.value), placeholder: incidenciaActiva.provider_code || "código" }))
        ),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Referencia proveedor" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.providerReference, onChange: (e2) => cambiarFormularioIncidenciaB04("providerReference", e2.target.value), placeholder: incidenciaActiva.provider_reference || "referencia" })),
        form.estado === "CONFIRMADO" ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-3 gap-2" },
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Autorizado" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", min: "0", value: form.autorizado, onChange: (e2) => cambiarFormularioIncidenciaB04("autorizado", e2.target.value), placeholder: String(ultimoIntento?.requested_amount || "importe") })),
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Capturado" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", min: "0", value: form.capturado, onChange: (e2) => cambiarFormularioIncidenciaB04("capturado", e2.target.value), placeholder: String(ultimoIntento?.requested_amount || "importe") })),
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Liquidado" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", min: "0", value: form.liquidado, onChange: (e2) => cambiarFormularioIncidenciaB04("liquidado", e2.target.value), placeholder: "opcional" }))
        ) : null,
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Evidencia de resolución" }, /* @__PURE__ */ import_react4.default.createElement("textarea", { value: form.evidencia, onChange: (e2) => cambiarFormularioIncidenciaB04("evidencia", e2.target.value), rows: 2, className: "w-full rounded-lg px-3 py-2 text-[12px]", placeholder: "Quién verificó, cuándo y con qué comprobante…", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } })),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: () => resolverIncidenciaB04UI(incidenciaActiva), disabled: procesandoIncidenciaB04 }, procesandoIncidenciaB04 ? "Resolviendo…" : "Resolver incidencia")
      ) : null,
      errorCobroF4 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[11.5px] p-2 rounded-lg mb-2", style: { background: "#FCE8E6", color: C2.red } }, errorCobroF4) : null,
      mensajeCobroF4 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] p-2 rounded-lg mb-2", style: { background: C2.accentSoft, color: C2.ink } }, mensajeCobroF4) : null,
      pedidoListo && saldoVisible > 0 && !bloqueado ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "p-2 rounded-lg", style: { border: `1px solid ${C2.line}`, background: C2.surface } },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 gap-2 mb-2" },
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Importe de este pago (€)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", min: "0.01", max: saldoVisible, value: importeCobroF4, onChange: (e2) => setImporteCobroF4(e2.target.value), placeholder: saldoVisible.toFixed(2) })),
          /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Efectivo recibido (€)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", min: "0", value: efectivoRecibidoCobroF4, onChange: (e2) => setEfectivoRecibidoCobroF4(e2.target.value), placeholder: importeVisible > 0 ? importeVisible.toFixed(2) : "0.00" }))
        ),
        cambioVisible !== null ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: cambioVisible < 0 ? C2.red : C2.accent } }, cambioVisible < 0 ? `Faltan €${fmt(Math.abs(cambioVisible))}` : `Cambio a devolver: €${fmt(cambioVisible)}`) : null,
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 flex-wrap" },
          /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => ejecutarCobroF4("EFECTIVO", { importeObjetivo: importeVisible, importeRecibido: recibidoVisible == null ? importeVisible : recibidoVisible, cambioEntregado: cambioVisible == null ? 0 : cambioVisible }), disabled: procesandoCobroF4 || !Number.isFinite(importeVisible) || importeVisible <= 0 || cambioVisible !== null && cambioVisible < 0 }, procesandoCobroF4 ? "Procesando…" : "Cobrar efectivo"),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => ejecutarCobroF4("TARJETA", { importeObjetivo: importeVisible }), disabled: procesandoCobroF4 || !Number.isFinite(importeVisible) || importeVisible <= 0 }, "Iniciar tarjeta simulada"),
          confirmadoVisible > 0 && saldoVisible > 0 ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => ejecutarCobroF4("TARJETA", { importeObjetivo: saldoVisible }), disabled: procesandoCobroF4 }, "Completar pago mixto con tarjeta") : null
        ),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-2", style: { color: C2.inkSoft } }, "El botón de completar mixto usa el saldo que devuelve el servidor, no el cálculo local del navegador.")
      ) : null,
      estado?.pendienteLocal ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2" },
        /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: recuperarCobroF4UI, disabled: procesandoCobroF4 }, "Recuperar/reintentar mismo intento")
      ) : null
    );
  }

  (0, import_react4.useEffect)(() => {
    let activo = true;
    if (!pedidoOperativoA05?.cuentaId || typeof leerEstadoCobroF4 !== "function") {
      setEstadoCobroF4(null);
      setErrorCobroF4("");
      return () => { activo = false; };
    }
    setCargandoCobroF4(true);
    Promise.resolve(leerEstadoCobroF4()).then((resultado) => {
      if (!activo) return;
      setCargandoCobroF4(false);
      if (!resultado?.ok) {
        setErrorCobroF4(resultado?.error || "No se pudo consultar el cobro.");
        return;
      }
      setEstadoCobroF4(resultado);
      setErrorCobroF4("");
    }).catch(() => {
      if (!activo) return;
      setCargandoCobroF4(false);
      setErrorCobroF4("No se pudo consultar el cobro.");
    });
    return () => { activo = false; };
  }, [pedidoOperativoA05?.cuentaId, pedidoOperativoA05?.cuentaVersion, pedidoOperativoA05?.pedidoEstado, local?.id, configEmpresa?.id]);

  async function confirmarCobro() {
    setErrorVenta("");
    setEnviandoVenta(true);
    const resultado = await venderCarrito(
      carrito.map((l22) => ({ productoId: l22.productoId, cantidad: l22.cantidad, configuracionA04: l22.configuracionA04 || null })),
      { modalidad: modalidadActualA02 || void 0 }
    );
    setEnviandoVenta(false);
    if (!resultado || resultado.ok === false) {
      if (resultado?.modalidadNoHabilitada) await cargarModalidadesA02();
      if (await gestionarConflictoA06(resultado, "GUARDAR_PEDIDO")) {
        setErrorVenta("");
        return;
      }
      const prod = resultado && resultado.productoId ? productos.find((p22) => p22.id === resultado.productoId) : null;
      setErrorVenta(
        resultado && resultado.error === "Stock insuficiente" ? `Sin stock suficiente de "${prod ? prod.nombre : "ese producto"}" \u2014 quedan ${fmt(resultado.disponible)}. No se ha cobrado nada, ajusta la cantidad.` : resultado && resultado.error || "No se pudo completar la venta. Int\xE9ntalo de nuevo."
      );
      return;
    }
    setConfirmacion({
      total: resultado.totalServidor != null ? resultado.totalServidor : total,
      n: resultado.n,
      cuentaId: resultado.cuentaId || null,
      pedidoId: resultado.pedidoId || null,
      pedidoVersion: resultado.pedidoVersion || null,
      pedidoEstado: resultado.pedidoEstado || "ABIERTO",
      lineas: Array.isArray(resultado.lineas) ? resultado.lineas : [],
      currencyCode: resultado.currencyCode || "EUR",
      responsableActual: resultado.responsableActual || null,
      ubicacion: resultado.ubicacion || null,
      modalidad: resultado.modalidad || null
    });
    setErrorA05("");
    setConflictoA06(null);
    if (typeof leerPedidoOperativoA05 === "function") {
      setPedidoOperativoA05(await Promise.resolve(leerPedidoOperativoA05()));
    }
    setCarrito([]);
    setShowCobro(false);
  }
  async function enviarPedidoGuardadoA05() {
    if (procesandoA05 || !confirmacion || typeof enviarPedidoA05 !== "function") return;
    setProcesandoA05(true);
    setErrorA05("");
    try {
      const resultado = await enviarPedidoA05();
      if (!resultado || resultado.ok === false) {
        if (await gestionarConflictoA06(resultado, "ENVIAR_PEDIDO")) {
          setErrorA05("");
          return;
        }
        setErrorA05(resultado?.error || "No se pudo enviar el pedido.");
        return;
      }
      setConflictoA06(null);
      setConfirmacion((actual) => actual ? {
        ...actual,
        pedidoVersion: resultado.pedidoVersion,
        pedidoEstado: resultado.pedidoEstado || "ENVIADO",
        lineas: Array.isArray(resultado.lineas) ? resultado.lineas : actual.lineas
      } : actual);
      setPedidoOperativoA05(resultado);
    } finally {
      setProcesandoA05(false);
    }
  }
  async function ejecutarAccionA05(accion, lineaId = null) {
    if (accionEnCursoA05 || typeof accionPedidoA05 !== "function") return;
    if ((accion === "CANCELAR_LINEA" || accion === "CANCELAR_PEDIDO") && !motivoOperacionA05.trim()) {
      setErrorA05("Escribe un motivo antes de cancelar.");
      return;
    }
    setAccionEnCursoA05(accion + ":" + (lineaId || "pedido"));
    setErrorA05("");
    try {
      const resultado = await accionPedidoA05(accion, lineaId, motivoOperacionA05);
      if (!resultado || resultado.ok === false) {
        if (await gestionarConflictoA06(resultado, "ACCION_PEDIDO")) {
          setErrorA05("");
          return;
        }
        setErrorA05(resultado?.error || "No se pudo realizar la operación.");
        return;
      }
      setConflictoA06(null);
      setPedidoOperativoA05(resultado);
      setConfirmacion((actual) => actual && actual.pedidoId === resultado.pedidoId ? {
        ...actual,
        pedidoVersion: resultado.pedidoVersion,
        pedidoEstado: resultado.pedidoEstado,
        lineas: resultado.lineas
      } : actual);
      if (accion === "CANCELAR_LINEA" || accion === "CANCELAR_PEDIDO") setMotivoOperacionA05("");
    } finally {
      setAccionEnCursoA05("");
    }
  }

  function renderSalaA07() {
    const pedido = pedidoOperativoA05;
    if (!pedido?.cuentaId) return null;
    const ubicacion = pedido.ubicacion || mapaSalaA07?.ubicacion || null;
    const responsable = pedido.responsableActual || mapaSalaA07?.responsableActual || null;
    const zonas = Array.isArray(mapaSalaA07?.zonas) ? mapaSalaA07.zonas : [];
    return /* @__PURE__ */ import_react4.default.createElement(
      Card,
      { className: "mb-4" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Sala y mesas"),
        /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: refrescarSalaA07, disabled: cargandoSalaA07 }, cargandoSalaA07 ? "Actualizando…" : "Actualizar")
      ),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, "Ocupación y comensales vienen de cuentas reales del servidor. Responsable: ", /* @__PURE__ */ import_react4.default.createElement("b", null, etiquetaResponsableA07(responsable))),
      ubicacion ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-3 p-2 rounded-lg", style: { background: C2.accentSoft } },
        /* @__PURE__ */ import_react4.default.createElement("b", null, ubicacion.mesa_nombre || ubicacion.mesa_codigo || "Mesa"),
        " · ", ubicacion.zona_nombre || ubicacion.zona_tipo || "Zona",
        " · ", Number(ubicacion.comensales) || 0, " comensal(es)",
        " · ", ubicacion.estado_mesa || "OCUPADA",
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: C2.inkSoft } }, "Traslados y relevos conservan la misma cuenta y se registran en el historial del servidor.")
      ) : null,
      errorSalaA07 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mb-2 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorSalaA07) : null,
      !cargandoSalaA07 && zonas.length === 0 && !errorSalaA07 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, "No hay zonas ni mesas configuradas para este local.") : null,
      zonas.map((zona) => /* @__PURE__ */ import_react4.default.createElement("div", { key: zona.zona_id, className: "mb-3" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] font-semibold uppercase tracking-wide mb-1", style: { color: C2.inkSoft } }, zona.nombre || zona.codigo, " · ", zona.tipo),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-2" },
          (zona.mesas || []).map((mesa) => {
            const seleccionada = mesaSeleccionadaA07?.mesa_id === mesa.mesa_id;
            const noAsignable = ["BLOQUEADA", "RESERVADA", "FUERA_SERVICIO"].includes(String(mesa.estado_efectivo || ""));
            const esActual = ubicacion?.mesa_id && String(ubicacion.mesa_id) === String(mesa.mesa_id);
            return /* @__PURE__ */ import_react4.default.createElement("button", {
              key: mesa.mesa_id,
              type: "button",
              disabled: !!esActual || noAsignable || asignandoMesaA07 || moviendoMesaA07,
              onClick: () => {
                setMesaSeleccionadaA07(mesa);
                if (ubicacion?.comensales) setComensalesA07(String(ubicacion.comensales));
                else if (Number(mesa.capacidad) > 0) setComensalesA07(String(Math.min(Number(mesa.capacidad), 2) || 1));
              },
              className: "rounded-lg p-2 text-left",
              style: {
                border: "1px solid " + (esActual || seleccionada ? C2.accent : C2.line),
                background: esActual ? C2.accentSoft : C2.surface,
                opacity: noAsignable ? 0.6 : 1
              }
            },
              /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold" }, mesa.nombre || mesa.codigo),
              /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, mesa.estado_efectivo, " · ", Number(mesa.ocupacion_comensales) || 0, "/", Number(mesa.capacidad) || 0, " personas"),
              mesa.sobre_capacidad ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px]", style: { color: C2.red } }, "Sobre capacidad") : null,
              (mesa.cuentas || []).length ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: C2.inkSoft } }, (mesa.cuentas || []).length, " cuenta(s) activa(s)") : null
            );
          })
        )
      )),
      !ubicacion && mesaSeleccionadaA07 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2 p-2 rounded-lg", style: { border: "1px solid " + C2.line } },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold mb-2" }, "Asignar ", mesaSeleccionadaA07.nombre || mesaSeleccionadaA07.codigo),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Comensales" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", min: "1", max: "999", step: "1", value: comensalesA07, onChange: (e2) => setComensalesA07(e2.target.value) })),
        Number(comensalesA07) > Number(mesaSeleccionadaA07.capacidad) ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.amber || C2.inkSoft } }, "Aviso: supera la capacidad configurada de la mesa. El backend lo permite como advertencia, no como bloqueo.") : null,
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
          /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarAsignacionMesaA07, disabled: asignandoMesaA07 }, asignandoMesaA07 ? "Asignando…" : "Asignar esta cuenta"),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setMesaSeleccionadaA07(null), disabled: asignandoMesaA07 }, "Cancelar")
        )
      ) : null,
      ubicacion && mesaSeleccionadaA07 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2 p-2 rounded-lg", style: { border: "1px solid " + C2.line } },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold mb-2" }, "Trasladar a ", mesaSeleccionadaA07.nombre || mesaSeleccionadaA07.codigo),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Comensales" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", min: "1", max: "999", step: "1", value: comensalesA07, onChange: (e2) => setComensalesA07(e2.target.value) })),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo del traslado" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoTrasladoA07, onChange: (e2) => setMotivoTrasladoA07(e2.target.value), placeholder: "Cliente cambia de mesa…" })),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
          /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarTrasladoMesaA07, disabled: moviendoMesaA07 || !motivoTrasladoA07.trim() }, moviendoMesaA07 ? "Trasladando…" : "Trasladar cuenta"),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => { setMesaSeleccionadaA07(null); setMotivoTrasladoA07(""); }, disabled: moviendoMesaA07 }, "Cancelar")
        )
      ) : null,
      !relevoAbiertoA07 ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: abrirRelevoResponsableA07, disabled: cargandoResponsablesA07 || cambiandoResponsableA07 }, cargandoResponsablesA07 ? "Cargando responsables…" : "Cambiar responsable") : /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2 p-2 rounded-lg", style: { border: "1px solid " + C2.line } },
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nuevo responsable" }, /* @__PURE__ */ import_react4.default.createElement("select", { value: responsableSeleccionadoA07, onChange: (e2) => setResponsableSeleccionadoA07(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[12px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } },
          /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "Selecciona…"),
          responsablesA07.filter((r22) => String(r22.user_id || "") !== String(responsable || "")).map((r22) => /* @__PURE__ */ import_react4.default.createElement("option", { key: r22.user_id, value: r22.user_id }, r22.nombre, " · ", r22.rol))
        )),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo del relevo" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoResponsableA07, onChange: (e2) => setMotivoResponsableA07(e2.target.value), placeholder: "Cambio de turno…" })),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" },
          /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarRelevoResponsableA07, disabled: cambiandoResponsableA07 || !responsableSeleccionadoA07 || !motivoResponsableA07.trim() }, cambiandoResponsableA07 ? "Cambiando…" : "Confirmar relevo"),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => { setRelevoAbiertoA07(false); setMotivoResponsableA07(""); }, disabled: cambiandoResponsableA07 }, "Cancelar")
        )
      )
    );
  }


  function renderDescuentoCuentaA09() {
    const pedido = pedidoOperativoA05;
    if (!pedido?.cuentaId) return null;
    if (!descuentoAbiertoA09) {
      return /* @__PURE__ */ import_react4.default.createElement(
        Card,
        { className: "mb-4" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2" },
          /* @__PURE__ */ import_react4.default.createElement("div", null,
            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Descuento / cortesía"),
            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, "Aplica límites A09; las políticas de doble autorización requieren segunda firma y los excesos de rol se escalan.")
          ),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: abrirDescuentoCuentaA09 }, "Abrir")
        )
      );
    }

    const activas = Array.isArray(autorizacionesA09) ? autorizacionesA09 : [];
    return /* @__PURE__ */ import_react4.default.createElement(
      Card,
      { className: "mb-4" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Descuento / cortesía"),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-1.5" },
          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: cargarAutorizacionesA09, disabled: cargandoAutorizacionesA09 || procesandoDescuentoA09 }, cargandoAutorizacionesA09 ? "Actualizando…" : "Actualizar"),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setDescuentoAbiertoA09(false), disabled: procesandoDescuentoA09 }, "Cerrar")
        )
      ),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Tipo" },
        /* @__PURE__ */ import_react4.default.createElement("select", { value: tipoDescuentoA09, onChange: (e2) => setTipoDescuentoA09(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[12px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } },
          /* @__PURE__ */ import_react4.default.createElement("option", { value: "PERCENT" }, "Porcentaje"),
          /* @__PURE__ */ import_react4.default.createElement("option", { value: "AMOUNT" }, "Importe (antes de IVA)"),
          /* @__PURE__ */ import_react4.default.createElement("option", { value: "COURTESY" }, "Cortesía")
        )
      ),
      tipoDescuentoA09 !== "COURTESY" ? /* @__PURE__ */ import_react4.default.createElement(Field, { label: tipoDescuentoA09 === "PERCENT" ? "Porcentaje" : "Importe (€, antes de IVA)" },
        /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", min: "0.00000001", max: tipoDescuentoA09 === "PERCENT" ? "100" : void 0, step: "0.00000001", value: valorDescuentoA09, onChange: (e2) => setValorDescuentoA09(e2.target.value) })
      ) : null,
      tipoDescuentoA09 === "AMOUNT" ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, "El importe se resta antes de IVA: el total de la cuenta baja ese importe más su IVA.") : null,
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo" },
        /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoDescuentoA09, onChange: (e2) => setMotivoDescuentoA09(e2.target.value), maxLength: 500, placeholder: "Motivo obligatorio" })
      ),
      /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => enviarDescuentoA09(), disabled: procesandoDescuentoA09 || !motivoDescuentoA09.trim() || (tipoDescuentoA09 !== "COURTESY" && !valorDescuentoA09) }, procesandoDescuentoA09 ? "Procesando…" : "Aplicar / solicitar"),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-2", style: { color: C2.inkSoft } }, "Las políticas con doble autorización requieren que otra persona apruebe; la aprobación no aplica el descuento por sí sola."),
      descuentosAplicadosA09.length > 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] font-semibold mb-1" }, "Stack aplicado · ", descuentosAplicadosA09.length, " operaciones"),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, "Cada operación se aplica sobre la base restante y el servidor vuelve a validar el límite acumulado."),
        descuentosAplicadosA09.map((row) => /* @__PURE__ */ import_react4.default.createElement("div", { key: row.operationId, className: "p-2 rounded-lg mb-2", style: { border: "1px solid " + C2.line } },
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] font-semibold" }, String(row.tipo || ""), " · €", fmt(row.importe), " · ", row.repartos, " reparto", row.repartos === 1 ? "" : "s"),
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, row.motivo || "Sin motivo registrado", row.lineas > 0 ? " · "+row.lineas+" línea"+(row.lineas === 1 ? "" : "s") : "")
        ))
      ) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-3", style: { color: C2.inkSoft } }, "No hay descuentos aplicados en esta cuenta."),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] font-semibold mb-1" }, "Auditoría A09 · historial"),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, "Incluye solicitud, aprobación o rechazo, invalidación y aplicación. Los reversos económicos siguen el flujo transaccional correspondiente."),
        errorAuditoriaDescuentosA09 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[11px] mb-2 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorAuditoriaDescuentosA09) : null,
        auditoriaDescuentosA09.solicitudes.length > 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-2" },
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] font-semibold mb-1" }, "Solicitudes y estado final"),
          auditoriaDescuentosA09.solicitudes.map((row) => {
            const op = row?.snapshot?.operation || {};
            const operationId = String(row?.operation_id || "").slice(-16);
            const resultado = row?.resultado || {};
            return /* @__PURE__ */ import_react4.default.createElement("div", { key: "audit-request-" + row.operation_id, className: "p-2 rounded-lg mb-2", style: { border: "1px solid " + C2.line } },
              /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] font-semibold" }, String(row?.estado || ""), " · ", String(op?.tipo || "DESCUENTO"), " · …", operationId),
              /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: C2.inkSoft } }, "Solicitud: ", row?.solicitada_at || "sin fecha", " · Motivo: ", row?.motivo || "sin motivo"),
              row?.autorizada_at ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: C2.inkSoft } }, "Decisión: ", row.autorizada_at, " · ", row.motivo_autorizacion || "sin motivo de autorización") : null,
              row?.aplicada_at ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: C2.inkSoft } }, "Aplicación: ", row.aplicada_at) : null,
              resultado?.error ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-1", style: { color: C2.red } }, "Resultado: ", String(resultado.error)) : null
            );
          })
        ) : null,
        auditoriaDescuentosA09.intentos.length > 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-2" },
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] font-semibold mb-1" }, "Intentos de aprobación · ", auditoriaDescuentosA09.intentos.length),
          auditoriaDescuentosA09.intentos.map((row) => /* @__PURE__ */ import_react4.default.createElement("div", { key: "audit-attempt-" + row.attempt_id, className: "text-[10px] p-2 rounded-lg mb-1", style: { border: "1px solid " + C2.line, color: C2.inkSoft } }, String(row?.decision || "INTENTO"), " · ", row?.occurred_at || "sin fecha", " · ", row?.motivo || "sin motivo", " · ", String(row?.resultado?.status || row?.resultado?.error || "registrado")))
        ) : null,
        auditoriaDescuentosA09.aplicaciones.length > 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-2" },
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] font-semibold mb-1" }, "Aplicaciones registradas · ", auditoriaDescuentosA09.aplicaciones.length),
        auditoriaDescuentosA09.aplicaciones.map((row) => /* @__PURE__ */ import_react4.default.createElement("div", { key: "audit-applied-" + row.operation_id + "-" + row.reparto_id, className: "text-[10px] p-2 rounded-lg mb-1", style: { border: "1px solid " + C2.line, color: C2.inkSoft } }, String(row?.tipo || "DESCUENTO"), " · €", fmt(row?.importe), " · ", row?.created_at || "sin fecha", " · operación …", String(row?.operation_id || "").slice(-16)))
        ) : null,
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-2" },
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] font-semibold mb-1" }, "Efectos de caja · conciliación"),
        auditoriaDescuentosA09.efectosCaja.length > 0 ? auditoriaDescuentosA09.efectosCaja.map((row) => /* @__PURE__ */ import_react4.default.createElement("div", { key: "audit-cash-" + row.operation_id, className: "text-[10px] p-2 rounded-lg mb-1", style: { border: "1px solid " + C2.line, color: C2.inkSoft } }, String(row?.checkout?.estado || "CHECKOUT"), " · ", String(row?.pago?.estado || "PAGO"), " · ", String(row?.medio_pago || row?.pago?.medio || "EFECTIVO"), " · importe €", fmt(row?.importe), " · efecto efectivo €", fmt(row?.efecto_efectivo), " · ", row?.created_at || "sin fecha")) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px]", style: { color: C2.inkSoft } }, "Sin movimientos de caja asociados: el descuento solo modifica el total comercial; el cobro posterior registra el importe neto.")
        ),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-2" },
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] font-semibold mb-1" }, "Stock · líneas · producto"),
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mb-1", style: { color: C2.inkSoft } }, "El descuento A09 conserva producto, cantidad y unidad; solo actualiza los importes comerciales de la línea y no genera movimientos de stock."),
          auditoriaDescuentosA09.efectosStock.length > 0 ? auditoriaDescuentosA09.efectosStock.map((row) => /* @__PURE__ */ import_react4.default.createElement("div", { key: "audit-stock-" + row.id, className: "text-[10px] p-2 rounded-lg mb-1", style: { border: "1px solid " + C2.line, color: C2.inkSoft } }, "Producto ", String(row?.producto_id || "sin producto"), " · cantidad ", fmt(row?.cantidad), " ", String(row?.unidad || ""), " · línea ", String(row?.id || "").slice(-16), row?.descuentos?.length ? " · descuentos " + row.descuentos.length : " · sin descuento registrado")) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px]", style: { color: C2.inkSoft } }, "No hay líneas comerciales asociadas a esta cuenta."),
        ),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-2" },
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] font-semibold mb-1" }, "Fiscalización · alcance A09"),
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mb-1", style: { color: C2.inkSoft } }, "Una línea con fiscalización activa bloquea el descuento; la fiscalización parcial no se aplica en este alcance y no se modifica desde el TPV."),
          auditoriaDescuentosA09.fiscalizacion.length > 0 ? auditoriaDescuentosA09.fiscalizacion.map((row) => /* @__PURE__ */ import_react4.default.createElement("div", { key: "audit-fiscal-" + row.id, className: "text-[10px] p-2 rounded-lg mb-1", style: { border: "1px solid " + C2.line, color: C2.inkSoft } }, String(row?.venta?.estado || "VENTA FISCAL"), " · línea ", String(row?.source_line_id || "").slice(-16), " · cantidad ", fmt(row?.cantidad), " · total €", fmt(row?.total), " · ", row?.created_at || "sin fecha")) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px]", style: { color: C2.inkSoft } }, "Sin líneas fiscales activas asociadas a esta cuenta."),
        ),
        auditoriaDescuentosA09.eventos.length > 0 ? /* @__PURE__ */ import_react4.default.createElement("div", null,
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] font-semibold mb-1" }, "Eventos server-side · ", auditoriaDescuentosA09.eventos.length),
          auditoriaDescuentosA09.eventos.map((row) => /* @__PURE__ */ import_react4.default.createElement("div", { key: "audit-event-" + row.operation_id + "-" + row.occurred_at, className: "text-[10px] p-2 rounded-lg mb-1", style: { border: "1px solid " + C2.line, color: C2.inkSoft } }, String(row?.event_type || "EVENTO"), " · ", row?.occurred_at || "sin fecha", " · operación …", String(row?.operation_id || "").slice(-16)))
        ) : null,
        auditoriaDescuentosA09.solicitudes.length === 0 && auditoriaDescuentosA09.intentos.length === 0 && auditoriaDescuentosA09.aplicaciones.length === 0 && auditoriaDescuentosA09.eventos.length === 0 && auditoriaDescuentosA09.efectosCaja.length === 0 && auditoriaDescuentosA09.efectosStock.length === 0 && auditoriaDescuentosA09.fiscalizacion.length === 0 && !errorAuditoriaDescuentosA09 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, "No hay registros de auditoría para esta cuenta.") : null
      ),
      activas.length > 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-3" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] font-semibold mb-2" }, "Autorizaciones de esta cuenta"),
        /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo de aprobación / rechazo" },
          /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoAutorizacionA09, onChange: (e2) => setMotivoAutorizacionA09(e2.target.value), maxLength: 500 })
        ),
        activas.map((row) => {
          const op = row?.snapshot?.operation || {};
          const requiereEscalado = op.requiere_escalado === true;
          return /* @__PURE__ */ import_react4.default.createElement("div", { key: row.operation_id, className: "p-2 rounded-lg mb-2", style: { border: "1px solid " + C2.line } },
            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] font-semibold" }, String(row.estado || ""), " · ", String(op.tipo || ""), " · €", fmt(Number(op.importe_descuento) || 0), requiereEscalado ? " · ESCALADO" : " · DOBLE AUTORIZACIÓN"),
            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, requiereEscalado ? "Supera el límite del rol solicitante; debe autorizarla alguien con capacidad suficiente." : "La política exige una segunda autorización de otra persona; la aprobación no aplica el descuento por sí sola."),
            row.estado === "PENDIENTE" ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 mt-2 flex-wrap" },
              /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: () => decidirAutorizacionA09(row, "APROBAR"), disabled: procesandoDescuentoA09 || !motivoAutorizacionA09.trim() }, "Aprobar"),
              /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => decidirAutorizacionA09(row, "RECHAZAR"), disabled: procesandoDescuentoA09 || !motivoAutorizacionA09.trim() }, "Rechazar")
            ) : null,
            row.estado === "APROBADA" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, className: "mt-2", onClick: () => enviarDescuentoA09(solicitudDesdeAutorizacionA09(row)), disabled: procesandoDescuentoA09 }, "Reintentar aplicación") : null
          );
        })
      ) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-3", style: { color: C2.inkSoft } }, cargandoAutorizacionesA09 ? "Cargando autorizaciones…" : "No hay autorizaciones pendientes para esta cuenta."),
      errorDescuentoA09 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mt-2 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorDescuentoA09) : null,
      mensajeDescuentoA09 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mt-2 p-2 rounded-lg", style: { background: C2.accentSoft } }, mensajeDescuentoA09) : null
    );
  }

  function renderRepartoProductosA08() {
    const pedido = pedidoOperativoA05;
    if (!pedido?.cuentaId) return null;
    const lineas = lineasMoviblesA08();
    const destinos = Array.isArray(estadoRepartoA08?.destinos) ? estadoRepartoA08.destinos : [];
    const seleccion = lineas.find((item) => String(item.source_line_id || "") === String(lineaSeleccionadaA08 || "")) || null;
    const disponible = cantidadMovibleA08(seleccion);
    const fiscalizada = Number(seleccion?.cantidad_fiscalizada) || 0;

    if (!repartoAbiertoA08) {
      return /* @__PURE__ */ import_react4.default.createElement(
        Card,
        { className: "mb-4" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2" },
          /* @__PURE__ */ import_react4.default.createElement("div", null,
            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Repartir productos"),
            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, "Mueve cantidades comerciales entre cuentas abiertas sin mover el pedido de cocina ni los pagos.")
          ),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: abrirRepartoProductosA08, disabled: cargandoRepartoA08 }, cargandoRepartoA08 ? "Cargando…" : "Abrir reparto")
        ),
        errorRepartoA08 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mt-2 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorRepartoA08) : null
      );
    }

    return /* @__PURE__ */ import_react4.default.createElement(
      Card,
      { className: "mb-4" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Repartir productos"),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-1.5" },
          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: abrirRepartoProductosA08, disabled: cargandoRepartoA08 || moviendoLineaA08 }, cargandoRepartoA08 ? "Actualizando…" : "Actualizar"),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => { setRepartoAbiertoA08(false); setErrorRepartoA08(""); setMensajeRepartoA08(""); }, disabled: moviendoLineaA08 }, "Cerrar")
        )
      ),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-3", style: { color: C2.inkSoft } }, "Las cantidades disponibles, versiones de cuenta y parte fiscalizada se leen del servidor justo antes del reparto."),
      lineas.length === 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.inkSoft } }, "No hay productos repartibles en esta cuenta.") : /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Producto / línea" },
        /* @__PURE__ */ import_react4.default.createElement("select", { value: lineaSeleccionadaA08, onChange: (e2) => seleccionarLineaRepartoA08(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[12px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } },
          /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "Selecciona…"),
          lineas.map((linea) => {
            const producto = productos.find((p22) => String(p22.id) === String(linea.producto_id));
            return /* @__PURE__ */ import_react4.default.createElement("option", { key: linea.source_line_id, value: linea.source_line_id }, producto?.nombre || "Producto", " · disponible ", fmt(cantidadMovibleA08(linea)));
          })
        )
      ),
      seleccion ? /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Cantidad a mover" },
        /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", min: "0.00000001", max: String(disponible), step: "any", value: cantidadRepartoA08, onChange: (e2) => setCantidadRepartoA08(e2.target.value) })
      ) : null,
      fiscalizada > 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-2", style: { color: C2.amber || C2.inkSoft } }, "Parte fiscalizada inmóvil: ", fmt(fiscalizada), " · disponible para mover: ", fmt(disponible)) : null,
      destinos.length === 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.inkSoft } }, "No hay otra cuenta abierta compatible en este local y día operativo.") : /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Cuenta destino" },
        /* @__PURE__ */ import_react4.default.createElement("select", { value: cuentaDestinoA08, onChange: (e2) => setCuentaDestinoA08(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[12px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } },
          /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "Selecciona…"),
          destinos.map((cuenta) => /* @__PURE__ */ import_react4.default.createElement("option", { key: cuenta.cuenta_id, value: cuenta.cuenta_id }, etiquetaCuentaDestinoA08(cuenta)))
        )
      ),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Comensal (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: comensalRepartoA08, onChange: (e2) => setComensalRepartoA08(e2.target.value), placeholder: "Ej. Persona 2" })),
      errorRepartoA08 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mb-2 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorRepartoA08) : null,
      mensajeRepartoA08 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2 p-2 rounded-lg", style: { background: C2.accentSoft, color: C2.ink } }, mensajeRepartoA08) : null,
      /* @__PURE__ */ import_react4.default.createElement(Btn, {
        onClick: confirmarRepartoProductoA08,
        disabled: moviendoLineaA08 || !seleccion || !cuentaDestinoA08 || !Number.isFinite(Number(cantidadRepartoA08)) || Number(cantidadRepartoA08) <= 0 || Number(cantidadRepartoA08) > disponible
      }, moviendoLineaA08 ? "Moviendo…" : "Mover producto")
    );
  }

  function renderPedidoOperativoA05() {
    const pedido = pedidoOperativoA05;
    if (!pedido || !pedido.pedidoId) return null;
    const terminal = pedido.pedidoEstado === "CERRADO" || pedido.pedidoEstado === "CANCELADO";
    const tieneServidas = (pedido.lineas || []).some((l22) => l22.estado === "SERVIDA");
    const puedeCancelarPedido = !terminal && !tieneServidas;
    return /* @__PURE__ */ import_react4.default.createElement(
      Card,
      { className: "mb-4" },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Pedido operativo"),
        /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[11px] font-semibold", style: { color: pedido.pedidoEstado === "CANCELADO" ? C2.red : C2.accent } }, pedido.pedidoEstado || "ABIERTO")
      ),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mb-3", style: { color: C2.inkSoft } }, "Los permisos se validan siempre en el servidor. Preparación, servido y cancelaciones no registran cobro ni documento fiscal."),
      (pedido.lineas || []).map((linea) => {
        const producto = productos.find((p22) => p22.id === linea.productoId);
        const busy = !!accionEnCursoA05;
        return /* @__PURE__ */ import_react4.default.createElement(
          "div",
          { key: linea.lineaId, className: "py-2", style: { borderTop: "1px solid " + C2.line } },
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between gap-2 mb-1" },
            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-medium" }, producto?.nombre || linea.productoId),
            /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] font-semibold", style: { color: C2.inkSoft } }, linea.estado)
          ),
          /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex flex-wrap gap-1.5" },
            linea.estado === "ENVIADA" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: () => ejecutarAccionA05("INICIAR_PREPARACION", linea.lineaId), disabled: busy }, "Iniciar preparación") : null,
            linea.estado === "EN_PREPARACION" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: () => ejecutarAccionA05("MARCAR_PREPARADA", linea.lineaId), disabled: busy }, "Marcar preparada") : null,
            linea.estado === "PREPARADA" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: () => ejecutarAccionA05("SERVIR", linea.lineaId), disabled: busy }, "Servir") : null,
            !["SERVIDA", "CANCELADA"].includes(linea.estado) ? /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "danger", onClick: () => ejecutarAccionA05("CANCELAR_LINEA", linea.lineaId), disabled: busy || !motivoOperacionA05.trim() }, "Cancelar línea") : null
          )
        );
      }),
      !terminal ? /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo de cancelación (obligatorio para cancelar)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoOperacionA05, onChange: (e2) => setMotivoOperacionA05(e2.target.value), placeholder: "Error de pedido, cliente cancela…" })) : null,
      errorA05 ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mb-2 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorA05) : null,
      puedeCancelarPedido ? /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "danger", onClick: () => ejecutarAccionA05("CANCELAR_PEDIDO"), disabled: !!accionEnCursoA05 || !motivoOperacionA05.trim() }, accionEnCursoA05 === "CANCELAR_PEDIDO:pedido" ? "Cancelando…" : "Cancelar pedido") : null
    );
  }

  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ import_react4.default.createElement("h2", { className: "text-[16px] font-semibold" }, "TPV"), carrito.length > 0 && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: vaciarCarrito }, "Vaciar carrito")), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]" }, "A02/A04 guardan la cuenta y el pedido con autoridad del servidor; A05 permite enviarlo y F4 inicia el cobro solo cuando el pedido está listo. Los productos configurables usan variantes y modificadores A04. ", /* @__PURE__ */ import_react4.default.createElement("b", null, "No registra cobro, tique fiscal ni movimiento de stock"), ". El total definitivo lo confirma el servidor.")),
  estadoBorradorA06?.estado === "ACTIVO" ? /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.accentSoft, border: "none" } },
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold" }, "Borrador local activo"),
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, carrito.length, " línea(s) · se conserva 24 h desde la última modificación · caduca ", estadoBorradorA06.expiresAtMs ? new Date(estadoBorradorA06.expiresAtMs).toLocaleString("es-ES") : "")
  ) : estadoBorradorA06?.estado === "CADUCADO" ? /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } },
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]" }, "Borrador local caducado: se descartó porque superó la política de 24 h.")
  ) : estadoBorradorA06?.estado === "INVALIDO" || estadoBorradorA06?.estado === "NO_DISPONIBLE" ? /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mb-4 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, estadoBorradorA06.error || "No se puede usar el borrador local.") : null,
  conflictoA06 ? /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: "#FCE8E6", border: "1px solid " + C2.red } },
    /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] font-semibold", style: { color: C2.red } }, "Conflicto de edición: otro terminal cambió esta cuenta."),
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, conflictoA06.recuperado ? "Se ha recargado la versión del servidor. Tu borrador local no se ha borrado: revísalo antes de repetir la acción." : "No se ha sobrescrito el servidor. Tu borrador local se conserva; recarga la cuenta antes de repetir la acción."),
    conflictoA06.revisionServidor ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono text-[9.5px] mt-1", style: { color: C2.inkSoft } }, "Revisión servidor: ", conflictoA06.revisionServidor) : null,
    /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setConflictoA06(null) }, "Entendido")
  ) : null,
  renderSalaA07(), renderRepartoProductosA08(), renderPedidoOperativoA05(), renderDescuentoCuentaA09(), renderCobroF4(), vendibles.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "No hay nada en el piso de venta ahora mismo. Ponle precio a un producto en Productos, o haz un traspaso desde el almac\xE9n en la pesta\xF1a Traspasos." }) : /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "relative mb-3" }, /* @__PURE__ */ import_react4.default.createElement(
    "input",
    {
      ref: inputEscaneoRef,
      type: "text",
      inputMode: "search",
      value: busqueda,
      onChange: (e2) => setBusqueda(e2.target.value),
      onKeyDown: manejarEnterEscaneo,
      placeholder: "Escanea un c\xF3digo de barras o busca por nombre\u2026",
      autoFocus: true,
      className: "w-full rounded-xl px-4 py-3 text-[14px]",
      style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink }
    }
  ), avisoEscaneo && /* @__PURE__ */ import_react4.default.createElement(
    "div",
    {
      className: "absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] font-semibold px-2 py-1 rounded-md",
      style: { background: C2.accentSoft, color: C2.accent }
    },
    avisoEscaneo
  ), busqueda && !avisoEscaneo && /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      onClick: () => {
        setBusqueda("");
        inputEscaneoRef.current?.focus();
      },
      "aria-label": "Borrar b\xFAsqueda",
      className: "absolute right-3 top-1/2 -translate-y-1/2"
    },
    /* @__PURE__ */ import_react4.default.createElement(X2, { size: 16, color: C2.inkSoft })
  )), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 mb-3 overflow-x-auto" }, categorias.map((c22) => /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      key: c22,
      onClick: () => setCategoria(c22),
      className: "text-[12px] font-medium px-3 py-1.5 rounded-full whitespace-nowrap shrink-0",
      style: {
        background: categoria === c22 ? C2.chrome : C2.surface,
        color: categoria === c22 ? "#fff" : C2.inkSoft,
        border: `1px solid ${categoria === c22 ? C2.chrome : C2.line}`
      }
    },
    c22
  ))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4" }, visibles.map((p22) => {
    const precioConIva = precioNeto(p22) * (1 + ivaDe(p22) / 100);
    const cantidadEnCarrito = carrito.filter((l22) => l22.productoId === p22.id).reduce((acc, l22) => acc + (Number(l22.cantidad) || 0), 0);
    const sinStock = (Number(p22.stockPisoVenta) || 0) <= 0;
    return /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        key: p22.id,
        onClick: () => agregar(p22),
        disabled: cargandoA04,
        className: "rounded-xl p-3 text-left relative",
        style: { background: C2.surface, border: `1px solid ${cantidadEnCarrito > 0 ? C2.accent : C2.line}`, minHeight: 104, opacity: cargandoA04 ? 0.7 : 1 }
      },
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-medium leading-tight mb-1" }, p22.nombre),
      /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[14px] font-bold mono", style: { color: C2.accent } }, "\u20AC", fmt(precioConIva)),
      sinStock && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-0.5", style: { color: C2.red } }, "sin stock"),
      cantidadEnCarrito > 0 && /* @__PURE__ */ import_react4.default.createElement(
        "span",
        {
          className: "absolute -top-2 -right-2 rounded-full text-[11px] font-bold flex items-center justify-center",
          style: { background: C2.accentFill, color: C2.onAccent, width: 22, height: 22 }
        },
        fmt(cantidadEnCarrito)
      )
    );
  }))), lineasCarrito.length > 0 && /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold mb-2" }, "Carrito"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1.5 mb-3" }, lineasCarrito.map((l22) => /* @__PURE__ */ import_react4.default.createElement("div", { key: l22.claveCarrito || l22.productoId, className: "flex items-center justify-between text-[12.5px]" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "flex-1" }, /* @__PURE__ */ import_react4.default.createElement("div", null, l22.producto.nombre), l22.configuracionA04?.etiquetas?.length ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-0.5", style: { color: C2.inkSoft } }, l22.configuracionA04.etiquetas.join(" · ")) : null), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => cambiarCantidad(l22.claveCarrito || l22.productoId, -1), className: "rounded-md p-1 flex items-center justify-center", style: { border: `1px solid ${C2.line}`, minWidth: 44, minHeight: 44 } }, /* @__PURE__ */ import_react4.default.createElement(Minus, { size: 12 })), /* @__PURE__ */ import_react4.default.createElement(
    "input",
    {
      type: "number",
      inputMode: "decimal",
      step: "any",
      min: "0",
      value: l22.cantidad,
      onChange: (e2) => fijarCantidad(l22.claveCarrito || l22.productoId, e2.target.value),
      onBlur: () => normalizarCantidad(l22.claveCarrito || l22.productoId),
      onFocus: (e2) => e2.target.select(),
      className: "mono text-center rounded-md py-1",
      style: { width: 54, border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink, fontSize: 13, minHeight: 44 }
    }
  ), /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => cambiarCantidad(l22.claveCarrito || l22.productoId, 1), className: "rounded-md p-1 flex items-center justify-center", style: { border: `1px solid ${C2.line}`, minWidth: 44, minHeight: 44 } }, /* @__PURE__ */ import_react4.default.createElement(Plus, { size: 12 })), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono font-semibold w-16 text-right" }, "\u20AC", fmt(l22.subtotal)), /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => quitar(l22.claveCarrito || l22.productoId), "aria-label": "Quitar producto", className: "flex items-center justify-center", style: { minWidth: 44, minHeight: 44 } }, /* @__PURE__ */ import_react4.default.createElement(X2, { size: 14, color: C2.inkSoft })))))), faltaStock.length > 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mb-2", style: { color: C2.red } }, "Vas a dejar en negativo: ", faltaStock.map((l22) => l22.producto.nombre).join(", "), "."), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between pt-2", style: { borderTop: `1px solid ${C2.line}` } }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "font-semibold" }, "Total"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono font-bold text-[19px]", style: { color: C2.accent } }, "\u20AC", fmt(total)))), errorVenta && /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", "data-error-venta": "1", className: "text-[12.5px] mb-3 p-2 rounded-lg", style: { background: C2.redSoft, color: C2.red } }, "\u26A0 ", errorVenta), lineasCarrito.length > 0 && renderSelectorModalidadA02(), lineasCarrito.length > 0 && /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarCobro, disabled: enviandoVenta || cargandoA04 }, enviandoVenta ? "Guardando pedido\u2026" : `Guardar pedido \u20AC${fmt(total)}`), renderConfiguradorA04(), false && showCobro && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setShowCobro(false), title: "Cobrar" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-center mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]", style: { color: C2.inkSoft } }, "Total"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[28px] font-bold mono", style: { color: C2.accent } }, "\u20AC", fmt(total))), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Medio de pago" }, /* @__PURE__ */ import_react4.default.createElement("select", { value: medioPago, onChange: (e2) => setMedioPago(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } }, /* @__PURE__ */ import_react4.default.createElement("option", null, "Efectivo"), /* @__PURE__ */ import_react4.default.createElement("option", null, "Tarjeta"), /* @__PURE__ */ import_react4.default.createElement("option", null, "Mixto"), /* @__PURE__ */ import_react4.default.createElement("option", null, "Transferencia"), /* @__PURE__ */ import_react4.default.createElement("option", null, "Otro"))), medioPago === "Efectivo" && /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Efectivo entregado por el cliente (\u20AC)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", value: efectivoRecibido, onChange: (e2) => setEfectivoRecibido(e2.target.value), autoFocus: true })), cambio !== null && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] mb-3", style: { color: cambio < 0 ? C2.red : C2.accent } }, cambio < 0 ? `Faltan \u20AC${fmt(Math.abs(cambio))}` : `Cambio a devolver: \u20AC${fmt(cambio)}`)), medioPago === "Mixto" && /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Paga con tarjeta (\u20AC)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", min: "0", max: total, value: importeTarjetaMixto, onChange: (e2) => setImporteTarjetaMixto(e2.target.value), autoFocus: true })), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] mb-3", style: { color: C2.inkSoft } }, "Resto en efectivo: ", /* @__PURE__ */ import_react4.default.createElement("b", { className: "mono", style: { color: C2.ink } }, "\u20AC", fmt(restoEfectivoMixto))), restoEfectivoMixto > 0 && /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Efectivo entregado por el cliente (\u20AC)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", value: efectivoRecibido, onChange: (e2) => setEfectivoRecibido(e2.target.value) })), cambio !== null && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] mb-3", style: { color: cambio < 0 ? C2.red : C2.accent } }, cambio < 0 ? `Faltan \u20AC${fmt(Math.abs(cambio))}` : `Cambio a devolver: \u20AC${fmt(cambio)}`))), errorVenta && /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12.5px] mb-3 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "\u26A0 ", errorVenta), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(
    Btn,
    {
      onClick: confirmarCobro,
      disabled: enviandoVenta || medioPago === "Efectivo" && cambio !== null && cambio < 0 || medioPago === "Mixto" && (Number(importeTarjetaMixto) < 0 || Number(importeTarjetaMixto) > total || restoEfectivoMixto > 0 && cambio !== null && cambio < 0)
    },
    enviandoVenta ? "Cobrando\u2026" : "Confirmar venta"
  ), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setShowCobro(false), disabled: enviandoVenta }, "Cancelar"))), confirmacion && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => !procesandoA05 && setConfirmacion(null), title: confirmacion.pedidoEstado === "ENVIADO" ? "Pedido enviado" : "Pedido guardado" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] mb-2" }, confirmacion.currencyCode || "EUR", " ", fmt(confirmacion.total), " · ", confirmacion.n, " línea(s)"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2", style: { color: C2.inkSoft } }, "Cuenta ", confirmacion.cuentaId || "", " · Pedido ", confirmacion.pedidoId || "", confirmacion.modalidad ? " · Modalidad: " + (MODALIDADES_ETIQUETA_A02[confirmacion.modalidad] || confirmacion.modalidad) : ""), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2 font-semibold", style: { color: confirmacion.pedidoEstado === "ENVIADO" ? C2.accent : C2.ink } }, "Estado operativo: ", confirmacion.pedidoEstado || "ABIERTO"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, confirmacion.pedidoEstado === "ENVIADO" ? "A05 ha confirmado las líneas y enviado el pedido. Continúa su preparación, servido o cancelación desde el panel operativo del TPV." : "A02/A04 han persistido cuenta, pedido y líneas. A05 puede confirmar las líneas y enviar el pedido sin registrar cobro, documento fiscal ni movimiento de stock."), errorA05 && /* @__PURE__ */ import_react4.default.createElement("div", { role: "alert", className: "text-[12px] mb-3 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", errorA05), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, confirmacion.pedidoEstado !== "ENVIADO" ? /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: enviarPedidoGuardadoA05, disabled: procesandoA05 }, procesandoA05 ? "Enviando pedido…" : "Enviar pedido") : null, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setConfirmacion(null), disabled: procesandoA05 }, confirmacion.pedidoEstado === "ENVIADO" ? "Aceptar" : "Cerrar"))), renderHistorialVentas(), confirmAnular && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setConfirmAnular(null), title: "Anular esta venta" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] mb-3" }, /* @__PURE__ */ import_react4.default.createElement("b", null, confirmAnular.resumen), " \xB7 \u20AC", fmt(confirmAnular.importe)), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-3", style: { color: C2.inkSoft } }, "El stock de esos productos volver\xE1 al piso de venta, y quedar\xE1 registrada la anulaci\xF3n. La venta original no se borra: se ve que existi\xF3 y que se anul\xF3."), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: motivoAnular, onChange: (e2) => setMotivoAnular(e2.target.value), placeholder: "Cobro duplicado, importe incorrecto\u2026" })), errorAnular && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", role: "alert", style: { color: C2.red } }, errorAnular), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 mt-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "danger", onClick: confirmarAnulacion, disabled: procesandoAnulacion }, procesandoAnulacion ? "Anulando\u2026" : "S\xED, anular la venta"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setConfirmAnular(null), disabled: procesandoAnulacion }, "Cancelar"))));
}
var CIERRE_TEXTO_BLOQUEO = {
  DIFERENCIA_SIN_MOTIVO: "Falta registrar el motivo de la diferencia.",
  DIFERENCIA_PENDIENTE_APROBACION: "Falta la aprobación del Propietario.",
  DIFERENCIA_RECHAZADA: "El Propietario rechazó la diferencia: reabre el cierre y vuelve a contar.",
  DIFERENCIA_CAMBIADA: "La diferencia cambió desde que se registró el motivo: regístralo de nuevo."
};
function infoCierreA10(r2) {
  return {
    difference: r2?.difference ?? null,
    expected: r2?.expected_amount ?? null,
    counted: r2?.counted_amount ?? null,
    umbral: r2?.umbral ?? 0,
    requiereAprobacion: r2?.requiere_aprobacion === true,
    registro: r2?.registro || null,
    bloqueos: Array.isArray(r2?.bloqueos) ? r2.bloqueos : []
  };
}
function CocinaA10({ productos = [], local = null, configEmpresa = null, listarEstacionesA10, listarComandasA10, crearEstacionA10, actualizarEstacionA10, asignarProductoEstacionA10, enviarCambioComandaA10, reimprimirComandaA10, resolverMermaComandaA10, rolPerfil = "" }) {
  const h3 = import_react4.default.createElement;
  const abrirSesionCajaA10 = typeof listarEstacionesA10?.abrirSesionCajaA10 === "function" ? listarEstacionesA10.abrirSesionCajaA10 : null;
  const consultarSesionCajaC01 = typeof listarEstacionesA10?.consultarSesionCajaC01 === "function" ? listarEstacionesA10.consultarSesionCajaC01 : null;
  const vincularTerminalCajaC01 = typeof listarEstacionesA10?.vincularTerminalCajaC01 === "function" ? listarEstacionesA10.vincularTerminalCajaC01 : null;
  const desvincularTerminalCajaC01 = typeof listarEstacionesA10?.desvincularTerminalCajaC01 === "function" ? listarEstacionesA10.desvincularTerminalCajaC01 : null;
  const cambiarResponsableCajaC01 = typeof listarEstacionesA10?.cambiarResponsableCajaC01 === "function" ? listarEstacionesA10.cambiarResponsableCajaC01 : null;
  const iniciarCierreSesionCajaA10 = typeof listarEstacionesA10?.iniciarCierreSesionCajaA10 === "function" ? listarEstacionesA10.iniciarCierreSesionCajaA10 : null;
  const confirmarCierreProvisionalA10 = typeof listarEstacionesA10?.confirmarCierreProvisionalA10 === "function" ? listarEstacionesA10.confirmarCierreProvisionalA10 : null;
  const ensayarCierreSesionCajaC12 = typeof listarEstacionesA10?.ensayarCierreSesionCajaC12 === "function" ? listarEstacionesA10.ensayarCierreSesionCajaC12 : null;
  const finalizarCierreSesionCajaA10 = typeof listarEstacionesA10?.finalizarCierreSesionCajaA10 === "function" ? listarEstacionesA10.finalizarCierreSesionCajaA10 : null;
  const reabrirCierreProvisionalA10 = typeof listarEstacionesA10?.reabrirCierreProvisionalA10 === "function" ? listarEstacionesA10.reabrirCierreProvisionalA10 : null;
  const consultarCierreCajaA10 = typeof listarEstacionesA10?.consultarCierreCajaA10 === "function" ? listarEstacionesA10.consultarCierreCajaA10 : null;
  const registrarDiferenciaCajaA10 = typeof listarEstacionesA10?.registrarDiferenciaCajaA10 === "function" ? listarEstacionesA10.registrarDiferenciaCajaA10 : null;
  const decidirDiferenciaCajaA10 = typeof listarEstacionesA10?.decidirDiferenciaCajaA10 === "function" ? listarEstacionesA10.decidirDiferenciaCajaA10 : null;
  const [estaciones, setEstaciones] = (0, import_react4.useState)([]);
  const [rutas, setRutas] = (0, import_react4.useState)([]);
  const [comandas, setComandas] = (0, import_react4.useState)([]);
  const [estacionId, setEstacionId] = (0, import_react4.useState)("");
  const [codigo, setCodigo] = (0, import_react4.useState)("");
  const [nombre, setNombre] = (0, import_react4.useState)("");
  const [tipo, setTipo] = (0, import_react4.useState)("COCINA");
  const [productoId, setProductoId] = (0, import_react4.useState)("");
  const [prioridad, setPrioridad] = (0, import_react4.useState)("1");
  const [notas, setNotas] = (0, import_react4.useState)({});
  const [cargando, setCargando] = (0, import_react4.useState)(false);
  const [procesando, setProcesando] = (0, import_react4.useState)("");
  const [error, setError] = (0, import_react4.useState)("");
  const [mensaje, setMensaje] = (0, import_react4.useState)("");
  const [requiereApertura, setRequiereApertura] = (0, import_react4.useState)(false);
  const [fondoInicial, setFondoInicial] = (0, import_react4.useState)("0");
  const [sesionCajaC01, setSesionCajaC01] = (0, import_react4.useState)(null);
  const [responsableCajaC01, setResponsableCajaC01] = (0, import_react4.useState)("");
  const [motivoRelevoC01, setMotivoRelevoC01] = (0, import_react4.useState)("");
  const [terminalCajaC01, setTerminalCajaC01] = (0, import_react4.useState)("");
  const [motivoDesvinculoC01, setMotivoDesvinculoC01] = (0, import_react4.useState)("");
  const [efectivoContado, setEfectivoContado] = (0, import_react4.useState)("0");
  const [estadoCierre, setEstadoCierre] = (0, import_react4.useState)("ABIERTA");
  const [arqueoPrevio, setArqueoPrevio] = (0, import_react4.useState)(null);
  const [motivoReapertura, setMotivoReapertura] = (0, import_react4.useState)("");
  const [puedeReabrirCierre, setPuedeReabrirCierre] = (0, import_react4.useState)(null);
  (0, import_react4.useEffect)(() => {
    let activo = true;
    setPuedeReabrirCierre(null);
    if (!configEmpresa?.id || !local?.id || !rolPerfil) return void 0;
    (async () => {
      try {
        const d2 = await configRpc("abc_obtener_capacidades_rol", { p_empresa_id: configEmpresa.id, p_local_id: local.id });
        const fila = (d2?.capacidades || []).find((c3) => c3.capacidad === "ABC_CIERRE_REABRIR");
        const celda = fila ? (fila.roles || []).find((r2) => r2.rol === rolPerfil) : null;
        if (activo) setPuedeReabrirCierre(celda ? celda.efectivo === true : false);
      } catch (e2) {
        if (activo) setPuedeReabrirCierre(null);
      }
    })();
    return () => {
      activo = false;
    };
  }, [configEmpresa?.id, local?.id, rolPerfil]);
  const [bloqueosCierre, setBloqueosCierre] = (0, import_react4.useState)([]);
  const [cierreInfo, setCierreInfo] = (0, import_react4.useState)(null);
  const [ensayoCierre, setEnsayoCierre] = (0, import_react4.useState)(null);
  const [motivoDiferencia, setMotivoDiferencia] = (0, import_react4.useState)("");
  const [motivoDecision, setMotivoDecision] = (0, import_react4.useState)("");
  const bloqueosDiferencia = Array.isArray(cierreInfo?.bloqueos) ? cierreInfo.bloqueos : [];

  const productosActivos = (productos || []).filter((producto) => producto && producto.activo !== false);
  const estacionSeleccionada = estaciones.find((estacion) => String(estacion.id) === String(estacionId)) || null;
  const nombreProducto = (id) => productos.find((producto) => String(producto.id) === String(id))?.nombre || id || "Producto";
  const nombreEstacion = (id) => estaciones.find((estacion) => String(estacion.id) === String(id))?.nombre || "Sin estación";
  const versionLinea = (linea) => Number(linea?.linea_version || linea?.snapshot?.linea_version || linea?.snapshot?.lineaVersion || 0);

  async function sincronizarCierre() {
    if (typeof consultarCierreCajaA10 !== "function") return null;
    const r2 = await consultarCierreCajaA10();
    if (!r2?.ok) return null;
    const estado = String(r2.sessionEstado || "");
    if (estado === "EN_CIERRE" || estado === "CIERRE_PROVISIONAL") {
      setEstadoCierre(estado);
      setArqueoPrevio(estado === "EN_CIERRE" && !r2.arqueoError ? r2.arqueoPrevio || null : null);
      if (r2.arqueoError) setError("No se pudo calcular el arqueo en el servidor: " + r2.arqueoError);
      if (estado !== "CIERRE_PROVISIONAL") {
        setCierreInfo(null);
        setEnsayoCierre(null);
      }
      else if (!r2.diferenciaError) setCierreInfo(infoCierreA10(r2));
    } else if (estado === "ABIERTA") {
      setEstadoCierre("ABIERTA");
      setArqueoPrevio(null);
      setCierreInfo(null);
      setEnsayoCierre(null);
    }
    return estado || null;
  }

  async function refrescarCierreInfo() {
    setEnsayoCierre(null);
    return sincronizarCierre();
  }

  async function refrescarSesionCajaC01() {
    if (typeof consultarSesionCajaC01 !== "function") return null;
    const resultado = await consultarSesionCajaC01();
    if (!resultado?.ok) {
      setSesionCajaC01(null);
      return null;
    }
    setSesionCajaC01(resultado);
    const activo = String(resultado.responsableActivo?.user_id || "");
    const siguienteResponsable = (resultado.responsables || []).find((responsable) => String(responsable.user_id) !== activo);
    setResponsableCajaC01((actual) => (resultado.responsables || []).some((responsable) => String(responsable.user_id) === String(actual) && String(actual) !== activo) ? actual : String(siguienteResponsable?.user_id || ""));
    const vinculados = new Set((resultado.terminalesVinculados || []).map((terminal) => String(terminal.terminal_id)));
    const siguienteTerminal = (resultado.terminales || []).find((terminal) => !vinculados.has(String(terminal.id)));
    setTerminalCajaC01((actual) => (resultado.terminales || []).some((terminal) => String(terminal.id) === String(actual) && !vinculados.has(String(actual))) ? actual : String(siguienteTerminal?.id || ""));
    return resultado;
  }

  async function refrescarEstaciones() {
    if (!local?.id || !configEmpresa?.id || typeof listarEstacionesA10 !== "function") return;
    setCargando(true);
    setError("");
    const estadoServidor = await sincronizarCierre();
    if (estadoServidor === "EN_CIERRE" || estadoServidor === "CIERRE_PROVISIONAL") {
      setCargando(false);
      setRequiereApertura(false);
      setEstaciones([]);
      setRutas([]);
      return;
    }
    const resultado = await listarEstacionesA10();
    setCargando(false);
    if (!resultado?.ok) {
      setRequiereApertura(String(resultado?.error || "").toLowerCase().includes("sesión de caja"));
      setError(resultado?.error || "No se pudieron cargar las estaciones.");
      return;
    }
    setRequiereApertura(false);
    const nuevas = Array.isArray(resultado.estaciones) ? resultado.estaciones : [];
    setEstaciones(nuevas);
    setRutas(Array.isArray(resultado.rutas) ? resultado.rutas : []);
    if (estacionId && !nuevas.some((estacion) => String(estacion.id) === String(estacionId))) setEstacionId("");
    await refrescarSesionCajaC01();
  }

  async function refrescarComandas() {
    if (typeof listarComandasA10 !== "function") return;
    setCargando(true);
    setError("");
    const resultado = await listarComandasA10(estacionId || null, 100);
    setCargando(false);
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudieron cargar las comandas.");
      return;
    }
    setComandas(Array.isArray(resultado.comandas) ? resultado.comandas : []);
  }

  (0, import_react4.useEffect)(() => {
    setEstaciones([]);
    setRutas([]);
    setComandas([]);
    setEstacionId("");
    setError("");
    setMensaje("");
    setSesionCajaC01(null);
    setResponsableCajaC01("");
    setMotivoRelevoC01("");
    setTerminalCajaC01("");
    setMotivoDesvinculoC01("");
    setEstadoCierre("ABIERTA");
    setArqueoPrevio(null);
    setMotivoReapertura("");
    setBloqueosCierre([]);
    setCierreInfo(null);
    setEnsayoCierre(null);
    setMotivoDiferencia("");
    setMotivoDecision("");
    refrescarEstaciones();
  }, [local?.id, configEmpresa?.id]);

  (0, import_react4.useEffect)(() => {
    if (local?.id && configEmpresa?.id) refrescarComandas();
  }, [estacionId, local?.id, configEmpresa?.id]);

  async function guardarEstacion() {
    if (procesando || typeof crearEstacionA10 !== "function") return;
    setProcesando("crear-estacion");
    setError("");
    setMensaje("");
    const resultado = await crearEstacionA10({ codigo, nombre, tipo });
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo crear la estación.");
      return;
    }
    setCodigo("");
    setNombre("");
    setMensaje("Estación creada por el contrato A10.");
    await refrescarEstaciones();
  }

  async function abrirSesion() {
    if (procesando || typeof abrirSesionCajaA10 !== "function") return;
    setProcesando("abrir-sesion");
    setError("");
    setMensaje("");
    const resultado = await abrirSesionCajaA10({ fondoInicial });
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo abrir la sesión de caja.");
      return;
    }
    setRequiereApertura(false);
    setEstadoCierre("ABIERTA");
    setArqueoPrevio(null);
    setBloqueosCierre([]);
    setMensaje(`Sesión de caja abierta en ${resultado.caja_nombre || "la caja principal"} con fondo inicial de €${Number(fondoInicial || 0).toFixed(2)}.`);
    await refrescarEstaciones();
    await refrescarComandas();
  }

  async function relevarResponsableC01() {
    if (procesando || typeof cambiarResponsableCajaC01 !== "function") return;
    if (!responsableCajaC01 || !motivoRelevoC01.trim()) {
      setError("Selecciona el nuevo responsable e indica el motivo del relevo.");
      return;
    }
    setProcesando("relevo-c01");
    setError("");
    setMensaje("");
    const resultado = await cambiarResponsableCajaC01(responsableCajaC01, motivoRelevoC01.trim());
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo registrar el relevo de caja.");
      return;
    }
    setMotivoRelevoC01("");
    setMensaje("Relevo de caja registrado con su responsable y motivo.");
    await refrescarSesionCajaC01();
  }

  async function vincularTerminalC01() {
    if (procesando || typeof vincularTerminalCajaC01 !== "function" || !terminalCajaC01) return;
    setProcesando("vincular-terminal-c01");
    setError("");
    setMensaje("");
    const resultado = await vincularTerminalCajaC01(terminalCajaC01);
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo vincular el terminal a la sesión.");
      return;
    }
    setMensaje("Terminal vinculado a la sesión de caja.");
    await refrescarSesionCajaC01();
  }

  async function desvincularTerminalC01(terminalId) {
    if (procesando || typeof desvincularTerminalCajaC01 !== "function") return;
    if (!motivoDesvinculoC01.trim()) {
      setError("Indica el motivo para desvincular el terminal auxiliar.");
      return;
    }
    setProcesando("desvincular-terminal-c01:" + terminalId);
    setError("");
    setMensaje("");
    const resultado = await desvincularTerminalCajaC01(terminalId, motivoDesvinculoC01.trim());
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo desvincular el terminal.");
      return;
    }
    setMotivoDesvinculoC01("");
    setMensaje("Terminal auxiliar desvinculado con motivo registrado.");
    await refrescarSesionCajaC01();
  }

  async function iniciarCierre() {
    if (procesando || typeof iniciarCierreSesionCajaA10 !== "function") return;
    setProcesando("iniciar-cierre");
    setError("");
    setMensaje("");
    const resultado = await iniciarCierreSesionCajaA10();
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo iniciar el cierre de la sesión.");
      return;
    }
    setEstadoCierre("EN_CIERRE");
    setMensaje("Cierre iniciado. Revisa el efectivo contado y confirma el cierre provisional.");
    await refrescarCierreInfo();
  }

  async function confirmarProvisional() {
    if (procesando || typeof confirmarCierreProvisionalA10 !== "function") return;
    const contado = Number(efectivoContado);
    if (!Number.isFinite(contado) || contado < 0) {
      setError("Escribe un efectivo contado igual o mayor que cero.");
      return;
    }
    setProcesando("cierre-provisional");
    setError("");
    setMensaje("");
    const resultado = await confirmarCierreProvisionalA10({ efectivoContado: contado });
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo confirmar el cierre provisional.");
      return;
    }
    setEstadoCierre("CIERRE_PROVISIONAL");
    setArqueoPrevio(null);
    setBloqueosCierre(Array.isArray(resultado.blockers) ? resultado.blockers : []);
    setMensaje(`Cierre provisional registrado: contado €${Number(resultado.counted_amount || contado).toFixed(2)}, esperado €${Number(resultado.expected_amount || 0).toFixed(2)}, diferencia €${Number(resultado.difference || 0).toFixed(2)}. ${Number(resultado.difference || 0) !== 0 ? "Hay una diferencia: registra su motivo antes de finalizar." : "Puedes finalizarlo o reabrirlo con motivo."}`);
    await refrescarCierreInfo();
  }

  async function ensayarCierre() {
    if (procesando || typeof ensayarCierreSesionCajaC12 !== "function") return;
    setProcesando("ensayar-cierre");
    setError("");
    setMensaje("");
    const resultado = await ensayarCierreSesionCajaC12();
    setProcesando("");
    if (!resultado?.ok) {
      setEnsayoCierre(null);
      setError(resultado?.error || "No se pudo ensayar el cierre.");
      return;
    }
    setEnsayoCierre(resultado);
    const estado = String(resultado.resultado || "");
    setMensaje(estado === "APTO_CIERRE" ? "Ensayo completado: la sesión está preparada para el cierre definitivo." : "Ensayo completado: resuelve los bloqueos indicados antes de finalizar.");
  }

  async function finalizarCierre() {
    if (procesando || typeof finalizarCierreSesionCajaA10 !== "function") return;
    setProcesando("finalizar-cierre");
    setError("");
    setMensaje("");
    const resultado = await finalizarCierreSesionCajaA10();
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo finalizar el cierre.");
      await refrescarCierreInfo();
      return;
    }
    setEstadoCierre("CERRADA_FINAL");
    setRequiereApertura(true);
    setBloqueosCierre([]);
    setEstaciones([]);
    setRutas([]);
    setComandas([]);
    setCierreInfo(null);
    setEnsayoCierre(null);
    setMotivoDiferencia("");
    setMotivoDecision("");
    setMensaje("Sesión cerrada definitivamente por el servidor. Para operar de nuevo, abre una nueva sesión.");
  }

  async function reabrirProvisional() {
    if (procesando || typeof reabrirCierreProvisionalA10 !== "function") return;
    if (!motivoReapertura.trim()) {
      setError("Indica el motivo para reabrir el cierre provisional.");
      return;
    }
    setProcesando("reabrir-cierre");
    setError("");
    setMensaje("");
    const resultado = await reabrirCierreProvisionalA10({ motivo: motivoReapertura });
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo reabrir el cierre provisional.");
      return;
    }
    setEstadoCierre("ABIERTA");
    setArqueoPrevio(null);
    setMotivoReapertura("");
    setBloqueosCierre([]);
    setCierreInfo(null);
    setEnsayoCierre(null);
    setMotivoDiferencia("");
    setMotivoDecision("");
    setMensaje("Cierre provisional reabierto. La sesión vuelve a estar disponible para operar.");
    await refrescarEstaciones();
    await refrescarComandas();
  }

  async function registrarDiferencia() {
    if (procesando || typeof registrarDiferenciaCajaA10 !== "function") return;
    if (!motivoDiferencia.trim()) {
      setError("Escribe el motivo de la diferencia de caja.");
      return;
    }
    setProcesando("registrar-diferencia");
    setError("");
    setMensaje("");
    const resultado = await registrarDiferenciaCajaA10({ motivo: motivoDiferencia.trim() });
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo registrar el motivo de la diferencia.");
      await refrescarCierreInfo();
      return;
    }
    setMotivoDiferencia("");
    setMensaje("Motivo de la diferencia registrado.");
    await refrescarCierreInfo();
  }

  async function decidirDiferencia(decision) {
    if (procesando || typeof decidirDiferenciaCajaA10 !== "function") return;
    if (!motivoDecision.trim()) {
      setError("Escribe el motivo de tu decisión.");
      return;
    }
    setProcesando("decidir-diferencia");
    setError("");
    setMensaje("");
    const resultado = await decidirDiferenciaCajaA10({ decision, motivo: motivoDecision.trim() });
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo registrar tu decisión.");
      await refrescarCierreInfo();
      return;
    }
    setMotivoDecision("");
    setMensaje(decision === "APROBAR" ? "Diferencia aprobada. Ya se puede finalizar el cierre." : "Diferencia rechazada. Reabre el cierre y vuelve a contar.");
    await refrescarCierreInfo();
  }

  async function cambiarActivo(estacion) {
    if (procesando || typeof actualizarEstacionA10 !== "function") return;
    setProcesando("estacion:" + estacion.id);
    setError("");
    setMensaje("");
    const resultado = await actualizarEstacionA10({ estacionId: estacion.id, nombre: estacion.nombre, tipo: estacion.tipo, activo: estacion.activo !== true, version: estacion.version });
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo actualizar la estación.");
      return;
    }
    setMensaje(estacion.activo === true ? "Estación desactivada." : "Estación activada.");
    await refrescarEstaciones();
  }

  async function guardarRuta() {
    if (procesando || typeof asignarProductoEstacionA10 !== "function") return;
    setProcesando("ruta");
    setError("");
    setMensaje("");
    const resultado = await asignarProductoEstacionA10({ productoId, estacionId: estacionId || estacionSeleccionada?.id, prioridad });
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "No se pudo asignar la ruta.");
      return;
    }
    setMensaje("Ruta de producto actualizada por el contrato A10.");
    await refrescarEstaciones();
  }

  async function ejecutarA10(clave, accion) {
    if (procesando) return;
    setProcesando(clave);
    setError("");
    setMensaje("");
    const resultado = await accion();
    setProcesando("");
    if (!resultado?.ok) {
      setError(resultado?.error || "La operación A10 no se pudo completar.");
      return;
    }
    setMensaje("Operación A10 confirmada por el servidor.");
    await refrescarComandas();
  }

  function renderEnsayoC12() {
    if (!ensayoCierre) return h3("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Ejecuta el ensayo C12 para comprobar efectivo, pagos, efectos y documentos sin modificar el cierre.");
    const informe = ensayoCierre.informe || {};
    const caja = informe.caja || {};
    const documentos = informe.documentos || {};
    const bloqueos = Array.isArray(informe.bloqueos) ? informe.bloqueos : [];
    const apto = ensayoCierre.resultado === "APTO_CIERRE";
    const etiquetaBloqueo = {
      CONTEO_FALTANTE: "Falta el conteo de efectivo.",
      DIFERENCIA_EFECTIVO: "El efectivo contado no coincide con el esperado.",
      PAGOS_PENDIENTES: "Hay pagos pendientes.",
      EFECTOS_PENDIENTES: "Hay efectos pendientes.",
      CONCILIACIONES_DOCUMENTALES_PENDIENTES: "Hay documentos de esta sesión pendientes de conciliación.",
      SESION_NO_REVISABLE: "La sesión ya no está en un estado revisable."
    };
    return h3("div", { className: "mb-3 p-2 rounded-lg", style: { background: apto ? C2.accentSoft : C2.redSoft || "#FCE8E6" }, "data-c12-ensayo": String(ensayoCierre.resultado || "") },
      h3("div", { className: "text-[12px] font-semibold mb-1", style: { color: apto ? C2.accent : C2.red } }, "Ensayo C12: ", String(ensayoCierre.resultado || "SIN_RESULTADO")),
      h3("div", { className: "text-[11px] mb-1" }, String(informe.explicacion || "El servidor no devolvió una explicación.")),
      h3("div", { className: "text-[11px]", style: { color: C2.inkSoft } },
        "Efectivo esperado €", Number(caja.expected_amount || 0).toFixed(2),
        " · contado €", Number(caja.counted_amount || 0).toFixed(2),
        " · diferencia €", Number(caja.difference || 0).toFixed(2),
        " · documentos conciliados ", Number(documentos.documentos_conciliados || 0),
        " · pendientes ", Number(documentos.documentos_pendientes || 0)
      ),
      bloqueos.length > 0 ? h3("ul", { className: "list-disc pl-4 text-[11px] mt-1" }, bloqueos.map((bloqueo) => h3("li", { key: String(bloqueo) }, etiquetaBloqueo[bloqueo] || String(bloqueo)))) : null
    );
  }

  function renderDiferencia() {
    const info = cierreInfo;
    if (!info || info.difference === null || info.difference === void 0 || Number(info.difference) === 0) return null;
    const registro = info.registro || null;
    const euros = (n2) => Number(n2).toFixed(2);
    const esPropietarioCierre = rolPerfil === "Propietario";
    const pideMotivo = !registro || bloqueosDiferencia.includes("DIFERENCIA_SIN_MOTIVO") || bloqueosDiferencia.includes("DIFERENCIA_CAMBIADA");
    return h3("div", { className: "mb-3 p-2 rounded-lg", style: { background: C2.redSoft || "#FCE8E6" }, "data-diferencia-caja": "1" },
      h3("div", { className: "text-[12px] font-semibold mb-1", style: { color: C2.red } }, "Diferencia de caja: €" + euros(info.difference) + " (contado €" + euros(info.counted) + ", esperado €" + euros(info.expected) + ")"),
      h3("div", { className: "text-[11px] mb-2", style: { color: C2.inkSoft } }, "Toda diferencia exige un motivo y queda en la auditoría. " + (info.requiereAprobacion ? "Esta supera el umbral de €" + euros(info.umbral) + ": la tiene que aprobar el Propietario." : "Esta no supera el umbral de €" + euros(info.umbral) + ": no necesita aprobación.")),
      pideMotivo ? h3("div", null,
        registro && bloqueosDiferencia.includes("DIFERENCIA_CAMBIADA") ? h3("div", { className: "text-[11px] mb-2", style: { color: C2.red } }, CIERRE_TEXTO_BLOQUEO.DIFERENCIA_CAMBIADA) : null,
        h3(Field, { label: "Motivo de la diferencia (obligatorio)" }, h3(Input, { value: motivoDiferencia, onChange: (e2) => setMotivoDiferencia(e2.target.value), placeholder: "Por qué no cuadra la caja…", maxLength: 500 })),
        h3(Btn, { small: true, onClick: registrarDiferencia, disabled: !!procesando || !motivoDiferencia.trim() }, procesando === "registrar-diferencia" ? "Registrando…" : "Registrar motivo")
      ) : h3("div", null,
        h3("div", { className: "text-[11.5px] mb-1" }, "Motivo registrado: «" + String(registro.motivo || "") + "»"),
        registro.estado === "APROBADA" ? h3("div", { className: "text-[11.5px]" }, "Aprobada por el Propietario: «" + String(registro.decision_motivo || "") + "». Ya se puede finalizar el cierre.") : null,
        registro.estado === "RECHAZADA" ? h3("div", { className: "text-[11.5px]", style: { color: C2.red } }, "Rechazada por el Propietario: «" + String(registro.decision_motivo || "") + "». " + CIERRE_TEXTO_BLOQUEO.DIFERENCIA_RECHAZADA) : null,
        registro.estado === "REGISTRADA" && !info.requiereAprobacion ? h3("div", { className: "text-[11.5px]" }, "Motivo guardado. Ya se puede finalizar el cierre.") : null,
        registro.estado === "REGISTRADA" && info.requiereAprobacion ? (esPropietarioCierre ? h3("div", null,
          h3(Field, { label: "Motivo de tu decisión (obligatorio)" }, h3(Input, { value: motivoDecision, onChange: (e2) => setMotivoDecision(e2.target.value), placeholder: "Por qué apruebas o rechazas…", maxLength: 500 })),
          h3("div", { className: "flex gap-2 flex-wrap" },
            h3(Btn, { small: true, onClick: () => decidirDiferencia("APROBAR"), disabled: !!procesando || !motivoDecision.trim() }, procesando === "decidir-diferencia" ? "Guardando…" : "Aprobar diferencia"),
            h3(Btn, { small: true, variant: "danger", onClick: () => decidirDiferencia("RECHAZAR"), disabled: !!procesando || !motivoDecision.trim() }, "Rechazar diferencia")
          )
        ) : h3("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, "Pendiente de aprobación del Propietario. El cierre no se puede finalizar hasta entonces.")) : null
      )
    );
  }

  function renderComanda(comanda) {
    const lineas = Array.isArray(comanda?.lineas) ? comanda.lineas : [];
    return h3(Card, { key: comanda.id, className: "mb-2" },
      h3("div", { className: "flex items-center justify-between gap-2 mb-2" },
        h3("div", { className: "text-[12.5px] font-semibold" }, String(comanda.tipo || "COMANDA"), " · ", nombreEstacion(comanda.estacion_id)),
        h3("span", { className: "text-[10.5px] font-semibold", style: { color: comanda.estado === "BLOQUEADA" ? C2.red : C2.accent } }, String(comanda.estado || "PENDIENTE"))
      ),
      h3("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, "Pedido ", String(comanda.pedido_id || "").slice(-12), " · ", comanda.created_at || "sin fecha"),
      lineas.map((linea) => {
        const nota = notas[linea.id] || "";
        const version = versionLinea(linea);
        return h3("div", { key: linea.id, className: "py-2", style: { borderTop: "1px solid " + C2.line } },
          h3("div", { className: "flex items-center justify-between gap-2" },
            h3("div", { className: "text-[12px] font-medium" }, nombreProducto(linea.producto_id), " · ", String(linea.cantidad)),
            h3("span", { className: "text-[10px]", style: { color: C2.inkSoft } }, String(linea.accion || "ALTA"))
          ),
          linea.nota ? h3("div", { className: "text-[11px] mt-1", style: { color: C2.inkSoft } }, "Nota: ", linea.nota) : null,
          linea.decision_merma === "PENDIENTE" ? h3("div", { className: "mt-2 p-2 rounded-lg", style: { background: C2.amberSoft } },
            h3("div", { className: "text-[11px] font-semibold mb-1" }, "Decisión de merma pendiente"),
            h3("div", { className: "flex gap-1.5 flex-wrap" },
              h3(Btn, { small: true, onClick: () => ejecutarA10("merma:" + linea.id, () => resolverMermaComandaA10({ comandaLineaId: linea.id, decision: "MERMA_CONFIRMADA" })) }, "Confirmar merma"),
              h3(Btn, { small: true, variant: "ghost", onClick: () => ejecutarA10("no-merma:" + linea.id, () => resolverMermaComandaA10({ comandaLineaId: linea.id, decision: "NO_MERMA" })) }, "No es merma")
            )
          ) : null,
          h3("div", { className: "flex gap-1.5 flex-wrap mt-2" },
            h3(Btn, { small: true, onClick: () => ejecutarA10("reprint:" + comanda.id, () => reimprimirComandaA10(comanda.id)) }, "Reimprimir"),
            version > 0 ? h3(Btn, { small: true, variant: "ghost", onClick: () => ejecutarA10("change:" + linea.id, () => enviarCambioComandaA10({ lineaId: linea.linea_id, nota, lineaVersion: version })), disabled: !nota.trim() }, "Enviar cambio") : null
          ),
          version > 0 ? h3(Input, { value: nota, onChange: (e2) => setNotas((prev) => ({ ...prev, [linea.id]: e2.target.value })), placeholder: "Nota operativa para cocina…", maxLength: 500 }) : null
        );
      }),
      lineas.length === 0 ? h3("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "La comanda no contiene líneas visibles.") : null
    );
  }

  const responsableActivoC01 = (sesionCajaC01?.responsables || []).find((responsable) => String(responsable.user_id) === String(sesionCajaC01?.responsableActivo?.user_id || "")) || null;
  const terminalesVinculadosC01 = Array.isArray(sesionCajaC01?.terminalesVinculados) ? sesionCajaC01.terminalesVinculados : [];
  const idsTerminalesVinculadosC01 = new Set(terminalesVinculadosC01.map((terminal) => String(terminal.terminal_id)));
  const terminalesDisponiblesC01 = (sesionCajaC01?.terminales || []).filter((terminal) => !idsTerminalesVinculadosC01.has(String(terminal.id)));

  if (!local?.id || !configEmpresa?.id) {
    return h3(Card, { className: "p-5" }, h3("div", { className: "text-[16px] font-semibold mb-2" }, "Cocina y comandas A10"), h3("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "Selecciona un local concreto para consultar estaciones y comandas."));
  }

  return h3("div", null,
    h3("div", { className: "flex items-center justify-between mb-3" }, h3("h2", { className: "text-[16px] font-semibold" }, "Cocina y comandas A10"), h3(Btn, { small: true, variant: "ghost", onClick: () => { refrescarEstaciones(); refrescarComandas(); }, disabled: !!procesando || cargando }, cargando ? "Actualizando…" : "Actualizar")),
    h3(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, h3("div", { className: "text-[12px]" }, "A10 enruta comandas por estación mediante RPC y outbox. ", h3("b", null, "No mueve stock, no cobra ni emite fiscalidad."))),
    error ? h3("div", { role: "alert", className: "text-[12px] mb-3 p-2 rounded-lg", style: { background: "#FCE8E6", color: C2.red } }, "⚠ ", error) : null,
    mensaje ? h3("div", { className: "text-[12px] mb-3 p-2 rounded-lg", style: { background: C2.accentSoft } }, mensaje) : null,
    requiereApertura ? h3(Card, { className: "mb-4", style: { background: C2.redSoft || "#FCE8E6", border: "none" } },
      h3("div", { className: "text-[12.5px] font-semibold mb-1" }, "Abrir sesión de caja"),
      h3("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Este terminal necesita una sesión abierta para crear estaciones y recibir comandas. La apertura queda registrada por el servidor; no genera una venta."),
      h3(Field, { label: "Fondo inicial (€)" }, h3(Input, { type: "number", min: "0", step: "0.01", value: fondoInicial, onChange: (e2) => setFondoInicial(e2.target.value) })),
      h3(Btn, { small: true, onClick: abrirSesion, disabled: !!procesando || !String(fondoInicial).trim() }, procesando === "abrir-sesion" ? "Abriendo…" : "Abrir sesión")
    ) : null,
    !requiereApertura && estadoCierre === "ABIERTA" && sesionCajaC01 ? h3(Card, { className: "mb-4", "data-c01-sesion": "1" },
      h3("div", { className: "text-[12.5px] font-semibold mb-1" }, "Sesión, responsable y terminales"),
      h3("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Sesión ", String(sesionCajaC01.sesion?.id || "").slice(-8), " · ", String(sesionCajaC01.sesion?.estado || "ABIERTA"), " · Responsable: ", responsableActivoC01?.nombre || "Usuario activo"),
      sesionCajaC01.responsablesError ? h3("div", { className: "text-[11px] mb-2", style: { color: C2.amber } }, "No se pudo cargar la lista de responsables: ", sesionCajaC01.responsablesError) : null,
      (sesionCajaC01.responsables || []).length > 1 ? h3("div", { className: "mb-3" },
        h3("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2" },
          h3(Field, { label: "Nuevo responsable" }, h3("select", { value: responsableCajaC01, onChange: (e2) => setResponsableCajaC01(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } }, h3("option", { value: "" }, "Selecciona…"), (sesionCajaC01.responsables || []).filter((responsable) => String(responsable.user_id) !== String(sesionCajaC01.responsableActivo?.user_id || "")).map((responsable) => h3("option", { key: responsable.user_id, value: responsable.user_id }, responsable.nombre || "Usuario", " · ", responsable.rol || "")))),
          h3(Field, { label: "Motivo del relevo" }, h3(Input, { value: motivoRelevoC01, onChange: (e2) => setMotivoRelevoC01(e2.target.value), placeholder: "Cambio de turno…", maxLength: 500 }))
        ),
        h3(Btn, { small: true, onClick: relevarResponsableC01, disabled: !!procesando || !responsableCajaC01 || !motivoRelevoC01.trim() }, procesando === "relevo-c01" ? "Registrando…" : "Registrar relevo")
      ) : null,
      h3("div", { className: "text-[11.5px] font-semibold mb-1" }, "Terminales vinculados"),
      h3("div", { className: "space-y-1 mb-3" }, terminalesVinculadosC01.map((terminal) => h3("div", { key: terminal.terminal_id, className: "flex items-center justify-between gap-2" }, h3("span", { className: "text-[11px]" }, terminal.nombre, String(terminal.terminal_id) === String(sesionCajaC01.terminalActualId) ? " · este terminal" : " · auxiliar"), String(terminal.terminal_id) === String(sesionCajaC01.terminalActualId) ? null : h3(Btn, { small: true, variant: "ghost", onClick: () => desvincularTerminalC01(terminal.terminal_id), disabled: !!procesando || !motivoDesvinculoC01.trim() }, procesando === "desvincular-terminal-c01:" + terminal.terminal_id ? "Desvinculando…" : "Desvincular")))),
      terminalesVinculadosC01.some((terminal) => String(terminal.terminal_id) !== String(sesionCajaC01.terminalActualId)) ? h3(Field, { label: "Motivo para desvincular un terminal auxiliar" }, h3(Input, { value: motivoDesvinculoC01, onChange: (e2) => setMotivoDesvinculoC01(e2.target.value), placeholder: "Fin de apoyo…", maxLength: 500 })) : null,
      terminalesDisponiblesC01.length > 0 ? h3("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2 items-end" },
        h3(Field, { label: "Añadir terminal a esta sesión" }, h3("select", { value: terminalCajaC01, onChange: (e2) => setTerminalCajaC01(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } }, terminalesDisponiblesC01.map((terminal) => h3("option", { key: terminal.id, value: terminal.id }, terminal.nombre || "Terminal")))),
        h3(Btn, { small: true, onClick: vincularTerminalC01, disabled: !!procesando || !terminalCajaC01 }, procesando === "vincular-terminal-c01" ? "Vinculando…" : "Vincular terminal")
      ) : h3("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "No hay otros terminales activos disponibles en este local.")
    ) : null,
    !requiereApertura && iniciarCierreSesionCajaA10 ? h3(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } },
      h3("div", { className: "text-[12.5px] font-semibold mb-1" }, "Cierre de sesión de caja · ", estadoCierre),
      estadoCierre === "ABIERTA" ? h3("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Inicia el cierre cuando dejes de operar. El servidor comprobará los pagos y efectos pendientes antes de permitir el cierre provisional.") : null,
      estadoCierre === "EN_CIERRE" ? h3("div", null,
        h3("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Introduce el efectivo contado para registrar el arqueo provisional. Todavía podrás reabrirlo con un motivo."),
        arqueoPrevio ? h3("div", { className: "text-[11.5px] mb-3 p-2 rounded-lg", style: { background: C2.accentSoft } },
          "Esperado por el servidor: €", Number(arqueoPrevio.expected_amount).toFixed(2),
          " · Fondo €", Number(arqueoPrevio.fondo_inicial).toFixed(2),
          " + Entradas €", Number(arqueoPrevio.entradas_efectivo).toFixed(2),
          " − Salidas €", Number(arqueoPrevio.salidas_efectivo).toFixed(2),
          ". Se recalculará al confirmar."
        ) : h3("div", { className: "text-[11.5px] mb-3", role: "status" }, "Calculando el efectivo esperado en el servidor…"),
        h3(Field, { label: "Efectivo contado (€)" }, h3(Input, { type: "number", min: "0", step: "0.01", value: efectivoContado, onChange: (e2) => setEfectivoContado(e2.target.value) })),
        h3(Btn, { small: true, onClick: confirmarProvisional, disabled: !!procesando || !arqueoPrevio || !String(efectivoContado).trim() }, procesando === "cierre-provisional" ? "Registrando…" : "Confirmar cierre provisional")
      ) : null,
      estadoCierre === "ABIERTA" ? h3(Btn, { small: true, variant: "danger", onClick: iniciarCierre, disabled: !!procesando }, procesando === "iniciar-cierre" ? "Iniciando…" : "Iniciar cierre") : null,
      estadoCierre === "CIERRE_PROVISIONAL" ? h3("div", null,
        h3("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "El cierre provisional está registrado. Finalízalo cuando no queden bloqueos o reábrelo para corregir la sesión."),
        renderDiferencia(),
        ensayarCierreSesionCajaC12 ? h3("div", { className: "mb-3" },
          h3(Btn, { small: true, variant: "ghost", onClick: ensayarCierre, disabled: !!procesando }, procesando === "ensayar-cierre" ? "Ensayando…" : ensayoCierre ? "Repetir ensayo C12" : "Ensayar cierre C12"),
          renderEnsayoC12()
        ) : null,
        bloqueosCierre.length > 0 ? h3("div", { className: "mb-3 p-2 rounded-lg", style: { background: C2.redSoft || "#FCE8E6", color: C2.red } },
          h3("div", { className: "text-[11.5px] font-semibold mb-1" }, "Bloqueos que impiden el cierre definitivo"),
          h3("ul", { className: "list-disc pl-4 text-[11px]" }, bloqueosCierre.map((bloqueo, indice) => h3("li", { key: String(bloqueo?.tipo || bloqueo?.codigo || indice) }, String(bloqueo?.detalle || bloqueo?.tipo || bloqueo?.codigo || "Pendiente operativo"))))
        ) : null,
        h3("div", { className: "flex gap-2 flex-wrap" },
          h3(Btn, { small: true, variant: "danger", onClick: finalizarCierre, disabled: !!procesando || bloqueosDiferencia.length > 0 }, procesando === "finalizar-cierre" ? "Finalizando…" : "Finalizar cierre"),
          puedeReabrirCierre === false ? h3("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, "Solo el Propietario (o quien él autorice en Configuración) puede reabrir un cierre provisional.") : null,
          puedeReabrirCierre === false ? null : h3(Field, { label: "Motivo de reapertura" }, h3(Input, { value: motivoReapertura, onChange: (e2) => setMotivoReapertura(e2.target.value), placeholder: "Ajuste de arqueo…", maxLength: 500 })),
          puedeReabrirCierre === false ? null : h3(Btn, { small: true, variant: "ghost", onClick: reabrirProvisional, disabled: !!procesando || !motivoReapertura.trim() }, procesando === "reabrir-cierre" ? "Reabriendo…" : "Reabrir cierre provisional")
        )
      ) : null
    ) : null,
    h3(Card, { className: "mb-4" },
      h3("div", { className: "text-[12.5px] font-semibold mb-2" }, "Estaciones y rutas"),
      h3("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2" },
        h3(Field, { label: "Código" }, h3(Input, { value: codigo, onChange: (e2) => setCodigo(e2.target.value), placeholder: "COCINA" })),
        h3(Field, { label: "Nombre" }, h3(Input, { value: nombre, onChange: (e2) => setNombre(e2.target.value), placeholder: "Cocina principal" })),
        h3(Field, { label: "Tipo" }, h3("select", { value: tipo, onChange: (e2) => setTipo(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } }, ["COCINA", "CHURRERIA", "BARRA", "BEBIDAS", "OTRO"].map((valor) => h3("option", { key: valor, value: valor }, valor))))
      ),
      h3(Btn, { small: true, onClick: guardarEstacion, disabled: !!procesando || !codigo.trim() || !nombre.trim() }, procesando === "crear-estacion" ? "Creando…" : "Crear estación"),
      h3("div", { className: "mt-3 space-y-1.5" }, estaciones.length === 0 ? h3("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "No hay estaciones configuradas todavía.") : estaciones.map((estacion) => h3("div", { key: estacion.id, className: "flex items-center justify-between gap-2 p-2 rounded-lg", style: { border: "1px solid " + C2.line, opacity: estacion.activo ? 1 : 0.6 } }, h3("div", null, h3("div", { className: "text-[11.5px] font-semibold" }, estacion.codigo, " · ", estacion.nombre), h3("div", { className: "text-[10px]", style: { color: C2.inkSoft } }, estacion.tipo, " · ", rutas.filter((ruta) => String(ruta.estacion_id) === String(estacion.id)).length, " ruta(s)")), h3(Btn, { small: true, variant: "ghost", onClick: () => cambiarActivo(estacion), disabled: !!procesando }, estacion.activo ? "Desactivar" : "Activar"))))
    ),
    h3(Card, { className: "mb-4" },
      h3("div", { className: "text-[12.5px] font-semibold mb-2" }, "Asignar producto a estación"),
      h3("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2" },
        h3(Field, { label: "Producto" }, h3("select", { value: productoId, onChange: (e2) => setProductoId(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } }, h3("option", { value: "" }, "Selecciona…"), productosActivos.map((producto) => h3("option", { key: producto.id, value: producto.id }, producto.nombre)))),
        h3(Field, { label: "Estación" }, h3("select", { value: estacionId, onChange: (e2) => setEstacionId(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } }, h3("option", { value: "" }, "Selecciona…"), estaciones.filter((estacion) => estacion.activo !== false).map((estacion) => h3("option", { key: estacion.id, value: estacion.id }, estacion.codigo, " · ", estacion.nombre)))),
        h3(Field, { label: "Prioridad" }, h3(Input, { type: "number", min: "1", max: "100", step: "1", value: prioridad, onChange: (e2) => setPrioridad(e2.target.value) }))
      ),
      h3(Btn, { small: true, onClick: guardarRuta, disabled: !!procesando || !productoId || !estacionId }, procesando === "ruta" ? "Guardando…" : "Guardar ruta")
    ),
    h3(Card, { className: "mb-3" }, h3("div", { className: "flex items-center justify-between gap-2 mb-2" }, h3("div", { className: "text-[12.5px] font-semibold" }, "Comandas"), h3("select", { value: estacionId, onChange: (e2) => setEstacionId(e2.target.value), className: "rounded-lg px-2 py-1 text-[11px]", style: { border: "1px solid " + C2.line, background: C2.surface, color: C2.ink } }, h3("option", { value: "" }, "Todas las estaciones"), estaciones.map((estacion) => h3("option", { key: estacion.id, value: estacion.id }, estacion.codigo)))), h3("div", { className: "text-[10.5px] mb-2", style: { color: C2.inkSoft } }, "La lista procede de abc_listar_comandas_estacion y respeta el local activo."), comandas.length === 0 ? h3("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, "No hay comandas para este filtro.") : comandas.map(renderComanda))
  );
}
function Traspasos({ productos, productosEmpresa = [], locales = [], localActivoId, traspasos, traspasarStock, traspasarEntreLocales, pisoVentaBajo, fichasCosto = [] }) {
  const h3 = import_react4.default.createElement;
  const selectStyle = { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink };
  function selectNode(props, options) {
    return h3("select", { ...props, className: "w-full rounded-lg px-3 py-2 text-[13px]", style: selectStyle }, options);
  }
  const [verTodos, setVerTodos] = (0, import_react4.useState)(false);
  const vendibles = (0, import_react4.useMemo)(() => {
    if (verTodos) return productos;
    const idsDeFichas = new Set(fichasCosto.map((f22) => f22.productoVinculadoId).filter(Boolean));
    return productos.filter((p22) => p22.tipo === "elaborado" || Number(p22.precioVenta) > 0 || idsDeFichas.has(p22.id) || Number(p22.stockPisoVenta) > 0);
  }, [productos, fichasCosto, verTodos]);
  const [productoId, setProductoId] = (0, import_react4.useState)(vendibles[0]?.id || "");
  const [cantidad, setCantidad] = (0, import_react4.useState)("");
  const [direccion, setDireccion] = (0, import_react4.useState)("a_piso");
  const [error, setError] = (0, import_react4.useState)("");
  const [ok, setOk] = (0, import_react4.useState)("");
  (0, import_react4.useEffect)(() => {
    if (vendibles.length > 0 && !vendibles.some((p22) => p22.id === productoId)) setProductoId(vendibles[0].id);
  }, [vendibles, productoId]);
  const producto = productos.find((p22) => p22.id === productoId);
  const enPiso = producto ? Number(producto.stockPisoVenta) || 0 : 0;
  const enAlmacen = producto ? Math.max(0, (Number(producto.stock) || 0) - enPiso) : 0;
  async function submit() {
    const res = await traspasarStock(productoId, cantidad, direccion);
    if (!res || !res.ok) {
      setError(res?.error || "No se pudo completar el traspaso.");
      setOk("");
      return;
    }
    setError("");
    setOk(`Traspasado ${fmt(Number(cantidad))} ${producto?.unidad || ""} ${direccion === "a_piso" ? "al piso de venta" : "al almac\xE9n"}.`);
    setCantidad("");
  }
  const destinos = locales.filter((l22) => l22.id !== localActivoId && l22.activo !== false && !l22.fusionadoEn);
  const [destinoLocalId, setDestinoLocalId] = (0, import_react4.useState)(destinos[0]?.id || "");
  const [productoOrigenInterId, setProductoOrigenInterId] = (0, import_react4.useState)(productos[0]?.id || "");
  const [productoDestinoInterId, setProductoDestinoInterId] = (0, import_react4.useState)("");
  const [cantidadInter, setCantidadInter] = (0, import_react4.useState)("");
  const [errorInter, setErrorInter] = (0, import_react4.useState)("");
  const [okInter, setOkInter] = (0, import_react4.useState)("");
  (0, import_react4.useEffect)(() => {
    if (destinos.length && !destinos.some((l22) => l22.id === destinoLocalId)) setDestinoLocalId(destinos[0].id);
    if (!destinos.length && destinoLocalId) setDestinoLocalId("");
  }, [localActivoId, locales, destinoLocalId]);
  (0, import_react4.useEffect)(() => {
    if (productos.length && !productos.some((p22) => p22.id === productoOrigenInterId)) setProductoOrigenInterId(productos[0].id);
  }, [productos, productoOrigenInterId]);
  const productoOrigenInter = productos.find((p22) => p22.id === productoOrigenInterId);
  const unidadOrigen = String(productoOrigenInter?.unidad || "").trim().toLowerCase();
  const productosDestino = productosEmpresa.filter((p22) => p22.localId === destinoLocalId && p22.activo !== false && !p22.fusionadoEnId && !p22.fusionadoEn && String(p22.unidad || "").trim().toLowerCase() === unidadOrigen);
  (0, import_react4.useEffect)(() => {
    if (productosDestino.length && !productosDestino.some((p22) => p22.id === productoDestinoInterId)) setProductoDestinoInterId(productosDestino[0].id);
    if (!productosDestino.length && productoDestinoInterId) setProductoDestinoInterId("");
  }, [destinoLocalId, productoOrigenInterId, productosEmpresa, productoDestinoInterId]);
  const localOrigen = locales.find((l22) => l22.id === localActivoId);
  const localDestino = locales.find((l22) => l22.id === destinoLocalId);
  const disponibleInter = productoOrigenInter ? Math.max(0, (Number(productoOrigenInter.stock) || 0) - (Number(productoOrigenInter.stockPisoVenta) || 0)) : 0;
  async function submitEntreLocales() {
    const res = await traspasarEntreLocales(productoOrigenInterId, productoDestinoInterId, destinoLocalId, cantidadInter);
    if (!res || !res.ok) {
      setErrorInter(res?.error || "No se pudo completar el traspaso entre locales.");
      setOkInter("");
      return;
    }
    setErrorInter("");
    setOkInter(`Traspaso completado: ${fmt(Number(cantidadInter))} ${productoOrigenInter?.unidad || ""} \xB7 ${localOrigen?.nombre || "Origen"} \u2192 ${localDestino?.nombre || "Destino"}.`);
    setCantidadInter("");
  }
  const productoOptions = vendibles.map((p22) => h3("option", { key: p22.id, value: p22.id }, p22.nombre));
  const direccionOptions = [
    h3("option", { key: "a_piso", value: "a_piso" }, "Almac\xE9n \u2192 Piso de venta"),
    h3("option", { key: "a_almacen", value: "a_almacen" }, "Piso de venta \u2192 Almac\xE9n")
  ];
  const destinoOptions = destinos.map((l22) => h3("option", { key: l22.id, value: l22.id }, l22.nombre));
  const origenOptions = productos.filter((p22) => p22.activo !== false && !p22.fusionadoEnId && !p22.fusionadoEn).map((p22) => h3("option", { key: p22.id, value: p22.id }, `${p22.nombre} \xB7 ${fmt(Math.max(0, (Number(p22.stock) || 0) - (Number(p22.stockPisoVenta) || 0)))} ${p22.unidad || ""} almac\xE9n`));
  const receptorOptions = productosDestino.map((p22) => h3("option", { key: p22.id, value: p22.id }, `${p22.nombre} \xB7 ${p22.unidad || ""}`));
  let internoBody;
  if (vendibles.length === 0) {
    internoBody = h3(Empty, { text: "No hay productos disponibles para traspasar." });
  } else {
    internoBody = h3(
      import_react4.default.Fragment,
      null,
      h3(Field, { label: "Producto" }, selectNode({
        value: productoId,
        onChange: (e2) => {
          setProductoId(e2.target.value);
          setError("");
          setOk("");
        }
      }, productoOptions)),
      h3("button", { type: "button", onClick: () => setVerTodos((x3) => !x3), className: "text-[11.5px] font-medium mb-3", style: { color: C2.accent } }, verTodos ? "Mostrar solo productos de venta" : "Mostrar todos los productos"),
      producto && h3(
        "div",
        { className: "grid grid-cols-2 gap-2 mb-3 text-[12px]" },
        h3("div", { className: "p-2 rounded-lg", style: { background: C2.surfaceSoft } }, h3("div", { style: { color: C2.inkSoft } }, "En almac\xE9n"), h3("b", { className: "mono" }, fmt(enAlmacen), " ", producto.unidad)),
        h3("div", { className: "p-2 rounded-lg", style: { background: C2.surfaceSoft } }, h3("div", { style: { color: C2.inkSoft } }, "En piso"), h3("b", { className: "mono" }, fmt(enPiso), " ", producto.unidad))
      ),
      h3(Field, { label: "Direcci\xF3n" }, selectNode({ value: direccion, onChange: (e2) => setDireccion(e2.target.value) }, direccionOptions)),
      h3(Field, { label: `Cantidad${producto?.unidad ? ` (${producto.unidad})` : ""}` }, h3(Input, { type: "number", min: "0", step: "any", value: cantidad, onChange: (e2) => setCantidad(e2.target.value), placeholder: "0" })),
      error && h3("div", { className: "text-[12px] mb-2", style: { color: C2.red } }, error),
      ok && h3("div", { className: "text-[12px] mb-2", style: { color: C2.green } }, ok),
      h3(Btn, { onClick: submit }, "Confirmar movimiento")
    );
  }
  let interBody;
  if (destinos.length === 0) {
    interBody = h3(Empty, { text: "Esta empresa no tiene otro local activo disponible." });
  } else if (productos.length === 0) {
    interBody = h3(Empty, { text: "No hay productos en el local de origen." });
  } else {
    const receptorNode = productosDestino.length ? selectNode({ value: productoDestinoInterId, onChange: (e2) => setProductoDestinoInterId(e2.target.value) }, receptorOptions) : h3("div", { className: "text-[12px] p-2 rounded-lg", style: { background: C2.amberSoft, color: C2.ink } }, "El destino no tiene un producto activo con la misma unidad. Cr\xE9alo primero en Productos para evitar asignaciones equivocadas.");
    interBody = h3(
      import_react4.default.Fragment,
      null,
      h3(Field, { label: "Local origen" }, h3("div", { className: "rounded-lg px-3 py-2 text-[13px]", style: { background: C2.surfaceSoft } }, localOrigen?.nombre || "Local activo")),
      h3(Field, { label: "Local destino" }, selectNode({
        value: destinoLocalId,
        onChange: (e2) => {
          setDestinoLocalId(e2.target.value);
          setProductoDestinoInterId("");
          setErrorInter("");
          setOkInter("");
        }
      }, destinoOptions)),
      h3(Field, { label: "Producto que sale" }, selectNode({
        value: productoOrigenInterId,
        onChange: (e2) => {
          setProductoOrigenInterId(e2.target.value);
          setProductoDestinoInterId("");
          setErrorInter("");
        }
      }, origenOptions)),
      h3(Field, { label: "Producto que recibe" }, receptorNode),
      productoOrigenInter && h3("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Disponible en almac\xE9n de origen: ", h3("b", { className: "mono" }, fmt(disponibleInter), " ", productoOrigenInter.unidad || ""), Number(productoOrigenInter.deficitPendiente) > 0 ? " \xB7 D\xE9ficit pendiente: bloqueado" : ""),
      h3(Field, { label: `Cantidad${productoOrigenInter?.unidad ? ` (${productoOrigenInter.unidad})` : ""}` }, h3(Input, { type: "number", min: "0", step: "any", value: cantidadInter, onChange: (e2) => setCantidadInter(e2.target.value), placeholder: "0" })),
      errorInter && h3("div", { className: "text-[12px] mb-2", style: { color: C2.red } }, errorInter),
      okInter && h3("div", { className: "text-[12px] mb-2", style: { color: C2.green } }, okInter),
      h3(Btn, { onClick: submitEntreLocales, disabled: !productoDestinoInterId }, "Confirmar traspaso entre locales")
    );
  }
  const historial = (traspasos || []).slice(0, 60);
  let historialBody;
  if (historial.length === 0) {
    historialBody = h3(Empty, { text: "Todav\xEDa no hay traspasos en este local." });
  } else {
    historialBody = h3("div", { className: "space-y-2" }, historial.map((t22) => {
      const entre = t22.tipo === "ENTRE_LOCALES";
      const sale = entre && t22.origenLocalId === localActivoId;
      const titulo = entre ? `${t22.origenLocalNombre || "Origen"} \u2192 ${t22.destinoLocalNombre || "Destino"}` : t22.direccion === "a_piso" ? "Almac\xE9n \u2192 Piso de venta" : "Piso de venta \u2192 Almac\xE9n";
      const detalle = entre ? `${sale ? "Salida" : "Entrada"} \xB7 ${t22.productoOrigenNombre || "Producto"} \u2192 ${t22.productoDestinoNombre || "Producto"}` : t22.nombre;
      const unidad = t22.unidad || (productos.find((p22) => p22.id === t22.productoId)?.unidad || "");
      return h3(
        "div",
        { key: t22.id, className: "p-3 rounded-xl", style: { border: `1px solid ${C2.line}`, background: C2.surface } },
        h3(
          "div",
          { className: "flex items-start justify-between gap-3" },
          h3(
            "div",
            null,
            h3("div", { className: "text-[12.5px] font-medium" }, titulo),
            h3("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, detalle)
          ),
          h3("div", { className: "mono text-[12.5px] font-semibold whitespace-nowrap" }, fmt(t22.cantidad), " ", unidad)
        ),
        h3("div", { className: "text-[10.5px] mt-1", style: { color: C2.inkSoft } }, t22.fecha, " ", t22.hora)
      );
    }));
  }
  return h3(
    "div",
    null,
    h3(SectionTitle, null, "Traspasos"),
    h3(
      Card,
      { className: "mb-4", style: { background: C2.accentSoft, border: "none" } },
      h3("div", { className: "text-[12.5px]" }, "Gestiona dos movimientos distintos: almac\xE9n \u2194 piso de venta dentro del local, o stock f\xEDsico entre dos locales de la misma empresa. Los traspasos entre locales salen del almac\xE9n trasero y entran al almac\xE9n trasero del destino.")
    ),
    pisoVentaBajo.length > 0 && h3(
      Card,
      { className: "mb-4", style: { background: C2.amberSoft, border: "none" } },
      h3("div", { className: "text-[12.5px] font-semibold mb-2" }, "Bajo m\xEDnimo en el piso de venta"),
      h3("div", { className: "space-y-1" }, pisoVentaBajo.map((p22) => h3("div", { key: p22.id, className: "flex items-center justify-between text-[12px]" }, h3("span", null, p22.nombre), h3("span", { className: "mono" }, fmt(p22.stockPisoVenta || 0), " / m\xEDn. ", fmt(p22.stockMinimoPisoVenta)))))
    ),
    h3(
      "div",
      { className: "grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4" },
      h3(
        Card,
        null,
        h3("div", { className: "font-semibold text-[14px] mb-1" }, "Dentro de este local"),
        h3("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Mueve unidades entre almac\xE9n y piso de venta sin cambiar el stock total."),
        internoBody
      ),
      h3(
        Card,
        null,
        h3("div", { className: "font-semibold text-[14px] mb-1" }, "Entre locales"),
        h3("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "El origen es el local activo. Elige el local y el producto exacto que recibir\xE1 la mercanc\xEDa."),
        interBody
      )
    ),
    h3(
      Card,
      null,
      h3("div", { className: "font-semibold text-[14px] mb-3" }, "Historial de traspasos"),
      historialBody
    )
  );
}
function PanelDireccion({ movimientos, gastosGenerales, nominas, empleados, promedioDiarioVentas, proyeccionTesoreria, stockBajo = [], descuadresStock = [] }) {
  const hoy = todayISO();
  const mesActual = hoy.slice(0, 7);
  const [anio, mes] = mesActual.split("-").map(Number);
  const diaDelMes = (/* @__PURE__ */ new Date()).getDate();
  const diasEnMes = new Date(anio, mes, 0).getDate();
  function resumenDe(movsDelPeriodo) {
    const ventas = movsDelPeriodo.filter((m22) => esVenta(m22));
    const ingresos = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * (Number(m22.ingresoUnitario) || 0) * (1 + (Number(m22.ivaVentaAplicado) || 0) / 100), 0);
    const coste = ventas.reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * (Number(m22.costoUnitario) || 0), 0);
    const tickets = new Set(ventas.map((m22) => m22.operationId || m22.ventaId || m22.id)).size;
    const compras = movsDelPeriodo.filter((m22) => m22.tipo === "COMPRA" && Number(m22.cantidad) > 0).reduce((a22, m22) => a22 + Number(m22.cantidad) * (Number(m22.costoUnitario) || 0), 0);
    const merma = movsDelPeriodo.filter((m22) => esMerma(m22)).reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * (Number(m22.costoUnitario) || 0), 0);
    return { ingresos, coste, margen: ingresos - coste, tickets, compras, merma };
  }
  const movHoy = (0, import_react4.useMemo)(() => movimientos.filter((m22) => m22.fecha === hoy), [movimientos, hoy]);
  const movMes = (0, import_react4.useMemo)(() => movimientos.filter((m22) => (m22.fecha || "").slice(0, 7) === mesActual), [movimientos, mesActual]);
  const rHoy = (0, import_react4.useMemo)(() => resumenDe(movHoy), [movHoy]);
  const rMes = (0, import_react4.useMemo)(() => resumenDe(movMes), [movMes]);
  const nominasDelMes = nominas.filter((n2) => n2.mes === mesActual);
  const costePersonalMes = nominasDelMes.reduce((a22, n2) => a22 + (Number(n2.costeTotalEmpresa) || 0), 0);
  const porcentajePersonal = rMes.ingresos > 0 ? costePersonalMes / rMes.ingresos * 100 : null;
  const gastosFijosMes = gastosGenerales.filter((g2) => !g2.fecha).reduce((a22, g2) => a22 + (Number(g2.importe) || 0), 0) * (diasEnMes / 30);
  const gastosPuntualesMes = gastosGenerales.filter((g2) => g2.fecha && (g2.fecha || "").slice(0, 7) === mesActual).reduce((a22, g2) => a22 + (Number(g2.importe) || 0), 0);
  const beneficioMes = rMes.margen - costePersonalMes - gastosFijosMes - gastosPuntualesMes;
  const factorExtrapolacion = diaDelMes > 0 ? diasEnMes / diaDelMes : 1;
  const ventasFinMes = rMes.ingresos * factorExtrapolacion;
  const resultadoEstimadoFinMes = beneficioMes * factorExtrapolacion;
  const cajaFutura30d = (proyeccionTesoreria || []).reduce((a22, d2) => a22 + d2.netoDia, 0);
  const Bloque2 = ({ titulo, children }) => /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-5" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-semibold mb-2", style: { color: C2.inkSoft } }, titulo), /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 gap-2" }, children));
  const Dato = ({ label, valor, color, nota }) => /* @__PURE__ */ import_react4.default.createElement(Card, { className: "py-2.5" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, label), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mono mt-0.5", style: { color: color || C2.ink } }, valor), nota && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10px] mt-0.5", style: { color: C2.inkSoft } }, nota));
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Panel de direcci\xF3n"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.accentSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, "C\xF3mo va el negocio, sin entrar en diez pantallas distintas \u2014 reutiliza los mismos n\xFAmeros que ya ves en Resultados, Tesorer\xEDa y Coste de Personal.")), /* @__PURE__ */ import_react4.default.createElement(Bloque2, { titulo: "HOY" }, /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Ventas", valor: `\u20AC${fmt(rHoy.ingresos)}` }), /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Tickets", valor: rHoy.tickets, nota: rHoy.tickets > 0 ? `ticket medio \u20AC${fmt(rHoy.ingresos / rHoy.tickets)}` : null }), /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Margen", valor: `\u20AC${fmt(rHoy.margen)}`, color: C2.accent }), /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Stock bajo m\xEDnimo", valor: stockBajo.length, color: stockBajo.length ? C2.red : C2.ink })), /* @__PURE__ */ import_react4.default.createElement(Bloque2, { titulo: "ESTE MES" }, /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Ventas del mes", valor: `\u20AC${fmt(rMes.ingresos)}` }), /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Margen del mes", valor: `\u20AC${fmt(rMes.margen)}`, color: C2.accent }), /* @__PURE__ */ import_react4.default.createElement(
    Dato,
    {
      label: "Personal sobre ventas",
      valor: porcentajePersonal === null ? "\u2014" : `${fmt(porcentajePersonal)}%`,
      color: porcentajePersonal === null ? C2.ink : porcentajePersonal <= 35 ? C2.accent : porcentajePersonal <= 40 ? C2.amber : C2.red
    }
  ), /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Compras del mes", valor: `\u20AC${fmt(rMes.compras)}` }), /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Merma del mes", valor: `\u20AC${fmt(rMes.merma)}`, color: rMes.merma > 0 ? C2.amber : C2.ink }), /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Beneficio estimado", valor: `\u20AC${fmt(beneficioMes)}`, color: beneficioMes >= 0 ? C2.accent : C2.red, nota: "ventas \u2212 coste \u2212 personal \u2212 gastos" })), /* @__PURE__ */ import_react4.default.createElement(Bloque2, { titulo: "PREVISI\xD3N (estimaci\xF3n, no un hecho)" }, /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Ventas fin de mes", valor: `\u20AC${fmt(ventasFinMes)}`, nota: `llevas ${diaDelMes} de ${diasEnMes} d\xEDas` }), /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Resultado estimado fin de mes", valor: `\u20AC${fmt(resultadoEstimadoFinMes)}`, color: resultadoEstimadoFinMes >= 0 ? C2.accent : C2.red }), /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Caja a 30 d\xEDas", valor: `${cajaFutura30d >= 0 ? "+" : ""}\u20AC${fmt(cajaFutura30d)}`, color: cajaFutura30d >= 0 ? C2.accent : C2.red, nota: `\u20AC${fmt(promedioDiarioVentas)}/d\xEDa de media` }), /* @__PURE__ */ import_react4.default.createElement(Dato, { label: "Descuadres de stock sin resolver", valor: descuadresStock.length, color: descuadresStock.length ? C2.red : C2.ink })));
}
function Tesoreria({ proyeccionTesoreria, promedioDiarioVentas }) {
  const [saldoActual, setSaldoActual] = (0, import_react4.useState)("");
  const saldoInicial = Number(saldoActual) || 0;
  let acumulado = saldoInicial;
  const filas = proyeccionTesoreria.map((d2) => {
    acumulado += d2.netoDia;
    return { ...d2, saldoProyectado: acumulado };
  });
  const primerNegativo = filas.find((f22) => f22.saldoProyectado < 0);
  const totalPagos30d = proyeccionTesoreria.reduce((a22, d2) => a22 + d2.pagosDia, 0);
  const totalIngresos30d = proyeccionTesoreria.reduce((a22, d2) => a22 + d2.ingresosDia, 0);
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, { action: /* @__PURE__ */ import_react4.default.createElement(Pill2, { color: C2.inkSoft }, /* @__PURE__ */ import_react4.default.createElement(CalendarRange, { size: 11, style: { verticalAlign: "middle", marginRight: 3 } }), "Pr\xF3ximos 30 d\xEDas") }, "Tesorer\xEDa"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.accentSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, "Proyecci\xF3n a 30 d\xEDas. Los pagos son reales (facturas con vencimiento conocido) y los encargos con fecha de entrega fijada tambi\xE9n. La venta del d\xEDa a d\xEDa se estima con tu promedio de los \xFAltimos 30 d\xEDas (\u20AC", fmt(promedioDiarioVentas), "/d\xEDa) \u2014 es una estimaci\xF3n, no una promesa, y mejora cuantas m\xE1s ventas registres.")), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Saldo disponible hoy (caja + banco)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", value: saldoActual, onChange: (e2) => setSaldoActual(e2.target.value), placeholder: "Lo que tienes ahora mismo" })), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "El programa no sabe tu saldo bancario \u2014 lo pones t\xFA aqu\xED para poder proyectar hacia delante.")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 gap-3 mb-4" }, /* @__PURE__ */ import_react4.default.createElement(Card, null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "Ingresos previstos (30 d\xEDas)"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-xl font-semibold mono mt-1", style: { color: C2.accent } }, "\u20AC", fmt(totalIngresos30d))), /* @__PURE__ */ import_react4.default.createElement(Card, null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "Pagos comprometidos (30 d\xEDas)"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-xl font-semibold mono mt-1" }, "\u20AC", fmt(totalPagos30d)))), saldoActual !== "" && primerNegativo && /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.redSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold" }, "Posible falta de caja el ", new Date(primerNegativo.fecha).toLocaleDateString("es-ES")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mt-1", style: { color: C2.inkSoft } }, "Al ritmo actual, ese d\xEDa el saldo proyectado bajar\xEDa de cero. Revisa si puedes retrasar alg\xFAn pago o adelantar alg\xFAn cobro antes de esa fecha.")), saldoActual === "" ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Pon tu saldo actual arriba para ver la proyecci\xF3n d\xEDa a d\xEDa." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1" }, filas.map((f22) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: f22.fecha, style: { padding: "0.6rem 1rem" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between text-[12.5px]" }, /* @__PURE__ */ import_react4.default.createElement("span", null, new Date(f22.fecha).toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "2-digit" })), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center gap-3" }, f22.pagosDia > 0 && /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono text-[11.5px]", style: { color: C2.red } }, "\u2212\u20AC", fmt(f22.pagosDia)), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono font-semibold", style: { color: f22.saldoProyectado < 0 ? C2.red : C2.ink } }, "\u20AC", fmt(f22.saldoProyectado))))))));
}
var MESES_NOMBRE = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function Estacionalidad({ ingresosPorMes }) {
  const hoy = /* @__PURE__ */ new Date();
  const filas = [];
  for (let i33 = 0; i33 < 12; i33++) {
    const d2 = new Date(hoy.getFullYear(), hoy.getMonth() - i33, 1);
    const key = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}`;
    const keyAnterior = `${d2.getFullYear() - 1}-${String(d2.getMonth() + 1).padStart(2, "0")}`;
    const actual = ingresosPorMes[key] || 0;
    const anterior = ingresosPorMes[keyAnterior];
    const variacion = anterior ? (actual - anterior) / anterior * 100 : null;
    filas.push({
      key,
      etiqueta: `${MESES_NOMBRE[d2.getMonth()]} ${d2.getFullYear()}`,
      actual,
      anterior: anterior ?? null,
      variacion
    });
  }
  filas.reverse();
  const hayComparacion = filas.some((f22) => f22.anterior !== null);
  const mesesConDatos = filas.filter((f22) => f22.actual > 0).length;
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, { action: /* @__PURE__ */ import_react4.default.createElement(Pill2, { color: C2.inkSoft }, /* @__PURE__ */ import_react4.default.createElement(CalendarRange, { size: 11, style: { verticalAlign: "middle", marginRight: 3 } }), "\xDAltimos 12 meses") }, "Estacionalidad"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.accentSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, "Compara cada mes contra el mismo mes del a\xF1o anterior \u2014 para ver si San Valent\xEDn, Navidad o el verano se comportan distinto de un a\xF1o a otro, en vez de comparar solo contra el mes justo antes.")), !hayComparacion && /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, "Todav\xEDa no tienes un a\xF1o completo de ventas registradas, as\xED que no hay ning\xFAn mes con el que comparar. En cuanto pase un a\xF1o desde que empezaste a registrar ventas, aqu\xED aparecer\xE1 la comparaci\xF3n real.", mesesConDatos > 0 && ` Por ahora tienes ${mesesConDatos} mes(es) con datos.`)), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1.5" }, filas.map((f22) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: f22.key }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[13px] font-medium capitalize" }, f22.etiqueta), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-right" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono font-semibold" }, "\u20AC", fmt(f22.actual)), f22.anterior !== null ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mono", style: { color: f22.variacion >= 0 ? C2.accent : C2.red } }, f22.variacion >= 0 ? "+" : "", fmt(f22.variacion), "% vs. \u20AC", fmt(f22.anterior), " el a\xF1o pasado") : /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "Sin dato del a\xF1o anterior")))))));
}
function CostePersonal({ empleados, nominas, addNomina, updateNomina, deleteNomina, fichajes, movimientos, setTab }) {
  const mesActual = aISO(/* @__PURE__ */ new Date()).slice(0, 7);
  const [mes, setMes] = (0, import_react4.useState)(mesActual);
  const [showForm, setShowForm] = (0, import_react4.useState)(false);
  const [editingId, setEditingId] = (0, import_react4.useState)(null);
  const [form, setForm] = (0, import_react4.useState)({ empleadoId: "", mes: mesActual, brutoTotal: "", seguridadSocialEmpresa: "", notas: "" });
  const [error, setError] = (0, import_react4.useState)("");
  const [confirmarAnularId, setConfirmarAnularId] = (0, import_react4.useState)(null);
  const [mostrarIA, setMostrarIA] = (0, import_react4.useState)(false);
  const [fotosIA, setFotosIA] = (0, import_react4.useState)([]);
  const [cargandoIA, setCargandoIA] = (0, import_react4.useState)(false);
  const [errorIA, setErrorIA] = (0, import_react4.useState)("");
  const [avisosIA, setAvisosIA] = (0, import_react4.useState)([]);
  const activos = empleados.filter((e2) => e2.activo !== false);
  const nominasDelMes = nominas.filter((n2) => n2.mes === mes);
  const nominasValidasDelMesPM13 = nominasDelMes.filter((n2) => n2.estado !== "ANULADA");
  const costeTotalMes = nominasValidasDelMesPM13.reduce((a22, n2) => a22 + (Number(n2.costeTotalEmpresa) || 0), 0);
  const ingresosDelMes = movimientos.filter((m22) => esVenta(m22) && (m22.fecha || "").slice(0, 7) === mes).reduce((a22, m22) => a22 + Math.abs(Number(m22.cantidad) || 0) * (Number(m22.ingresoUnitario) || 0), 0);
  const porcentajeSobreVentas = ingresosDelMes > 0 ? costeTotalMes / ingresosDelMes * 100 : null;
  function horasDelEmpleadoEnMes(empleadoId) {
    return horasDeEmpleadoEnMes(fichajes, empleadoId, mes);
  }
  const filas = nominasDelMes.map((n2) => {
    const emp = empleados.find((e2) => e2.id === n2.empleadoId);
    const horas = horasDelEmpleadoEnMes(n2.empleadoId);
    const costePorHora = horas > 0 ? (Number(n2.costeTotalEmpresa) || 0) / horas : null;
    return { ...n2, empleado: emp, horas, costePorHora };
  }).sort((a22, b2) => (b2.costeTotalEmpresa || 0) - (a22.costeTotalEmpresa || 0));
  const LIMITE_COSTE_PERSONAL = 0.35;
  const ventaObjetivo35 = costeTotalMes > 0 ? costeTotalMes / LIMITE_COSTE_PERSONAL : null;
  const diferenciaConObjetivo = ventaObjetivo35 !== null ? ingresosDelMes - ventaObjetivo35 : null;
  const horasTotalesMes = filas.reduce((a22, f22) => a22 + (f22.horas || 0), 0);
  const costePorHoraEquipo = horasTotalesMes > 0 ? costeTotalMes / horasTotalesMes : null;
  const ventasPorHoraEquipo = horasTotalesMes > 0 ? ingresosDelMes / horasTotalesMes : null;
  async function agregarFotosIA(archivos) {
    setErrorIA("");
    const validos = Array.from(archivos).filter((f22) => f22.type.startsWith("image/"));
    if (validos.length === 0) {
      setErrorIA("Solo se admiten fotos (jpg, png). Si es un PDF, hazle una foto de pantalla o de la hoja impresa.");
      return;
    }
    try {
      const nuevas = await Promise.all(validos.map(archivoABase64));
      setFotosIA((s22) => [...s22, ...nuevas]);
    } catch {
      setErrorIA("No se ha podido leer ese archivo. Prueba con otra foto.");
    }
  }
  function quitarFotoIA(idx) {
    setFotosIA((s22) => s22.filter((_22, i33) => i33 !== idx));
  }
  function empleadoPorNombreLeido(nombre) {
    if (!nombre) return null;
    const normaliza = (t22) => t22.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const buscado = normaliza(nombre);
    return activos.find((e2) => normaliza(e2.nombre) === buscado) || activos.find((e2) => normaliza(e2.nombre).includes(buscado) || buscado.includes(normaliza(e2.nombre))) || null;
  }
  function numeroLimpio(v22) {
    if (v22 === null || v22 === void 0 || v22 === "") return "";
    if (typeof v22 === "number" && !isNaN(v22)) return v22;
    let s22 = String(v22).trim().replace(/[€\s]/g, "");
    if (/,/.test(s22) && /\./.test(s22)) s22 = s22.replace(/\./g, "").replace(",", ".");
    else if (/,/.test(s22)) s22 = s22.replace(",", ".");
    const n2 = parseFloat(s22);
    return isNaN(n2) ? "" : n2;
  }
  function mesLimpio(v22) {
    if (!v22) return null;
    const m22 = String(v22).match(/^(\d{4})-(\d{2})/);
    return m22 ? `${m22[1]}-${m22[2]}` : null;
  }
  async function importarNominaConIA() {
    if (fotosIA.length === 0) {
      setErrorIA("Sube al menos una foto de la n\xF3mina.");
      return;
    }
    setCargandoIA(true);
    setErrorIA("");
    setAvisosIA([]);
    try {
      const resp = await fetch(
        "https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/importar-nomina",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenes: fotosIA.map((f22) => ({ base64: f22.base64, mediaType: f22.mediaType })) })
        }
      );
      const r2 = await resp.json();
      if (!r2.ok) {
        setErrorIA(r2.error || "No se ha podido leer correctamente esta n\xF3mina. Rev\xEDsala antes de continuar.");
        setCargandoIA(false);
        return;
      }
      const d2 = r2.datos || {};
      const empMatch = empleadoPorNombreLeido(d2.empleado);
      const mesSaneado = mesLimpio(d2.mes);
      const avisos = ["PM13 P07: propuesta IA. Revisa empleado, mes, bruto y Seguridad Social. La IA no emite ni valida una nómina oficial y el guardado exige confirmación humana explícita."];
      if (!empMatch) avisos.push(`No se ha podido emparejar el nombre le\xEDdo ("${d2.empleado || "\u2014"}") con ning\xFAn empleado dado de alta. El\xEDgelo a mano abajo.`);
      if (!d2.mes) avisos.push("No se ha podido leer el mes de la n\xF3mina. Rev\xEDsalo antes de guardar.");
      else if (!mesSaneado) avisos.push(`El mes le\xEDdo ("${d2.mes}") no tiene un formato reconocible. Se ha dejado el mes actual \u2014 rev\xEDsalo antes de guardar.`);
      setForm({
        empleadoId: empMatch ? empMatch.id : "",
        mes: mesSaneado || mes,
        brutoTotal: numeroLimpio(d2.brutoTotal),
        seguridadSocialEmpresa: numeroLimpio(d2.seguridadSocialEmpresa),
        notas: d2.notas || "",
        origen: "IA",
        revisionHumanaConfirmada: false
      });
      setEditingId(null);
      setAvisosIA(avisos);
      setMostrarIA(false);
      setFotosIA([]);
      setShowForm(true);
    } catch {
      setErrorIA("No se ha podido conectar con la IA. Comprueba tu conexi\xF3n e int\xE9ntalo otra vez.");
    } finally {
      setCargandoIA(false);
    }
  }
  function submit() {
    if (!form.empleadoId) {
      setError("Elige de qu\xE9 empleado es la n\xF3mina.");
      return;
    }
    if (!(Number(form.brutoTotal) > 0)) {
      setError("Pon el bruto total del mes.");
      return;
    }
    setError("");
    let datosGuardarPM13 = form;
    if (!editingId && form.origen === "IA") {
      const revisionConfirmadaPM13 = typeof window !== "undefined" && typeof window.confirm === "function" && window.confirm("Revisión humana obligatoria: confirma que has comprobado empleado, mes, bruto, Seguridad Social y notas contra la nómina original. La IA solo propone datos y no sustituye tu revisión.");
      if (!revisionConfirmadaPM13) {
        setError("La propuesta de IA no se ha guardado porque falta confirmar la revisión humana.");
        return;
      }
      datosGuardarPM13 = { ...form, revisionHumanaConfirmada: true };
    }
    const resultadoNominaPM13 = editingId ? updateNomina(editingId, datosGuardarPM13) : addNomina(datosGuardarPM13);
    if (!resultadoNominaPM13 || resultadoNominaPM13.ok === false) {
      setError(resultadoNominaPM13?.error || "No se pudo guardar la nómina.");
      return;
    }
    if (form.mes && form.mes !== mes) setMes(form.mes);
    setForm({ empleadoId: "", mes: form.mes || mes, brutoTotal: "", seguridadSocialEmpresa: "", notas: "" });
    setEditingId(null);
    setAvisosIA([]);
    setShowForm(false);
  }
  function abrirEdicion(n2) {
    setForm({
      empleadoId: n2.empleadoId || "",
      mes: n2.mes || mes,
      brutoTotal: n2.brutoTotal ?? "",
      seguridadSocialEmpresa: n2.seguridadSocialEmpresa ?? "",
      notas: n2.notas || "",
      origen: n2.origen || "MANUAL",
      revisionHumanaConfirmada: false
    });
    setEditingId(n2.id);
    setError("");
    setAvisosIA([]);
    setShowForm(true);
  }
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, { action: /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => {
    setMostrarIA(true);
    setFotosIA([]);
    setErrorIA("");
  } }, /* @__PURE__ */ import_react4.default.createElement(Camera, { size: 15 }), " Foto con IA"), /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => {
    setForm({ empleadoId: "", mes, brutoTotal: "", seguridadSocialEmpresa: "", notas: "" });
    setEditingId(null);
    setError("");
    setShowForm((s22) => !s22);
  } }, /* @__PURE__ */ import_react4.default.createElement(Plus, { size: 15 }), " Registrar n\xF3mina")) }, "Coste de personal"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, /* @__PURE__ */ import_react4.default.createElement("b", null, "Esto no calcula n\xF3minas"), " \u2014 eso lo hace tu gestor\xEDa, que es quien tiene la autorizaci\xF3n ante la Seguridad Social y responde legalmente. Aqu\xED solo apuntas lo que la gestor\xEDa ya te ha pasado, para cruzarlo con tus ventas reales y saber cu\xE1nto te cuesta de verdad el personal, en vez de una estimaci\xF3n.")), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Mes que est\xE1s viendo" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "month", value: mes, onChange: (e2) => setMes(e2.target.value) }))), mostrarIA && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => {
    if (!cargandoIA) setMostrarIA(false);
  }, title: "Leer n\xF3mina con foto (IA)", ancho: "max-w-2xl" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-3", style: { color: C2.inkSoft } }, "Sube una foto de la n\xF3mina (o de la hoja de cotizaci\xF3n, si quieres que lea tambi\xE9n la Seguridad Social). La IA prepara el formulario para que lo revises \u2014 nada se guarda hasta que t\xFA confirmes."), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-3", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]" }, "Una n\xF3mina lleva datos personales y econ\xF3micos sensibles del trabajador. Revisa bien cada cifra antes de guardar \u2014 la IA puede confundir n\xFAmeros, sobre todo si la foto sale torcida o con poca luz.")), /* @__PURE__ */ import_react4.default.createElement(
    "label",
    {
      className: "flex flex-col items-center justify-center gap-2 rounded-lg py-6 mb-3 cursor-pointer",
      style: { border: `2px dashed ${C2.line}`, background: C2.surface }
    },
    /* @__PURE__ */ import_react4.default.createElement(Camera, { size: 22, color: C2.inkSoft }),
    /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "Toca para elegir: hacer foto ahora o subir de la galer\xEDa"),
    /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        type: "file",
        accept: "image/*",
        multiple: true,
        disabled: cargandoIA,
        onChange: (e2) => {
          agregarFotosIA(e2.target.files);
          e2.target.value = "";
        },
        className: "hidden"
      }
    )
  ), fotosIA.length > 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex flex-wrap gap-2 mb-3" }, fotosIA.map((f22, i33) => /* @__PURE__ */ import_react4.default.createElement("div", { key: i33, className: "relative" }, /* @__PURE__ */ import_react4.default.createElement("img", { src: f22.previsualizacion, alt: "", className: "w-16 h-16 object-cover rounded-lg", style: { border: `1px solid ${C2.line}` } }), !cargandoIA && /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      onClick: () => quitarFotoIA(i33),
      "aria-label": "Quitar esta foto",
      className: "absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center",
      style: { width: 18, height: 18, background: C2.red, color: "#fff" }
    },
    /* @__PURE__ */ import_react4.default.createElement(X2, { size: 12 })
  )))), errorIA && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", role: "alert", style: { color: C2.red } }, errorIA), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mb-3", style: { color: C2.inkSoft } }, "Si alg\xFAn dato sale borroso o no se lee bien, la IA lo deja en blanco en vez de inventarlo \u2014 luego lo rellenas t\xFA en la revisi\xF3n."), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: importarNominaConIA, disabled: cargandoIA }, cargandoIA ? "Leyendo la n\xF3mina\u2026" : "Leer con IA"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setMostrarIA(false), disabled: cargandoIA }, "Cancelar"))), showForm && /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] font-semibold mb-3" }, editingId ? "Editar n\xF3mina" : "Registrar n\xF3mina del mes"), avisosIA.length > 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-3 px-3 py-2 rounded-lg text-[12px]", style: { background: C2.amberSoft } }, avisosIA.map((a22, i33) => /* @__PURE__ */ import_react4.default.createElement("div", { key: i33 }, a22))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 gap-x-3" }, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Empleado" }, /* @__PURE__ */ import_react4.default.createElement("select", { value: form.empleadoId, onChange: (e2) => setForm({ ...form, empleadoId: e2.target.value }), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink } }, /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "\u2014 Elige un empleado \u2014"), activos.map((e2) => /* @__PURE__ */ import_react4.default.createElement("option", { key: e2.id, value: e2.id }, e2.nombre)))), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Mes" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "month", value: form.mes, onChange: (e2) => setForm({ ...form, mes: e2.target.value }) })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Bruto del mes (\u20AC)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", value: form.brutoTotal, onChange: (e2) => setForm({ ...form, brutoTotal: e2.target.value }), placeholder: "Lo que pone la n\xF3mina" })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Seguridad Social a cargo de la empresa (\u20AC)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", step: "0.01", value: form.seguridadSocialEmpresa, onChange: (e2) => setForm({ ...form, seguridadSocialEmpresa: e2.target.value }), placeholder: "Del bolet\xEDn de cotizaci\xF3n" })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Notas (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.notas, onChange: (e2) => setForm({ ...form, notas: e2.target.value }), placeholder: "Incluye paga extra, finiquito\u2026" }))), Number(form.brutoTotal) > 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", style: { color: C2.inkSoft } }, "Coste total para la empresa: ", /* @__PURE__ */ import_react4.default.createElement("b", { className: "mono" }, "\u20AC", fmt(Number(form.brutoTotal) + (Number(form.seguridadSocialEmpresa) || 0)))), error && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", role: "alert", style: { color: C2.red } }, error), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: submit }, editingId ? "Guardar cambios" : "Guardar"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => {
    setShowForm(false);
    setEditingId(null);
    setAvisosIA([]);
  } }, "Cancelar"))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 gap-3 mb-4" }, /* @__PURE__ */ import_react4.default.createElement(Card, null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "Coste total del mes"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-xl font-semibold mono mt-1" }, "\u20AC", fmt(costeTotalMes))), /* @__PURE__ */ import_react4.default.createElement(Card, null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "% sobre ventas del mes"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-xl font-semibold mono mt-1", style: { color: porcentajeSobreVentas === null ? C2.inkSoft : porcentajeSobreVentas > 35 ? C2.red : porcentajeSobreVentas > 30 ? C2.amber : C2.accent } }, porcentajeSobreVentas === null ? "\u2014" : `${fmt(porcentajeSobreVentas)}%`), porcentajeSobreVentas !== null && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-0.5", style: { color: C2.inkSoft } }, "sobre \u20AC", fmt(ingresosDelMes), " vendidos"))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-3 gap-3 mb-4" }, /* @__PURE__ */ import_react4.default.createElement(Card, null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "Venta objetivo (no pasar del 35%)"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-xl font-semibold mono mt-1" }, ventaObjetivo35 === null ? "\u2014" : `\u20AC${fmt(ventaObjetivo35)}`), diferenciaConObjetivo !== null && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-0.5", style: { color: diferenciaConObjetivo >= 0 ? C2.accent : C2.red } }, diferenciaConObjetivo >= 0 ? `ya llevas \u20AC${fmt(diferenciaConObjetivo)} de margen` : `te faltan \u20AC${fmt(Math.abs(diferenciaConObjetivo))} por vender`)), /* @__PURE__ */ import_react4.default.createElement(Card, null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "Coste de personal por hora"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-xl font-semibold mono mt-1" }, costePorHoraEquipo === null ? "\u2014" : `\u20AC${fmt(costePorHoraEquipo)}`), horasTotalesMes > 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px] mt-0.5", style: { color: C2.inkSoft } }, "sobre ", fmt(horasTotalesMes), " h fichadas")), /* @__PURE__ */ import_react4.default.createElement(Card, null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px]", style: { color: C2.inkSoft } }, "Ventas por hora trabajada"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-xl font-semibold mono mt-1" }, ventasPorHoraEquipo === null ? "\u2014" : `\u20AC${fmt(ventasPorHoraEquipo)}`))), porcentajeSobreVentas !== null && porcentajeSobreVentas > 35 && /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.redSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] mb-2" }, "El personal se est\xE1 llevando m\xE1s del 35% de lo que vendes. En hosteler\xEDa suele considerarse una se\xF1al de alerta \u2014 puede ser un mes flojo de ventas, o que haga falta revisar turnos o plantilla."), setTab && /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => setTab("turnos") }, "Ir a Turnos")), filas.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: `No has registrado n\xF3minas de ${mes} todav\xEDa.` }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2" }, filas.map((n2) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: n2.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-start justify-between" }, /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[13px] font-medium" }, n2.empleado ? n2.empleado.nombre : "Empleado eliminado"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, "Bruto \u20AC", fmt(n2.brutoTotal), " + SS empresa \u20AC", fmt(n2.seguridadSocialEmpresa)), n2.notas && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mt-0.5", style: { color: C2.inkSoft } }, n2.notas)), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-right" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono font-semibold" }, "\u20AC", fmt(n2.costeTotalEmpresa)), n2.costePorHora !== null && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mono", style: { color: C2.inkSoft } }, "\u20AC", fmt(n2.costePorHora), "/h \xB7 ", fmt(n2.horas), " h fichadas"))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2 flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", disabled: n2.origen === "IA" || n2.estado === "ANULADA", onClick: () => abrirEdicion(n2) }, /* @__PURE__ */ import_react4.default.createElement(Pencil, { size: 13 }), n2.origen === "IA" ? " Revisada por humano" : n2.estado === "ANULADA" ? " Anulada" : " Editar"), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", disabled: n2.estado === "ANULADA", onClick: () => setConfirmarAnularId(n2.id) }, /* @__PURE__ */ import_react4.default.createElement(Trash2, { size: 13 }), n2.estado === "ANULADA" ? " Anulada" : " Anular"))))), confirmarAnularId && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setConfirmarAnularId(null), title: "Anular n\xF3mina" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] mb-4" }, "Esta n\xF3mina quedar\xE1 marcada como anulada. Esta acci\xF3n no se puede deshacer."), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setConfirmarAnularId(null) }, "Cancelar"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "danger", onClick: () => { deleteNomina(confirmarAnularId); setConfirmarAnularId(null); } }, "S\xED, anular"))));
}
function HistorialProducto({ productos, movimientos, pedidos: pedidos2, albaranes, traspasos, proveedorPorId }) {
  const [busqueda, setBusqueda] = (0, import_react4.useState)("");
  const [productoId, setProductoId] = (0, import_react4.useState)("");
  const [seccion, setSeccion] = (0, import_react4.useState)("movimientos");
  const coincidencias = (0, import_react4.useMemo)(() => {
    const q2 = busqueda.trim().toLowerCase();
    if (!q2) return [];
    return productos.filter((p22) => p22.nombre.toLowerCase().includes(q2) || (p22.codigoBarras || "").toLowerCase().includes(q2)).slice(0, 8);
  }, [productos, busqueda]);
  const producto = productos.find((p22) => p22.id === productoId);
  const movimientosDelProducto = (0, import_react4.useMemo)(() => {
    if (!producto) return [];
    return movimientos.filter((m22) => m22.productoId === producto.id).sort((a22, b2) => (b2.fecha || "").localeCompare(a22.fecha || ""));
  }, [movimientos, producto]);
  const pedidosDelProducto = (0, import_react4.useMemo)(() => {
    if (!producto) return [];
    return pedidos2.filter((pe2) => (pe2.items || []).some((it2) => it2.productoId === producto.id)).map((pe2) => ({ pedido: pe2, item: pe2.items.find((it2) => it2.productoId === producto.id) })).sort((a22, b2) => (b2.pedido.fecha || "").localeCompare(a22.pedido.fecha || ""));
  }, [pedidos2, producto]);
  const comprasDelProducto = (0, import_react4.useMemo)(() => {
    if (!producto) return [];
    return albaranes.filter((a22) => a22.estado === "confirmado" && (a22.lineas || []).some((ln2) => ln2.productoId === producto.id)).map((a22) => {
      const ln2 = a22.lineas.find((x3) => x3.productoId === producto.id);
      const unidades = Number(ln2.unidadesEntradas) || 0;
      const importe = Number(ln2.importe) || 0;
      return { albaran: a22, linea: ln2, unidades, precioUnitario: unidades > 0 ? importe / unidades : 0 };
    }).sort((a22, b2) => (b2.albaran.fecha || "").localeCompare(a22.albaran.fecha || ""));
  }, [albaranes, producto]);
  const traspasosDelProducto = (0, import_react4.useMemo)(() => {
    if (!producto) return [];
    return traspasos.filter((t22) => t22.tipo === "ENTRE_LOCALES" ? t22.productoOrigenId === producto.id || t22.productoDestinoId === producto.id : t22.productoId === producto.id).sort((a22, b2) => (b2.fecha || "").localeCompare(a22.fecha || ""));
  }, [traspasos, producto]);
  const SECCIONES = [
    { id: "movimientos", label: "Movimientos", n: movimientosDelProducto.length },
    { id: "pedidos", label: "Pedidos", n: pedidosDelProducto.length },
    { id: "compras", label: "Compras", n: comprasDelProducto.length },
    { id: "traspasos", label: "Traspasos", n: traspasosDelProducto.length }
  ];
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Historial de producto"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Busca un producto por nombre o c\xF3digo de barras" }, /* @__PURE__ */ import_react4.default.createElement(
    Input,
    {
      value: busqueda,
      onChange: (e2) => {
        setBusqueda(e2.target.value);
        setProductoId("");
      },
      placeholder: "Ej. Harina, Bomb\xF3n surtido\u2026",
      autoFocus: true
    }
  )), busqueda && !producto && /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1 mt-1" }, coincidencias.length === 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "Sin resultados.") : coincidencias.map((p22) => /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      key: p22.id,
      onClick: () => {
        setProductoId(p22.id);
        setBusqueda(p22.nombre);
      },
      className: "w-full text-left px-3 py-2 rounded-lg text-[13px]",
      style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink }
    },
    p22.nombre,
    " ",
    /* @__PURE__ */ import_react4.default.createElement("span", { style: { color: C2.inkSoft } }, "\xB7 ", p22.unidad)
  )))), !producto ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Busca y elige un producto para ver todo su historial." }) : /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-start justify-between mb-2" }, /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-semibold text-[15px]" }, producto.nombre), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, producto.categoria || "Sin categor\xEDa", " \xB7 ", producto.unidad)), /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => {
    setProductoId("");
    setBusqueda("");
  }, "aria-label": "Quitar selecci\xF3n" }, /* @__PURE__ */ import_react4.default.createElement(X2, { size: 16, color: C2.inkSoft }))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 gap-3 mt-2" }, /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, "Stock total"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono font-semibold" }, fmt(producto.stock), " ", producto.unidad)), /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, "En piso de venta"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono font-semibold" }, fmt(producto.stockPisoVenta || 0), " ", producto.unidad)), /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, "Costo"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono font-semibold" }, "\u20AC", fmt(producto.costo))), /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, "Precio de venta"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono font-semibold" }, producto.precioVenta ? `\u20AC${fmt(producto.precioVenta)}` : "\u2014")))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 mb-3 overflow-x-auto" }, SECCIONES.map((s22) => /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      key: s22.id,
      onClick: () => setSeccion(s22.id),
      className: "text-[12px] font-medium px-3 py-1.5 rounded-full whitespace-nowrap",
      style: {
        background: seccion === s22.id ? C2.accent : C2.surface,
        color: seccion === s22.id ? "#fff" : C2.inkSoft,
        border: `1px solid ${seccion === s22.id ? C2.accent : C2.line}`
      }
    },
    s22.label,
    " (",
    s22.n,
    ")"
  ))), seccion === "movimientos" && (movimientosDelProducto.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Sin movimientos registrados para este producto." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1.5" }, movimientosDelProducto.map((m22) => {
    const cantidadNum = Number(m22.cantidad) || 0;
    const efecto = m22.tipo === "salida" ? -Math.abs(cantidadNum) : cantidadNum;
    const esPositivo = efecto >= 0;
    return /* @__PURE__ */ import_react4.default.createElement(Card, { key: m22.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, /* @__PURE__ */ import_react4.default.createElement("b", { style: { color: esPositivo ? C2.accent : C2.red } }, esPositivo ? "+" : "\u2212", fmt(Math.abs(efecto))), " ", m22.motivo || m22.referencia || "\u2014", m22.tipo === "ajuste" && /* @__PURE__ */ import_react4.default.createElement("span", { className: "ml-1 text-[10.5px]", style: { color: C2.inkSoft } }, "(ajuste de inventario)")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, m22.fecha, m22.usuario ? ` \xB7 ${m22.usuario}` : "", m22.stockAnterior != null && m22.stockPosterior != null ? ` \xB7 saldo ${fmt(m22.stockAnterior)} \u2192 ${fmt(m22.stockPosterior)}` : "")), (m22.costoUnitario || m22.ingresoUnitario) && /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono text-[11.5px]", style: { color: C2.inkSoft } }, "\u20AC", fmt(m22.tipo === "entrada" ? m22.costoUnitario : m22.ingresoUnitario), "/", producto.unidad)));
  }))), seccion === "pedidos" && (pedidosDelProducto.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Este producto no est\xE1 en ning\xFAn pedido a proveedor." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1.5" }, pedidosDelProducto.map(({ pedido, item }) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: pedido.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between mb-1" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[12.5px] font-medium" }, (proveedorPorId(pedido.proveedorId) || {}).nombre || "Proveedor eliminado"), /* @__PURE__ */ import_react4.default.createElement(Pill2, { color: pedido.estado === "Recibido" ? C2.inkSoft : pedido.estado === "Parcial" ? C2.amber : C2.accent }, pedido.estado)), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]", style: { color: C2.inkSoft } }, pedido.fecha, " \xB7 pedidas ", fmt(item.cantidad), " ", producto.unidad, " \xB7 recibidas ", fmt(item.cantidadRecibida || 0)))))), seccion === "compras" && (comprasDelProducto.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Sin compras confirmadas de este producto." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1.5" }, comprasDelProducto.map(({ albaran, linea, unidades, precioUnitario }) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: albaran.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between mb-1" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[12.5px] font-medium" }, (proveedorPorId(albaran.proveedorId) || {}).nombre || "Proveedor eliminado"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[11px]", style: { color: C2.inkSoft } }, "Albar\xE1n ", albaran.numero || "s/n")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]", style: { color: C2.inkSoft } }, albaran.fecha, " \xB7 ", fmt(unidades), " ", producto.unidad, " a \u20AC", fmt(precioUnitario), "/", producto.unidad, linea.lote && ` \xB7 lote ${linea.lote}`, linea.caducidad && ` \xB7 caduca ${linea.caducidad}`))))), seccion === "traspasos" && (traspasosDelProducto.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Sin traspasos registrados para este producto." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1.5" }, traspasosDelProducto.map((t22) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: t22.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[12.5px]" }, t22.tipo === "ENTRE_LOCALES" ? `${t22.origenLocalNombre || "Origen"} \u2192 ${t22.destinoLocalNombre || "Destino"}` : t22.direccion === "a_piso" ? "Almac\xE9n \u2192 Piso de venta" : "Piso de venta \u2192 Almac\xE9n"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono text-[12.5px] font-semibold" }, fmt(t22.cantidad), " ", producto.unidad)), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, t22.fecha, " ", t22.hora)))))));
}
function BusquedaGlobal({ productos, proveedores, clientes, fichasCosto, empleados, setTab }) {
  const [q2, setQ] = (0, import_react4.useState)("");
  const resultados = (0, import_react4.useMemo)(() => {
    const texto = q2.trim().toLowerCase();
    if (texto.length < 2) return null;
    return {
      productos: productos.filter((p22) => p22.nombre.toLowerCase().includes(texto) || (p22.codigoBarras || "").toLowerCase().includes(texto)).slice(0, 8),
      proveedores: proveedores.filter((p22) => p22.nombre.toLowerCase().includes(texto)).slice(0, 8),
      clientes: clientes.filter((c22) => c22.nombre.toLowerCase().includes(texto)).slice(0, 8),
      fichasCosto: fichasCosto.filter((f22) => f22.nombre.toLowerCase().includes(texto)).slice(0, 8),
      empleados: empleados.filter((e2) => e2.nombre.toLowerCase().includes(texto)).slice(0, 8)
    };
  }, [q2, productos, proveedores, clientes, fichasCosto, empleados]);
  const totalResultados = resultados ? Object.values(resultados).reduce((a22, lista) => a22 + lista.length, 0) : 0;
  const GRUPOS = [
    { clave: "productos", titulo: "Productos", tab: "productos", icon: Package },
    { clave: "proveedores", titulo: "Proveedores", tab: "proveedores", icon: Truck },
    { clave: "clientes", titulo: "Clientes", tab: "clientes", icon: Users },
    { clave: "fichasCosto", titulo: "Fichas de costo", tab: "fichas", icon: Calculator },
    { clave: "empleados", titulo: "Personal", tab: "personal", icon: UserRound }
  ];
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Buscar en todo el programa"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement(
    Input,
    {
      value: q2,
      onChange: (e2) => setQ(e2.target.value),
      placeholder: "Escribe un nombre\u2026 (productos, proveedores, clientes, fichas, personal)",
      autoFocus: true
    }
  )), q2.trim().length > 0 && q2.trim().length < 2 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "Sigue escribiendo, al menos 2 letras.") : resultados === null ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Escribe algo para buscar en productos, proveedores, clientes, fichas de costo y personal." }) : totalResultados === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: `Sin resultados para "${q2}".` }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-4" }, GRUPOS.map((g2) => {
    const lista = resultados[g2.clave];
    if (!lista || lista.length === 0) return null;
    const Icono = g2.icon;
    return /* @__PURE__ */ import_react4.default.createElement("div", { key: g2.clave }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center gap-1.5 text-[12px] font-semibold mb-2", style: { color: C2.inkSoft } }, /* @__PURE__ */ import_react4.default.createElement(Icono, { size: 14 }), " ", g2.titulo, " (", lista.length, ")"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1.5" }, lista.map((item) => /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        key: item.id,
        onClick: () => setTab(g2.tab),
        className: "w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg",
        style: { border: `1px solid ${C2.line}`, background: C2.surface }
      },
      /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[13px]", style: { color: C2.ink } }, item.nombre),
      /* @__PURE__ */ import_react4.default.createElement(ChevronRight, { size: 15, color: C2.inkSoft })
    ))));
  })));
}
function AceiteFreidoras({ freidoras = [], registrosAceite = [], productos, addFreidora, updateFreidora, deleteFreidora, registrarCambio, registrarRelleno, eliminarRegistroAceite, consumoPorCiclo }) {
  const [showForm, setShowForm] = (0, import_react4.useState)(false);
  const [editingId, setEditingId] = (0, import_react4.useState)(null);
  const [form, setForm] = (0, import_react4.useState)({ nombre: "", litrosCarga: "", rellenoHabitual: "5", productoAceiteId: "" });
  const [error, setError] = (0, import_react4.useState)("");
  const [accion, setAccion] = (0, import_react4.useState)(null);
  const [litros, setLitros] = (0, import_react4.useState)("");
  const [tipoCambio, setTipoCambio] = (0, import_react4.useState)("Voluntario");
  const [observaciones, setObservaciones] = (0, import_react4.useState)("");
  const [responsable, setResponsable] = (0, import_react4.useState)("");
  const [errorAccion, setErrorAccion] = (0, import_react4.useState)("");
  const [confirmacionFaltanteAceite, setConfirmacionFaltanteAceite] = (0, import_react4.useState)("");
  const [confirmDeleteId, setConfirmDeleteId] = (0, import_react4.useState)(null);
  const [confirmEliminarRegistro, setConfirmEliminarRegistro] = (0, import_react4.useState)(null);
  const [avisoStockNoDevuelto, setAvisoStockNoDevuelto] = (0, import_react4.useState)("");
  const aceitesPosibles = (0, import_react4.useMemo)(
    () => productos.filter((p22) => /aceite|oliva|girasol/i.test(p22.nombre)).sort((a22, b2) => a22.nombre.localeCompare(b2.nombre, "es")),
    [productos]
  );
  function abrirNueva() {
    setEditingId(null);
    setForm({ nombre: "", litrosCarga: "", rellenoHabitual: "5", productoAceiteId: aceitesPosibles[0]?.id || "" });
    setError("");
    setShowForm(true);
  }
  function abrirEdicion(f22) {
    setEditingId(f22.id);
    setForm({
      nombre: f22.nombre,
      litrosCarga: String(f22.litrosCarga || ""),
      rellenoHabitual: String(f22.rellenoHabitual || 5),
      productoAceiteId: f22.productoAceiteId || ""
    });
    setError("");
    setShowForm(true);
  }
  function submit() {
    if (!form.nombre.trim()) {
      setError("Ponle un nombre a la freidora.");
      return;
    }
    if (!(Number(form.litrosCarga) > 0)) {
      setError("Indica cu\xE1ntos litros lleva un cambio completo.");
      return;
    }
    if (!form.productoAceiteId) {
      setError("Elige de qu\xE9 aceite del almac\xE9n se descuenta.");
      return;
    }
    if (editingId) updateFreidora(editingId, { ...form, litrosCarga: Number(form.litrosCarga), rellenoHabitual: Number(form.rellenoHabitual) });
    else addFreidora(form);
    setShowForm(false);
    setError("");
  }
  function abrirAccion(freidora, tipo) {
    setAccion({ freidora, tipo });
    setLitros(String(tipo === "cambio" ? freidora.litrosCarga || "" : freidora.rellenoHabitual || 5));
    setTipoCambio("Voluntario");
    setObservaciones("");
    setResponsable("");
    setErrorAccion("");
    setConfirmacionFaltanteAceite("");
  }
  const FRASE_CONFIRMACION_ACEITE = "CONFIRMO";
  function confirmarAccion() {
    const litrosNumero = Number(litros);
    const aceiteEnlazado = productos.find((p22) => p22.id === accion.freidora.productoAceiteId);
    const stockDisponible = litrosDisponibles(aceiteEnlazado);
    if (aceiteEnlazado && litrosNumero > stockDisponible) {
      if (confirmacionFaltanteAceite.trim().toUpperCase() !== FRASE_CONFIRMACION_ACEITE) {
        setErrorAccion(
          `Solo quedan ${fmt(stockDisponible)} L de ${aceiteEnlazado.nombre}, y est\xE1s pidiendo ${fmt(litrosNumero)} L. Si quieres registrarlo igual, escribe "${FRASE_CONFIRMACION_ACEITE}" en la casilla de abajo.`
        );
        return;
      }
    }
    const datos = { freidoraId: accion.freidora.id, litros: Number(litros), responsable };
    const r2 = accion.tipo === "cambio" ? registrarCambio({ ...datos, tipoCambio, observaciones }) : registrarRelleno(datos);
    if (!r2.ok) {
      setErrorAccion(r2.error);
      return;
    }
    setConfirmacionFaltanteAceite("");
    setAccion(null);
  }
  const registrosRecientes = (0, import_react4.useMemo)(
    () => (registrosAceite || []).slice(0, 25),
    [registrosAceite]
  );
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, { action: /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: abrirNueva }, /* @__PURE__ */ import_react4.default.createElement(Plus, { size: 15 }), " A\xF1adir freidora") }, "Aceite de freidoras"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px]" }, "Registra los cambios de aceite y los rellenos del d\xEDa a d\xEDa. Cada uno descuenta del almac\xE9n los litros que lleve, as\xED que el consumo real queda repartido en el tiempo tal como ocurre \u2014 no todo de golpe el d\xEDa del cambio.")), avisoStockNoDevuelto && /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.redSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, avisoStockNoDevuelto)), freidoras.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "A\xF1ade tu primera freidora para empezar a registrar los cambios de aceite." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-3 mb-5" }, freidoras.map((f22) => {
    const ciclo = consumoPorCiclo ? consumoPorCiclo(f22.id, registrosAceite) : null;
    const aceite = productos.find((p22) => p22.id === f22.productoAceiteId);
    return /* @__PURE__ */ import_react4.default.createElement(Card, { key: f22.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-start justify-between mb-2" }, /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-semibold text-[14px]" }, f22.nombre), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: C2.inkSoft } }, "Cambio de ", fmt(f22.litrosCarga), " L \xB7 relleno habitual ", fmt(f22.rellenoHabitual), " L"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px]", style: { color: aceite ? C2.inkSoft : C2.red } }, aceite ? `Descuenta de: ${aceite.nombre} (quedan ${fmt(litrosDisponibles(aceite))} L)` : "\u26A0 El aceite enlazado ya no existe")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => abrirEdicion(f22), "aria-label": "Editar freidora", className: "flex items-center justify-center shrink-0", style: { width: 44, height: 44 } }, /* @__PURE__ */ import_react4.default.createElement(Pencil, { size: 14, color: C2.inkSoft })), /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => setConfirmDeleteId(f22.id), "aria-label": "Eliminar freidora", className: "flex items-center justify-center shrink-0", style: { width: 44, height: 44 } }, /* @__PURE__ */ import_react4.default.createElement(Trash2, { size: 14, color: C2.inkSoft })))), ciclo && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-2 p-2 rounded-lg", style: { background: C2.bg } }, "Desde el \xFAltimo cambio (", ciclo.desde, ", hace ", ciclo.dias, " d\xEDa", ciclo.dias > 1 ? "s" : "", "):", " ", /* @__PURE__ */ import_react4.default.createElement("b", { className: "mono" }, fmt(ciclo.litrosTotal), " L"), " en total", ciclo.numRellenos > 0 && ` (${fmt(ciclo.litrosCambio)} del cambio + ${fmt(ciclo.litrosRelleno)} en ${ciclo.numRellenos} relleno${ciclo.numRellenos > 1 ? "s" : ""})`, ciclo.coste > 0 && ` \xB7 \u20AC${fmt(ciclo.coste)}`), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, onClick: () => abrirAccion(f22, "cambio") }, "Cambio de aceite"), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => abrirAccion(f22, "relleno") }, "Relleno")));
  })), registrosRecientes.length > 0 && /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-medium mb-2", style: { color: C2.inkSoft } }, "\xDAltimos registros"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1.5" }, registrosRecientes.map((r2) => /* @__PURE__ */ import_react4.default.createElement(Card, { key: r2.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]" }, r2.tipo === "cambio" ? "Cambio de aceite" : "Relleno", " \xB7 ", r2.freidoraNombre, r2.tipo === "cambio" && r2.tipoCambio === "Obligatorio" && /* @__PURE__ */ import_react4.default.createElement(Pill2, { color: C2.amber }, "obligatorio")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, r2.fecha, " ", r2.hora, r2.responsable ? ` \xB7 ${r2.responsable}` : "", r2.observaciones ? ` \xB7 ${r2.observaciones}` : "")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono text-[12.5px]" }, fmt(r2.litros), " L"), eliminarRegistroAceite && /* @__PURE__ */ import_react4.default.createElement("button", { onClick: () => setConfirmEliminarRegistro(r2), "aria-label": "Eliminar registro", className: "flex items-center justify-center shrink-0", style: { width: 44, height: 44 } }, /* @__PURE__ */ import_react4.default.createElement(Trash2, { size: 14, color: C2.inkSoft })))))))), showForm && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setShowForm(false), title: editingId ? "Editar freidora" : "Nueva freidora" }, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.nombre, onChange: (e2) => setForm({ ...form, nombre: e2.target.value }), placeholder: "Freidora 1 (churros)" })), /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-2 gap-x-3" }, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Litros de un cambio completo" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", value: form.litrosCarga, onChange: (e2) => setForm({ ...form, litrosCarga: e2.target.value }), placeholder: "50" })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Relleno habitual (litros)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", value: form.rellenoHabitual, onChange: (e2) => setForm({ ...form, rellenoHabitual: e2.target.value }), placeholder: "5" }))), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "\xBFDe qu\xE9 aceite del almac\xE9n se descuenta?" }, /* @__PURE__ */ import_react4.default.createElement(
    "select",
    {
      value: form.productoAceiteId,
      onChange: (e2) => setForm({ ...form, productoAceiteId: e2.target.value }),
      className: "w-full rounded-lg px-3 py-2 text-[13px]",
      style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink }
    },
    /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "\u2014 Elige el aceite \u2014"),
    aceitesPosibles.map((p22) => /* @__PURE__ */ import_react4.default.createElement("option", { key: p22.id, value: p22.id }, p22.nombre))
  ), aceitesPosibles.length === 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mt-1", style: { color: C2.amber } }, 'No encuentro ning\xFAn producto con "aceite" en el nombre. Cr\xE9alo primero en Productos.')), error && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", role: "alert", style: { color: C2.red } }, error), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 mt-1" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: submit }, editingId ? "Guardar cambios" : "A\xF1adir"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setShowForm(false) }, "Cancelar"))), accion && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setAccion(null), title: accion.tipo === "cambio" ? "Cambio de aceite" : "Relleno de aceite" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] mb-3" }, accion.freidora.nombre), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Litros" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", value: litros, onChange: (e2) => {
    setLitros(e2.target.value);
    setConfirmacionFaltanteAceite("");
  } }), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mt-1", style: { color: C2.inkSoft } }, accion.tipo === "cambio" ? "Se propone la carga completa. Aj\xFAstalo si has echado m\xE1s o menos." : "Se propone el relleno habitual. Aj\xFAstalo a ojo, no hace falta medirlo exacto.")), accion.tipo === "cambio" && /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Tipo de cambio" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, ["Voluntario", "Obligatorio"].map((t22) => /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      key: t22,
      onClick: () => setTipoCambio(t22),
      className: "text-[12px] font-medium px-3 py-1.5 rounded-full",
      style: {
        background: tipoCambio === t22 ? C2.accent : C2.surface,
        color: tipoCambio === t22 ? "#fff" : C2.inkSoft,
        border: `1px solid ${tipoCambio === t22 ? C2.accent : C2.line}`
      }
    },
    t22
  )))), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Observaciones (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: observaciones, onChange: (e2) => setObservaciones(e2.target.value), placeholder: "Aceite muy oscuro, olor fuerte\u2026" }))), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Qui\xE9n lo hace (opcional)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: responsable, onChange: (e2) => setResponsable(e2.target.value) })), (() => {
    const aceiteEnlazado = accion && productos.find((p22) => p22.id === accion.freidora.productoAceiteId);
    const stockDisponible = litrosDisponibles(aceiteEnlazado);
    const faltaAceite = aceiteEnlazado && Number(litros) > stockDisponible;
    if (!faltaAceite) return null;
    return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-3", style: { background: C2.redSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] mb-2" }, "Solo quedan ", fmt(stockDisponible), " L de ", aceiteEnlazado.nombre, ", y est\xE1s pidiendo ", fmt(Number(litros)), " L. Si lo registras igual, se quedar\xE1 en 0 aunque hayas gastado m\xE1s de lo que ten\xEDas."), /* @__PURE__ */ import_react4.default.createElement(Field, { label: `Para registrarlo igual, escribe "${FRASE_CONFIRMACION_ACEITE}"` }, /* @__PURE__ */ import_react4.default.createElement(
      Input,
      {
        value: confirmacionFaltanteAceite,
        onChange: (e2) => setConfirmacionFaltanteAceite(e2.target.value),
        placeholder: FRASE_CONFIRMACION_ACEITE
      }
    )));
  })(), errorAccion && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] mb-2", role: "alert", style: { color: C2.red } }, errorAccion), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 mt-1" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarAccion }, "Registrar y descontar del almac\xE9n"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setAccion(null) }, "Cancelar"))), confirmDeleteId && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setConfirmDeleteId(null), title: "Eliminar freidora" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] mb-4" }, "Se borra la freidora. Los registros de cambios y rellenos ya hechos se conservan en el hist\xF3rico."), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "danger", onClick: () => {
    deleteFreidora(confirmDeleteId);
    setConfirmDeleteId(null);
  } }, "S\xED, eliminar"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setConfirmDeleteId(null) }, "Cancelar"))), confirmEliminarRegistro && /* @__PURE__ */ import_react4.default.createElement(Modal, { onClose: () => setConfirmEliminarRegistro(null), title: "Eliminar registro de aceite" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] mb-4" }, "Se borra este ", confirmEliminarRegistro.tipo === "cambio" ? "cambio" : "relleno", " de", " ", /* @__PURE__ */ import_react4.default.createElement("b", null, fmt(confirmEliminarRegistro.litros), " L"), " (", confirmEliminarRegistro.freidoraNombre, "), y esos litros", " ", /* @__PURE__ */ import_react4.default.createElement("b", null, "vuelven a sumarse"), " al stock del aceite del almac\xE9n \u2014 como si nunca se hubiera registrado."), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(
    Btn,
    {
      variant: "danger",
      onClick: () => {
        const r2 = eliminarRegistroAceite(confirmEliminarRegistro);
        setAvisoStockNoDevuelto(
          r2 && r2.stockDevuelto === false ? "Se ha borrado el registro, pero no se ha podido devolver el stock: ni el registro ni la freidora ya existente sab\xEDan a qu\xE9 aceite pertenec\xEDa. Rev\xEDsalo a mano en Productos." : ""
        );
        setConfirmEliminarRegistro(null);
      }
    },
    "S\xED, eliminar y devolver el aceite"
  ), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setConfirmEliminarRegistro(null) }, "Cancelar"))));
}
function PrefiltroPublico({ token }) {
  const [estado, setEstado] = (0, import_react4.useState)("comprobando");
  const [candidatoNombre, setCandidatoNombre] = (0, import_react4.useState)("");
  const [form, setForm] = (0, import_react4.useState)({
    nombreCompleto: "",
    experienciaLaboral: "",
    motivoBusqueda: "",
    experienciaHosteleria: "",
    funcionesUltimoTrabajo: "",
    horariosRotativos: "",
    disponibilidadInmediata: "",
    zona: "",
    motivoSanGines: "",
    papeles: "",
    telefono: "",
    preguntas: ""
  });
  (0, import_react4.useEffect)(() => {
    (async () => {
      try {
        const resp = await fetch(
          "https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/prefiltro-candidato",
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "comprobar", token }) }
        );
        const r2 = await resp.json();
        if (!r2.ok) {
          setEstado("invalido");
          return;
        }
        if (r2.estado === "completado") {
          setEstado("completado");
          return;
        }
        setCandidatoNombre(r2.candidatoNombre || "");
        setForm((f22) => ({ ...f22, nombreCompleto: r2.candidatoNombre || "" }));
        setEstado("valido");
      } catch {
        setEstado("error");
      }
    })();
  }, [token]);
  async function enviar(e2) {
    e2.preventDefault();
    setEstado("enviando");
    try {
      const resp = await fetch(
        "https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/prefiltro-candidato",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "enviar", token, respuestas: form }) }
      );
      const r2 = await resp.json();
      if (!r2.ok) {
        setEstado("error");
        return;
      }
      setEstado("enviado");
    } catch {
      setEstado("error");
    }
  }
  const estiloBase = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F3E9", fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui', padding: 20 };
  const estiloCaja = { background: "#fff", padding: 28, borderRadius: 14, width: "100%", maxWidth: 420, border: "1px solid #E2DBC7", boxShadow: "0 4px 20px rgba(23,36,28,0.06)" };
  const estiloInput = { width: "100%", padding: "10px 12px", marginBottom: 14, border: "1px solid #E2DBC7", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
  const estiloLabel = { fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: "#17241C", display: "block" };
  if (estado === "comprobando") {
    return /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloBase }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { color: "#6B7A6E", fontSize: 13.5 } }, "Cargando\u2026"));
  }
  if (estado === "invalido") {
    return /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloBase }, /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloCaja }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 16, fontWeight: 700, marginBottom: 8 } }, "Este enlace no es v\xE1lido"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 13, color: "#6B7A6E" } }, "Puede que est\xE9 mal copiado, o que ya haya caducado. Ponte en contacto con la persona que te lo envi\xF3.")));
  }
  if (estado === "completado") {
    return /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloBase }, /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloCaja }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 16, fontWeight: 700, marginBottom: 8 } }, "Ya se ha recibido tu respuesta"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 13, color: "#6B7A6E" } }, "Este cuestionario ya est\xE1 completado \u2014 no se puede rellenar dos veces. Si crees que es un error, contacta con la persona que te lo envi\xF3.")));
  }
  if (estado === "enviado") {
    return /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloBase }, /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloCaja }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 16, fontWeight: 700, marginBottom: 8 } }, "\xA1Gracias!"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 13, color: "#6B7A6E" } }, "Hemos recibido tus respuestas. Nos pondremos en contacto contigo si seguimos adelante con el proceso.")));
  }
  if (estado === "error") {
    return /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloBase }, /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloCaja }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 16, fontWeight: 700, marginBottom: 8 } }, "No se ha podido conectar"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 13, color: "#6B7A6E" } }, "Comprueba tu conexi\xF3n y vuelve a intentarlo.")));
  }
  const enviando = estado === "enviando";
  return /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloBase }, /* @__PURE__ */ import_react4.default.createElement("form", { onSubmit: enviar, style: estiloCaja }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 18, fontWeight: 700, marginBottom: 4, color: "#17241C" } }, "Formulario de preselecci\xF3n"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 12.5, color: "#6B7A6E", marginBottom: 22 } }, candidatoNombre ? `Hola ${candidatoNombre}, ` : "Hola, ", "gracias por tu inter\xE9s \u2014 responde estas preguntas cortas antes de la entrevista."), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "Nombre completo"), /* @__PURE__ */ import_react4.default.createElement("input", { required: true, value: form.nombreCompleto, onChange: (e2) => setForm({ ...form, nombreCompleto: e2.target.value }), style: estiloInput }), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "Cu\xE9ntame sobre tu experiencia laboral"), /* @__PURE__ */ import_react4.default.createElement("textarea", { required: true, value: form.experienciaLaboral, onChange: (e2) => setForm({ ...form, experienciaLaboral: e2.target.value }), style: { ...estiloInput, minHeight: 60 } }), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "\xBFPor qu\xE9 est\xE1s buscando trabajo actualmente?"), /* @__PURE__ */ import_react4.default.createElement("textarea", { required: true, value: form.motivoBusqueda, onChange: (e2) => setForm({ ...form, motivoBusqueda: e2.target.value }), style: { ...estiloInput, minHeight: 60 } }), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "\xBFHas trabajado antes en hosteler\xEDa, cafeter\xEDa, restaurante o de cara al p\xFAblico?"), /* @__PURE__ */ import_react4.default.createElement("select", { required: true, value: form.experienciaHosteleria, onChange: (e2) => setForm({ ...form, experienciaHosteleria: e2.target.value }), style: estiloInput }, /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "Selecciona una opci\xF3n"), /* @__PURE__ */ import_react4.default.createElement("option", { value: "S\xED" }, "S\xED"), /* @__PURE__ */ import_react4.default.createElement("option", { value: "No" }, "No")), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "\xBFQu\xE9 funciones realizabas en tu \xFAltimo trabajo?"), /* @__PURE__ */ import_react4.default.createElement("textarea", { required: true, value: form.funcionesUltimoTrabajo, onChange: (e2) => setForm({ ...form, funcionesUltimoTrabajo: e2.target.value }), style: { ...estiloInput, minHeight: 60 } }), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "\xBFTienes disponibilidad para trabajar con horarios rotativos y partidos?"), /* @__PURE__ */ import_react4.default.createElement("select", { required: true, value: form.horariosRotativos, onChange: (e2) => setForm({ ...form, horariosRotativos: e2.target.value }), style: estiloInput }, /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "Selecciona una opci\xF3n"), /* @__PURE__ */ import_react4.default.createElement("option", { value: "S\xED" }, "S\xED"), /* @__PURE__ */ import_react4.default.createElement("option", { value: "No" }, "No")), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "\xBFTienes disponibilidad inmediata para incorporarte?"), /* @__PURE__ */ import_react4.default.createElement("select", { required: true, value: form.disponibilidadInmediata, onChange: (e2) => setForm({ ...form, disponibilidadInmediata: e2.target.value }), style: estiloInput }, /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "Selecciona una opci\xF3n"), /* @__PURE__ */ import_react4.default.createElement("option", { value: "S\xED" }, "S\xED"), /* @__PURE__ */ import_react4.default.createElement("option", { value: "No" }, "No")), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "\xBFEn qu\xE9 zona, barrio o c\xF3digo postal vives?"), /* @__PURE__ */ import_react4.default.createElement("input", { required: true, value: form.zona, onChange: (e2) => setForm({ ...form, zona: e2.target.value }), style: estiloInput }), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "\xBFPor qu\xE9 te interesa trabajar aqu\xED?"), /* @__PURE__ */ import_react4.default.createElement("textarea", { required: true, value: form.motivoSanGines, onChange: (e2) => setForm({ ...form, motivoSanGines: e2.target.value }), style: { ...estiloInput, minHeight: 60 } }), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "\xBFTienes DNI/NIE en regla para trabajar en Espa\xF1a?"), /* @__PURE__ */ import_react4.default.createElement("select", { required: true, value: form.papeles, onChange: (e2) => setForm({ ...form, papeles: e2.target.value }), style: estiloInput }, /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "Selecciona una opci\xF3n"), /* @__PURE__ */ import_react4.default.createElement("option", { value: "S\xED" }, "S\xED"), /* @__PURE__ */ import_react4.default.createElement("option", { value: "No" }, "No")), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "Tel\xE9fono de contacto"), /* @__PURE__ */ import_react4.default.createElement("input", { required: true, type: "tel", value: form.telefono, onChange: (e2) => setForm({ ...form, telefono: e2.target.value }), style: estiloInput }), /* @__PURE__ */ import_react4.default.createElement("label", { style: estiloLabel }, "\xBFHay algo que quieras preguntarnos sobre el puesto? (opcional)"), /* @__PURE__ */ import_react4.default.createElement("textarea", { value: form.preguntas, onChange: (e2) => setForm({ ...form, preguntas: e2.target.value }), style: { ...estiloInput, minHeight: 50 } }), /* @__PURE__ */ import_react4.default.createElement("button", { type: "submit", disabled: enviando, style: { width: "100%", padding: "11px", background: "#8C6D2A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" } }, enviando ? "Enviando\u2026" : "Enviar respuestas")));
}
var ultimosErroresAvisados = /* @__PURE__ */ new Map();
async function registrarErrorSistema(mensaje, pantalla, pila) {
  try {
    if (typeof window === "undefined" || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return;
    const supabase = await window.getSupabaseClient();
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
    const contexto = window.__contextoErroresPM20 || {};
    await supabase.from("errores_sistema").insert({
      id,
      mensaje: String(mensaje || "").slice(0, 500),
      pantalla: pantalla || "",
      pila: String(pila || "").slice(0, 2e3),
      dispositivo: navigator.userAgent.slice(0, 200),
      empresa_id: contexto.empresaId || null,
      local_id: contexto.localId || null
    });
    const clave = String(mensaje || "").slice(0, 200);
    const ahora = Date.now();
    const ultimoAviso = ultimosErroresAvisados.get(clave);
    if (!ultimoAviso || ahora - ultimoAviso > 10 * 60 * 1e3) {
      ultimosErroresAvisados.set(clave, ahora);
      fetch("https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/enviar-notificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: "Error en el programa",
          cuerpo: `${pantalla ? pantalla + ": " : ""}${String(mensaje || "").slice(0, 120)}`,
          url: "/"
        })
      }).catch(() => {
      });
    }
  } catch (e2) {
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("error", (evento) => {
    registrarErrorSistema(evento.message, "global", evento.error && evento.error.stack);
  });
  window.addEventListener("unhandledrejection", (evento) => {
    const razon = evento.reason;
    registrarErrorSistema(
      razon && razon.message ? razon.message : String(razon),
      "promesa sin capturar",
      razon && razon.stack
    );
  });
}
var ErrorBoundaryGlobal = class extends import_react4.default.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    registrarErrorSistema(error && error.message, "renderizado", error && error.stack || info && info.componentStack);
  }
  render() {
    if (this.state.error) {
      return /* @__PURE__ */ import_react4.default.createElement(
        "div",
        { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F3E9", padding: 20, fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui" } },
        /* @__PURE__ */ import_react4.default.createElement(
          "div",
          { style: { background: "#fff", padding: 28, borderRadius: 14, maxWidth: 380, border: "1px solid #E2DBC7", textAlign: "center" } },
          /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#17241C" } }, "Algo ha fallado"),
          /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 13, color: "#6B7A6E", marginBottom: 18 } }, "Se ha registrado el error autom\xE1ticamente. Recarga la p\xE1gina para continuar."),
          /* @__PURE__ */ import_react4.default.createElement(
            "button",
            {
              onClick: () => window.location.reload(),
              style: { padding: "10px 20px", background: "#8C6D2A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }
            },
            "Recargar"
          )
        )
      );
    }
    return this.props.children;
  }
};
function AppConSesion() {
  const [fase, setFase] = (0, import_react4.useState)("comprobando");
  const [cliente, setCliente] = (0, import_react4.useState)(null);
  const [email, setEmail] = (0, import_react4.useState)("");
  const [password, setPassword] = (0, import_react4.useState)("");
  const [error, setError] = (0, import_react4.useState)("");
  const [cargando, setCargando] = (0, import_react4.useState)(false);
  (0, import_react4.useEffect)(() => {
    let activo = true;
    (async () => {
      const hayNube = await window.conectarNube();
      if (!activo) return;
      if (!hayNube) {
        window.actualizarIndicador();
        setFase("dentro");
        return;
      }
      const supabase = window.__nubeCliente;
      setCliente(supabase);
      try {
        const { data } = await supabase.auth.getSession();
        if (!activo) return;
        if (data.session) {
          await window.subirPendientes();
          setFase("dentro");
        } else {
          setFase("login");
        }
        supabase.auth.onAuthStateChange(async (_evento, s22) => {
          if (!activo) return;
          if (s22) {
            await window.subirPendientes();
            setFase("dentro");
          } else setFase("login");
        });
      } catch (e2) {
        window.__nubeActiva = false;
        window.actualizarIndicador();
        setFase("dentro");
      }
    })();
    return () => {
      activo = false;
    };
  }, []);
  async function entrar(e2) {
    e2.preventDefault();
    if (!cliente) return;
    setError("");
    setCargando(true);
    const { error: error2 } = await cliente.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error2) setError("Correo o contrase\xF1a incorrectos.");
  }
  function entrarSinNube() {
    window.__nubeActiva = false;
    window.actualizarIndicador();
    setFase("dentro");
  }
  const estiloBase = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 26%, #1C5C46 0%, #123B2D 44%, #081A14 100%)", fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui", padding: 20 };
  if (fase === "comprobando") {
    return /* @__PURE__ */ import_react4.default.createElement("div", { style: { ...estiloBase, color: "#6B7A6E", fontSize: 13.5 } }, "Comprobando conexi\xF3n\u2026");
  }
  if (fase === "login") {
    const campoAcceso = { width: "100%", padding: "13px 14px", marginBottom: 12, border: "1px solid rgba(198,154,82,.30)", borderRadius: 12, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", background: "rgba(2,18,11,.52)", color: "#F4EBDD" };
    return /* @__PURE__ */ import_react4.default.createElement("div", { style: estiloBase }, /* @__PURE__ */ import_react4.default.createElement("form", { onSubmit: entrar, className: "form-acceso", style: { background: "linear-gradient(180deg, rgba(22,71,54,.985), rgba(12,39,30,.985))", padding: "30px 28px 26px", borderRadius: 24, width: "100%", maxWidth: 390, border: "1px solid rgba(198,154,82,.55)", boxShadow: "0 24px 70px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.03)", backdropFilter: "blur(10px)" } }, /* @__PURE__ */ import_react4.default.createElement("style", null, ".form-acceso :focus-visible { outline: 3px solid #C69A52; outline-offset: 2px; }"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", justifyContent: "center", marginBottom: 4 } }, /* @__PURE__ */ import_react4.default.createElement("img", { src: LOGO_PROYECTO, alt: "L&A Suite", style: { width: "72%", maxWidth: 225, height: "auto", display: "block", filter: "drop-shadow(0 8px 18px rgba(0,0,0,.28))" } })), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 27, fontWeight: 600, textAlign: "center", marginBottom: 6, color: "#F7F0E3", letterSpacing: ".01em" } }, "L&A Suite"), /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 12.5, color: "#AEBBB2", textAlign: "center", marginBottom: 24, lineHeight: 1.45 } }, "Inicia sesi\xF3n para sincronizar entre dispositivos"), /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        type: "email",
        required: true,
        autoFocus: true,
        placeholder: "Correo",
        value: email,
        onChange: (e2) => setEmail(e2.target.value),
        style: campoAcceso
      }
    ), /* @__PURE__ */ import_react4.default.createElement(
      "input",
      {
        type: "password",
        required: true,
        placeholder: "Contrase\xF1a",
        value: password,
        onChange: (e2) => setPassword(e2.target.value),
        style: { ...campoAcceso, marginBottom: 16 }
      }
    ), error && /* @__PURE__ */ import_react4.default.createElement("div", { style: { color: "#FFB9AE", fontSize: 12.5, marginBottom: 12, lineHeight: 1.4 } }, error), /* @__PURE__ */ import_react4.default.createElement("button", { type: "submit", disabled: cargando, style: { width: "100%", padding: "13px", background: "linear-gradient(135deg, #8A6028 0%, #C69A52 52%, #9B7132 100%)", color: "#071D12", border: "1px solid rgba(232,199,130,.66)", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 20px rgba(0,0,0,.22)" } }, cargando ? "Entrando\u2026" : "Entrar"), /* @__PURE__ */ import_react4.default.createElement("a", { href: "./restablecer-contrasena.html", style: { display: "block", marginTop: 12, textAlign: "center", fontSize: 12.5, color: "#C69A52", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" } }, "\xBFOlvidaste tu contrase\xF1a?"), /* @__PURE__ */ import_react4.default.createElement("button", { type: "button", onClick: entrarSinNube, style: { display: "block", width: "100%", marginTop: 12, textAlign: "center", fontSize: 12.5, color: "#C69A52", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", background: "transparent", border: "none", padding: 0, font: "inherit" } }, "Trabajar solo en este equipo, sin sincronizar")));
  }
  return /* @__PURE__ */ import_react4.default.createElement(GestionAlmacen, null);
}
var rutaHash = typeof window !== "undefined" ? window.location.hash : "";
var matchPrefiltro = /^#\/prefiltro\/(.+)$/.exec(rutaHash);
(0, import_client2.createRoot)(document.getElementById("root")).render(
  /* @__PURE__ */ import_react4.default.createElement(
    ErrorBoundaryGlobal,
    null,
    matchPrefiltro ? /* @__PURE__ */ import_react4.default.createElement(PrefiltroPublico, { token: matchPrefiltro[1] }) : /* @__PURE__ */ import_react4.default.createElement(AppConSesion, null)
  )
);
/*! Bundled license information:

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

scheduler/cjs/scheduler.development.js:
  (**
   * @license React
   * scheduler.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom.development.js:
  (**
   * @license React
   * react-dom.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
  (**
   * Checks if an event is supported in the current execution environment.
   *
   * NOTE: This will not work correctly for non-generic events such as `change`,
   * `reset`, `load`, `error`, and `select`.
   *
   * Borrows from Modernizr.
   *
   * @param {string} eventNameSuffix Event name, e.g. "click".
   * @return {boolean} True if the event is supported.
   * @internal
   * @license Modernizr 3.0.0pre (Custom Build) | MIT
   *)

lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs:
lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs:
lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs:
lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs:
lucide-react/dist/esm/defaultAttributes.mjs:
lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs:
lucide-react/dist/esm/context.mjs:
lucide-react/dist/esm/Icon.mjs:
lucide-react/dist/esm/createLucideIcon.mjs:
lucide-react/dist/esm/icons/arrow-left-right.mjs:
lucide-react/dist/esm/icons/bell.mjs:
lucide-react/dist/esm/icons/boxes.mjs:
lucide-react/dist/esm/icons/calculator.mjs:
lucide-react/dist/esm/icons/calendar-clock.mjs:
lucide-react/dist/esm/icons/calendar-days.mjs:
lucide-react/dist/esm/icons/calendar-range.mjs:
lucide-react/dist/esm/icons/camera.mjs:
lucide-react/dist/esm/icons/chart-column.mjs:
lucide-react/dist/esm/icons/chart-line.mjs:
lucide-react/dist/esm/icons/chevron-right.mjs:
lucide-react/dist/esm/icons/circle-arrow-down.mjs:
lucide-react/dist/esm/icons/circle-arrow-up.mjs:
lucide-react/dist/esm/icons/circle-check.mjs:
lucide-react/dist/esm/icons/clipboard-list.mjs:
lucide-react/dist/esm/icons/clock.mjs:
lucide-react/dist/esm/icons/cog.mjs:
lucide-react/dist/esm/icons/coins.mjs:
lucide-react/dist/esm/icons/download.mjs:
lucide-react/dist/esm/icons/droplet.mjs:
lucide-react/dist/esm/icons/ellipsis.mjs:
lucide-react/dist/esm/icons/eye-off.mjs:
lucide-react/dist/esm/icons/eye.mjs:
lucide-react/dist/esm/icons/factory.mjs:
lucide-react/dist/esm/icons/file-text.mjs:
lucide-react/dist/esm/icons/files.mjs:
lucide-react/dist/esm/icons/loader-circle.mjs:
lucide-react/dist/esm/icons/log-in.mjs:
lucide-react/dist/esm/icons/log-out.mjs:
lucide-react/dist/esm/icons/mail.mjs:
lucide-react/dist/esm/icons/map.mjs:
lucide-react/dist/esm/icons/message-circle.mjs:
lucide-react/dist/esm/icons/minus.mjs:
lucide-react/dist/esm/icons/package.mjs:
lucide-react/dist/esm/icons/pencil.mjs:
lucide-react/dist/esm/icons/phone.mjs:
lucide-react/dist/esm/icons/plus.mjs:
lucide-react/dist/esm/icons/receipt.mjs:
lucide-react/dist/esm/icons/rotate-ccw-clock.mjs:
lucide-react/dist/esm/icons/scan-barcode.mjs:
lucide-react/dist/esm/icons/search.mjs:
lucide-react/dist/esm/icons/shield-check.mjs:
lucide-react/dist/esm/icons/shopping-bag.mjs:
lucide-react/dist/esm/icons/shopping-cart.mjs:
lucide-react/dist/esm/icons/stethoscope.mjs:
lucide-react/dist/esm/icons/tags.mjs:
lucide-react/dist/esm/icons/trash-2.mjs:
lucide-react/dist/esm/icons/trending-up.mjs:
lucide-react/dist/esm/icons/triangle-alert.mjs:
lucide-react/dist/esm/icons/truck.mjs:
lucide-react/dist/esm/icons/upload.mjs:
lucide-react/dist/esm/icons/user-round.mjs:
lucide-react/dist/esm/icons/users.mjs:
lucide-react/dist/esm/icons/wallet.mjs:
lucide-react/dist/esm/icons/x.mjs:
lucide-react/dist/esm/icons/a-arrow-down.mjs:
lucide-react/dist/esm/icons/a-arrow-up.mjs:
lucide-react/dist/esm/icons/a-large-small.mjs:
lucide-react/dist/esm/icons/accessibility.mjs:
lucide-react/dist/esm/icons/activity.mjs:
lucide-react/dist/esm/icons/ad.mjs:
lucide-react/dist/esm/icons/air-vent.mjs:
lucide-react/dist/esm/icons/airplay.mjs:
lucide-react/dist/esm/icons/alarm-clock-check.mjs:
lucide-react/dist/esm/icons/alarm-clock-minus.mjs:
lucide-react/dist/esm/icons/alarm-clock-off.mjs:
lucide-react/dist/esm/icons/alarm-clock-plus.mjs:
lucide-react/dist/esm/icons/alarm-clock.mjs:
lucide-react/dist/esm/icons/alarm-smoke.mjs:
lucide-react/dist/esm/icons/album.mjs:
lucide-react/dist/esm/icons/align-center-horizontal.mjs:
lucide-react/dist/esm/icons/align-center-vertical.mjs:
lucide-react/dist/esm/icons/align-end-horizontal.mjs:
lucide-react/dist/esm/icons/align-end-vertical.mjs:
lucide-react/dist/esm/icons/align-horizontal-distribute-center.mjs:
lucide-react/dist/esm/icons/align-horizontal-distribute-end.mjs:
lucide-react/dist/esm/icons/align-horizontal-distribute-start.mjs:
lucide-react/dist/esm/icons/align-horizontal-justify-end.mjs:
lucide-react/dist/esm/icons/align-horizontal-justify-center.mjs:
lucide-react/dist/esm/icons/align-horizontal-justify-start.mjs:
lucide-react/dist/esm/icons/align-horizontal-space-around.mjs:
lucide-react/dist/esm/icons/align-horizontal-space-between.mjs:
lucide-react/dist/esm/icons/align-start-horizontal.mjs:
lucide-react/dist/esm/icons/align-start-vertical.mjs:
lucide-react/dist/esm/icons/align-vertical-distribute-center.mjs:
lucide-react/dist/esm/icons/align-vertical-distribute-end.mjs:
lucide-react/dist/esm/icons/align-vertical-distribute-start.mjs:
lucide-react/dist/esm/icons/align-vertical-justify-center.mjs:
lucide-react/dist/esm/icons/align-vertical-justify-start.mjs:
lucide-react/dist/esm/icons/align-vertical-justify-end.mjs:
lucide-react/dist/esm/icons/align-vertical-space-around.mjs:
lucide-react/dist/esm/icons/align-vertical-space-between.mjs:
lucide-react/dist/esm/icons/ambulance.mjs:
lucide-react/dist/esm/icons/ampersand.mjs:
lucide-react/dist/esm/icons/ampersands.mjs:
lucide-react/dist/esm/icons/amphora.mjs:
lucide-react/dist/esm/icons/anchor.mjs:
lucide-react/dist/esm/icons/angle.mjs:
lucide-react/dist/esm/icons/antenna.mjs:
lucide-react/dist/esm/icons/aperture.mjs:
lucide-react/dist/esm/icons/anvil.mjs:
lucide-react/dist/esm/icons/app-window-mac.mjs:
lucide-react/dist/esm/icons/app-window.mjs:
lucide-react/dist/esm/icons/apple.mjs:
lucide-react/dist/esm/icons/archive-restore.mjs:
lucide-react/dist/esm/icons/archive-x.mjs:
lucide-react/dist/esm/icons/archive.mjs:
lucide-react/dist/esm/icons/armchair.mjs:
lucide-react/dist/esm/icons/arrow-big-down-dash.mjs:
lucide-react/dist/esm/icons/arrow-big-down.mjs:
lucide-react/dist/esm/icons/arrow-big-left-dash.mjs:
lucide-react/dist/esm/icons/arrow-big-left.mjs:
lucide-react/dist/esm/icons/arrow-big-right-dash.mjs:
lucide-react/dist/esm/icons/arrow-big-right.mjs:
lucide-react/dist/esm/icons/arrow-big-up-dash.mjs:
lucide-react/dist/esm/icons/arrow-big-up.mjs:
lucide-react/dist/esm/icons/arrow-down-0-1.mjs:
lucide-react/dist/esm/icons/arrow-down-1-0.mjs:
lucide-react/dist/esm/icons/arrow-down-a-z.mjs:
lucide-react/dist/esm/icons/arrow-down-from-line.mjs:
lucide-react/dist/esm/icons/arrow-down-left.mjs:
lucide-react/dist/esm/icons/arrow-down-narrow-wide.mjs:
lucide-react/dist/esm/icons/arrow-down-right.mjs:
lucide-react/dist/esm/icons/arrow-down-to-dot.mjs:
lucide-react/dist/esm/icons/arrow-down-to-line.mjs:
lucide-react/dist/esm/icons/arrow-down-up.mjs:
lucide-react/dist/esm/icons/arrow-down-z-a.mjs:
lucide-react/dist/esm/icons/arrow-down-wide-narrow.mjs:
lucide-react/dist/esm/icons/arrow-down.mjs:
lucide-react/dist/esm/icons/arrow-left-from-line.mjs:
lucide-react/dist/esm/icons/arrow-left-to-line.mjs:
lucide-react/dist/esm/icons/arrow-left.mjs:
lucide-react/dist/esm/icons/arrow-right-from-line.mjs:
lucide-react/dist/esm/icons/arrow-right-left.mjs:
lucide-react/dist/esm/icons/arrow-right-to-line.mjs:
lucide-react/dist/esm/icons/arrow-right.mjs:
lucide-react/dist/esm/icons/arrow-up-0-1.mjs:
lucide-react/dist/esm/icons/arrow-up-1-0.mjs:
lucide-react/dist/esm/icons/arrow-up-a-z.mjs:
lucide-react/dist/esm/icons/arrow-up-down.mjs:
lucide-react/dist/esm/icons/arrow-up-from-dot.mjs:
lucide-react/dist/esm/icons/arrow-up-from-line.mjs:
lucide-react/dist/esm/icons/arrow-up-left.mjs:
lucide-react/dist/esm/icons/arrow-up-narrow-wide.mjs:
lucide-react/dist/esm/icons/arrow-up-right.mjs:
lucide-react/dist/esm/icons/arrow-up-to-line.mjs:
lucide-react/dist/esm/icons/arrow-up-wide-narrow.mjs:
lucide-react/dist/esm/icons/arrow-up-z-a.mjs:
lucide-react/dist/esm/icons/arrow-up.mjs:
lucide-react/dist/esm/icons/arrows-up-from-line.mjs:
lucide-react/dist/esm/icons/asterisk.mjs:
lucide-react/dist/esm/icons/astroid.mjs:
lucide-react/dist/esm/icons/at-sign.mjs:
lucide-react/dist/esm/icons/atom.mjs:
lucide-react/dist/esm/icons/audio-lines-off.mjs:
lucide-react/dist/esm/icons/audio-lines-x.mjs:
lucide-react/dist/esm/icons/audio-lines.mjs:
lucide-react/dist/esm/icons/audio-waveform.mjs:
lucide-react/dist/esm/icons/award.mjs:
lucide-react/dist/esm/icons/axe.mjs:
lucide-react/dist/esm/icons/axis-3d.mjs:
lucide-react/dist/esm/icons/baby.mjs:
lucide-react/dist/esm/icons/backpack.mjs:
lucide-react/dist/esm/icons/badge-alert.mjs:
lucide-react/dist/esm/icons/badge-cent.mjs:
lucide-react/dist/esm/icons/badge-check.mjs:
lucide-react/dist/esm/icons/badge-dollar-sign.mjs:
lucide-react/dist/esm/icons/badge-euro.mjs:
lucide-react/dist/esm/icons/badge-indian-rupee.mjs:
lucide-react/dist/esm/icons/badge-info.mjs:
lucide-react/dist/esm/icons/badge-japanese-yen.mjs:
lucide-react/dist/esm/icons/badge-percent.mjs:
lucide-react/dist/esm/icons/badge-minus.mjs:
lucide-react/dist/esm/icons/badge-plus.mjs:
lucide-react/dist/esm/icons/badge-pound-sterling.mjs:
lucide-react/dist/esm/icons/badge-question-mark.mjs:
lucide-react/dist/esm/icons/badge-russian-ruble.mjs:
lucide-react/dist/esm/icons/badge-swiss-franc.mjs:
lucide-react/dist/esm/icons/badge-turkish-lira.mjs:
lucide-react/dist/esm/icons/badge-x.mjs:
lucide-react/dist/esm/icons/badge.mjs:
lucide-react/dist/esm/icons/baggage-claim.mjs:
lucide-react/dist/esm/icons/balloon.mjs:
lucide-react/dist/esm/icons/banana.mjs:
lucide-react/dist/esm/icons/ban.mjs:
lucide-react/dist/esm/icons/bandage.mjs:
lucide-react/dist/esm/icons/banknote-arrow-down.mjs:
lucide-react/dist/esm/icons/banknote-arrow-up.mjs:
lucide-react/dist/esm/icons/banknote-check.mjs:
lucide-react/dist/esm/icons/banknote-x.mjs:
lucide-react/dist/esm/icons/banknote.mjs:
lucide-react/dist/esm/icons/barcode.mjs:
lucide-react/dist/esm/icons/barrel.mjs:
lucide-react/dist/esm/icons/baseline.mjs:
lucide-react/dist/esm/icons/bath.mjs:
lucide-react/dist/esm/icons/battery-charging.mjs:
lucide-react/dist/esm/icons/battery-full.mjs:
lucide-react/dist/esm/icons/battery-low.mjs:
lucide-react/dist/esm/icons/battery-medium.mjs:
lucide-react/dist/esm/icons/battery-plus.mjs:
lucide-react/dist/esm/icons/battery-warning.mjs:
lucide-react/dist/esm/icons/battery.mjs:
lucide-react/dist/esm/icons/beaker.mjs:
lucide-react/dist/esm/icons/bean-off.mjs:
lucide-react/dist/esm/icons/bed-double.mjs:
lucide-react/dist/esm/icons/bean.mjs:
lucide-react/dist/esm/icons/bed-single.mjs:
lucide-react/dist/esm/icons/bed.mjs:
lucide-react/dist/esm/icons/beef-off.mjs:
lucide-react/dist/esm/icons/beef.mjs:
lucide-react/dist/esm/icons/beer-off.mjs:
lucide-react/dist/esm/icons/beer.mjs:
lucide-react/dist/esm/icons/bell-check.mjs:
lucide-react/dist/esm/icons/bell-dot.mjs:
lucide-react/dist/esm/icons/bell-electric.mjs:
lucide-react/dist/esm/icons/bell-minus.mjs:
lucide-react/dist/esm/icons/bell-off.mjs:
lucide-react/dist/esm/icons/bell-ring.mjs:
lucide-react/dist/esm/icons/bell-plus.mjs:
lucide-react/dist/esm/icons/between-horizontal-end.mjs:
lucide-react/dist/esm/icons/between-horizontal-start.mjs:
lucide-react/dist/esm/icons/between-vertical-end.mjs:
lucide-react/dist/esm/icons/between-vertical-start.mjs:
lucide-react/dist/esm/icons/bike.mjs:
lucide-react/dist/esm/icons/biceps-flexed.mjs:
lucide-react/dist/esm/icons/binary.mjs:
lucide-react/dist/esm/icons/binoculars.mjs:
lucide-react/dist/esm/icons/biohazard.mjs:
lucide-react/dist/esm/icons/bird.mjs:
lucide-react/dist/esm/icons/birdhouse.mjs:
lucide-react/dist/esm/icons/bitcoin.mjs:
lucide-react/dist/esm/icons/blend.mjs:
lucide-react/dist/esm/icons/blender.mjs:
lucide-react/dist/esm/icons/blinds.mjs:
lucide-react/dist/esm/icons/blocks.mjs:
lucide-react/dist/esm/icons/bluetooth-connected.mjs:
lucide-react/dist/esm/icons/bluetooth-searching.mjs:
lucide-react/dist/esm/icons/bluetooth.mjs:
lucide-react/dist/esm/icons/bluetooth-off.mjs:
lucide-react/dist/esm/icons/bold.mjs:
lucide-react/dist/esm/icons/bomb.mjs:
lucide-react/dist/esm/icons/bolt.mjs:
lucide-react/dist/esm/icons/bone-fracture.mjs:
lucide-react/dist/esm/icons/bone.mjs:
lucide-react/dist/esm/icons/book-a.mjs:
lucide-react/dist/esm/icons/book-alert.mjs:
lucide-react/dist/esm/icons/book-audio.mjs:
lucide-react/dist/esm/icons/book-check.mjs:
lucide-react/dist/esm/icons/book-copy.mjs:
lucide-react/dist/esm/icons/book-dashed.mjs:
lucide-react/dist/esm/icons/book-down.mjs:
lucide-react/dist/esm/icons/book-headphones.mjs:
lucide-react/dist/esm/icons/book-heart.mjs:
lucide-react/dist/esm/icons/book-image.mjs:
lucide-react/dist/esm/icons/book-key.mjs:
lucide-react/dist/esm/icons/book-lock.mjs:
lucide-react/dist/esm/icons/book-marked.mjs:
lucide-react/dist/esm/icons/book-minus.mjs:
lucide-react/dist/esm/icons/book-open-check.mjs:
lucide-react/dist/esm/icons/book-open-text.mjs:
lucide-react/dist/esm/icons/book-open.mjs:
lucide-react/dist/esm/icons/book-plus.mjs:
lucide-react/dist/esm/icons/book-text.mjs:
lucide-react/dist/esm/icons/book-search.mjs:
lucide-react/dist/esm/icons/book-type.mjs:
lucide-react/dist/esm/icons/book-up-2.mjs:
lucide-react/dist/esm/icons/book-up.mjs:
lucide-react/dist/esm/icons/book-user.mjs:
lucide-react/dist/esm/icons/book.mjs:
lucide-react/dist/esm/icons/book-x.mjs:
lucide-react/dist/esm/icons/bookmark-check.mjs:
lucide-react/dist/esm/icons/bookmark-minus.mjs:
lucide-react/dist/esm/icons/bookmark-off.mjs:
lucide-react/dist/esm/icons/bookmark-plus.mjs:
lucide-react/dist/esm/icons/bookmark.mjs:
lucide-react/dist/esm/icons/bookmark-x.mjs:
lucide-react/dist/esm/icons/boom-box.mjs:
lucide-react/dist/esm/icons/bot-message-square.mjs:
lucide-react/dist/esm/icons/bot-off.mjs:
lucide-react/dist/esm/icons/bot.mjs:
lucide-react/dist/esm/icons/bottle-wine.mjs:
lucide-react/dist/esm/icons/bow-arrow.mjs:
lucide-react/dist/esm/icons/box.mjs:
lucide-react/dist/esm/icons/braces.mjs:
lucide-react/dist/esm/icons/brackets.mjs:
lucide-react/dist/esm/icons/brain-cog.mjs:
lucide-react/dist/esm/icons/brain-circuit.mjs:
lucide-react/dist/esm/icons/brain.mjs:
lucide-react/dist/esm/icons/brick-wall-fire.mjs:
lucide-react/dist/esm/icons/brick-wall-shield.mjs:
lucide-react/dist/esm/icons/brick-wall.mjs:
lucide-react/dist/esm/icons/briefcase-business.mjs:
lucide-react/dist/esm/icons/briefcase-conveyor-belt.mjs:
lucide-react/dist/esm/icons/briefcase-medical.mjs:
lucide-react/dist/esm/icons/briefcase.mjs:
lucide-react/dist/esm/icons/bring-to-front.mjs:
lucide-react/dist/esm/icons/broccoli.mjs:
lucide-react/dist/esm/icons/broom-sparkles.mjs:
lucide-react/dist/esm/icons/broom.mjs:
lucide-react/dist/esm/icons/brush-cleaning.mjs:
lucide-react/dist/esm/icons/brush.mjs:
lucide-react/dist/esm/icons/bubbles.mjs:
lucide-react/dist/esm/icons/bug-play.mjs:
lucide-react/dist/esm/icons/bug-off.mjs:
lucide-react/dist/esm/icons/bug.mjs:
lucide-react/dist/esm/icons/building-2.mjs:
lucide-react/dist/esm/icons/building.mjs:
lucide-react/dist/esm/icons/bus-front.mjs:
lucide-react/dist/esm/icons/bus.mjs:
lucide-react/dist/esm/icons/cable-car.mjs:
lucide-react/dist/esm/icons/cable.mjs:
lucide-react/dist/esm/icons/cake-slice.mjs:
lucide-react/dist/esm/icons/cake.mjs:
lucide-react/dist/esm/icons/calendar-1.mjs:
lucide-react/dist/esm/icons/calendar-arrow-down.mjs:
lucide-react/dist/esm/icons/calendar-arrow-up.mjs:
lucide-react/dist/esm/icons/calendar-check-2.mjs:
lucide-react/dist/esm/icons/calendar-check.mjs:
lucide-react/dist/esm/icons/calendar-cog.mjs:
lucide-react/dist/esm/icons/calendar-fold.mjs:
lucide-react/dist/esm/icons/calendar-minus-2.mjs:
lucide-react/dist/esm/icons/calendar-heart.mjs:
lucide-react/dist/esm/icons/calendar-minus.mjs:
lucide-react/dist/esm/icons/calendar-off.mjs:
lucide-react/dist/esm/icons/calendar-plus-2.mjs:
lucide-react/dist/esm/icons/calendar-plus.mjs:
lucide-react/dist/esm/icons/calendar-search.mjs:
lucide-react/dist/esm/icons/calendar-sync.mjs:
lucide-react/dist/esm/icons/calendar-x.mjs:
lucide-react/dist/esm/icons/calendar-x-2.mjs:
lucide-react/dist/esm/icons/calendar.mjs:
lucide-react/dist/esm/icons/calendars.mjs:
lucide-react/dist/esm/icons/camera-off.mjs:
lucide-react/dist/esm/icons/candy-cane.mjs:
lucide-react/dist/esm/icons/candy-off.mjs:
lucide-react/dist/esm/icons/candy.mjs:
lucide-react/dist/esm/icons/cannabis-off.mjs:
lucide-react/dist/esm/icons/cannabis.mjs:
lucide-react/dist/esm/icons/captions-off.mjs:
lucide-react/dist/esm/icons/captions.mjs:
lucide-react/dist/esm/icons/car-battery.mjs:
lucide-react/dist/esm/icons/car-front.mjs:
lucide-react/dist/esm/icons/car-taxi-front.mjs:
lucide-react/dist/esm/icons/car.mjs:
lucide-react/dist/esm/icons/caravan.mjs:
lucide-react/dist/esm/icons/card-sim.mjs:
lucide-react/dist/esm/icons/carrot.mjs:
lucide-react/dist/esm/icons/case-lower.mjs:
lucide-react/dist/esm/icons/case-sensitive.mjs:
lucide-react/dist/esm/icons/cassette-tape.mjs:
lucide-react/dist/esm/icons/case-upper.mjs:
lucide-react/dist/esm/icons/cast.mjs:
lucide-react/dist/esm/icons/castle.mjs:
lucide-react/dist/esm/icons/cat.mjs:
lucide-react/dist/esm/icons/cctv-off.mjs:
lucide-react/dist/esm/icons/cctv.mjs:
lucide-react/dist/esm/icons/chart-area.mjs:
lucide-react/dist/esm/icons/chart-bar-big.mjs:
lucide-react/dist/esm/icons/chart-bar-decreasing.mjs:
lucide-react/dist/esm/icons/chart-bar-increasing.mjs:
lucide-react/dist/esm/icons/chart-bar-stacked.mjs:
lucide-react/dist/esm/icons/chart-bar.mjs:
lucide-react/dist/esm/icons/chart-candlestick.mjs:
lucide-react/dist/esm/icons/chart-column-big.mjs:
lucide-react/dist/esm/icons/chart-column-decreasing.mjs:
lucide-react/dist/esm/icons/chart-column-increasing.mjs:
lucide-react/dist/esm/icons/chart-column-stacked.mjs:
lucide-react/dist/esm/icons/chart-gantt.mjs:
lucide-react/dist/esm/icons/chart-network.mjs:
lucide-react/dist/esm/icons/chart-no-axes-column-decreasing.mjs:
lucide-react/dist/esm/icons/chart-no-axes-column-increasing.mjs:
lucide-react/dist/esm/icons/chart-no-axes-column.mjs:
lucide-react/dist/esm/icons/chart-no-axes-combined.mjs:
lucide-react/dist/esm/icons/chart-no-axes-gantt.mjs:
lucide-react/dist/esm/icons/chart-pie.mjs:
lucide-react/dist/esm/icons/chart-scatter.mjs:
lucide-react/dist/esm/icons/chart-spline.mjs:
lucide-react/dist/esm/icons/check-check.mjs:
lucide-react/dist/esm/icons/check-line.mjs:
lucide-react/dist/esm/icons/check.mjs:
lucide-react/dist/esm/icons/chef-hat.mjs:
lucide-react/dist/esm/icons/cherry.mjs:
lucide-react/dist/esm/icons/chess-bishop.mjs:
lucide-react/dist/esm/icons/chess-king.mjs:
lucide-react/dist/esm/icons/chess-knight.mjs:
lucide-react/dist/esm/icons/chess-pawn.mjs:
lucide-react/dist/esm/icons/chess-queen.mjs:
lucide-react/dist/esm/icons/chess-rook.mjs:
lucide-react/dist/esm/icons/chevron-down.mjs:
lucide-react/dist/esm/icons/chevron-first.mjs:
lucide-react/dist/esm/icons/chevron-last.mjs:
lucide-react/dist/esm/icons/chevron-left.mjs:
lucide-react/dist/esm/icons/chevron-up.mjs:
lucide-react/dist/esm/icons/chevrons-down-up.mjs:
lucide-react/dist/esm/icons/chevrons-down.mjs:
lucide-react/dist/esm/icons/chevrons-left-right-ellipsis.mjs:
lucide-react/dist/esm/icons/chevrons-left-right.mjs:
lucide-react/dist/esm/icons/chevrons-right-left.mjs:
lucide-react/dist/esm/icons/chevrons-left.mjs:
lucide-react/dist/esm/icons/chevrons-right.mjs:
lucide-react/dist/esm/icons/chevrons-up-down.mjs:
lucide-react/dist/esm/icons/chevrons-up.mjs:
lucide-react/dist/esm/icons/church.mjs:
lucide-react/dist/esm/icons/cigarette-off.mjs:
lucide-react/dist/esm/icons/cigarette.mjs:
lucide-react/dist/esm/icons/circle-alert.mjs:
lucide-react/dist/esm/icons/circle-arrow-left.mjs:
lucide-react/dist/esm/icons/circle-arrow-out-down-left.mjs:
lucide-react/dist/esm/icons/circle-arrow-out-down-right.mjs:
lucide-react/dist/esm/icons/circle-arrow-out-up-left.mjs:
lucide-react/dist/esm/icons/circle-arrow-out-up-right.mjs:
lucide-react/dist/esm/icons/circle-arrow-right.mjs:
lucide-react/dist/esm/icons/circle-check-big.mjs:
lucide-react/dist/esm/icons/circle-chevron-down.mjs:
lucide-react/dist/esm/icons/circle-chevron-left.mjs:
lucide-react/dist/esm/icons/circle-chevron-right.mjs:
lucide-react/dist/esm/icons/circle-chevron-up.mjs:
lucide-react/dist/esm/icons/circle-dashed.mjs:
lucide-react/dist/esm/icons/circle-divide.mjs:
lucide-react/dist/esm/icons/circle-dollar-sign.mjs:
lucide-react/dist/esm/icons/circle-dot-dashed.mjs:
lucide-react/dist/esm/icons/circle-dot.mjs:
lucide-react/dist/esm/icons/circle-ellipsis.mjs:
lucide-react/dist/esm/icons/circle-equal.mjs:
lucide-react/dist/esm/icons/circle-euro.mjs:
lucide-react/dist/esm/icons/circle-fading-arrow-up.mjs:
lucide-react/dist/esm/icons/circle-fading-plus.mjs:
lucide-react/dist/esm/icons/circle-gauge.mjs:
lucide-react/dist/esm/icons/circle-minus.mjs:
lucide-react/dist/esm/icons/circle-off.mjs:
lucide-react/dist/esm/icons/circle-parking-off.mjs:
lucide-react/dist/esm/icons/circle-parking.mjs:
lucide-react/dist/esm/icons/circle-pause.mjs:
lucide-react/dist/esm/icons/circle-percent.mjs:
lucide-react/dist/esm/icons/circle-pile.mjs:
lucide-react/dist/esm/icons/circle-play.mjs:
lucide-react/dist/esm/icons/circle-plus.mjs:
lucide-react/dist/esm/icons/circle-pound-sterling.mjs:
lucide-react/dist/esm/icons/circle-power.mjs:
lucide-react/dist/esm/icons/circle-question-mark.mjs:
lucide-react/dist/esm/icons/circle-slash-2.mjs:
lucide-react/dist/esm/icons/circle-slash.mjs:
lucide-react/dist/esm/icons/circle-small.mjs:
lucide-react/dist/esm/icons/circle-star.mjs:
lucide-react/dist/esm/icons/circle-stop.mjs:
lucide-react/dist/esm/icons/circle-user-round.mjs:
lucide-react/dist/esm/icons/circle-user.mjs:
lucide-react/dist/esm/icons/circle-x.mjs:
lucide-react/dist/esm/icons/circle.mjs:
lucide-react/dist/esm/icons/circuit-board.mjs:
lucide-react/dist/esm/icons/citrus.mjs:
lucide-react/dist/esm/icons/clapperboard.mjs:
lucide-react/dist/esm/icons/clipboard-check.mjs:
lucide-react/dist/esm/icons/clipboard-clock.mjs:
lucide-react/dist/esm/icons/clipboard-copy.mjs:
lucide-react/dist/esm/icons/clipboard-minus.mjs:
lucide-react/dist/esm/icons/clipboard-paste.mjs:
lucide-react/dist/esm/icons/clipboard-pen-line.mjs:
lucide-react/dist/esm/icons/clipboard-pen.mjs:
lucide-react/dist/esm/icons/clipboard-plus.mjs:
lucide-react/dist/esm/icons/clipboard-type.mjs:
lucide-react/dist/esm/icons/clipboard.mjs:
lucide-react/dist/esm/icons/clipboard-x.mjs:
lucide-react/dist/esm/icons/clock-1.mjs:
lucide-react/dist/esm/icons/clock-10.mjs:
lucide-react/dist/esm/icons/clock-11.mjs:
lucide-react/dist/esm/icons/clock-12.mjs:
lucide-react/dist/esm/icons/clock-2.mjs:
lucide-react/dist/esm/icons/clock-3.mjs:
lucide-react/dist/esm/icons/clock-4.mjs:
lucide-react/dist/esm/icons/clock-5.mjs:
lucide-react/dist/esm/icons/clock-6.mjs:
lucide-react/dist/esm/icons/clock-7.mjs:
lucide-react/dist/esm/icons/clock-8.mjs:
lucide-react/dist/esm/icons/clock-9.mjs:
lucide-react/dist/esm/icons/clock-alert.mjs:
lucide-react/dist/esm/icons/clock-arrow-down.mjs:
lucide-react/dist/esm/icons/clock-arrow-left.mjs:
lucide-react/dist/esm/icons/clock-arrow-right.mjs:
lucide-react/dist/esm/icons/clock-arrow-up.mjs:
lucide-react/dist/esm/icons/clock-check.mjs:
lucide-react/dist/esm/icons/clock-fading.mjs:
lucide-react/dist/esm/icons/clock-plus.mjs:
lucide-react/dist/esm/icons/closed-caption.mjs:
lucide-react/dist/esm/icons/cloud-alert.mjs:
lucide-react/dist/esm/icons/cloud-backup.mjs:
lucide-react/dist/esm/icons/cloud-check.mjs:
lucide-react/dist/esm/icons/cloud-cog.mjs:
lucide-react/dist/esm/icons/cloud-download.mjs:
lucide-react/dist/esm/icons/cloud-drizzle.mjs:
lucide-react/dist/esm/icons/cloud-fog.mjs:
lucide-react/dist/esm/icons/cloud-hail.mjs:
lucide-react/dist/esm/icons/cloud-lightning.mjs:
lucide-react/dist/esm/icons/cloud-moon-rain.mjs:
lucide-react/dist/esm/icons/cloud-moon.mjs:
lucide-react/dist/esm/icons/cloud-off.mjs:
lucide-react/dist/esm/icons/cloud-rain-wind.mjs:
lucide-react/dist/esm/icons/cloud-rain.mjs:
lucide-react/dist/esm/icons/cloud-sun-rain.mjs:
lucide-react/dist/esm/icons/cloud-snow.mjs:
lucide-react/dist/esm/icons/cloud-sun.mjs:
lucide-react/dist/esm/icons/cloud-sync.mjs:
lucide-react/dist/esm/icons/cloud-upload.mjs:
lucide-react/dist/esm/icons/cloud.mjs:
lucide-react/dist/esm/icons/cloudy.mjs:
lucide-react/dist/esm/icons/clover.mjs:
lucide-react/dist/esm/icons/club.mjs:
lucide-react/dist/esm/icons/code.mjs:
lucide-react/dist/esm/icons/code-xml.mjs:
lucide-react/dist/esm/icons/coffee.mjs:
lucide-react/dist/esm/icons/columns-2.mjs:
lucide-react/dist/esm/icons/columns-3-cog.mjs:
lucide-react/dist/esm/icons/columns-3.mjs:
lucide-react/dist/esm/icons/columns-4.mjs:
lucide-react/dist/esm/icons/combine.mjs:
lucide-react/dist/esm/icons/command.mjs:
lucide-react/dist/esm/icons/compass.mjs:
lucide-react/dist/esm/icons/component.mjs:
lucide-react/dist/esm/icons/computer.mjs:
lucide-react/dist/esm/icons/concierge-bell.mjs:
lucide-react/dist/esm/icons/cone.mjs:
lucide-react/dist/esm/icons/construction.mjs:
lucide-react/dist/esm/icons/contact-round.mjs:
lucide-react/dist/esm/icons/contact.mjs:
lucide-react/dist/esm/icons/contrast.mjs:
lucide-react/dist/esm/icons/container.mjs:
lucide-react/dist/esm/icons/cookie.mjs:
lucide-react/dist/esm/icons/cooking-pot.mjs:
lucide-react/dist/esm/icons/copy-check.mjs:
lucide-react/dist/esm/icons/copy-minus.mjs:
lucide-react/dist/esm/icons/copy-plus.mjs:
lucide-react/dist/esm/icons/copy-slash.mjs:
lucide-react/dist/esm/icons/copy-x.mjs:
lucide-react/dist/esm/icons/copyleft.mjs:
lucide-react/dist/esm/icons/copy.mjs:
lucide-react/dist/esm/icons/copyright.mjs:
lucide-react/dist/esm/icons/corner-down-left.mjs:
lucide-react/dist/esm/icons/corner-down-right.mjs:
lucide-react/dist/esm/icons/corner-left-down.mjs:
lucide-react/dist/esm/icons/corner-left-up.mjs:
lucide-react/dist/esm/icons/corner-right-down.mjs:
lucide-react/dist/esm/icons/corner-right-up.mjs:
lucide-react/dist/esm/icons/corner-up-left.mjs:
lucide-react/dist/esm/icons/corner-up-right.mjs:
lucide-react/dist/esm/icons/cpu.mjs:
lucide-react/dist/esm/icons/creative-commons.mjs:
lucide-react/dist/esm/icons/credit-card.mjs:
lucide-react/dist/esm/icons/croissant.mjs:
lucide-react/dist/esm/icons/cross.mjs:
lucide-react/dist/esm/icons/crop.mjs:
lucide-react/dist/esm/icons/crosshair.mjs:
lucide-react/dist/esm/icons/crown.mjs:
lucide-react/dist/esm/icons/cuboid.mjs:
lucide-react/dist/esm/icons/currency.mjs:
lucide-react/dist/esm/icons/cylinder.mjs:
lucide-react/dist/esm/icons/dam.mjs:
lucide-react/dist/esm/icons/cup-soda.mjs:
lucide-react/dist/esm/icons/database-arrow-down.mjs:
lucide-react/dist/esm/icons/database-arrow-up.mjs:
lucide-react/dist/esm/icons/database-check.mjs:
lucide-react/dist/esm/icons/database-backup.mjs:
lucide-react/dist/esm/icons/database-minus.mjs:
lucide-react/dist/esm/icons/database-plus.mjs:
lucide-react/dist/esm/icons/database-search.mjs:
lucide-react/dist/esm/icons/database-x.mjs:
lucide-react/dist/esm/icons/database-zap.mjs:
lucide-react/dist/esm/icons/database.mjs:
lucide-react/dist/esm/icons/decimals-arrow-left.mjs:
lucide-react/dist/esm/icons/decimals-arrow-right.mjs:
lucide-react/dist/esm/icons/delete.mjs:
lucide-react/dist/esm/icons/dessert.mjs:
lucide-react/dist/esm/icons/diameter.mjs:
lucide-react/dist/esm/icons/diamond-minus.mjs:
lucide-react/dist/esm/icons/diamond-percent.mjs:
lucide-react/dist/esm/icons/diamond-plus.mjs:
lucide-react/dist/esm/icons/diamond.mjs:
lucide-react/dist/esm/icons/dice-1.mjs:
lucide-react/dist/esm/icons/dice-2.mjs:
lucide-react/dist/esm/icons/dice-3.mjs:
lucide-react/dist/esm/icons/dice-4.mjs:
lucide-react/dist/esm/icons/dice-5.mjs:
lucide-react/dist/esm/icons/dice-6.mjs:
lucide-react/dist/esm/icons/dices.mjs:
lucide-react/dist/esm/icons/diff.mjs:
lucide-react/dist/esm/icons/disc-2.mjs:
lucide-react/dist/esm/icons/disc-3.mjs:
lucide-react/dist/esm/icons/disc-album.mjs:
lucide-react/dist/esm/icons/disc.mjs:
lucide-react/dist/esm/icons/divide.mjs:
lucide-react/dist/esm/icons/dna-off.mjs:
lucide-react/dist/esm/icons/dna.mjs:
lucide-react/dist/esm/icons/dock.mjs:
lucide-react/dist/esm/icons/dog.mjs:
lucide-react/dist/esm/icons/dollar-sign.mjs:
lucide-react/dist/esm/icons/donut.mjs:
lucide-react/dist/esm/icons/door-closed-locked.mjs:
lucide-react/dist/esm/icons/door-closed.mjs:
lucide-react/dist/esm/icons/door-open.mjs:
lucide-react/dist/esm/icons/dot.mjs:
lucide-react/dist/esm/icons/drafting-compass.mjs:
lucide-react/dist/esm/icons/drama.mjs:
lucide-react/dist/esm/icons/drill.mjs:
lucide-react/dist/esm/icons/drone.mjs:
lucide-react/dist/esm/icons/droplet-off.mjs:
lucide-react/dist/esm/icons/droplets.mjs:
lucide-react/dist/esm/icons/drum.mjs:
lucide-react/dist/esm/icons/drumstick.mjs:
lucide-react/dist/esm/icons/dumbbell.mjs:
lucide-react/dist/esm/icons/ear-off.mjs:
lucide-react/dist/esm/icons/ear.mjs:
lucide-react/dist/esm/icons/earth-lock.mjs:
lucide-react/dist/esm/icons/earth.mjs:
lucide-react/dist/esm/icons/eclipse.mjs:
lucide-react/dist/esm/icons/egg-fried.mjs:
lucide-react/dist/esm/icons/egg-off.mjs:
lucide-react/dist/esm/icons/egg.mjs:
lucide-react/dist/esm/icons/eject.mjs:
lucide-react/dist/esm/icons/ellipse.mjs:
lucide-react/dist/esm/icons/ellipsis-vertical.mjs:
lucide-react/dist/esm/icons/equal-approximately.mjs:
lucide-react/dist/esm/icons/equal-not.mjs:
lucide-react/dist/esm/icons/equal.mjs:
lucide-react/dist/esm/icons/eraser.mjs:
lucide-react/dist/esm/icons/ethernet-port.mjs:
lucide-react/dist/esm/icons/euro.mjs:
lucide-react/dist/esm/icons/ev-charger.mjs:
lucide-react/dist/esm/icons/expand.mjs:
lucide-react/dist/esm/icons/external-link.mjs:
lucide-react/dist/esm/icons/eye-closed.mjs:
lucide-react/dist/esm/icons/eye-dashed.mjs:
lucide-react/dist/esm/icons/face-expressionless.mjs:
lucide-react/dist/esm/icons/face-angry.mjs:
lucide-react/dist/esm/icons/face-neutral.mjs:
lucide-react/dist/esm/icons/face-grinning.mjs:
lucide-react/dist/esm/icons/face-slightly-frowning.mjs:
lucide-react/dist/esm/icons/face-slightly-smiling-plus.mjs:
lucide-react/dist/esm/icons/face-slightly-smiling.mjs:
lucide-react/dist/esm/icons/fan.mjs:
lucide-react/dist/esm/icons/fast-forward.mjs:
lucide-react/dist/esm/icons/feather.mjs:
lucide-react/dist/esm/icons/fence.mjs:
lucide-react/dist/esm/icons/ferris-wheel.mjs:
lucide-react/dist/esm/icons/file-archive.mjs:
lucide-react/dist/esm/icons/file-axis-3d.mjs:
lucide-react/dist/esm/icons/file-badge.mjs:
lucide-react/dist/esm/icons/file-box.mjs:
lucide-react/dist/esm/icons/file-braces-corner.mjs:
lucide-react/dist/esm/icons/file-braces.mjs:
lucide-react/dist/esm/icons/file-chart-column-increasing.mjs:
lucide-react/dist/esm/icons/file-chart-column.mjs:
lucide-react/dist/esm/icons/file-chart-line.mjs:
lucide-react/dist/esm/icons/file-chart-pie.mjs:
lucide-react/dist/esm/icons/file-check-corner.mjs:
lucide-react/dist/esm/icons/file-check.mjs:
lucide-react/dist/esm/icons/file-clock.mjs:
lucide-react/dist/esm/icons/file-code-corner.mjs:
lucide-react/dist/esm/icons/file-code.mjs:
lucide-react/dist/esm/icons/file-cog.mjs:
lucide-react/dist/esm/icons/file-diff.mjs:
lucide-react/dist/esm/icons/file-digit.mjs:
lucide-react/dist/esm/icons/file-down.mjs:
lucide-react/dist/esm/icons/file-exclamation-point.mjs:
lucide-react/dist/esm/icons/file-headphone.mjs:
lucide-react/dist/esm/icons/file-heart.mjs:
lucide-react/dist/esm/icons/file-image.mjs:
lucide-react/dist/esm/icons/file-input.mjs:
lucide-react/dist/esm/icons/file-key.mjs:
lucide-react/dist/esm/icons/file-lock.mjs:
lucide-react/dist/esm/icons/file-minus-corner.mjs:
lucide-react/dist/esm/icons/file-minus.mjs:
lucide-react/dist/esm/icons/file-music.mjs:
lucide-react/dist/esm/icons/file-output.mjs:
lucide-react/dist/esm/icons/file-pen-line.mjs:
lucide-react/dist/esm/icons/file-pen.mjs:
lucide-react/dist/esm/icons/file-play.mjs:
lucide-react/dist/esm/icons/file-plus-corner.mjs:
lucide-react/dist/esm/icons/file-plus.mjs:
lucide-react/dist/esm/icons/file-question-mark.mjs:
lucide-react/dist/esm/icons/file-scan.mjs:
lucide-react/dist/esm/icons/file-search-corner.mjs:
lucide-react/dist/esm/icons/file-search.mjs:
lucide-react/dist/esm/icons/file-signal.mjs:
lucide-react/dist/esm/icons/file-sliders.mjs:
lucide-react/dist/esm/icons/file-spreadsheet.mjs:
lucide-react/dist/esm/icons/file-stack.mjs:
lucide-react/dist/esm/icons/file-symlink.mjs:
lucide-react/dist/esm/icons/file-terminal.mjs:
lucide-react/dist/esm/icons/file-type-corner.mjs:
lucide-react/dist/esm/icons/file-type.mjs:
lucide-react/dist/esm/icons/file-up.mjs:
lucide-react/dist/esm/icons/file-user.mjs:
lucide-react/dist/esm/icons/file-video-camera.mjs:
lucide-react/dist/esm/icons/file-volume.mjs:
lucide-react/dist/esm/icons/file-x-corner.mjs:
lucide-react/dist/esm/icons/file-x.mjs:
lucide-react/dist/esm/icons/file.mjs:
lucide-react/dist/esm/icons/film.mjs:
lucide-react/dist/esm/icons/fingerprint-pattern.mjs:
lucide-react/dist/esm/icons/fire-extinguisher.mjs:
lucide-react/dist/esm/icons/fish-off.mjs:
lucide-react/dist/esm/icons/fish-symbol.mjs:
lucide-react/dist/esm/icons/fish.mjs:
lucide-react/dist/esm/icons/fishing-hook.mjs:
lucide-react/dist/esm/icons/fishing-rod.mjs:
lucide-react/dist/esm/icons/flag-off.mjs:
lucide-react/dist/esm/icons/flag-triangle-left.mjs:
lucide-react/dist/esm/icons/flag-triangle-right.mjs:
lucide-react/dist/esm/icons/flag.mjs:
lucide-react/dist/esm/icons/flame-kindling.mjs:
lucide-react/dist/esm/icons/flame.mjs:
lucide-react/dist/esm/icons/flashlight-off.mjs:
lucide-react/dist/esm/icons/flashlight.mjs:
lucide-react/dist/esm/icons/flask-conical-off.mjs:
lucide-react/dist/esm/icons/flask-round.mjs:
lucide-react/dist/esm/icons/flask-conical.mjs:
lucide-react/dist/esm/icons/flip-horizontal-2.mjs:
lucide-react/dist/esm/icons/flip-vertical-2.mjs:
lucide-react/dist/esm/icons/flower-2.mjs:
lucide-react/dist/esm/icons/flower.mjs:
lucide-react/dist/esm/icons/focus.mjs:
lucide-react/dist/esm/icons/fold-horizontal.mjs:
lucide-react/dist/esm/icons/fold-vertical.mjs:
lucide-react/dist/esm/icons/folder-archive.mjs:
lucide-react/dist/esm/icons/folder-bookmark.mjs:
lucide-react/dist/esm/icons/folder-check.mjs:
lucide-react/dist/esm/icons/folder-clock.mjs:
lucide-react/dist/esm/icons/folder-closed.mjs:
lucide-react/dist/esm/icons/folder-code.mjs:
lucide-react/dist/esm/icons/folder-cog.mjs:
lucide-react/dist/esm/icons/folder-dot.mjs:
lucide-react/dist/esm/icons/folder-down.mjs:
lucide-react/dist/esm/icons/folder-git-2.mjs:
lucide-react/dist/esm/icons/folder-git.mjs:
lucide-react/dist/esm/icons/folder-heart.mjs:
lucide-react/dist/esm/icons/folder-input.mjs:
lucide-react/dist/esm/icons/folder-kanban.mjs:
lucide-react/dist/esm/icons/folder-key.mjs:
lucide-react/dist/esm/icons/folder-lock.mjs:
lucide-react/dist/esm/icons/folder-minus.mjs:
lucide-react/dist/esm/icons/folder-open-dot.mjs:
lucide-react/dist/esm/icons/folder-open.mjs:
lucide-react/dist/esm/icons/folder-output.mjs:
lucide-react/dist/esm/icons/folder-pen.mjs:
lucide-react/dist/esm/icons/folder-plus.mjs:
lucide-react/dist/esm/icons/folder-root.mjs:
lucide-react/dist/esm/icons/folder-search-2.mjs:
lucide-react/dist/esm/icons/folder-search.mjs:
lucide-react/dist/esm/icons/folder-symlink.mjs:
lucide-react/dist/esm/icons/folder-sync.mjs:
lucide-react/dist/esm/icons/folder-tree.mjs:
lucide-react/dist/esm/icons/folder-up.mjs:
lucide-react/dist/esm/icons/folder-x.mjs:
lucide-react/dist/esm/icons/folder.mjs:
lucide-react/dist/esm/icons/folders.mjs:
lucide-react/dist/esm/icons/forklift.mjs:
lucide-react/dist/esm/icons/footprints.mjs:
lucide-react/dist/esm/icons/form.mjs:
lucide-react/dist/esm/icons/forward.mjs:
lucide-react/dist/esm/icons/frame.mjs:
lucide-react/dist/esm/icons/fuel.mjs:
lucide-react/dist/esm/icons/funnel-plus.mjs:
lucide-react/dist/esm/icons/fullscreen.mjs:
lucide-react/dist/esm/icons/funnel-x.mjs:
lucide-react/dist/esm/icons/funnel.mjs:
lucide-react/dist/esm/icons/gallery-horizontal-end.mjs:
lucide-react/dist/esm/icons/gallery-horizontal.mjs:
lucide-react/dist/esm/icons/gallery-thumbnails.mjs:
lucide-react/dist/esm/icons/gallery-vertical-end.mjs:
lucide-react/dist/esm/icons/gallery-vertical.mjs:
lucide-react/dist/esm/icons/gamepad-2.mjs:
lucide-react/dist/esm/icons/gamepad-directional.mjs:
lucide-react/dist/esm/icons/gamepad.mjs:
lucide-react/dist/esm/icons/gauge.mjs:
lucide-react/dist/esm/icons/gavel.mjs:
lucide-react/dist/esm/icons/gem.mjs:
lucide-react/dist/esm/icons/georgian-lari.mjs:
lucide-react/dist/esm/icons/ghost.mjs:
lucide-react/dist/esm/icons/git-branch-minus.mjs:
lucide-react/dist/esm/icons/gift.mjs:
lucide-react/dist/esm/icons/git-branch-plus.mjs:
lucide-react/dist/esm/icons/git-branch.mjs:
lucide-react/dist/esm/icons/git-commit-horizontal.mjs:
lucide-react/dist/esm/icons/git-commit-vertical.mjs:
lucide-react/dist/esm/icons/git-compare-arrows.mjs:
lucide-react/dist/esm/icons/git-fork.mjs:
lucide-react/dist/esm/icons/git-compare.mjs:
lucide-react/dist/esm/icons/git-graph.mjs:
lucide-react/dist/esm/icons/git-merge-conflict.mjs:
lucide-react/dist/esm/icons/git-merge.mjs:
lucide-react/dist/esm/icons/git-pull-request-arrow.mjs:
lucide-react/dist/esm/icons/git-pull-request-closed.mjs:
lucide-react/dist/esm/icons/git-pull-request-create-arrow.mjs:
lucide-react/dist/esm/icons/git-pull-request-draft.mjs:
lucide-react/dist/esm/icons/git-pull-request-create.mjs:
lucide-react/dist/esm/icons/git-pull-request.mjs:
lucide-react/dist/esm/icons/glass-water.mjs:
lucide-react/dist/esm/icons/glasses.mjs:
lucide-react/dist/esm/icons/globe-check.mjs:
lucide-react/dist/esm/icons/globe-lock.mjs:
lucide-react/dist/esm/icons/globe-off.mjs:
lucide-react/dist/esm/icons/globe.mjs:
lucide-react/dist/esm/icons/globe-x.mjs:
lucide-react/dist/esm/icons/goal.mjs:
lucide-react/dist/esm/icons/gpu.mjs:
lucide-react/dist/esm/icons/graduation-cap.mjs:
lucide-react/dist/esm/icons/grape.mjs:
lucide-react/dist/esm/icons/grid-2x2-plus.mjs:
lucide-react/dist/esm/icons/grid-2x2-check.mjs:
lucide-react/dist/esm/icons/grid-2x2-x.mjs:
lucide-react/dist/esm/icons/grid-3x2.mjs:
lucide-react/dist/esm/icons/grid-2x2.mjs:
lucide-react/dist/esm/icons/grid-3x3.mjs:
lucide-react/dist/esm/icons/grip-horizontal.mjs:
lucide-react/dist/esm/icons/grip-vertical.mjs:
lucide-react/dist/esm/icons/grip.mjs:
lucide-react/dist/esm/icons/group.mjs:
lucide-react/dist/esm/icons/guitar.mjs:
lucide-react/dist/esm/icons/ham.mjs:
lucide-react/dist/esm/icons/hamburger.mjs:
lucide-react/dist/esm/icons/hammer.mjs:
lucide-react/dist/esm/icons/hand-coins.mjs:
lucide-react/dist/esm/icons/hand-fist.mjs:
lucide-react/dist/esm/icons/hand-grab.mjs:
lucide-react/dist/esm/icons/hand-heart.mjs:
lucide-react/dist/esm/icons/hand-helping.mjs:
lucide-react/dist/esm/icons/hand-metal.mjs:
lucide-react/dist/esm/icons/hand-platter.mjs:
lucide-react/dist/esm/icons/hand.mjs:
lucide-react/dist/esm/icons/handbag.mjs:
lucide-react/dist/esm/icons/handshake.mjs:
lucide-react/dist/esm/icons/hard-drive-download.mjs:
lucide-react/dist/esm/icons/hard-drive-upload.mjs:
lucide-react/dist/esm/icons/hard-drive.mjs:
lucide-react/dist/esm/icons/hard-hat.mjs:
lucide-react/dist/esm/icons/hash.mjs:
lucide-react/dist/esm/icons/hat-glasses.mjs:
lucide-react/dist/esm/icons/haze.mjs:
lucide-react/dist/esm/icons/hd.mjs:
lucide-react/dist/esm/icons/hdmi-port.mjs:
lucide-react/dist/esm/icons/heading-1.mjs:
lucide-react/dist/esm/icons/heading-2.mjs:
lucide-react/dist/esm/icons/heading-3.mjs:
lucide-react/dist/esm/icons/heading-4.mjs:
lucide-react/dist/esm/icons/heading-5.mjs:
lucide-react/dist/esm/icons/heading-6.mjs:
lucide-react/dist/esm/icons/heading.mjs:
lucide-react/dist/esm/icons/headphone-off.mjs:
lucide-react/dist/esm/icons/headphones.mjs:
lucide-react/dist/esm/icons/headset.mjs:
lucide-react/dist/esm/icons/heart-crack.mjs:
lucide-react/dist/esm/icons/heart-handshake.mjs:
lucide-react/dist/esm/icons/heart-minus.mjs:
lucide-react/dist/esm/icons/heart-off.mjs:
lucide-react/dist/esm/icons/heart-plus.mjs:
lucide-react/dist/esm/icons/heart-x.mjs:
lucide-react/dist/esm/icons/heart-pulse.mjs:
lucide-react/dist/esm/icons/heart.mjs:
lucide-react/dist/esm/icons/heater.mjs:
lucide-react/dist/esm/icons/helicopter.mjs:
lucide-react/dist/esm/icons/hexagon.mjs:
lucide-react/dist/esm/icons/hop-off.mjs:
lucide-react/dist/esm/icons/hop.mjs:
lucide-react/dist/esm/icons/highlighter.mjs:
lucide-react/dist/esm/icons/hospital.mjs:
lucide-react/dist/esm/icons/hotel.mjs:
lucide-react/dist/esm/icons/hourglass.mjs:
lucide-react/dist/esm/icons/house-heart.mjs:
lucide-react/dist/esm/icons/house-plug.mjs:
lucide-react/dist/esm/icons/house-plus.mjs:
lucide-react/dist/esm/icons/house-wifi.mjs:
lucide-react/dist/esm/icons/house.mjs:
lucide-react/dist/esm/icons/ice-cream-bowl.mjs:
lucide-react/dist/esm/icons/ice-cream-cone.mjs:
lucide-react/dist/esm/icons/id-card-lanyard.mjs:
lucide-react/dist/esm/icons/id-card.mjs:
lucide-react/dist/esm/icons/image-minus.mjs:
lucide-react/dist/esm/icons/image-down.mjs:
lucide-react/dist/esm/icons/image-off.mjs:
lucide-react/dist/esm/icons/image-play.mjs:
lucide-react/dist/esm/icons/image-plus.mjs:
lucide-react/dist/esm/icons/image-up.mjs:
lucide-react/dist/esm/icons/image-upscale.mjs:
lucide-react/dist/esm/icons/image.mjs:
lucide-react/dist/esm/icons/images.mjs:
lucide-react/dist/esm/icons/import.mjs:
lucide-react/dist/esm/icons/inbox.mjs:
lucide-react/dist/esm/icons/indian-rupee.mjs:
lucide-react/dist/esm/icons/infinity.mjs:
lucide-react/dist/esm/icons/info.mjs:
lucide-react/dist/esm/icons/inspection-panel.mjs:
lucide-react/dist/esm/icons/italic.mjs:
lucide-react/dist/esm/icons/iteration-ccw.mjs:
lucide-react/dist/esm/icons/iteration-cw.mjs:
lucide-react/dist/esm/icons/japanese-yen.mjs:
lucide-react/dist/esm/icons/kanban.mjs:
lucide-react/dist/esm/icons/joystick.mjs:
lucide-react/dist/esm/icons/kayak.mjs:
lucide-react/dist/esm/icons/key-round.mjs:
lucide-react/dist/esm/icons/key.mjs:
lucide-react/dist/esm/icons/key-square.mjs:
lucide-react/dist/esm/icons/keyboard-music.mjs:
lucide-react/dist/esm/icons/keyboard-off.mjs:
lucide-react/dist/esm/icons/keyboard.mjs:
lucide-react/dist/esm/icons/lamp-ceiling.mjs:
lucide-react/dist/esm/icons/lamp-desk.mjs:
lucide-react/dist/esm/icons/lamp-floor.mjs:
lucide-react/dist/esm/icons/lamp-wall-down.mjs:
lucide-react/dist/esm/icons/lamp-wall-up.mjs:
lucide-react/dist/esm/icons/land-plot.mjs:
lucide-react/dist/esm/icons/landmark.mjs:
lucide-react/dist/esm/icons/lamp.mjs:
lucide-react/dist/esm/icons/languages.mjs:
lucide-react/dist/esm/icons/laptop-minimal-check.mjs:
lucide-react/dist/esm/icons/laptop-minimal.mjs:
lucide-react/dist/esm/icons/laptop.mjs:
lucide-react/dist/esm/icons/lasso.mjs:
lucide-react/dist/esm/icons/layer-arrow-down.mjs:
lucide-react/dist/esm/icons/lasso-select.mjs:
lucide-react/dist/esm/icons/layer-arrow-up.mjs:
lucide-react/dist/esm/icons/layers-arrow-down.mjs:
lucide-react/dist/esm/icons/layers-2.mjs:
lucide-react/dist/esm/icons/layers-minus.mjs:
lucide-react/dist/esm/icons/layers-arrow-up.mjs:
lucide-react/dist/esm/icons/layers-plus.mjs:
lucide-react/dist/esm/icons/layers.mjs:
lucide-react/dist/esm/icons/layout-freeform.mjs:
lucide-react/dist/esm/icons/layout-dashboard.mjs:
lucide-react/dist/esm/icons/layout-grid.mjs:
lucide-react/dist/esm/icons/layout-list.mjs:
lucide-react/dist/esm/icons/layout-panel-left.mjs:
lucide-react/dist/esm/icons/layout-panel-top.mjs:
lucide-react/dist/esm/icons/leaf.mjs:
lucide-react/dist/esm/icons/layout-template.mjs:
lucide-react/dist/esm/icons/leafy-green.mjs:
lucide-react/dist/esm/icons/lectern.mjs:
lucide-react/dist/esm/icons/lens-concave.mjs:
lucide-react/dist/esm/icons/lens-convex.mjs:
lucide-react/dist/esm/icons/library-big.mjs:
lucide-react/dist/esm/icons/library.mjs:
lucide-react/dist/esm/icons/life-buoy.mjs:
lucide-react/dist/esm/icons/ligature.mjs:
lucide-react/dist/esm/icons/lightbulb-off.mjs:
lucide-react/dist/esm/icons/lightbulb.mjs:
lucide-react/dist/esm/icons/line-dot-right-horizontal.mjs:
lucide-react/dist/esm/icons/line-squiggle.mjs:
lucide-react/dist/esm/icons/line-style.mjs:
lucide-react/dist/esm/icons/link-2-off.mjs:
lucide-react/dist/esm/icons/link-2.mjs:
lucide-react/dist/esm/icons/link.mjs:
lucide-react/dist/esm/icons/list-check.mjs:
lucide-react/dist/esm/icons/list-checks.mjs:
lucide-react/dist/esm/icons/list-chevrons-down-up.mjs:
lucide-react/dist/esm/icons/list-chevrons-up-down.mjs:
lucide-react/dist/esm/icons/list-clock.mjs:
lucide-react/dist/esm/icons/list-collapse.mjs:
lucide-react/dist/esm/icons/list-end.mjs:
lucide-react/dist/esm/icons/list-filter-plus.mjs:
lucide-react/dist/esm/icons/list-filter.mjs:
lucide-react/dist/esm/icons/list-indent-decrease.mjs:
lucide-react/dist/esm/icons/list-indent-increase.mjs:
lucide-react/dist/esm/icons/list-minus.mjs:
lucide-react/dist/esm/icons/list-music.mjs:
lucide-react/dist/esm/icons/list-ordered.mjs:
lucide-react/dist/esm/icons/list-plus.mjs:
lucide-react/dist/esm/icons/list-restart.mjs:
lucide-react/dist/esm/icons/list-sort-ascending.mjs:
lucide-react/dist/esm/icons/list-sort-descending.mjs:
lucide-react/dist/esm/icons/list-start.mjs:
lucide-react/dist/esm/icons/list-todo.mjs:
lucide-react/dist/esm/icons/list-tree.mjs:
lucide-react/dist/esm/icons/list-x.mjs:
lucide-react/dist/esm/icons/list-video.mjs:
lucide-react/dist/esm/icons/list.mjs:
lucide-react/dist/esm/icons/loader-pinwheel.mjs:
lucide-react/dist/esm/icons/loader.mjs:
lucide-react/dist/esm/icons/locate-fixed.mjs:
lucide-react/dist/esm/icons/locate-off.mjs:
lucide-react/dist/esm/icons/locate.mjs:
lucide-react/dist/esm/icons/lock-keyhole.mjs:
lucide-react/dist/esm/icons/lock-keyhole-open.mjs:
lucide-react/dist/esm/icons/lock-open.mjs:
lucide-react/dist/esm/icons/lock.mjs:
lucide-react/dist/esm/icons/logs.mjs:
lucide-react/dist/esm/icons/lollipop.mjs:
lucide-react/dist/esm/icons/luggage.mjs:
lucide-react/dist/esm/icons/magnet.mjs:
lucide-react/dist/esm/icons/mail-badge.mjs:
lucide-react/dist/esm/icons/mail-check.mjs:
lucide-react/dist/esm/icons/mail-clock.mjs:
lucide-react/dist/esm/icons/mail-minus.mjs:
lucide-react/dist/esm/icons/mail-open.mjs:
lucide-react/dist/esm/icons/mail-plus.mjs:
lucide-react/dist/esm/icons/mail-question-mark.mjs:
lucide-react/dist/esm/icons/mail-search.mjs:
lucide-react/dist/esm/icons/mail-warning.mjs:
lucide-react/dist/esm/icons/mail-x.mjs:
lucide-react/dist/esm/icons/mailbox.mjs:
lucide-react/dist/esm/icons/mails.mjs:
lucide-react/dist/esm/icons/map-minus.mjs:
lucide-react/dist/esm/icons/map-pin-check.mjs:
lucide-react/dist/esm/icons/map-pin-check-inside.mjs:
lucide-react/dist/esm/icons/map-pin-house.mjs:
lucide-react/dist/esm/icons/map-pin-minus-inside.mjs:
lucide-react/dist/esm/icons/map-pin-minus.mjs:
lucide-react/dist/esm/icons/map-pin-off.mjs:
lucide-react/dist/esm/icons/map-pin-pen.mjs:
lucide-react/dist/esm/icons/map-pin-plus.mjs:
lucide-react/dist/esm/icons/map-pin-plus-inside.mjs:
lucide-react/dist/esm/icons/map-pin-search.mjs:
lucide-react/dist/esm/icons/map-pin-x-inside.mjs:
lucide-react/dist/esm/icons/map-pin-x.mjs:
lucide-react/dist/esm/icons/map-pin.mjs:
lucide-react/dist/esm/icons/map-pinned.mjs:
lucide-react/dist/esm/icons/map-plus.mjs:
lucide-react/dist/esm/icons/mars-stroke.mjs:
lucide-react/dist/esm/icons/mars.mjs:
lucide-react/dist/esm/icons/martini.mjs:
lucide-react/dist/esm/icons/maximize-2.mjs:
lucide-react/dist/esm/icons/maximize.mjs:
lucide-react/dist/esm/icons/medal.mjs:
lucide-react/dist/esm/icons/megaphone-off.mjs:
lucide-react/dist/esm/icons/megaphone.mjs:
lucide-react/dist/esm/icons/memory-stick.mjs:
lucide-react/dist/esm/icons/menu.mjs:
lucide-react/dist/esm/icons/merge.mjs:
lucide-react/dist/esm/icons/message-circle-check.mjs:
lucide-react/dist/esm/icons/message-circle-code.mjs:
lucide-react/dist/esm/icons/message-circle-dashed.mjs:
lucide-react/dist/esm/icons/message-circle-heart.mjs:
lucide-react/dist/esm/icons/message-circle-more.mjs:
lucide-react/dist/esm/icons/message-circle-off.mjs:
lucide-react/dist/esm/icons/message-circle-plus.mjs:
lucide-react/dist/esm/icons/message-circle-question-mark.mjs:
lucide-react/dist/esm/icons/message-circle-reply.mjs:
lucide-react/dist/esm/icons/message-circle-x.mjs:
lucide-react/dist/esm/icons/message-circle-warning.mjs:
lucide-react/dist/esm/icons/message-square-check.mjs:
lucide-react/dist/esm/icons/message-square-code.mjs:
lucide-react/dist/esm/icons/message-square-dashed.mjs:
lucide-react/dist/esm/icons/message-square-diff.mjs:
lucide-react/dist/esm/icons/message-square-dot.mjs:
lucide-react/dist/esm/icons/message-square-heart.mjs:
lucide-react/dist/esm/icons/message-square-lock.mjs:
lucide-react/dist/esm/icons/message-square-more.mjs:
lucide-react/dist/esm/icons/message-square-off.mjs:
lucide-react/dist/esm/icons/message-square-plus.mjs:
lucide-react/dist/esm/icons/message-square-quote.mjs:
lucide-react/dist/esm/icons/message-square-reply.mjs:
lucide-react/dist/esm/icons/message-square-share.mjs:
lucide-react/dist/esm/icons/message-square-text.mjs:
lucide-react/dist/esm/icons/message-square-warning.mjs:
lucide-react/dist/esm/icons/message-square-x.mjs:
lucide-react/dist/esm/icons/message-square.mjs:
lucide-react/dist/esm/icons/messages-square.mjs:
lucide-react/dist/esm/icons/metronome.mjs:
lucide-react/dist/esm/icons/mic-audio-lines.mjs:
lucide-react/dist/esm/icons/mic-off.mjs:
lucide-react/dist/esm/icons/mic-signal.mjs:
lucide-react/dist/esm/icons/mic-vocal.mjs:
lucide-react/dist/esm/icons/mic.mjs:
lucide-react/dist/esm/icons/microchip.mjs:
lucide-react/dist/esm/icons/microscope.mjs:
lucide-react/dist/esm/icons/microwave.mjs:
lucide-react/dist/esm/icons/midi-port.mjs:
lucide-react/dist/esm/icons/milestone.mjs:
lucide-react/dist/esm/icons/milk-off.mjs:
lucide-react/dist/esm/icons/milk.mjs:
lucide-react/dist/esm/icons/minimize.mjs:
lucide-react/dist/esm/icons/minimize-2.mjs:
lucide-react/dist/esm/icons/mirror-round.mjs:
lucide-react/dist/esm/icons/mirror-rectangular.mjs:
lucide-react/dist/esm/icons/monitor-check.mjs:
lucide-react/dist/esm/icons/monitor-cloud.mjs:
lucide-react/dist/esm/icons/monitor-cog.mjs:
lucide-react/dist/esm/icons/monitor-dot.mjs:
lucide-react/dist/esm/icons/monitor-down.mjs:
lucide-react/dist/esm/icons/monitor-off.mjs:
lucide-react/dist/esm/icons/monitor-pause.mjs:
lucide-react/dist/esm/icons/monitor-play.mjs:
lucide-react/dist/esm/icons/monitor-smartphone.mjs:
lucide-react/dist/esm/icons/monitor-stop.mjs:
lucide-react/dist/esm/icons/monitor-speaker.mjs:
lucide-react/dist/esm/icons/monitor-up.mjs:
lucide-react/dist/esm/icons/monitor-x.mjs:
lucide-react/dist/esm/icons/monitor.mjs:
lucide-react/dist/esm/icons/moon-star.mjs:
lucide-react/dist/esm/icons/moon.mjs:
lucide-react/dist/esm/icons/mop-sparkles.mjs:
lucide-react/dist/esm/icons/mosque.mjs:
lucide-react/dist/esm/icons/mop.mjs:
lucide-react/dist/esm/icons/motorbike.mjs:
lucide-react/dist/esm/icons/mountain-snow.mjs:
lucide-react/dist/esm/icons/mountain.mjs:
lucide-react/dist/esm/icons/mouse-left.mjs:
lucide-react/dist/esm/icons/mouse-off.mjs:
lucide-react/dist/esm/icons/mouse-pointer-2-off.mjs:
lucide-react/dist/esm/icons/mouse-pointer-2.mjs:
lucide-react/dist/esm/icons/mouse-pointer-ban.mjs:
lucide-react/dist/esm/icons/mouse-pointer-click.mjs:
lucide-react/dist/esm/icons/mouse-pointer.mjs:
lucide-react/dist/esm/icons/mouse-right.mjs:
lucide-react/dist/esm/icons/move-3d.mjs:
lucide-react/dist/esm/icons/mouse.mjs:
lucide-react/dist/esm/icons/move-diagonal-2.mjs:
lucide-react/dist/esm/icons/move-diagonal.mjs:
lucide-react/dist/esm/icons/move-down-left.mjs:
lucide-react/dist/esm/icons/move-down-right.mjs:
lucide-react/dist/esm/icons/move-horizontal.mjs:
lucide-react/dist/esm/icons/move-down.mjs:
lucide-react/dist/esm/icons/move-left.mjs:
lucide-react/dist/esm/icons/move-right.mjs:
lucide-react/dist/esm/icons/move-up-left.mjs:
lucide-react/dist/esm/icons/move-up-right.mjs:
lucide-react/dist/esm/icons/move-up.mjs:
lucide-react/dist/esm/icons/move-vertical.mjs:
lucide-react/dist/esm/icons/move.mjs:
lucide-react/dist/esm/icons/music-3.mjs:
lucide-react/dist/esm/icons/music-2.mjs:
lucide-react/dist/esm/icons/music-4.mjs:
lucide-react/dist/esm/icons/navigation-2-off.mjs:
lucide-react/dist/esm/icons/music.mjs:
lucide-react/dist/esm/icons/navigation-2.mjs:
lucide-react/dist/esm/icons/navigation-off.mjs:
lucide-react/dist/esm/icons/network.mjs:
lucide-react/dist/esm/icons/navigation.mjs:
lucide-react/dist/esm/icons/newspaper.mjs:
lucide-react/dist/esm/icons/nfc.mjs:
lucide-react/dist/esm/icons/non-binary.mjs:
lucide-react/dist/esm/icons/notebook-tabs.mjs:
lucide-react/dist/esm/icons/notebook-pen.mjs:
lucide-react/dist/esm/icons/notebook-text.mjs:
lucide-react/dist/esm/icons/notebook.mjs:
lucide-react/dist/esm/icons/notepad-text-dashed.mjs:
lucide-react/dist/esm/icons/notepad-text.mjs:
lucide-react/dist/esm/icons/nut-off.mjs:
lucide-react/dist/esm/icons/nut.mjs:
lucide-react/dist/esm/icons/octagon-alert.mjs:
lucide-react/dist/esm/icons/octagon-minus.mjs:
lucide-react/dist/esm/icons/octagon-pause.mjs:
lucide-react/dist/esm/icons/octagon.mjs:
lucide-react/dist/esm/icons/omega.mjs:
lucide-react/dist/esm/icons/octagon-x.mjs:
lucide-react/dist/esm/icons/option.mjs:
lucide-react/dist/esm/icons/orbit.mjs:
lucide-react/dist/esm/icons/origami.mjs:
lucide-react/dist/esm/icons/package-2.mjs:
lucide-react/dist/esm/icons/package-check.mjs:
lucide-react/dist/esm/icons/package-minus.mjs:
lucide-react/dist/esm/icons/package-open.mjs:
lucide-react/dist/esm/icons/package-plus.mjs:
lucide-react/dist/esm/icons/package-search.mjs:
lucide-react/dist/esm/icons/package-x.mjs:
lucide-react/dist/esm/icons/paint-roller.mjs:
lucide-react/dist/esm/icons/paint-bucket.mjs:
lucide-react/dist/esm/icons/paintbrush-vertical.mjs:
lucide-react/dist/esm/icons/paintbrush.mjs:
lucide-react/dist/esm/icons/palette.mjs:
lucide-react/dist/esm/icons/panda.mjs:
lucide-react/dist/esm/icons/panel-bottom-close.mjs:
lucide-react/dist/esm/icons/panel-bottom-open.mjs:
lucide-react/dist/esm/icons/panel-bottom-dashed.mjs:
lucide-react/dist/esm/icons/panel-bottom.mjs:
lucide-react/dist/esm/icons/panel-left-close.mjs:
lucide-react/dist/esm/icons/panel-left-open.mjs:
lucide-react/dist/esm/icons/panel-left-dashed.mjs:
lucide-react/dist/esm/icons/panel-left-right-dashed.mjs:
lucide-react/dist/esm/icons/panel-left.mjs:
lucide-react/dist/esm/icons/panel-right-close.mjs:
lucide-react/dist/esm/icons/panel-right-dashed.mjs:
lucide-react/dist/esm/icons/panel-right-open.mjs:
lucide-react/dist/esm/icons/panel-right.mjs:
lucide-react/dist/esm/icons/panel-top-bottom-dashed.mjs:
lucide-react/dist/esm/icons/panel-top-close.mjs:
lucide-react/dist/esm/icons/panel-top-dashed.mjs:
lucide-react/dist/esm/icons/panel-top-open.mjs:
lucide-react/dist/esm/icons/panel-top.mjs:
lucide-react/dist/esm/icons/panels-left-bottom.mjs:
lucide-react/dist/esm/icons/panels-right-bottom.mjs:
lucide-react/dist/esm/icons/paper-bag.mjs:
lucide-react/dist/esm/icons/panels-top-left.mjs:
lucide-react/dist/esm/icons/paperclip.mjs:
lucide-react/dist/esm/icons/parasol.mjs:
lucide-react/dist/esm/icons/parentheses.mjs:
lucide-react/dist/esm/icons/party-popper.mjs:
lucide-react/dist/esm/icons/parking-meter.mjs:
lucide-react/dist/esm/icons/pause.mjs:
lucide-react/dist/esm/icons/pc-case.mjs:
lucide-react/dist/esm/icons/paw-print.mjs:
lucide-react/dist/esm/icons/pen-off.mjs:
lucide-react/dist/esm/icons/pen-tool.mjs:
lucide-react/dist/esm/icons/pen-line.mjs:
lucide-react/dist/esm/icons/pen.mjs:
lucide-react/dist/esm/icons/pencil-line.mjs:
lucide-react/dist/esm/icons/pencil-sparkles.mjs:
lucide-react/dist/esm/icons/pencil-off.mjs:
lucide-react/dist/esm/icons/pencil-ruler.mjs:
lucide-react/dist/esm/icons/pentagon.mjs:
lucide-react/dist/esm/icons/percent.mjs:
lucide-react/dist/esm/icons/person-standing.mjs:
lucide-react/dist/esm/icons/phi.mjs:
lucide-react/dist/esm/icons/phone-call.mjs:
lucide-react/dist/esm/icons/philippine-peso.mjs:
lucide-react/dist/esm/icons/phone-forwarded.mjs:
lucide-react/dist/esm/icons/phone-incoming.mjs:
lucide-react/dist/esm/icons/phone-missed.mjs:
lucide-react/dist/esm/icons/phone-off.mjs:
lucide-react/dist/esm/icons/phone-outgoing.mjs:
lucide-react/dist/esm/icons/pi.mjs:
lucide-react/dist/esm/icons/piano.mjs:
lucide-react/dist/esm/icons/pickaxe.mjs:
lucide-react/dist/esm/icons/picture-in-picture-2.mjs:
lucide-react/dist/esm/icons/picture-in-picture.mjs:
lucide-react/dist/esm/icons/piggy-bank.mjs:
lucide-react/dist/esm/icons/pilcrow-left.mjs:
lucide-react/dist/esm/icons/pilcrow-right.mjs:
lucide-react/dist/esm/icons/pilcrow.mjs:
lucide-react/dist/esm/icons/pill-bottle.mjs:
lucide-react/dist/esm/icons/pill.mjs:
lucide-react/dist/esm/icons/pin-off.mjs:
lucide-react/dist/esm/icons/pin.mjs:
lucide-react/dist/esm/icons/pipette.mjs:
lucide-react/dist/esm/icons/pizza.mjs:
lucide-react/dist/esm/icons/plane-takeoff.mjs:
lucide-react/dist/esm/icons/plane-landing.mjs:
lucide-react/dist/esm/icons/plane.mjs:
lucide-react/dist/esm/icons/play.mjs:
lucide-react/dist/esm/icons/play-off.mjs:
lucide-react/dist/esm/icons/plug-zap.mjs:
lucide-react/dist/esm/icons/plug-2.mjs:
lucide-react/dist/esm/icons/plug.mjs:
lucide-react/dist/esm/icons/pocket-knife.mjs:
lucide-react/dist/esm/icons/podium.mjs:
lucide-react/dist/esm/icons/pointer-off.mjs:
lucide-react/dist/esm/icons/pointer.mjs:
lucide-react/dist/esm/icons/popcorn.mjs:
lucide-react/dist/esm/icons/popsicle.mjs:
lucide-react/dist/esm/icons/pound-sterling.mjs:
lucide-react/dist/esm/icons/power-off.mjs:
lucide-react/dist/esm/icons/presentation.mjs:
lucide-react/dist/esm/icons/power.mjs:
lucide-react/dist/esm/icons/printer-check.mjs:
lucide-react/dist/esm/icons/printer-x.mjs:
lucide-react/dist/esm/icons/printer.mjs:
lucide-react/dist/esm/icons/projector.mjs:
lucide-react/dist/esm/icons/proportions.mjs:
lucide-react/dist/esm/icons/puzzle.mjs:
lucide-react/dist/esm/icons/pyramid.mjs:
lucide-react/dist/esm/icons/qr-code.mjs:
lucide-react/dist/esm/icons/quote.mjs:
lucide-react/dist/esm/icons/rabbit.mjs:
lucide-react/dist/esm/icons/radar.mjs:
lucide-react/dist/esm/icons/radiation.mjs:
lucide-react/dist/esm/icons/radical.mjs:
lucide-react/dist/esm/icons/radio-off.mjs:
lucide-react/dist/esm/icons/radio-receiver.mjs:
lucide-react/dist/esm/icons/radio-tower.mjs:
lucide-react/dist/esm/icons/radio.mjs:
lucide-react/dist/esm/icons/radius.mjs:
lucide-react/dist/esm/icons/rainbow.mjs:
lucide-react/dist/esm/icons/rat.mjs:
lucide-react/dist/esm/icons/ratio.mjs:
lucide-react/dist/esm/icons/receipt-cent.mjs:
lucide-react/dist/esm/icons/receipt-euro.mjs:
lucide-react/dist/esm/icons/receipt-indian-rupee.mjs:
lucide-react/dist/esm/icons/receipt-japanese-yen.mjs:
lucide-react/dist/esm/icons/receipt-pound-sterling.mjs:
lucide-react/dist/esm/icons/receipt-russian-ruble.mjs:
lucide-react/dist/esm/icons/receipt-swiss-franc.mjs:
lucide-react/dist/esm/icons/receipt-text.mjs:
lucide-react/dist/esm/icons/receipt-turkish-lira.mjs:
lucide-react/dist/esm/icons/rectangle-circle.mjs:
lucide-react/dist/esm/icons/rectangle-ellipsis.mjs:
lucide-react/dist/esm/icons/rectangle-goggles.mjs:
lucide-react/dist/esm/icons/rectangle-horizontal.mjs:
lucide-react/dist/esm/icons/recycle.mjs:
lucide-react/dist/esm/icons/rectangle-vertical.mjs:
lucide-react/dist/esm/icons/redo-2.mjs:
lucide-react/dist/esm/icons/redo-dot.mjs:
lucide-react/dist/esm/icons/redo.mjs:
lucide-react/dist/esm/icons/refresh-ccw-dot.mjs:
lucide-react/dist/esm/icons/refresh-ccw.mjs:
lucide-react/dist/esm/icons/refresh-cw-off.mjs:
lucide-react/dist/esm/icons/refresh-cw.mjs:
lucide-react/dist/esm/icons/refrigerator.mjs:
lucide-react/dist/esm/icons/regex.mjs:
lucide-react/dist/esm/icons/remove-formatting.mjs:
lucide-react/dist/esm/icons/repeat-1.mjs:
lucide-react/dist/esm/icons/repeat-2.mjs:
lucide-react/dist/esm/icons/repeat-off.mjs:
lucide-react/dist/esm/icons/repeat.mjs:
lucide-react/dist/esm/icons/replace-all.mjs:
lucide-react/dist/esm/icons/replace.mjs:
lucide-react/dist/esm/icons/reply.mjs:
lucide-react/dist/esm/icons/reply-all.mjs:
lucide-react/dist/esm/icons/rewind.mjs:
lucide-react/dist/esm/icons/ribbon.mjs:
lucide-react/dist/esm/icons/road.mjs:
lucide-react/dist/esm/icons/rocket.mjs:
lucide-react/dist/esm/icons/rocking-chair.mjs:
lucide-react/dist/esm/icons/rose.mjs:
lucide-react/dist/esm/icons/roller-coaster.mjs:
lucide-react/dist/esm/icons/rotate-3d.mjs:
lucide-react/dist/esm/icons/rotate-ccw-key.mjs:
lucide-react/dist/esm/icons/rotate-ccw-square.mjs:
lucide-react/dist/esm/icons/rotate-ccw.mjs:
lucide-react/dist/esm/icons/rotate-cw-fading-clock.mjs:
lucide-react/dist/esm/icons/rotate-cw-square.mjs:
lucide-react/dist/esm/icons/rotate-cw.mjs:
lucide-react/dist/esm/icons/route-off.mjs:
lucide-react/dist/esm/icons/router.mjs:
lucide-react/dist/esm/icons/route.mjs:
lucide-react/dist/esm/icons/rows-2.mjs:
lucide-react/dist/esm/icons/rows-3.mjs:
lucide-react/dist/esm/icons/rss.mjs:
lucide-react/dist/esm/icons/ruler-dimension-line.mjs:
lucide-react/dist/esm/icons/rows-4.mjs:
lucide-react/dist/esm/icons/ruler.mjs:
lucide-react/dist/esm/icons/russian-ruble.mjs:
lucide-react/dist/esm/icons/sailboat.mjs:
lucide-react/dist/esm/icons/salad.mjs:
lucide-react/dist/esm/icons/sandwich.mjs:
lucide-react/dist/esm/icons/satellite-dish.mjs:
lucide-react/dist/esm/icons/saudi-riyal.mjs:
lucide-react/dist/esm/icons/satellite.mjs:
lucide-react/dist/esm/icons/save-all.mjs:
lucide-react/dist/esm/icons/save-check.mjs:
lucide-react/dist/esm/icons/save-off.mjs:
lucide-react/dist/esm/icons/save-pen.mjs:
lucide-react/dist/esm/icons/save-plus.mjs:
lucide-react/dist/esm/icons/save.mjs:
lucide-react/dist/esm/icons/scale-3d.mjs:
lucide-react/dist/esm/icons/scale.mjs:
lucide-react/dist/esm/icons/scaling.mjs:
lucide-react/dist/esm/icons/scan-box.mjs:
lucide-react/dist/esm/icons/scan-eye.mjs:
lucide-react/dist/esm/icons/scan-face.mjs:
lucide-react/dist/esm/icons/scan-heart.mjs:
lucide-react/dist/esm/icons/scan-line.mjs:
lucide-react/dist/esm/icons/scan-qr-code.mjs:
lucide-react/dist/esm/icons/scan-search.mjs:
lucide-react/dist/esm/icons/scan-square.mjs:
lucide-react/dist/esm/icons/scan-text.mjs:
lucide-react/dist/esm/icons/scan.mjs:
lucide-react/dist/esm/icons/school.mjs:
lucide-react/dist/esm/icons/scissors-line-dashed.mjs:
lucide-react/dist/esm/icons/scissors.mjs:
lucide-react/dist/esm/icons/scooter.mjs:
lucide-react/dist/esm/icons/screen-share-off.mjs:
lucide-react/dist/esm/icons/screen-share.mjs:
lucide-react/dist/esm/icons/scroll-text.mjs:
lucide-react/dist/esm/icons/scroll.mjs:
lucide-react/dist/esm/icons/search-alert.mjs:
lucide-react/dist/esm/icons/search-check.mjs:
lucide-react/dist/esm/icons/search-code.mjs:
lucide-react/dist/esm/icons/search-slash.mjs:
lucide-react/dist/esm/icons/search-x.mjs:
lucide-react/dist/esm/icons/section.mjs:
lucide-react/dist/esm/icons/send-horizontal.mjs:
lucide-react/dist/esm/icons/send-to-back.mjs:
lucide-react/dist/esm/icons/send.mjs:
lucide-react/dist/esm/icons/separator-horizontal.mjs:
lucide-react/dist/esm/icons/separator-vertical.mjs:
lucide-react/dist/esm/icons/server-cog.mjs:
lucide-react/dist/esm/icons/server-off.mjs:
lucide-react/dist/esm/icons/server-crash.mjs:
lucide-react/dist/esm/icons/server-plus.mjs:
lucide-react/dist/esm/icons/server.mjs:
lucide-react/dist/esm/icons/settings-2.mjs:
lucide-react/dist/esm/icons/settings.mjs:
lucide-react/dist/esm/icons/shapes.mjs:
lucide-react/dist/esm/icons/share-2.mjs:
lucide-react/dist/esm/icons/share.mjs:
lucide-react/dist/esm/icons/sheet.mjs:
lucide-react/dist/esm/icons/shell.mjs:
lucide-react/dist/esm/icons/shelving-unit.mjs:
lucide-react/dist/esm/icons/shield-alert.mjs:
lucide-react/dist/esm/icons/shield-ban.mjs:
lucide-react/dist/esm/icons/shield-cog-corner.mjs:
lucide-react/dist/esm/icons/shield-cog.mjs:
lucide-react/dist/esm/icons/shield-ellipsis.mjs:
lucide-react/dist/esm/icons/shield-half.mjs:
lucide-react/dist/esm/icons/shield-lock.mjs:
lucide-react/dist/esm/icons/shield-keyhole.mjs:
lucide-react/dist/esm/icons/shield-minus.mjs:
lucide-react/dist/esm/icons/shield-off.mjs:
lucide-react/dist/esm/icons/shield-plus.mjs:
lucide-react/dist/esm/icons/shield-question-mark.mjs:
lucide-react/dist/esm/icons/shield-user.mjs:
lucide-react/dist/esm/icons/shield-x.mjs:
lucide-react/dist/esm/icons/shield.mjs:
lucide-react/dist/esm/icons/ship-wheel.mjs:
lucide-react/dist/esm/icons/ship.mjs:
lucide-react/dist/esm/icons/shirt.mjs:
lucide-react/dist/esm/icons/shopping-basket.mjs:
lucide-react/dist/esm/icons/shower-head.mjs:
lucide-react/dist/esm/icons/shovel.mjs:
lucide-react/dist/esm/icons/shredder.mjs:
lucide-react/dist/esm/icons/shrimp.mjs:
lucide-react/dist/esm/icons/shrink.mjs:
lucide-react/dist/esm/icons/shuffle.mjs:
lucide-react/dist/esm/icons/shrub.mjs:
lucide-react/dist/esm/icons/sigma.mjs:
lucide-react/dist/esm/icons/signal-high.mjs:
lucide-react/dist/esm/icons/signal-low.mjs:
lucide-react/dist/esm/icons/signal-medium.mjs:
lucide-react/dist/esm/icons/signal-zero.mjs:
lucide-react/dist/esm/icons/signal.mjs:
lucide-react/dist/esm/icons/signature.mjs:
lucide-react/dist/esm/icons/signpost-big.mjs:
lucide-react/dist/esm/icons/signpost.mjs:
lucide-react/dist/esm/icons/siren.mjs:
lucide-react/dist/esm/icons/skip-back.mjs:
lucide-react/dist/esm/icons/skip-forward.mjs:
lucide-react/dist/esm/icons/skull.mjs:
lucide-react/dist/esm/icons/slash.mjs:
lucide-react/dist/esm/icons/slice.mjs:
lucide-react/dist/esm/icons/sliders-horizontal.mjs:
lucide-react/dist/esm/icons/sliders-vertical.mjs:
lucide-react/dist/esm/icons/smartphone-charging.mjs:
lucide-react/dist/esm/icons/smartphone-nfc.mjs:
lucide-react/dist/esm/icons/snail.mjs:
lucide-react/dist/esm/icons/snowflake.mjs:
lucide-react/dist/esm/icons/smartphone.mjs:
lucide-react/dist/esm/icons/soap-dispenser-droplet.mjs:
lucide-react/dist/esm/icons/sofa.mjs:
lucide-react/dist/esm/icons/solar-panel.mjs:
lucide-react/dist/esm/icons/soup.mjs:
lucide-react/dist/esm/icons/space.mjs:
lucide-react/dist/esm/icons/spade.mjs:
lucide-react/dist/esm/icons/sparkle.mjs:
lucide-react/dist/esm/icons/sparkles.mjs:
lucide-react/dist/esm/icons/speaker.mjs:
lucide-react/dist/esm/icons/speech.mjs:
lucide-react/dist/esm/icons/spell-check-2.mjs:
lucide-react/dist/esm/icons/spell-check.mjs:
lucide-react/dist/esm/icons/spline-pointer.mjs:
lucide-react/dist/esm/icons/spline.mjs:
lucide-react/dist/esm/icons/split.mjs:
lucide-react/dist/esm/icons/spool.mjs:
lucide-react/dist/esm/icons/sport-shoe.mjs:
lucide-react/dist/esm/icons/spotlight.mjs:
lucide-react/dist/esm/icons/spray-can.mjs:
lucide-react/dist/esm/icons/sprout.mjs:
lucide-react/dist/esm/icons/square-activity.mjs:
lucide-react/dist/esm/icons/square-arrow-down-left.mjs:
lucide-react/dist/esm/icons/square-arrow-down-right.mjs:
lucide-react/dist/esm/icons/square-arrow-down.mjs:
lucide-react/dist/esm/icons/square-arrow-left.mjs:
lucide-react/dist/esm/icons/square-arrow-out-down-left.mjs:
lucide-react/dist/esm/icons/square-arrow-out-down-right.mjs:
lucide-react/dist/esm/icons/square-arrow-out-up-left.mjs:
lucide-react/dist/esm/icons/square-arrow-out-up-right.mjs:
lucide-react/dist/esm/icons/square-arrow-right-enter.mjs:
lucide-react/dist/esm/icons/square-arrow-right-exit.mjs:
lucide-react/dist/esm/icons/square-arrow-right.mjs:
lucide-react/dist/esm/icons/square-arrow-up-left.mjs:
lucide-react/dist/esm/icons/square-arrow-up-right.mjs:
lucide-react/dist/esm/icons/square-asterisk.mjs:
lucide-react/dist/esm/icons/square-arrow-up.mjs:
lucide-react/dist/esm/icons/square-bottom-dashed-scissors.mjs:
lucide-react/dist/esm/icons/square-centerline-dashed-horizontal.mjs:
lucide-react/dist/esm/icons/square-centerline-dashed-vertical.mjs:
lucide-react/dist/esm/icons/square-chart-gantt.mjs:
lucide-react/dist/esm/icons/square-check-big.mjs:
lucide-react/dist/esm/icons/square-check.mjs:
lucide-react/dist/esm/icons/square-chevron-down.mjs:
lucide-react/dist/esm/icons/square-chevron-left.mjs:
lucide-react/dist/esm/icons/square-chevron-right.mjs:
lucide-react/dist/esm/icons/square-chevron-up.mjs:
lucide-react/dist/esm/icons/square-code.mjs:
lucide-react/dist/esm/icons/square-dashed-bottom-code.mjs:
lucide-react/dist/esm/icons/square-dashed-bottom.mjs:
lucide-react/dist/esm/icons/square-dashed-kanban.mjs:
lucide-react/dist/esm/icons/square-dashed-mouse-pointer.mjs:
lucide-react/dist/esm/icons/square-dashed-text.mjs:
lucide-react/dist/esm/icons/square-dashed-top-solid.mjs:
lucide-react/dist/esm/icons/square-dashed.mjs:
lucide-react/dist/esm/icons/square-dimensions.mjs:
lucide-react/dist/esm/icons/square-divide.mjs:
lucide-react/dist/esm/icons/square-dot.mjs:
lucide-react/dist/esm/icons/square-equal.mjs:
lucide-react/dist/esm/icons/square-function.mjs:
lucide-react/dist/esm/icons/square-kanban.mjs:
lucide-react/dist/esm/icons/square-library.mjs:
lucide-react/dist/esm/icons/square-m.mjs:
lucide-react/dist/esm/icons/square-menu.mjs:
lucide-react/dist/esm/icons/square-minus.mjs:
lucide-react/dist/esm/icons/square-mouse-pointer.mjs:
lucide-react/dist/esm/icons/square-off.mjs:
lucide-react/dist/esm/icons/square-parking.mjs:
lucide-react/dist/esm/icons/square-parking-off.mjs:
lucide-react/dist/esm/icons/square-pen.mjs:
lucide-react/dist/esm/icons/square-percent.mjs:
lucide-react/dist/esm/icons/square-pause.mjs:
lucide-react/dist/esm/icons/square-pi.mjs:
lucide-react/dist/esm/icons/square-pilcrow.mjs:
lucide-react/dist/esm/icons/square-play.mjs:
lucide-react/dist/esm/icons/square-power.mjs:
lucide-react/dist/esm/icons/square-plus.mjs:
lucide-react/dist/esm/icons/square-radical.mjs:
lucide-react/dist/esm/icons/square-scissors.mjs:
lucide-react/dist/esm/icons/square-round-corner.mjs:
lucide-react/dist/esm/icons/square-sigma.mjs:
lucide-react/dist/esm/icons/square-slash.mjs:
lucide-react/dist/esm/icons/square-split-horizontal.mjs:
lucide-react/dist/esm/icons/square-split-vertical.mjs:
lucide-react/dist/esm/icons/square-square.mjs:
lucide-react/dist/esm/icons/square-stack.mjs:
lucide-react/dist/esm/icons/square-star.mjs:
lucide-react/dist/esm/icons/square-terminal.mjs:
lucide-react/dist/esm/icons/square-stop.mjs:
lucide-react/dist/esm/icons/square-text.mjs:
lucide-react/dist/esm/icons/square-user-round.mjs:
lucide-react/dist/esm/icons/square-user.mjs:
lucide-react/dist/esm/icons/square-x.mjs:
lucide-react/dist/esm/icons/squares-exclude.mjs:
lucide-react/dist/esm/icons/square.mjs:
lucide-react/dist/esm/icons/squares-intersect.mjs:
lucide-react/dist/esm/icons/squares-subtract.mjs:
lucide-react/dist/esm/icons/squares-unite.mjs:
lucide-react/dist/esm/icons/squircle-dashed.mjs:
lucide-react/dist/esm/icons/squircle.mjs:
lucide-react/dist/esm/icons/squirrel.mjs:
lucide-react/dist/esm/icons/stamp.mjs:
lucide-react/dist/esm/icons/star-check.mjs:
lucide-react/dist/esm/icons/star-half.mjs:
lucide-react/dist/esm/icons/star-minus.mjs:
lucide-react/dist/esm/icons/star-off.mjs:
lucide-react/dist/esm/icons/star-plus.mjs:
lucide-react/dist/esm/icons/star-x.mjs:
lucide-react/dist/esm/icons/star.mjs:
lucide-react/dist/esm/icons/step-back.mjs:
lucide-react/dist/esm/icons/step-forward.mjs:
lucide-react/dist/esm/icons/sticky-note-check.mjs:
lucide-react/dist/esm/icons/sticker.mjs:
lucide-react/dist/esm/icons/sticky-note-minus.mjs:
lucide-react/dist/esm/icons/sticky-note-off.mjs:
lucide-react/dist/esm/icons/sticky-note-plus.mjs:
lucide-react/dist/esm/icons/sticky-note-x.mjs:
lucide-react/dist/esm/icons/sticky-note.mjs:
lucide-react/dist/esm/icons/stone.mjs:
lucide-react/dist/esm/icons/sticky-notes.mjs:
lucide-react/dist/esm/icons/store.mjs:
lucide-react/dist/esm/icons/stretch-horizontal.mjs:
lucide-react/dist/esm/icons/strikethrough.mjs:
lucide-react/dist/esm/icons/stretch-vertical.mjs:
lucide-react/dist/esm/icons/subscript.mjs:
lucide-react/dist/esm/icons/summary.mjs:
lucide-react/dist/esm/icons/sun-dim.mjs:
lucide-react/dist/esm/icons/sun-medium.mjs:
lucide-react/dist/esm/icons/sun-moon.mjs:
lucide-react/dist/esm/icons/sun-snow.mjs:
lucide-react/dist/esm/icons/sun.mjs:
lucide-react/dist/esm/icons/sunrise.mjs:
lucide-react/dist/esm/icons/superscript.mjs:
lucide-react/dist/esm/icons/sunset.mjs:
lucide-react/dist/esm/icons/swatch-book.mjs:
lucide-react/dist/esm/icons/swiss-franc.mjs:
lucide-react/dist/esm/icons/switch-camera.mjs:
lucide-react/dist/esm/icons/sword.mjs:
lucide-react/dist/esm/icons/swords.mjs:
lucide-react/dist/esm/icons/syringe.mjs:
lucide-react/dist/esm/icons/table-2.mjs:
lucide-react/dist/esm/icons/table-cells-merge.mjs:
lucide-react/dist/esm/icons/table-cells-split.mjs:
lucide-react/dist/esm/icons/table-columns-split.mjs:
lucide-react/dist/esm/icons/table-of-contents.mjs:
lucide-react/dist/esm/icons/table-properties.mjs:
lucide-react/dist/esm/icons/table-rows-split.mjs:
lucide-react/dist/esm/icons/table.mjs:
lucide-react/dist/esm/icons/tablet-smartphone.mjs:
lucide-react/dist/esm/icons/tablet.mjs:
lucide-react/dist/esm/icons/tablets.mjs:
lucide-react/dist/esm/icons/tag-plus.mjs:
lucide-react/dist/esm/icons/tag.mjs:
lucide-react/dist/esm/icons/tag-x.mjs:
lucide-react/dist/esm/icons/tally-1.mjs:
lucide-react/dist/esm/icons/tally-2.mjs:
lucide-react/dist/esm/icons/tally-4.mjs:
lucide-react/dist/esm/icons/tally-3.mjs:
lucide-react/dist/esm/icons/tally-5.mjs:
lucide-react/dist/esm/icons/tangent.mjs:
lucide-react/dist/esm/icons/target.mjs:
lucide-react/dist/esm/icons/telescope.mjs:
lucide-react/dist/esm/icons/tent-tree.mjs:
lucide-react/dist/esm/icons/tent.mjs:
lucide-react/dist/esm/icons/terminal.mjs:
lucide-react/dist/esm/icons/test-tube-diagonal.mjs:
lucide-react/dist/esm/icons/test-tube.mjs:
lucide-react/dist/esm/icons/test-tubes.mjs:
lucide-react/dist/esm/icons/text-align-center.mjs:
lucide-react/dist/esm/icons/text-align-end.mjs:
lucide-react/dist/esm/icons/text-align-justify.mjs:
lucide-react/dist/esm/icons/text-align-start.mjs:
lucide-react/dist/esm/icons/text-cursor-input.mjs:
lucide-react/dist/esm/icons/text-cursor.mjs:
lucide-react/dist/esm/icons/text-initial.mjs:
lucide-react/dist/esm/icons/text-search.mjs:
lucide-react/dist/esm/icons/text-wrap.mjs:
lucide-react/dist/esm/icons/text-quote.mjs:
lucide-react/dist/esm/icons/theater.mjs:
lucide-react/dist/esm/icons/thermometer-snowflake.mjs:
lucide-react/dist/esm/icons/thermometer-sun.mjs:
lucide-react/dist/esm/icons/thermometer.mjs:
lucide-react/dist/esm/icons/thumbs-up.mjs:
lucide-react/dist/esm/icons/thumbs-down.mjs:
lucide-react/dist/esm/icons/ticket-check.mjs:
lucide-react/dist/esm/icons/ticket-minus.mjs:
lucide-react/dist/esm/icons/ticket-percent.mjs:
lucide-react/dist/esm/icons/ticket-plus.mjs:
lucide-react/dist/esm/icons/ticket-slash.mjs:
lucide-react/dist/esm/icons/ticket-x.mjs:
lucide-react/dist/esm/icons/ticket.mjs:
lucide-react/dist/esm/icons/tickets-plane.mjs:
lucide-react/dist/esm/icons/tickets.mjs:
lucide-react/dist/esm/icons/timeline.mjs:
lucide-react/dist/esm/icons/timer-off.mjs:
lucide-react/dist/esm/icons/timer-reset.mjs:
lucide-react/dist/esm/icons/toggle-left.mjs:
lucide-react/dist/esm/icons/timer.mjs:
lucide-react/dist/esm/icons/toilet.mjs:
lucide-react/dist/esm/icons/toggle-right.mjs:
lucide-react/dist/esm/icons/tool-case.mjs:
lucide-react/dist/esm/icons/toolbox.mjs:
lucide-react/dist/esm/icons/tornado.mjs:
lucide-react/dist/esm/icons/torus.mjs:
lucide-react/dist/esm/icons/touchpad-off.mjs:
lucide-react/dist/esm/icons/touchpad.mjs:
lucide-react/dist/esm/icons/towel-rack.mjs:
lucide-react/dist/esm/icons/tower-control.mjs:
lucide-react/dist/esm/icons/toy-brick.mjs:
lucide-react/dist/esm/icons/tractor.mjs:
lucide-react/dist/esm/icons/traffic-cone.mjs:
lucide-react/dist/esm/icons/train-front-tunnel.mjs:
lucide-react/dist/esm/icons/train-front.mjs:
lucide-react/dist/esm/icons/train-track.mjs:
lucide-react/dist/esm/icons/tram-front.mjs:
lucide-react/dist/esm/icons/transgender.mjs:
lucide-react/dist/esm/icons/trash.mjs:
lucide-react/dist/esm/icons/tree-deciduous.mjs:
lucide-react/dist/esm/icons/tree-palm.mjs:
lucide-react/dist/esm/icons/tree-pine.mjs:
lucide-react/dist/esm/icons/trees.mjs:
lucide-react/dist/esm/icons/trending-down.mjs:
lucide-react/dist/esm/icons/trending-up-down.mjs:
lucide-react/dist/esm/icons/triangle-right.mjs:
lucide-react/dist/esm/icons/triangle-dashed.mjs:
lucide-react/dist/esm/icons/triangle.mjs:
lucide-react/dist/esm/icons/trophy.mjs:
lucide-react/dist/esm/icons/truck-electric.mjs:
lucide-react/dist/esm/icons/turkish-lira.mjs:
lucide-react/dist/esm/icons/turntable.mjs:
lucide-react/dist/esm/icons/turtle.mjs:
lucide-react/dist/esm/icons/tv-minimal-play.mjs:
lucide-react/dist/esm/icons/tv-minimal.mjs:
lucide-react/dist/esm/icons/tv.mjs:
lucide-react/dist/esm/icons/type-outline.mjs:
lucide-react/dist/esm/icons/type.mjs:
lucide-react/dist/esm/icons/umbrella-off.mjs:
lucide-react/dist/esm/icons/umbrella.mjs:
lucide-react/dist/esm/icons/underline.mjs:
lucide-react/dist/esm/icons/undo-2.mjs:
lucide-react/dist/esm/icons/undo-dot.mjs:
lucide-react/dist/esm/icons/unfold-horizontal.mjs:
lucide-react/dist/esm/icons/undo.mjs:
lucide-react/dist/esm/icons/unfold-vertical.mjs:
lucide-react/dist/esm/icons/ungroup.mjs:
lucide-react/dist/esm/icons/university.mjs:
lucide-react/dist/esm/icons/unlink-2.mjs:
lucide-react/dist/esm/icons/unplug.mjs:
lucide-react/dist/esm/icons/unlink.mjs:
lucide-react/dist/esm/icons/usb-c-port.mjs:
lucide-react/dist/esm/icons/usb.mjs:
lucide-react/dist/esm/icons/user-check.mjs:
lucide-react/dist/esm/icons/user-cog.mjs:
lucide-react/dist/esm/icons/user-key.mjs:
lucide-react/dist/esm/icons/user-lock.mjs:
lucide-react/dist/esm/icons/user-minus.mjs:
lucide-react/dist/esm/icons/user-pen.mjs:
lucide-react/dist/esm/icons/user-plus.mjs:
lucide-react/dist/esm/icons/user-round-arrow-left.mjs:
lucide-react/dist/esm/icons/user-round-check.mjs:
lucide-react/dist/esm/icons/user-round-key.mjs:
lucide-react/dist/esm/icons/user-round-cog.mjs:
lucide-react/dist/esm/icons/user-round-minus.mjs:
lucide-react/dist/esm/icons/user-round-pen.mjs:
lucide-react/dist/esm/icons/user-round-plus.mjs:
lucide-react/dist/esm/icons/user-round-search.mjs:
lucide-react/dist/esm/icons/user-round-x.mjs:
lucide-react/dist/esm/icons/user-search.mjs:
lucide-react/dist/esm/icons/user-shield.mjs:
lucide-react/dist/esm/icons/user-star.mjs:
lucide-react/dist/esm/icons/user-x.mjs:
lucide-react/dist/esm/icons/user.mjs:
lucide-react/dist/esm/icons/users-round.mjs:
lucide-react/dist/esm/icons/utensils-crossed.mjs:
lucide-react/dist/esm/icons/utensils.mjs:
lucide-react/dist/esm/icons/utility-pole.mjs:
lucide-react/dist/esm/icons/van.mjs:
lucide-react/dist/esm/icons/variable.mjs:
lucide-react/dist/esm/icons/vault.mjs:
lucide-react/dist/esm/icons/vegan.mjs:
lucide-react/dist/esm/icons/vector-square.mjs:
lucide-react/dist/esm/icons/venus-and-mars.mjs:
lucide-react/dist/esm/icons/venetian-mask.mjs:
lucide-react/dist/esm/icons/venus.mjs:
lucide-react/dist/esm/icons/vibrate-off.mjs:
lucide-react/dist/esm/icons/vibrate.mjs:
lucide-react/dist/esm/icons/video-off.mjs:
lucide-react/dist/esm/icons/video.mjs:
lucide-react/dist/esm/icons/videotape.mjs:
lucide-react/dist/esm/icons/view.mjs:
lucide-react/dist/esm/icons/voicemail.mjs:
lucide-react/dist/esm/icons/volleyball.mjs:
lucide-react/dist/esm/icons/volume-1.mjs:
lucide-react/dist/esm/icons/volume-off.mjs:
lucide-react/dist/esm/icons/volume-2.mjs:
lucide-react/dist/esm/icons/volume-x.mjs:
lucide-react/dist/esm/icons/volume.mjs:
lucide-react/dist/esm/icons/wallet-cards.mjs:
lucide-react/dist/esm/icons/vote.mjs:
lucide-react/dist/esm/icons/wallet-minimal.mjs:
lucide-react/dist/esm/icons/wallpaper.mjs:
lucide-react/dist/esm/icons/wand-sparkles.mjs:
lucide-react/dist/esm/icons/wand.mjs:
lucide-react/dist/esm/icons/warehouse.mjs:
lucide-react/dist/esm/icons/washing-machine.mjs:
lucide-react/dist/esm/icons/watch.mjs:
lucide-react/dist/esm/icons/waves-arrow-down.mjs:
lucide-react/dist/esm/icons/waves-arrow-up.mjs:
lucide-react/dist/esm/icons/waves-horizontal.mjs:
lucide-react/dist/esm/icons/waves-vertical.mjs:
lucide-react/dist/esm/icons/waypoints.mjs:
lucide-react/dist/esm/icons/waves-ladder.mjs:
lucide-react/dist/esm/icons/webcam-off.mjs:
lucide-react/dist/esm/icons/webcam.mjs:
lucide-react/dist/esm/icons/webhook-off.mjs:
lucide-react/dist/esm/icons/webhook.mjs:
lucide-react/dist/esm/icons/weight-tilde.mjs:
lucide-react/dist/esm/icons/weight.mjs:
lucide-react/dist/esm/icons/wheat-off.mjs:
lucide-react/dist/esm/icons/wheat.mjs:
lucide-react/dist/esm/icons/whole-word.mjs:
lucide-react/dist/esm/icons/wifi-cog.mjs:
lucide-react/dist/esm/icons/wifi-high.mjs:
lucide-react/dist/esm/icons/wifi-low.mjs:
lucide-react/dist/esm/icons/wifi-off.mjs:
lucide-react/dist/esm/icons/wifi-pen.mjs:
lucide-react/dist/esm/icons/wifi-sync.mjs:
lucide-react/dist/esm/icons/wifi.mjs:
lucide-react/dist/esm/icons/wind.mjs:
lucide-react/dist/esm/icons/wifi-zero.mjs:
lucide-react/dist/esm/icons/wind-arrow-down.mjs:
lucide-react/dist/esm/icons/wine-off.mjs:
lucide-react/dist/esm/icons/wine.mjs:
lucide-react/dist/esm/icons/workflow.mjs:
lucide-react/dist/esm/icons/worm.mjs:
lucide-react/dist/esm/icons/wrench-off.mjs:
lucide-react/dist/esm/icons/wrench.mjs:
lucide-react/dist/esm/icons/x-line-top.mjs:
lucide-react/dist/esm/icons/zap-off.mjs:
lucide-react/dist/esm/icons/zap.mjs:
lucide-react/dist/esm/icons/zodiac-aries.mjs:
lucide-react/dist/esm/icons/zodiac-aquarius.mjs:
lucide-react/dist/esm/icons/zodiac-cancer.mjs:
lucide-react/dist/esm/icons/zodiac-capricorn.mjs:
lucide-react/dist/esm/icons/zodiac-gemini.mjs:
lucide-react/dist/esm/icons/zodiac-leo.mjs:
lucide-react/dist/esm/icons/zodiac-libra.mjs:
lucide-react/dist/esm/icons/zodiac-ophiuchus.mjs:
lucide-react/dist/esm/icons/zodiac-pisces.mjs:
lucide-react/dist/esm/icons/zodiac-sagittarius.mjs:
lucide-react/dist/esm/icons/zodiac-scorpio.mjs:
lucide-react/dist/esm/icons/zodiac-taurus.mjs:
lucide-react/dist/esm/icons/zodiac-virgo.mjs:
lucide-react/dist/esm/icons/zoom-in.mjs:
lucide-react/dist/esm/icons/zoom-out.mjs:
lucide-react/dist/esm/icons/index.mjs:
lucide-react/dist/esm/lucide-react.mjs:
  (**
   * @license lucide-react v1.34.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)

xlsx/xlsx.mjs:
  (*! xlsx.js (C) 2013-present SheetJS -- http://sheetjs.com *)

xlsx/xlsx.mjs:
  (*! sheetjs (C) 2013-present SheetJS -- http://sheetjs.com *)

pako/dist/pako.esm.mjs:
  (*! pako 2.2.0 https://github.com/nodeca/pako @license (MIT AND Zlib) *)

jspdf/dist/jspdf.es.min.js:
  (** @license
   *
   * jsPDF - PDF Document creation from JavaScript
   * Version 4.2.1 Built on 2026-03-17T11:11:27.057Z
   *                      CommitID 00000000
   *
   * Copyright (c) 2010-2025 James Hall <james@parall.ax>, https://github.com/MrRio/jsPDF
   *               2015-2025 yWorks GmbH, http://www.yworks.com
   *               2015-2025 Lukas Holländer <lukas.hollaender@yworks.com>, https://github.com/HackbrettXXX
   *               2016-2018 Aras Abbasi <aras.abbasi@gmail.com>
   *               2010 Aaron Spike, https://github.com/acspike
   *               2012 Willow Systems Corporation, https://github.com/willowsystems
   *               2012 Pablo Hess, https://github.com/pablohess
   *               2012 Florian Jenett, https://github.com/fjenett
   *               2013 Warren Weckesser, https://github.com/warrenweckesser
   *               2013 Youssef Beddad, https://github.com/lifof
   *               2013 Lee Driscoll, https://github.com/lsdriscoll
   *               2013 Stefan Slonevskiy, https://github.com/stefslon
   *               2013 Jeremy Morel, https://github.com/jmorel
   *               2013 Christoph Hartmann, https://github.com/chris-rock
   *               2014 Juan Pablo Gaviria, https://github.com/juanpgaviria
   *               2014 James Makes, https://github.com/dollaruw
   *               2014 Diego Casorran, https://github.com/diegocr
   *               2014 Steven Spungin, https://github.com/Flamenco
   *               2014 Kenneth Glassey, https://github.com/Gavvers
   *
   * Permission is hereby granted, free of charge, to any person obtaining
   * a copy of this software and associated documentation files (the
   * "Software"), to deal in the Software without restriction, including
   * without limitation the rights to use, copy, modify, merge, publish,
   * distribute, sublicense, and/or sell copies of the Software, and to
   * permit persons to whom the Software is furnished to do so, subject to
   * the following conditions:
   *
   * The above copyright notice and this permission notice shall be
   * included in all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
   * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
   * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
   * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
   * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
   * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
   * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
   *
   * Contributor(s):
   *    siefkenj, ahwolf, rickygu, Midnith, saintclair, eaparango,
   *    kim3er, mfo, alnorth, Flamenco
   *)
  (**
   * A class to parse color values
   * @author Stoyan Stefanov <sstoo@gmail.com>
   * {@link   http://www.phpied.com/rgb-color-parser-in-javascript/}
   * @license Use it if you like it
   *)
  (**
   * @license
   * Joseph Myers does not specify a particular license for his work.
   *
   * Author: Joseph Myers
   * Accessed from: http://www.myersdaily.org/joseph/javascript/md5.js
   *
   * Modified by: Owen Leong
   *)
  (**
   * @license
   * FPDF is released under a permissive license: there is no usage restriction.
   * You may embed it freely in your application (commercial or not), with or
   * without modifications.
   *
   * Reference: http://www.fpdf.org/en/script/script37.php
   *)
  (**
   * @license
   * Licensed under the MIT License.
   * http://opensource.org/licenses/mit-license
   * Author: Owen Leong (@owenl131)
   * Date: 15 Oct 2020
   * References:
   * https://www.cs.cmu.edu/~dst/Adobe/Gallery/anon21jul01-pdf-encryption.txt
   * https://github.com/foliojs/pdfkit/blob/master/lib/security.js
   * http://www.fpdf.org/en/script/script37.php
   *)
  (**
   * @license
    Copyright (c) 2008, Adobe Systems Incorporated
    All rights reserved.
  
    Redistribution and use in source and binary forms, with or without 
    modification, are permitted provided that the following conditions are
    met:
  
    * Redistributions of source code must retain the above copyright notice, 
      this list of conditions and the following disclaimer.
    
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the 
      documentation and/or other materials provided with the distribution.
    
    * Neither the name of Adobe Systems Incorporated nor the names of its 
      contributors may be used to endorse or promote products derived from 
      this software without specific prior written permission.
  
    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
    IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
    THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR 
    CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
    EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
    LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
    NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
    SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  *)
  (**
   * @license
   * Copyright (c) 2017 Aras Abbasi
   *
   * Licensed under the MIT License.
   * http://opensource.org/licenses/mit-license
   *)
  (** ====================================================================
   * @license
   * jsPDF XMP metadata plugin
   * Copyright (c) 2016 Jussi Utunen, u-jussi@suomi24.fi
   *
   * Permission is hereby granted, free of charge, to any person obtaining
   * a copy of this software and associated documentation files (the
   * "Software"), to deal in the Software without restriction, including
   * without limitation the rights to use, copy, modify, merge, publish,
   * distribute, sublicense, and/or sell copies of the Software, and to
   * permit persons to whom the Software is furnished to do so, subject to
   * the following conditions:
   *
   * The above copyright notice and this permission notice shall be
   * included in all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
   * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
   * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
   * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
   * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
   * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
   * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
   * ====================================================================
   *)
*/
/*! Bundled license information:

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

scheduler/cjs/scheduler.development.js:
  (**
   * @license React
   * scheduler.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom.development.js:
  (**
   * @license React
   * react-dom.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
  (**
   * Checks if an event is supported in the current execution environment.
   *
   * NOTE: This will not work correctly for non-generic events such as `change`,
   * `reset`, `load`, `error`, and `select`.
   *
   * Borrows from Modernizr.
   *
   * @param {string} eventNameSuffix Event name, e.g. "click".
   * @return {boolean} True if the event is supported.
   * @internal
   * @license Modernizr 3.0.0pre (Custom Build) | MIT
   *)

html2canvas/dist/html2canvas.js:
  (*!
   * html2canvas 1.4.1 <https://html2canvas.hertzen.com>
   * Copyright (c) 2022 Niklas von Hertzen <https://hertzen.com>
   * Released under MIT License
   *)
  (*! *****************************************************************************
      Copyright (c) Microsoft Corporation.
  
      Permission to use, copy, modify, and/or distribute this software for any
      purpose with or without fee is hereby granted.
  
      THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
      REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
      AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
      INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
      LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
      OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
      PERFORMANCE OF THIS SOFTWARE.
      ***************************************************************************** *)

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.14 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.14/LICENSE *)

svg-pathdata/lib/SVGPathData.module.js:
  (*! *****************************************************************************
  Copyright (c) Microsoft Corporation.
  
  Permission to use, copy, modify, and/or distribute this software for any
  purpose with or without fee is hereby granted.
  
  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
  REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
  AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
  INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
  LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
  OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
  PERFORMANCE OF THIS SOFTWARE.
  ***************************************************************************** *)

pako/dist/pako.esm.mjs:
  (*! pako 2.2.0 https://github.com/nodeca/pako @license (MIT AND Zlib) *)

jspdf/dist/jspdf.es.min.js:
  (** @license
   *
   * jsPDF - PDF Document creation from JavaScript
   * Version 4.2.1 Built on 2026-03-17T11:11:27.057Z
   *                      CommitID 00000000
   *
   * Copyright (c) 2010-2025 James Hall <james@parall.ax>, https://github.com/MrRio/jsPDF
   *               2015-2025 yWorks GmbH, http://www.yworks.com
   *               2015-2025 Lukas Holländer <lukas.hollaender@yworks.com>, https://github.com/HackbrettXXX
   *               2016-2018 Aras Abbasi <aras.abbasi@gmail.com>
   *               2010 Aaron Spike, https://github.com/acspike
   *               2012 Willow Systems Corporation, https://github.com/willowsystems
   *               2012 Pablo Hess, https://github.com/pablohess
   *               2012 Florian Jenett, https://github.com/fjenett
   *               2013 Warren Weckesser, https://github.com/warrenweckesser
   *               2013 Youssef Beddad, https://github.com/lifof
   *               2013 Lee Driscoll, https://github.com/lsdriscoll
   *               2013 Stefan Slonevskiy, https://github.com/stefslon
   *               2013 Jeremy Morel, https://github.com/jmorel
   *               2013 Christoph Hartmann, https://github.com/chris-rock
   *               2014 Juan Pablo Gaviria, https://github.com/juanpgaviria
   *               2014 James Makes, https://github.com/dollaruw
   *               2014 Diego Casorran, https://github.com/diegocr
   *               2014 Steven Spungin, https://github.com/Flamenco
   *               2014 Kenneth Glassey, https://github.com/Gavvers
   *
   * Permission is hereby granted, free of charge, to any person obtaining
   * a copy of this software and associated documentation files (the
   * "Software"), to deal in the Software without restriction, including
   * without limitation the rights to use, copy, modify, merge, publish,
   * distribute, sublicense, and/or sell copies of the Software, and to
   * permit persons to whom the Software is furnished to do so, subject to
   * the following conditions:
   *
   * The above copyright notice and this permission notice shall be
   * included in all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
   * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
   * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
   * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
   * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
   * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
   * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
   *
   * Contributor(s):
   *    siefkenj, ahwolf, rickygu, Midnith, saintclair, eaparango,
   *    kim3er, mfo, alnorth, Flamenco
   *)
  (**
   * A class to parse color values
   * @author Stoyan Stefanov <sstoo@gmail.com>
   * {@link   http://www.phpied.com/rgb-color-parser-in-javascript/}
   * @license Use it if you like it
   *)
  (**
   * @license
   * Joseph Myers does not specify a particular license for his work.
   *
   * Author: Joseph Myers
   * Accessed from: http://www.myersdaily.org/joseph/javascript/md5.js
   *
   * Modified by: Owen Leong
   *)
  (**
   * @license
   * FPDF is released under a permissive license: there is no usage restriction.
   * You may embed it freely in your application (commercial or not), with or
   * without modifications.
   *
   * Reference: http://www.fpdf.org/en/script/script37.php
   *)
  (**
   * @license
   * Licensed under the MIT License.
   * http://opensource.org/licenses/mit-license
   * Author: Owen Leong (@owenl131)
   * Date: 15 Oct 2020
   * References:
   * https://www.cs.cmu.edu/~dst/Adobe/Gallery/anon21jul01-pdf-encryption.txt
   * https://github.com/foliojs/pdfkit/blob/master/lib/security.js
   * http://www.fpdf.org/en/script/script37.php
   *)
  (**
   * @license
    Copyright (c) 2008, Adobe Systems Incorporated
    All rights reserved.
  
    Redistribution and use in source and binary forms, with or without 
    modification, are permitted provided that the following conditions are
    met:
  
    * Redistributions of source code must retain the above copyright notice, 
      this list of conditions and the following disclaimer.
    
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the 
      documentation and/or other materials provided with the distribution.
    
    * Neither the name of Adobe Systems Incorporated nor the names of its 
      contributors may be used to endorse or promote products derived from 
      this software without specific prior written permission.
  
    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
    IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
    THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR 
    CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
    EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
    LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
    NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
    SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  *)
  (**
   * @license
   * Copyright (c) 2017 Aras Abbasi
   *
   * Licensed under the MIT License.
   * http://opensource.org/licenses/mit-license
   *)
  (** ====================================================================
   * @license
   * jsPDF XMP metadata plugin
   * Copyright (c) 2016 Jussi Utunen, u-jussi@suomi24.fi
   *
   * Permission is hereby granted, free of charge, to any person obtaining
   * a copy of this software and associated documentation files (the
   * "Software"), to deal in the Software without restriction, including
   * without limitation the rights to use, copy, modify, merge, publish,
   * distribute, sublicense, and/or sell copies of the Software, and to
   * permit persons to whom the Software is furnished to do so, subject to
   * the following conditions:
   *
   * The above copyright notice and this permission notice shall be
   * included in all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
   * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
   * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
   * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
   * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
   * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
   * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
   * ====================================================================
   *)

xlsx/xlsx.mjs:
  (*! xlsx.js (C) 2013-present SheetJS -- http://sheetjs.com *)

xlsx/xlsx.mjs:
  (*! sheetjs (C) 2013-present SheetJS -- http://sheetjs.com *)

lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs:
lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs:
lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs:
lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs:
lucide-react/dist/esm/defaultAttributes.mjs:
lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs:
lucide-react/dist/esm/context.mjs:
lucide-react/dist/esm/Icon.mjs:
lucide-react/dist/esm/createLucideIcon.mjs:
lucide-react/dist/esm/icons/arrow-left-right.mjs:
lucide-react/dist/esm/icons/bell.mjs:
lucide-react/dist/esm/icons/boxes.mjs:
lucide-react/dist/esm/icons/calculator.mjs:
lucide-react/dist/esm/icons/calendar-clock.mjs:
lucide-react/dist/esm/icons/calendar-days.mjs:
lucide-react/dist/esm/icons/calendar-range.mjs:
lucide-react/dist/esm/icons/camera.mjs:
lucide-react/dist/esm/icons/chart-column.mjs:
lucide-react/dist/esm/icons/chart-line.mjs:
lucide-react/dist/esm/icons/chevron-right.mjs:
lucide-react/dist/esm/icons/circle-arrow-down.mjs:
lucide-react/dist/esm/icons/circle-arrow-up.mjs:
lucide-react/dist/esm/icons/circle-check.mjs:
lucide-react/dist/esm/icons/clipboard-list.mjs:
lucide-react/dist/esm/icons/clock.mjs:
lucide-react/dist/esm/icons/cog.mjs:
lucide-react/dist/esm/icons/coins.mjs:
lucide-react/dist/esm/icons/download.mjs:
lucide-react/dist/esm/icons/droplet.mjs:
lucide-react/dist/esm/icons/ellipsis.mjs:
lucide-react/dist/esm/icons/eye-off.mjs:
lucide-react/dist/esm/icons/eye.mjs:
lucide-react/dist/esm/icons/factory.mjs:
lucide-react/dist/esm/icons/file-text.mjs:
lucide-react/dist/esm/icons/files.mjs:
lucide-react/dist/esm/icons/loader-circle.mjs:
lucide-react/dist/esm/icons/log-in.mjs:
lucide-react/dist/esm/icons/log-out.mjs:
lucide-react/dist/esm/icons/mail.mjs:
lucide-react/dist/esm/icons/map.mjs:
lucide-react/dist/esm/icons/message-circle.mjs:
lucide-react/dist/esm/icons/minus.mjs:
lucide-react/dist/esm/icons/package.mjs:
lucide-react/dist/esm/icons/pencil.mjs:
lucide-react/dist/esm/icons/phone.mjs:
lucide-react/dist/esm/icons/plus.mjs:
lucide-react/dist/esm/icons/receipt.mjs:
lucide-react/dist/esm/icons/rotate-ccw-clock.mjs:
lucide-react/dist/esm/icons/scan-barcode.mjs:
lucide-react/dist/esm/icons/search.mjs:
lucide-react/dist/esm/icons/shield-check.mjs:
lucide-react/dist/esm/icons/shopping-bag.mjs:
lucide-react/dist/esm/icons/shopping-cart.mjs:
lucide-react/dist/esm/icons/stethoscope.mjs:
lucide-react/dist/esm/icons/tags.mjs:
lucide-react/dist/esm/icons/trash-2.mjs:
lucide-react/dist/esm/icons/trending-up.mjs:
lucide-react/dist/esm/icons/triangle-alert.mjs:
lucide-react/dist/esm/icons/truck.mjs:
lucide-react/dist/esm/icons/upload.mjs:
lucide-react/dist/esm/icons/user-round.mjs:
lucide-react/dist/esm/icons/users.mjs:
lucide-react/dist/esm/icons/wallet.mjs:
lucide-react/dist/esm/icons/x.mjs:
lucide-react/dist/esm/lucide-react.mjs:
  (**
   * @license lucide-react v1.39.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/


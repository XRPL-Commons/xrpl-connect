import {
  require_events
} from "./chunk-FV5UCLW4.js";
import {
  __commonJS,
  __require
} from "./chunk-V46ELZXU.js";

// node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js"(exports, module) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/common.js"(exports, module) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
          if (!debug.enabled) {
            return;
          }
          const self2 = debug;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self2.diff = ms;
          self2.prev = prevTime;
          self2.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self2, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self2, args);
          const logFn = self2.log || createDebug.log;
          logFn.apply(self2, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy;
        Object.defineProperty(debug, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug);
        }
        return debug;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module.exports = setup;
  }
});

// node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/browser.js"(exports, module) {
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/.pnpm/fetch-ponyfill@7.1.0/node_modules/fetch-ponyfill/build/fetch-browser.js
var require_fetch_browser = __commonJS({
  "node_modules/.pnpm/fetch-ponyfill@7.1.0/node_modules/fetch-ponyfill/build/fetch-browser.js"(exports, module) {
    (function(global2) {
      "use strict";
      function fetchPonyfill(options) {
        var Promise2 = options && options.Promise || global2.Promise;
        var XMLHttpRequest = options && options.XMLHttpRequest || global2.XMLHttpRequest;
        return function() {
          var globalThis2 = Object.create(global2, {
            fetch: {
              value: void 0,
              writable: true
            }
          });
          (function(global3, factory) {
            typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : factory(global3.WHATWGFetch = {});
          })(this, function(exports2) {
            "use strict";
            var global3 = typeof globalThis2 !== "undefined" && globalThis2 || typeof self !== "undefined" && self || typeof global3 !== "undefined" && global3;
            var support = {
              searchParams: "URLSearchParams" in global3,
              iterable: "Symbol" in global3 && "iterator" in Symbol,
              blob: "FileReader" in global3 && "Blob" in global3 && function() {
                try {
                  new Blob();
                  return true;
                } catch (e) {
                  return false;
                }
              }(),
              formData: "FormData" in global3,
              arrayBuffer: "ArrayBuffer" in global3
            };
            function isDataView(obj) {
              return obj && DataView.prototype.isPrototypeOf(obj);
            }
            if (support.arrayBuffer) {
              var viewClasses = [
                "[object Int8Array]",
                "[object Uint8Array]",
                "[object Uint8ClampedArray]",
                "[object Int16Array]",
                "[object Uint16Array]",
                "[object Int32Array]",
                "[object Uint32Array]",
                "[object Float32Array]",
                "[object Float64Array]"
              ];
              var isArrayBufferView = ArrayBuffer.isView || function(obj) {
                return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1;
              };
            }
            function normalizeName(name) {
              if (typeof name !== "string") {
                name = String(name);
              }
              if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === "") {
                throw new TypeError("Invalid character in header field name");
              }
              return name.toLowerCase();
            }
            function normalizeValue(value) {
              if (typeof value !== "string") {
                value = String(value);
              }
              return value;
            }
            function iteratorFor(items) {
              var iterator = {
                next: function() {
                  var value = items.shift();
                  return { done: value === void 0, value };
                }
              };
              if (support.iterable) {
                iterator[Symbol.iterator] = function() {
                  return iterator;
                };
              }
              return iterator;
            }
            function Headers(headers) {
              this.map = {};
              if (headers instanceof Headers) {
                headers.forEach(function(value, name) {
                  this.append(name, value);
                }, this);
              } else if (Array.isArray(headers)) {
                headers.forEach(function(header) {
                  this.append(header[0], header[1]);
                }, this);
              } else if (headers) {
                Object.getOwnPropertyNames(headers).forEach(function(name) {
                  this.append(name, headers[name]);
                }, this);
              }
            }
            Headers.prototype.append = function(name, value) {
              name = normalizeName(name);
              value = normalizeValue(value);
              var oldValue = this.map[name];
              this.map[name] = oldValue ? oldValue + ", " + value : value;
            };
            Headers.prototype["delete"] = function(name) {
              delete this.map[normalizeName(name)];
            };
            Headers.prototype.get = function(name) {
              name = normalizeName(name);
              return this.has(name) ? this.map[name] : null;
            };
            Headers.prototype.has = function(name) {
              return this.map.hasOwnProperty(normalizeName(name));
            };
            Headers.prototype.set = function(name, value) {
              this.map[normalizeName(name)] = normalizeValue(value);
            };
            Headers.prototype.forEach = function(callback, thisArg) {
              for (var name in this.map) {
                if (this.map.hasOwnProperty(name)) {
                  callback.call(thisArg, this.map[name], name, this);
                }
              }
            };
            Headers.prototype.keys = function() {
              var items = [];
              this.forEach(function(value, name) {
                items.push(name);
              });
              return iteratorFor(items);
            };
            Headers.prototype.values = function() {
              var items = [];
              this.forEach(function(value) {
                items.push(value);
              });
              return iteratorFor(items);
            };
            Headers.prototype.entries = function() {
              var items = [];
              this.forEach(function(value, name) {
                items.push([name, value]);
              });
              return iteratorFor(items);
            };
            if (support.iterable) {
              Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
            }
            function consumed(body) {
              if (body.bodyUsed) {
                return Promise2.reject(new TypeError("Already read"));
              }
              body.bodyUsed = true;
            }
            function fileReaderReady(reader) {
              return new Promise2(function(resolve, reject) {
                reader.onload = function() {
                  resolve(reader.result);
                };
                reader.onerror = function() {
                  reject(reader.error);
                };
              });
            }
            function readBlobAsArrayBuffer(blob) {
              var reader = new FileReader();
              var promise = fileReaderReady(reader);
              reader.readAsArrayBuffer(blob);
              return promise;
            }
            function readBlobAsText(blob) {
              var reader = new FileReader();
              var promise = fileReaderReady(reader);
              reader.readAsText(blob);
              return promise;
            }
            function readArrayBufferAsText(buf) {
              var view = new Uint8Array(buf);
              var chars = new Array(view.length);
              for (var i = 0; i < view.length; i++) {
                chars[i] = String.fromCharCode(view[i]);
              }
              return chars.join("");
            }
            function bufferClone(buf) {
              if (buf.slice) {
                return buf.slice(0);
              } else {
                var view = new Uint8Array(buf.byteLength);
                view.set(new Uint8Array(buf));
                return view.buffer;
              }
            }
            function Body() {
              this.bodyUsed = false;
              this._initBody = function(body) {
                this.bodyUsed = this.bodyUsed;
                this._bodyInit = body;
                if (!body) {
                  this._bodyText = "";
                } else if (typeof body === "string") {
                  this._bodyText = body;
                } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
                  this._bodyBlob = body;
                } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
                  this._bodyFormData = body;
                } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                  this._bodyText = body.toString();
                } else if (support.arrayBuffer && support.blob && isDataView(body)) {
                  this._bodyArrayBuffer = bufferClone(body.buffer);
                  this._bodyInit = new Blob([this._bodyArrayBuffer]);
                } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
                  this._bodyArrayBuffer = bufferClone(body);
                } else {
                  this._bodyText = body = Object.prototype.toString.call(body);
                }
                if (!this.headers.get("content-type")) {
                  if (typeof body === "string") {
                    this.headers.set("content-type", "text/plain;charset=UTF-8");
                  } else if (this._bodyBlob && this._bodyBlob.type) {
                    this.headers.set("content-type", this._bodyBlob.type);
                  } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                    this.headers.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8");
                  }
                }
              };
              if (support.blob) {
                this.blob = function() {
                  var rejected = consumed(this);
                  if (rejected) {
                    return rejected;
                  }
                  if (this._bodyBlob) {
                    return Promise2.resolve(this._bodyBlob);
                  } else if (this._bodyArrayBuffer) {
                    return Promise2.resolve(new Blob([this._bodyArrayBuffer]));
                  } else if (this._bodyFormData) {
                    throw new Error("could not read FormData body as blob");
                  } else {
                    return Promise2.resolve(new Blob([this._bodyText]));
                  }
                };
                this.arrayBuffer = function() {
                  if (this._bodyArrayBuffer) {
                    var isConsumed = consumed(this);
                    if (isConsumed) {
                      return isConsumed;
                    }
                    if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
                      return Promise2.resolve(
                        this._bodyArrayBuffer.buffer.slice(
                          this._bodyArrayBuffer.byteOffset,
                          this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
                        )
                      );
                    } else {
                      return Promise2.resolve(this._bodyArrayBuffer);
                    }
                  } else {
                    return this.blob().then(readBlobAsArrayBuffer);
                  }
                };
              }
              this.text = function() {
                var rejected = consumed(this);
                if (rejected) {
                  return rejected;
                }
                if (this._bodyBlob) {
                  return readBlobAsText(this._bodyBlob);
                } else if (this._bodyArrayBuffer) {
                  return Promise2.resolve(readArrayBufferAsText(this._bodyArrayBuffer));
                } else if (this._bodyFormData) {
                  throw new Error("could not read FormData body as text");
                } else {
                  return Promise2.resolve(this._bodyText);
                }
              };
              if (support.formData) {
                this.formData = function() {
                  return this.text().then(decode);
                };
              }
              this.json = function() {
                return this.text().then(JSON.parse);
              };
              return this;
            }
            var methods = ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"];
            function normalizeMethod(method) {
              var upcased = method.toUpperCase();
              return methods.indexOf(upcased) > -1 ? upcased : method;
            }
            function Request(input, options2) {
              if (!(this instanceof Request)) {
                throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
              }
              options2 = options2 || {};
              var body = options2.body;
              if (input instanceof Request) {
                if (input.bodyUsed) {
                  throw new TypeError("Already read");
                }
                this.url = input.url;
                this.credentials = input.credentials;
                if (!options2.headers) {
                  this.headers = new Headers(input.headers);
                }
                this.method = input.method;
                this.mode = input.mode;
                this.signal = input.signal;
                if (!body && input._bodyInit != null) {
                  body = input._bodyInit;
                  input.bodyUsed = true;
                }
              } else {
                this.url = String(input);
              }
              this.credentials = options2.credentials || this.credentials || "same-origin";
              if (options2.headers || !this.headers) {
                this.headers = new Headers(options2.headers);
              }
              this.method = normalizeMethod(options2.method || this.method || "GET");
              this.mode = options2.mode || this.mode || null;
              this.signal = options2.signal || this.signal;
              this.referrer = null;
              if ((this.method === "GET" || this.method === "HEAD") && body) {
                throw new TypeError("Body not allowed for GET or HEAD requests");
              }
              this._initBody(body);
              if (this.method === "GET" || this.method === "HEAD") {
                if (options2.cache === "no-store" || options2.cache === "no-cache") {
                  var reParamSearch = /([?&])_=[^&]*/;
                  if (reParamSearch.test(this.url)) {
                    this.url = this.url.replace(reParamSearch, "$1_=" + (/* @__PURE__ */ new Date()).getTime());
                  } else {
                    var reQueryString = /\?/;
                    this.url += (reQueryString.test(this.url) ? "&" : "?") + "_=" + (/* @__PURE__ */ new Date()).getTime();
                  }
                }
              }
            }
            Request.prototype.clone = function() {
              return new Request(this, { body: this._bodyInit });
            };
            function decode(body) {
              var form = new FormData();
              body.trim().split("&").forEach(function(bytes) {
                if (bytes) {
                  var split = bytes.split("=");
                  var name = split.shift().replace(/\+/g, " ");
                  var value = split.join("=").replace(/\+/g, " ");
                  form.append(decodeURIComponent(name), decodeURIComponent(value));
                }
              });
              return form;
            }
            function parseHeaders(rawHeaders) {
              var headers = new Headers();
              var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, " ");
              preProcessedHeaders.split("\r").map(function(header) {
                return header.indexOf("\n") === 0 ? header.substr(1, header.length) : header;
              }).forEach(function(line) {
                var parts = line.split(":");
                var key = parts.shift().trim();
                if (key) {
                  var value = parts.join(":").trim();
                  headers.append(key, value);
                }
              });
              return headers;
            }
            Body.call(Request.prototype);
            function Response(bodyInit, options2) {
              if (!(this instanceof Response)) {
                throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
              }
              if (!options2) {
                options2 = {};
              }
              this.type = "default";
              this.status = options2.status === void 0 ? 200 : options2.status;
              this.ok = this.status >= 200 && this.status < 300;
              this.statusText = "statusText" in options2 ? options2.statusText : "";
              this.headers = new Headers(options2.headers);
              this.url = options2.url || "";
              this._initBody(bodyInit);
            }
            Body.call(Response.prototype);
            Response.prototype.clone = function() {
              return new Response(this._bodyInit, {
                status: this.status,
                statusText: this.statusText,
                headers: new Headers(this.headers),
                url: this.url
              });
            };
            Response.error = function() {
              var response = new Response(null, { status: 0, statusText: "" });
              response.type = "error";
              return response;
            };
            var redirectStatuses = [301, 302, 303, 307, 308];
            Response.redirect = function(url, status) {
              if (redirectStatuses.indexOf(status) === -1) {
                throw new RangeError("Invalid status code");
              }
              return new Response(null, { status, headers: { location: url } });
            };
            exports2.DOMException = global3.DOMException;
            try {
              new exports2.DOMException();
            } catch (err) {
              exports2.DOMException = function(message, name) {
                this.message = message;
                this.name = name;
                var error = Error(message);
                this.stack = error.stack;
              };
              exports2.DOMException.prototype = Object.create(Error.prototype);
              exports2.DOMException.prototype.constructor = exports2.DOMException;
            }
            function fetch2(input, init) {
              return new Promise2(function(resolve, reject) {
                var request = new Request(input, init);
                if (request.signal && request.signal.aborted) {
                  return reject(new exports2.DOMException("Aborted", "AbortError"));
                }
                var xhr = new XMLHttpRequest();
                function abortXhr() {
                  xhr.abort();
                }
                xhr.onload = function() {
                  var options2 = {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    headers: parseHeaders(xhr.getAllResponseHeaders() || "")
                  };
                  options2.url = "responseURL" in xhr ? xhr.responseURL : options2.headers.get("X-Request-URL");
                  var body = "response" in xhr ? xhr.response : xhr.responseText;
                  setTimeout(function() {
                    resolve(new Response(body, options2));
                  }, 0);
                };
                xhr.onerror = function() {
                  setTimeout(function() {
                    reject(new TypeError("Network request failed"));
                  }, 0);
                };
                xhr.ontimeout = function() {
                  setTimeout(function() {
                    reject(new TypeError("Network request failed"));
                  }, 0);
                };
                xhr.onabort = function() {
                  setTimeout(function() {
                    reject(new exports2.DOMException("Aborted", "AbortError"));
                  }, 0);
                };
                function fixUrl(url) {
                  try {
                    return url === "" && global3.location.href ? global3.location.href : url;
                  } catch (e) {
                    return url;
                  }
                }
                xhr.open(request.method, fixUrl(request.url), true);
                if (request.credentials === "include") {
                  xhr.withCredentials = true;
                } else if (request.credentials === "omit") {
                  xhr.withCredentials = false;
                }
                if ("responseType" in xhr) {
                  if (support.blob) {
                    xhr.responseType = "blob";
                  } else if (support.arrayBuffer && request.headers.get("Content-Type") && request.headers.get("Content-Type").indexOf("application/octet-stream") !== -1) {
                    xhr.responseType = "arraybuffer";
                  }
                }
                if (init && typeof init.headers === "object" && !(init.headers instanceof Headers)) {
                  Object.getOwnPropertyNames(init.headers).forEach(function(name) {
                    xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
                  });
                } else {
                  request.headers.forEach(function(value, name) {
                    xhr.setRequestHeader(name, value);
                  });
                }
                if (request.signal) {
                  request.signal.addEventListener("abort", abortXhr);
                  xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                      request.signal.removeEventListener("abort", abortXhr);
                    }
                  };
                }
                xhr.send(typeof request._bodyInit === "undefined" ? null : request._bodyInit);
              });
            }
            fetch2.polyfill = true;
            if (!global3.fetch) {
              global3.fetch = fetch2;
              global3.Headers = Headers;
              global3.Request = Request;
              global3.Response = Response;
            }
            exports2.Headers = Headers;
            exports2.Request = Request;
            exports2.Response = Response;
            exports2.fetch = fetch2;
            Object.defineProperty(exports2, "__esModule", { value: true });
          });
          return {
            fetch: globalThis2.fetch,
            Headers: globalThis2.Headers,
            Request: globalThis2.Request,
            Response: globalThis2.Response,
            DOMException: globalThis2.DOMException
          };
        }();
      }
      if (typeof define === "function" && define.amd) {
        define(function() {
          return fetchPonyfill;
        });
      } else if (typeof exports === "object") {
        module.exports = fetchPonyfill;
      } else {
        global2.fetchPonyfill = fetchPonyfill;
      }
    })(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : exports);
  }
});

// node_modules/.pnpm/os-browserify@0.3.0/node_modules/os-browserify/browser.js
var require_browser2 = __commonJS({
  "node_modules/.pnpm/os-browserify@0.3.0/node_modules/os-browserify/browser.js"(exports) {
    exports.endianness = function() {
      return "LE";
    };
    exports.hostname = function() {
      if (typeof location !== "undefined") {
        return location.hostname;
      } else return "";
    };
    exports.loadavg = function() {
      return [];
    };
    exports.uptime = function() {
      return 0;
    };
    exports.freemem = function() {
      return Number.MAX_VALUE;
    };
    exports.totalmem = function() {
      return Number.MAX_VALUE;
    };
    exports.cpus = function() {
      return [];
    };
    exports.type = function() {
      return "Browser";
    };
    exports.release = function() {
      if (typeof navigator !== "undefined") {
        return navigator.appVersion;
      }
      return "";
    };
    exports.networkInterfaces = exports.getNetworkInterfaces = function() {
      return {};
    };
    exports.arch = function() {
      return "javascript";
    };
    exports.platform = function() {
      return "browser";
    };
    exports.tmpdir = exports.tmpDir = function() {
      return "/tmp";
    };
    exports.EOL = "\n";
    exports.homedir = function() {
      return "/";
    };
  }
});

// node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/utils.js
var require_utils = __commonJS({
  "node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/utils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DeferredPromise = exports.throwIfError = void 0;
    function throwIfError(call) {
      var _a, _b, _c, _d, _e, _f;
      const isFatalError = call.message !== void 0;
      if (isFatalError) {
        throw new Error(call.message);
      }
      const isError = call.next === void 0 && ((_b = (_a = call) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.uuid) === void 0 && ((_d = (_c = call) === null || _c === void 0 ? void 0 : _c.application) === null || _d === void 0 ? void 0 : _d.uuidv4) === void 0 && ((_f = (_e = call) === null || _e === void 0 ? void 0 : _e.error) === null || _f === void 0 ? void 0 : _f.code) !== void 0;
      if (isError) {
        const e = call.error;
        throw new Error(`Error code ${e.code}, see XUMM Dev Console, reference: ${e.reference}`);
      }
    }
    exports.throwIfError = throwIfError;
    var DeferredPromise = class {
      constructor() {
        this.resolveFn = (_arg) => {
        };
        this.rejectFn = (_arg) => {
        };
        this.promise = new Promise((resolve, reject) => {
          this.resolveFn = resolve;
          this.rejectFn = reject;
        });
      }
      resolve(arg) {
        this.resolveFn(arg);
        return this.promise;
      }
      reject(arg) {
        this.rejectFn(arg);
        return this.promise;
      }
    };
    exports.DeferredPromise = DeferredPromise;
  }
});

// node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/Meta.js
var require_Meta = __commonJS({
  "node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/Meta.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Meta = void 0;
    var debug_1 = require_browser();
    var fetch_ponyfill_1 = __importDefault(require_fetch_browser());
    var { fetch: fetch2, Request, Response, Headers } = fetch_ponyfill_1.default();
    var os_browserify_1 = require_browser2();
    var utils_1 = require_utils();
    var index_1 = require_src();
    var log = debug_1.debug("xumm-sdk:meta");
    var Meta = class {
      constructor(apiKey, apiSecret) {
        this.isBrowser = false;
        this.jwtFlow = false;
        this.injected = false;
        this.endpoint = "https://xumm.app";
        log("Constructed");
        const uuidRe = new RegExp("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$");
        const secret = {
          split: apiSecret.split(":"),
          uuidv4: ""
        };
        if (secret.split.length === 3 && secret.split.slice(0, 2).join(":") === "xApp:OneTimeToken") {
          secret.uuidv4 = secret.split[2];
          this.jwtFlow = true;
        } else if (secret.split.length > 1 && secret.split[0] === "RAWJWT") {
          this.jwtFlow = true;
          this.jwt = secret.split.slice(1).join(":");
        } else {
          secret.uuidv4 = apiSecret;
        }
        if (!uuidRe.test(apiKey) || !uuidRe.test(secret.uuidv4)) {
          if (!this.jwtFlow) {
            throw new Error("Invalid API Key and/or API Secret. Use dotenv or constructor params.");
          } else {
            if (!this.jwt) {
              throw new Error("Invalid API Key and/or OTT (One Time Token). Provide OTT param (2nd param) or make sure `xAppToken` query param is present (Browser)");
            }
          }
        }
        if (typeof globalThis !== "undefined" && Object.keys(globalThis).indexOf("window") < 0) {
          log("Running in node");
        } else {
          console.log("XUMM SDK: Running in browser");
          this.isBrowser = true;
        }
        this.apiKey = apiKey;
        this.apiSecret = secret.uuidv4;
        if (this.jwtFlow && !this.jwt) {
          this.authPromise = new Promise((resolve) => {
            this.authPromiseResolve = resolve;
          });
          Promise.resolve().then(() => this.authorize()).catch((e) => {
            log("Authorize error:", e.message);
            if (this === null || this === void 0 ? void 0 : this.invoker) {
              this.invoker.caught(e);
            }
            if (this.authPromiseResolve) {
              this.authPromiseResolve();
            }
          });
        }
        return this;
      }
      setEndpoint(endpoint) {
        if (endpoint.match(/^http/)) {
          this.endpoint = endpoint.trim();
          return true;
        }
        return false;
      }
      authorize() {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
          log("JWT Authorize", this.apiSecret);
          let store;
          if ((this === null || this === void 0 ? void 0 : this.invoker) && this.invoker.constructor === index_1.XummSdkJwt) {
            store = this.invoker._jwtStore(this, (jwt) => this.jwt = jwt);
          }
          const authorizeData = (store === null || store === void 0 ? void 0 : store.get(this.apiSecret)) || (yield this.call("authorize"));
          if ((_b = (_a = authorizeData) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.code) {
            log(`Could not resolve API Key & OTT to JWT (already fetched? Unauthorized?)`);
            if ((this === null || this === void 0 ? void 0 : this.invoker) && this.invoker.constructor === index_1.XummSdkJwt && ((_c = this === null || this === void 0 ? void 0 : this.invoker) === null || _c === void 0 ? void 0 : _c.fatalHandler)) {
              this.invoker.fatalHandler(new Error(authorizeData.error.reference));
            } else {
              utils_1.throwIfError(authorizeData);
            }
          } else if ((_d = authorizeData) === null || _d === void 0 ? void 0 : _d.jwt) {
            const JwtOttResponse = authorizeData;
            store === null || store === void 0 ? void 0 : store.set(this.apiSecret, JwtOttResponse);
          } else {
            throw new Error(`Unexpected response for xApp JWT authorize request`);
          }
          if (this.authPromiseResolve) {
            this.authPromiseResolve();
          }
        });
      }
      call(endpoint, httpMethod = "GET", data) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
          const method = httpMethod.toUpperCase();
          const trEndpoint = endpoint.split("/")[0];
          if (this.jwtFlow && !(this === null || this === void 0 ? void 0 : this.jwt) && this.authPromise && endpoint !== "authorize") {
            yield this.authPromise;
          }
          try {
            let body;
            if (typeof data !== "undefined") {
              if (typeof data === "object" && data !== null) {
                body = JSON.stringify(data);
              }
              if (typeof data === "string") {
                body = data;
              }
            }
            const headers = {
              "Content-Type": "application/json"
            };
            if (!this.isBrowser) {
              Object.assign(headers, {
                "User-Agent": `xumm-sdk/node (${os_browserify_1.hostname()}) node-fetch`
              });
            }
            if (!this.jwtFlow) {
              Object.assign(headers, {
                "x-api-key": this.apiKey,
                "x-api-secret": this.apiSecret
              });
            } else {
              if (endpoint === "authorize") {
                Object.assign(headers, {
                  "x-api-key": this.apiKey,
                  "x-api-ott": this.apiSecret
                });
              } else {
                Object.assign(headers, {
                  "Authorization": "Bearer " + this.jwt
                });
              }
            }
            const jwtEndpoints = [
              "authorize",
              "ping",
              "curated-assets",
              "rates",
              "payload",
              "userdata",
              "xrpl-tx",
              "nftoken-detail",
              "rails",
              "hookhash"
            ];
            const endpointType = this.jwtFlow && jwtEndpoints.indexOf(trEndpoint) > -1 ? "jwt" : "platform";
            const request = yield fetch2(this.endpoint + "/api/v1/" + endpointType + "/" + endpoint, {
              method,
              body,
              headers
            });
            const json = yield request.json();
            return json;
          } catch (e) {
            const err = new Error(`Unexpected response from XUMM API [${method}:${trEndpoint}]`);
            err.stack = ((_a = e) === null || _a === void 0 ? void 0 : _a.stack) || void 0;
            throw err;
          }
        });
      }
      ping() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
          const pong = yield this.call("ping");
          utils_1.throwIfError(pong);
          if (typeof pong.auth !== "undefined") {
            return pong.auth;
          }
          if (typeof ((_a = pong) === null || _a === void 0 ? void 0 : _a.ott_uuidv4) !== "undefined") {
            return {
              application: {
                uuidv4: pong.app_uuidv4,
                name: pong.app_name
              },
              jwtData: pong
            };
          }
          if (typeof ((_b = pong) === null || _b === void 0 ? void 0 : _b.usertoken_uuidv4) !== "undefined") {
            return {
              application: {
                uuidv4: pong.client_id,
                name: pong.app_name
              },
              jwtData: pong
            };
          }
          throw new Error(`Unexpected response for ping request`);
        });
      }
      getCuratedAssets() {
        return __awaiter(this, void 0, void 0, function* () {
          return yield this.call("curated-assets");
        });
      }
      getRates(currencyCode) {
        return __awaiter(this, void 0, void 0, function* () {
          return yield this.call("rates/" + currencyCode.trim().toUpperCase());
        });
      }
      getKycStatus(userTokenOrAccount) {
        return __awaiter(this, void 0, void 0, function* () {
          if (userTokenOrAccount.trim().match(/^r/)) {
            const call = yield this.call("kyc-status/" + userTokenOrAccount.trim());
            return (call === null || call === void 0 ? void 0 : call.kycApproved) ? "SUCCESSFUL" : "NONE";
          } else {
            const call = yield this.call("kyc-status", "POST", {
              user_token: userTokenOrAccount
            });
            return (call === null || call === void 0 ? void 0 : call.kycStatus) || "NONE";
          }
        });
      }
      getRails() {
        return __awaiter(this, void 0, void 0, function* () {
          return yield this.call("rails");
        });
      }
      getHookHash(hookHash) {
        return __awaiter(this, void 0, void 0, function* () {
          if (typeof hookHash === "string" && hookHash.trim().match(/^[A-Fa-f0-9]{64}$/)) {
            return yield this.call("hookhash/" + hookHash.trim());
          }
          throw Error("Invalid Hook Hash (expecting 64 char hex)");
        });
      }
      getHookHashes() {
        return __awaiter(this, void 0, void 0, function* () {
          return yield this.call("hookhash");
        });
      }
      getTransaction(txHash) {
        return __awaiter(this, void 0, void 0, function* () {
          return yield this.call("xrpl-tx/" + txHash.trim());
        });
      }
      getNftokenDetail(tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
          if (!this.jwtFlow) {
            throw new Error("getNftokenDetail: only available in JWT (XummSdkJwt) mode");
          }
          return yield this.call("nftoken-detail/" + tokenId.trim());
        });
      }
      verifyUserTokens(userTokens) {
        return __awaiter(this, void 0, void 0, function* () {
          return (yield this.call("user-tokens", "POST", {
            tokens: Array.isArray(userTokens) ? userTokens : [userTokens]
          })).tokens;
        });
      }
      // Internal
      _inject(Invoker) {
        if (!this.injected) {
          this.invoker = Invoker;
        } else {
          throw new Error("Cannot `_inject` twice");
        }
      }
    };
    exports.Meta = Meta;
  }
});

// node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/Storage.js
var require_Storage = __commonJS({
  "node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/Storage.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Storage = void 0;
    var debug_1 = require_browser();
    var utils_1 = require_utils();
    var log = debug_1.debug("xumm-sdk:storage");
    var Storage = class {
      constructor(MetaObject) {
        log("Constructed");
        this.Meta = MetaObject;
      }
      get() {
        return __awaiter(this, void 0, void 0, function* () {
          const call = yield this.Meta.call("app-storage", "GET");
          utils_1.throwIfError(call);
          return call.data;
        });
      }
      set(data) {
        return __awaiter(this, void 0, void 0, function* () {
          const call = yield this.Meta.call("app-storage", "POST", data);
          utils_1.throwIfError(call);
          return call.stored;
        });
      }
      delete() {
        return __awaiter(this, void 0, void 0, function* () {
          const call = yield this.Meta.call("app-storage", "DELETE");
          utils_1.throwIfError(call);
          return call.stored;
        });
      }
    };
    exports.Storage = Storage;
  }
});

// node_modules/.pnpm/es5-ext@0.10.64/node_modules/es5-ext/global.js
var require_global = __commonJS({
  "node_modules/.pnpm/es5-ext@0.10.64/node_modules/es5-ext/global.js"(exports, module) {
    var naiveFallback = function() {
      if (typeof self === "object" && self) return self;
      if (typeof window === "object" && window) return window;
      throw new Error("Unable to resolve global `this`");
    };
    module.exports = function() {
      if (this) return this;
      if (typeof globalThis === "object" && globalThis) return globalThis;
      try {
        Object.defineProperty(Object.prototype, "__global__", {
          get: function() {
            return this;
          },
          configurable: true
        });
      } catch (error) {
        return naiveFallback();
      }
      try {
        if (!__global__) return naiveFallback();
        return __global__;
      } finally {
        delete Object.prototype.__global__;
      }
    }();
  }
});

// node_modules/.pnpm/websocket@1.0.35/node_modules/websocket/package.json
var require_package = __commonJS({
  "node_modules/.pnpm/websocket@1.0.35/node_modules/websocket/package.json"(exports, module) {
    module.exports = {
      name: "websocket",
      description: "Websocket Client & Server Library implementing the WebSocket protocol as specified in RFC 6455.",
      keywords: [
        "websocket",
        "websockets",
        "socket",
        "networking",
        "comet",
        "push",
        "RFC-6455",
        "realtime",
        "server",
        "client"
      ],
      author: "Brian McKelvey <theturtle32@gmail.com> (https://github.com/theturtle32)",
      contributors: [
        "Iñaki Baz Castillo <ibc@aliax.net> (http://dev.sipdoc.net)"
      ],
      version: "1.0.35",
      repository: {
        type: "git",
        url: "https://github.com/theturtle32/WebSocket-Node.git"
      },
      homepage: "https://github.com/theturtle32/WebSocket-Node",
      engines: {
        node: ">=4.0.0"
      },
      dependencies: {
        bufferutil: "^4.0.1",
        debug: "^2.2.0",
        "es5-ext": "^0.10.63",
        "typedarray-to-buffer": "^3.1.5",
        "utf-8-validate": "^5.0.2",
        yaeti: "^0.0.6"
      },
      devDependencies: {
        "buffer-equal": "^1.0.0",
        gulp: "^4.0.2",
        "gulp-jshint": "^2.0.4",
        "jshint-stylish": "^2.2.1",
        jshint: "^2.0.0",
        tape: "^4.9.1"
      },
      config: {
        verbose: false
      },
      scripts: {
        test: "tape test/unit/*.js",
        gulp: "gulp"
      },
      main: "index",
      directories: {
        lib: "./lib"
      },
      browser: "lib/browser.js",
      license: "Apache-2.0"
    };
  }
});

// node_modules/.pnpm/websocket@1.0.35/node_modules/websocket/lib/version.js
var require_version = __commonJS({
  "node_modules/.pnpm/websocket@1.0.35/node_modules/websocket/lib/version.js"(exports, module) {
    module.exports = require_package().version;
  }
});

// node_modules/.pnpm/websocket@1.0.35/node_modules/websocket/lib/browser.js
var require_browser3 = __commonJS({
  "node_modules/.pnpm/websocket@1.0.35/node_modules/websocket/lib/browser.js"(exports, module) {
    var _globalThis;
    if (typeof globalThis === "object") {
      _globalThis = globalThis;
    } else {
      try {
        _globalThis = require_global();
      } catch (error) {
      } finally {
        if (!_globalThis && typeof window !== "undefined") {
          _globalThis = window;
        }
        if (!_globalThis) {
          throw new Error("Could not determine global this");
        }
      }
    }
    var NativeWebSocket = _globalThis.WebSocket || _globalThis.MozWebSocket;
    var websocket_version = require_version();
    function W3CWebSocket(uri, protocols) {
      var native_instance;
      if (protocols) {
        native_instance = new NativeWebSocket(uri, protocols);
      } else {
        native_instance = new NativeWebSocket(uri);
      }
      return native_instance;
    }
    if (NativeWebSocket) {
      ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function(prop) {
        Object.defineProperty(W3CWebSocket, prop, {
          get: function() {
            return NativeWebSocket[prop];
          }
        });
      });
    }
    module.exports = {
      "w3cwebsocket": NativeWebSocket ? W3CWebSocket : null,
      "version": websocket_version
    };
  }
});

// node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/Payload.js
var require_Payload = __commonJS({
  "node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/Payload.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Payload = void 0;
    var debug_1 = require_browser();
    var websocket_1 = require_browser3();
    var utils_1 = require_utils();
    var log = debug_1.debug("xumm-sdk:payload");
    var logWs = debug_1.debug("xumm-sdk:payload:websocket");
    var maxSocketConnectAttempts = typeof jest !== "undefined" ? 0 : 30;
    var socketConnectAttemptSecondsDelay = 2;
    var socketKeepaliveSendSeconds = 2;
    var socketKeepaliveTimeoutSeconds = 10;
    var Payload = class {
      constructor(MetaObject) {
        log("Constructed");
        this.Meta = MetaObject;
      }
      resolvePayload(payload) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
          if (typeof payload === "string") {
            return yield this.get(payload, true);
          } else if (typeof ((_a = payload) === null || _a === void 0 ? void 0 : _a.uuid) !== "undefined") {
            return yield this.get(payload.uuid, true);
          } else if (typeof ((_c = (_b = payload) === null || _b === void 0 ? void 0 : _b.meta) === null || _c === void 0 ? void 0 : _c.uuid) !== "undefined") {
            return payload;
          }
          throw new Error("Could not resolve payload (not found)");
        });
      }
      create(payload, returnErrors = false) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
          const directTx = typeof payload.TransactionType !== "undefined" && typeof payload.txjson === "undefined";
          const call = yield this.Meta.call("payload", "POST", directTx ? { txjson: payload } : payload);
          if (returnErrors) {
            utils_1.throwIfError(call);
          }
          const isCreatedPayload = ((_a = call) === null || _a === void 0 ? void 0 : _a.next) !== void 0;
          if (!isCreatedPayload) {
            return null;
          }
          return call;
        });
      }
      get(payload, returnErrors = false) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
          const payloadUuid = typeof payload === "string" ? payload : payload === null || payload === void 0 ? void 0 : payload.uuid;
          const call = yield this.Meta.call("payload/" + payloadUuid, "GET");
          if (returnErrors) {
            utils_1.throwIfError(call);
          }
          const isPayload = ((_b = (_a = call) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.uuid) !== void 0;
          if (!isPayload) {
            return null;
          }
          return call;
        });
      }
      subscribe(payload, callback) {
        return __awaiter(this, void 0, void 0, function* () {
          const callbackPromise = new utils_1.DeferredPromise();
          const payloadDetails = yield this.resolvePayload(payload);
          if (payloadDetails) {
            const _u = "undefined";
            let socket;
            let keepAlivePing;
            let keepAliveReinstateTimer;
            let reconnectAttempts = 0;
            callbackPromise.promise.then(() => {
              clearTimeout(keepAlivePing);
              clearTimeout(keepAliveReinstateTimer);
              socket.close(1e3);
            });
            const connect = () => {
              var _a, _b;
              socket = typeof ((_a = globalThis) === null || _a === void 0 ? void 0 : _a.MockedWebSocket) !== _u && typeof jest !== _u ? new ((_b = globalThis) === null || _b === void 0 ? void 0 : _b.MockedWebSocket)("ws://xumm.local") : new websocket_1.w3cwebsocket(this.Meta.endpoint.replace(/^http/, "ws") + "/sign/" + payloadDetails.meta.uuid);
              socket.onopen = () => {
                console.log(`Payload ${payloadDetails.meta.uuid}: subscription active (WebSocket opened)`);
                keepAlivePing = setInterval(() => {
                  logWs("Send keepalive");
                  socket.send('{"ping":true}');
                }, socketKeepaliveSendSeconds * 1e3);
              };
              socket.onmessage = (MessageEvent2) => __awaiter(this, void 0, void 0, function* () {
                reconnectAttempts = 0;
                const m = MessageEvent2.data;
                let json = void 0;
                try {
                  json = JSON.parse(m.toString());
                  if ((json === null || json === void 0 ? void 0 : json.message) && json.message === "Right back at you!") {
                    logWs("Keepalive response");
                    clearTimeout(keepAliveReinstateTimer);
                    keepAliveReinstateTimer = setTimeout(() => {
                      console.log(`WebSocket for ${payloadDetails.meta.uuid} keepalive response timeout, assume dead... (Reconnect)`);
                      socket.close(1002, "Assume dead");
                    }, socketKeepaliveTimeoutSeconds * 1e3);
                    return;
                  }
                  if ((json === null || json === void 0 ? void 0 : json.signed) || (json === null || json === void 0 ? void 0 : json.expired)) {
                    const updatedPayloadDetails = yield this.resolvePayload(payload);
                    Object.assign(payloadDetails, Object.assign({}, updatedPayloadDetails));
                  }
                } catch (e) {
                  logWs(`Payload ${payloadDetails.meta.uuid}: Received message, unable to parse as JSON`, e);
                }
                if (json && callback && typeof json.devapp_fetched === "undefined") {
                  try {
                    const callbackResult = yield callback({
                      uuid: payloadDetails.meta.uuid,
                      data: json,
                      resolve(resolveData) {
                        return __awaiter(this, void 0, void 0, function* () {
                          yield callbackPromise.resolve(resolveData || void 0);
                        });
                      },
                      payload: payloadDetails
                    });
                    if (callbackResult !== void 0) {
                      callbackPromise.resolve(callbackResult);
                    }
                  } catch (e) {
                    logWs(`Payload ${payloadDetails.meta.uuid}: Callback exception`, e);
                    console.log(`Payload ${payloadDetails.meta.uuid}: Callback exception: ${e.message}`);
                  }
                }
              });
              socket.onclose = (_e) => {
                logWs("Closed [code]", _e.code);
                logWs("Closed [reason]", _e.reason);
                logWs("Closed [wasClean]", _e.wasClean);
                clearInterval(keepAlivePing);
                clearTimeout(keepAliveReinstateTimer);
                if (_e.code > 1e3 || _e.wasClean === false) {
                  console.log(_e);
                  logWs("Unhealthy disconnect, reconnecting...", _e.code);
                  if (reconnectAttempts < maxSocketConnectAttempts) {
                    if (reconnectAttempts === 0) {
                      console.log(`WebSocket for ${payloadDetails.meta.uuid} lost, reconnecting...`);
                    }
                    setTimeout(() => {
                      reconnectAttempts++;
                      logWs("# Reconnect");
                      if (typeof jest === "undefined") {
                        socket = connect();
                      }
                    }, socketConnectAttemptSecondsDelay * 1e3);
                  } else {
                    if (typeof jest === "undefined") {
                      console.log(`WebSocket for ${payloadDetails.meta.uuid} exceeded reconnect timeouts, give up`);
                    }
                  }
                } else {
                }
                logWs(`Payload ${payloadDetails.meta.uuid}: Subscription ended (WebSocket closed)`);
              };
              return socket;
            };
            socket = connect();
            return {
              payload: payloadDetails,
              resolve(resolveData) {
                callbackPromise.resolve(resolveData || void 0);
              },
              resolved: callbackPromise.promise,
              websocket: socket
            };
          }
          utils_1.throwIfError(payloadDetails);
          throw Error(`Couldn't subscribe: couldn't fetch payload`);
        });
      }
      cancel(payload, returnErrors = false) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
          const fullPayload = yield this.resolvePayload(payload);
          const call = yield this.Meta.call("payload/" + ((_a = fullPayload === null || fullPayload === void 0 ? void 0 : fullPayload.meta) === null || _a === void 0 ? void 0 : _a.uuid), "DELETE");
          if (returnErrors) {
            utils_1.throwIfError(call);
          }
          const isValidResponse = ((_c = (_b = call) === null || _b === void 0 ? void 0 : _b.meta) === null || _c === void 0 ? void 0 : _c.uuid) !== void 0;
          if (!isValidResponse) {
            return null;
          }
          return call;
        });
      }
      createAndSubscribe(payload, callback) {
        return __awaiter(this, void 0, void 0, function* () {
          const createdPayload = yield this.create(payload, true);
          if (createdPayload) {
            const subscription = yield this.subscribe(createdPayload, callback);
            return Object.assign({ created: createdPayload }, subscription);
          }
          throw new Error(`Error creating payload or subscribing to created payload`);
        });
      }
    };
    exports.Payload = Payload;
  }
});

// node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/JwtUserdata.js
var require_JwtUserdata = __commonJS({
  "node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/JwtUserdata.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.JwtUserdata = void 0;
    var debug_1 = require_browser();
    var utils_1 = require_utils();
    var log = debug_1.debug("xumm-sdk:xapp:userdata");
    var validateKey = (key) => {
      if (!(typeof key === "string" && key.match(/^[a-z0-9]{3,}$/))) {
        throw new Error("Invalid key, only a-z0-9 (min three chars) allowed: " + key);
      }
    };
    var JwtUserdata = class {
      constructor(MetaObject) {
        log("Constructed");
        this.Meta = MetaObject;
      }
      list() {
        return __awaiter(this, void 0, void 0, function* () {
          const call = yield this.Meta.call("userdata", "GET");
          utils_1.throwIfError(call);
          return call.keys;
        });
      }
      get(key) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
          const keys = Array.isArray(key) ? key.join(",") : key;
          keys.split(",").forEach((k) => validateKey(k));
          const call = yield this.Meta.call("userdata/" + keys, "GET");
          utils_1.throwIfError(call);
          return keys.split(",").length > 1 ? call.data : ((_a = call.data) === null || _a === void 0 ? void 0 : _a[keys]) || {};
        });
      }
      delete(key) {
        return __awaiter(this, void 0, void 0, function* () {
          validateKey(key);
          const call = yield this.Meta.call("userdata/" + key, "DELETE");
          utils_1.throwIfError(call);
          return call.persisted;
        });
      }
      set(key, data) {
        return __awaiter(this, void 0, void 0, function* () {
          validateKey(key);
          const call = yield this.Meta.call("userdata/" + key, "POST", data);
          utils_1.throwIfError(call);
          return call.persisted;
        });
      }
    };
    exports.JwtUserdata = JwtUserdata;
  }
});

// node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/xApp.js
var require_xApp = __commonJS({
  "node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/xApp.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.xApp = void 0;
    var debug_1 = require_browser();
    var JwtUserdata_1 = require_JwtUserdata();
    var utils_1 = require_utils();
    var log = debug_1.debug("xumm-sdk:xapp");
    var xApp = class {
      constructor(MetaObject) {
        log("Constructed");
        this.Meta = MetaObject;
        this.userdata = new JwtUserdata_1.JwtUserdata(MetaObject);
      }
      get(ott) {
        return __awaiter(this, void 0, void 0, function* () {
          const call = yield this.Meta.call("xapp/ott/" + ott, "GET");
          utils_1.throwIfError(call);
          return call;
        });
      }
    };
    exports.xApp = xApp;
  }
});

// node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/Push.js
var require_Push = __commonJS({
  "node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/Push.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Push = void 0;
    var debug_1 = require_browser();
    var JwtUserdata_1 = require_JwtUserdata();
    var utils_1 = require_utils();
    var log = debug_1.debug("xumm-sdk:xapp");
    var Push = class {
      constructor(MetaObject) {
        log("Constructed");
        this.Meta = MetaObject;
        this.userdata = new JwtUserdata_1.JwtUserdata(MetaObject);
      }
      event(data) {
        return __awaiter(this, void 0, void 0, function* () {
          const call = yield this.Meta.call("xapp/event", "POST", data);
          utils_1.throwIfError(call);
          return call;
        });
      }
      notification(data) {
        return __awaiter(this, void 0, void 0, function* () {
          const call = yield this.Meta.call("xapp/push", "POST", data);
          utils_1.throwIfError(call);
          return call;
        });
      }
    };
    exports.Push = Push;
  }
});

// node_modules/.pnpm/base64-js@1.5.1/node_modules/base64-js/index.js
var require_base64_js = __commonJS({
  "node_modules/.pnpm/base64-js@1.5.1/node_modules/base64-js/index.js"(exports) {
    "use strict";
    exports.byteLength = byteLength;
    exports.toByteArray = toByteArray;
    exports.fromByteArray = fromByteArray;
    var lookup = [];
    var revLookup = [];
    var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
    var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }
    var i;
    var len;
    revLookup["-".charCodeAt(0)] = 62;
    revLookup["_".charCodeAt(0)] = 63;
    function getLens(b64) {
      var len2 = b64.length;
      if (len2 % 4 > 0) {
        throw new Error("Invalid string. Length must be a multiple of 4");
      }
      var validLen = b64.indexOf("=");
      if (validLen === -1) validLen = len2;
      var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
      return [validLen, placeHoldersLen];
    }
    function byteLength(b64) {
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function _byteLength(b64, validLen, placeHoldersLen) {
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function toByteArray(b64) {
      var tmp;
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
      var curByte = 0;
      var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
      var i2;
      for (i2 = 0; i2 < len2; i2 += 4) {
        tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
        arr[curByte++] = tmp >> 16 & 255;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 2) {
        tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 1) {
        tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      return arr;
    }
    function tripletToBase64(num) {
      return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
    }
    function encodeChunk(uint8, start, end) {
      var tmp;
      var output = [];
      for (var i2 = start; i2 < end; i2 += 3) {
        tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
        output.push(tripletToBase64(tmp));
      }
      return output.join("");
    }
    function fromByteArray(uint8) {
      var tmp;
      var len2 = uint8.length;
      var extraBytes = len2 % 3;
      var parts = [];
      var maxChunkLength = 16383;
      for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
        parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
      }
      if (extraBytes === 1) {
        tmp = uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
        );
      } else if (extraBytes === 2) {
        tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
        );
      }
      return parts.join("");
    }
  }
});

// node_modules/.pnpm/ieee754@1.2.1/node_modules/ieee754/index.js
var require_ieee754 = __commonJS({
  "node_modules/.pnpm/ieee754@1.2.1/node_modules/ieee754/index.js"(exports) {
    exports.read = function(buffer, offset, isLE, mLen, nBytes) {
      var e, m;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var nBits = -7;
      var i = isLE ? nBytes - 1 : 0;
      var d = isLE ? -1 : 1;
      var s = buffer[offset + i];
      i += d;
      e = s & (1 << -nBits) - 1;
      s >>= -nBits;
      nBits += eLen;
      for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      m = e & (1 << -nBits) - 1;
      e >>= -nBits;
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : (s ? -1 : 1) * Infinity;
      } else {
        m = m + Math.pow(2, mLen);
        e = e - eBias;
      }
      return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
    };
    exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
      var e, m, c;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
      var i = isLE ? 0 : nBytes - 1;
      var d = isLE ? 1 : -1;
      var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
      value = Math.abs(value);
      if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0;
        e = eMax;
      } else {
        e = Math.floor(Math.log(value) / Math.LN2);
        if (value * (c = Math.pow(2, -e)) < 1) {
          e--;
          c *= 2;
        }
        if (e + eBias >= 1) {
          value += rt / c;
        } else {
          value += rt * Math.pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
          e++;
          c /= 2;
        }
        if (e + eBias >= eMax) {
          m = 0;
          e = eMax;
        } else if (e + eBias >= 1) {
          m = (value * c - 1) * Math.pow(2, mLen);
          e = e + eBias;
        } else {
          m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
          e = 0;
        }
      }
      for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
      }
      e = e << mLen | m;
      eLen += mLen;
      for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
      }
      buffer[offset + i - d] |= s * 128;
    };
  }
});

// node_modules/.pnpm/buffer@6.0.3/node_modules/buffer/index.js
var require_buffer = __commonJS({
  "node_modules/.pnpm/buffer@6.0.3/node_modules/buffer/index.js"(exports) {
    "use strict";
    var base64 = require_base64_js();
    var ieee754 = require_ieee754();
    var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
    exports.Buffer = Buffer;
    exports.SlowBuffer = SlowBuffer;
    exports.INSPECT_MAX_BYTES = 50;
    var K_MAX_LENGTH = 2147483647;
    exports.kMaxLength = K_MAX_LENGTH;
    Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();
    if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
      console.error(
        "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
      );
    }
    function typedArraySupport() {
      try {
        const arr = new Uint8Array(1);
        const proto = { foo: function() {
          return 42;
        } };
        Object.setPrototypeOf(proto, Uint8Array.prototype);
        Object.setPrototypeOf(arr, proto);
        return arr.foo() === 42;
      } catch (e) {
        return false;
      }
    }
    Object.defineProperty(Buffer.prototype, "parent", {
      enumerable: true,
      get: function() {
        if (!Buffer.isBuffer(this)) return void 0;
        return this.buffer;
      }
    });
    Object.defineProperty(Buffer.prototype, "offset", {
      enumerable: true,
      get: function() {
        if (!Buffer.isBuffer(this)) return void 0;
        return this.byteOffset;
      }
    });
    function createBuffer(length) {
      if (length > K_MAX_LENGTH) {
        throw new RangeError('The value "' + length + '" is invalid for option "size"');
      }
      const buf = new Uint8Array(length);
      Object.setPrototypeOf(buf, Buffer.prototype);
      return buf;
    }
    function Buffer(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        if (typeof encodingOrOffset === "string") {
          throw new TypeError(
            'The "string" argument must be of type string. Received type number'
          );
        }
        return allocUnsafe(arg);
      }
      return from(arg, encodingOrOffset, length);
    }
    Buffer.poolSize = 8192;
    function from(value, encodingOrOffset, length) {
      if (typeof value === "string") {
        return fromString(value, encodingOrOffset);
      }
      if (ArrayBuffer.isView(value)) {
        return fromArrayView(value);
      }
      if (value == null) {
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof value === "number") {
        throw new TypeError(
          'The "value" argument must not be of type number. Received type number'
        );
      }
      const valueOf = value.valueOf && value.valueOf();
      if (valueOf != null && valueOf !== value) {
        return Buffer.from(valueOf, encodingOrOffset, length);
      }
      const b = fromObject(value);
      if (b) return b;
      if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
        return Buffer.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
      }
      throw new TypeError(
        "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
      );
    }
    Buffer.from = function(value, encodingOrOffset, length) {
      return from(value, encodingOrOffset, length);
    };
    Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
    Object.setPrototypeOf(Buffer, Uint8Array);
    function assertSize(size) {
      if (typeof size !== "number") {
        throw new TypeError('"size" argument must be of type number');
      } else if (size < 0) {
        throw new RangeError('The value "' + size + '" is invalid for option "size"');
      }
    }
    function alloc(size, fill, encoding) {
      assertSize(size);
      if (size <= 0) {
        return createBuffer(size);
      }
      if (fill !== void 0) {
        return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
      }
      return createBuffer(size);
    }
    Buffer.alloc = function(size, fill, encoding) {
      return alloc(size, fill, encoding);
    };
    function allocUnsafe(size) {
      assertSize(size);
      return createBuffer(size < 0 ? 0 : checked(size) | 0);
    }
    Buffer.allocUnsafe = function(size) {
      return allocUnsafe(size);
    };
    Buffer.allocUnsafeSlow = function(size) {
      return allocUnsafe(size);
    };
    function fromString(string, encoding) {
      if (typeof encoding !== "string" || encoding === "") {
        encoding = "utf8";
      }
      if (!Buffer.isEncoding(encoding)) {
        throw new TypeError("Unknown encoding: " + encoding);
      }
      const length = byteLength(string, encoding) | 0;
      let buf = createBuffer(length);
      const actual = buf.write(string, encoding);
      if (actual !== length) {
        buf = buf.slice(0, actual);
      }
      return buf;
    }
    function fromArrayLike(array) {
      const length = array.length < 0 ? 0 : checked(array.length) | 0;
      const buf = createBuffer(length);
      for (let i = 0; i < length; i += 1) {
        buf[i] = array[i] & 255;
      }
      return buf;
    }
    function fromArrayView(arrayView) {
      if (isInstance(arrayView, Uint8Array)) {
        const copy = new Uint8Array(arrayView);
        return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
      }
      return fromArrayLike(arrayView);
    }
    function fromArrayBuffer(array, byteOffset, length) {
      if (byteOffset < 0 || array.byteLength < byteOffset) {
        throw new RangeError('"offset" is outside of buffer bounds');
      }
      if (array.byteLength < byteOffset + (length || 0)) {
        throw new RangeError('"length" is outside of buffer bounds');
      }
      let buf;
      if (byteOffset === void 0 && length === void 0) {
        buf = new Uint8Array(array);
      } else if (length === void 0) {
        buf = new Uint8Array(array, byteOffset);
      } else {
        buf = new Uint8Array(array, byteOffset, length);
      }
      Object.setPrototypeOf(buf, Buffer.prototype);
      return buf;
    }
    function fromObject(obj) {
      if (Buffer.isBuffer(obj)) {
        const len = checked(obj.length) | 0;
        const buf = createBuffer(len);
        if (buf.length === 0) {
          return buf;
        }
        obj.copy(buf, 0, 0, len);
        return buf;
      }
      if (obj.length !== void 0) {
        if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
          return createBuffer(0);
        }
        return fromArrayLike(obj);
      }
      if (obj.type === "Buffer" && Array.isArray(obj.data)) {
        return fromArrayLike(obj.data);
      }
    }
    function checked(length) {
      if (length >= K_MAX_LENGTH) {
        throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
      }
      return length | 0;
    }
    function SlowBuffer(length) {
      if (+length != length) {
        length = 0;
      }
      return Buffer.alloc(+length);
    }
    Buffer.isBuffer = function isBuffer(b) {
      return b != null && b._isBuffer === true && b !== Buffer.prototype;
    };
    Buffer.compare = function compare(a, b) {
      if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength);
      if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength);
      if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
        throw new TypeError(
          'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
        );
      }
      if (a === b) return 0;
      let x = a.length;
      let y = b.length;
      for (let i = 0, len = Math.min(x, y); i < len; ++i) {
        if (a[i] !== b[i]) {
          x = a[i];
          y = b[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    Buffer.isEncoding = function isEncoding(encoding) {
      switch (String(encoding).toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "latin1":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return true;
        default:
          return false;
      }
    };
    Buffer.concat = function concat(list, length) {
      if (!Array.isArray(list)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
      }
      if (list.length === 0) {
        return Buffer.alloc(0);
      }
      let i;
      if (length === void 0) {
        length = 0;
        for (i = 0; i < list.length; ++i) {
          length += list[i].length;
        }
      }
      const buffer = Buffer.allocUnsafe(length);
      let pos = 0;
      for (i = 0; i < list.length; ++i) {
        let buf = list[i];
        if (isInstance(buf, Uint8Array)) {
          if (pos + buf.length > buffer.length) {
            if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
            buf.copy(buffer, pos);
          } else {
            Uint8Array.prototype.set.call(
              buffer,
              buf,
              pos
            );
          }
        } else if (!Buffer.isBuffer(buf)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        } else {
          buf.copy(buffer, pos);
        }
        pos += buf.length;
      }
      return buffer;
    };
    function byteLength(string, encoding) {
      if (Buffer.isBuffer(string)) {
        return string.length;
      }
      if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
        return string.byteLength;
      }
      if (typeof string !== "string") {
        throw new TypeError(
          'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
        );
      }
      const len = string.length;
      const mustMatch = arguments.length > 2 && arguments[2] === true;
      if (!mustMatch && len === 0) return 0;
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "ascii":
          case "latin1":
          case "binary":
            return len;
          case "utf8":
          case "utf-8":
            return utf8ToBytes(string).length;
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return len * 2;
          case "hex":
            return len >>> 1;
          case "base64":
            return base64ToBytes(string).length;
          default:
            if (loweredCase) {
              return mustMatch ? -1 : utf8ToBytes(string).length;
            }
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer.byteLength = byteLength;
    function slowToString(encoding, start, end) {
      let loweredCase = false;
      if (start === void 0 || start < 0) {
        start = 0;
      }
      if (start > this.length) {
        return "";
      }
      if (end === void 0 || end > this.length) {
        end = this.length;
      }
      if (end <= 0) {
        return "";
      }
      end >>>= 0;
      start >>>= 0;
      if (end <= start) {
        return "";
      }
      if (!encoding) encoding = "utf8";
      while (true) {
        switch (encoding) {
          case "hex":
            return hexSlice(this, start, end);
          case "utf8":
          case "utf-8":
            return utf8Slice(this, start, end);
          case "ascii":
            return asciiSlice(this, start, end);
          case "latin1":
          case "binary":
            return latin1Slice(this, start, end);
          case "base64":
            return base64Slice(this, start, end);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return utf16leSlice(this, start, end);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = (encoding + "").toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer.prototype._isBuffer = true;
    function swap(b, n, m) {
      const i = b[n];
      b[n] = b[m];
      b[m] = i;
    }
    Buffer.prototype.swap16 = function swap16() {
      const len = this.length;
      if (len % 2 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 16-bits");
      }
      for (let i = 0; i < len; i += 2) {
        swap(this, i, i + 1);
      }
      return this;
    };
    Buffer.prototype.swap32 = function swap32() {
      const len = this.length;
      if (len % 4 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 32-bits");
      }
      for (let i = 0; i < len; i += 4) {
        swap(this, i, i + 3);
        swap(this, i + 1, i + 2);
      }
      return this;
    };
    Buffer.prototype.swap64 = function swap64() {
      const len = this.length;
      if (len % 8 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 64-bits");
      }
      for (let i = 0; i < len; i += 8) {
        swap(this, i, i + 7);
        swap(this, i + 1, i + 6);
        swap(this, i + 2, i + 5);
        swap(this, i + 3, i + 4);
      }
      return this;
    };
    Buffer.prototype.toString = function toString() {
      const length = this.length;
      if (length === 0) return "";
      if (arguments.length === 0) return utf8Slice(this, 0, length);
      return slowToString.apply(this, arguments);
    };
    Buffer.prototype.toLocaleString = Buffer.prototype.toString;
    Buffer.prototype.equals = function equals(b) {
      if (!Buffer.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
      if (this === b) return true;
      return Buffer.compare(this, b) === 0;
    };
    Buffer.prototype.inspect = function inspect() {
      let str = "";
      const max = exports.INSPECT_MAX_BYTES;
      str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
      if (this.length > max) str += " ... ";
      return "<Buffer " + str + ">";
    };
    if (customInspectSymbol) {
      Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect;
    }
    Buffer.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
      if (isInstance(target, Uint8Array)) {
        target = Buffer.from(target, target.offset, target.byteLength);
      }
      if (!Buffer.isBuffer(target)) {
        throw new TypeError(
          'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
        );
      }
      if (start === void 0) {
        start = 0;
      }
      if (end === void 0) {
        end = target ? target.length : 0;
      }
      if (thisStart === void 0) {
        thisStart = 0;
      }
      if (thisEnd === void 0) {
        thisEnd = this.length;
      }
      if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
        throw new RangeError("out of range index");
      }
      if (thisStart >= thisEnd && start >= end) {
        return 0;
      }
      if (thisStart >= thisEnd) {
        return -1;
      }
      if (start >= end) {
        return 1;
      }
      start >>>= 0;
      end >>>= 0;
      thisStart >>>= 0;
      thisEnd >>>= 0;
      if (this === target) return 0;
      let x = thisEnd - thisStart;
      let y = end - start;
      const len = Math.min(x, y);
      const thisCopy = this.slice(thisStart, thisEnd);
      const targetCopy = target.slice(start, end);
      for (let i = 0; i < len; ++i) {
        if (thisCopy[i] !== targetCopy[i]) {
          x = thisCopy[i];
          y = targetCopy[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
      if (buffer.length === 0) return -1;
      if (typeof byteOffset === "string") {
        encoding = byteOffset;
        byteOffset = 0;
      } else if (byteOffset > 2147483647) {
        byteOffset = 2147483647;
      } else if (byteOffset < -2147483648) {
        byteOffset = -2147483648;
      }
      byteOffset = +byteOffset;
      if (numberIsNaN(byteOffset)) {
        byteOffset = dir ? 0 : buffer.length - 1;
      }
      if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
      if (byteOffset >= buffer.length) {
        if (dir) return -1;
        else byteOffset = buffer.length - 1;
      } else if (byteOffset < 0) {
        if (dir) byteOffset = 0;
        else return -1;
      }
      if (typeof val === "string") {
        val = Buffer.from(val, encoding);
      }
      if (Buffer.isBuffer(val)) {
        if (val.length === 0) {
          return -1;
        }
        return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
      } else if (typeof val === "number") {
        val = val & 255;
        if (typeof Uint8Array.prototype.indexOf === "function") {
          if (dir) {
            return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
          } else {
            return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
          }
        }
        return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
      }
      throw new TypeError("val must be string, number or Buffer");
    }
    function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
      let indexSize = 1;
      let arrLength = arr.length;
      let valLength = val.length;
      if (encoding !== void 0) {
        encoding = String(encoding).toLowerCase();
        if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
          if (arr.length < 2 || val.length < 2) {
            return -1;
          }
          indexSize = 2;
          arrLength /= 2;
          valLength /= 2;
          byteOffset /= 2;
        }
      }
      function read(buf, i2) {
        if (indexSize === 1) {
          return buf[i2];
        } else {
          return buf.readUInt16BE(i2 * indexSize);
        }
      }
      let i;
      if (dir) {
        let foundIndex = -1;
        for (i = byteOffset; i < arrLength; i++) {
          if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
            if (foundIndex === -1) foundIndex = i;
            if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
          } else {
            if (foundIndex !== -1) i -= i - foundIndex;
            foundIndex = -1;
          }
        }
      } else {
        if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
        for (i = byteOffset; i >= 0; i--) {
          let found = true;
          for (let j = 0; j < valLength; j++) {
            if (read(arr, i + j) !== read(val, j)) {
              found = false;
              break;
            }
          }
          if (found) return i;
        }
      }
      return -1;
    }
    Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
      return this.indexOf(val, byteOffset, encoding) !== -1;
    };
    Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
    };
    Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
    };
    function hexWrite(buf, string, offset, length) {
      offset = Number(offset) || 0;
      const remaining = buf.length - offset;
      if (!length) {
        length = remaining;
      } else {
        length = Number(length);
        if (length > remaining) {
          length = remaining;
        }
      }
      const strLen = string.length;
      if (length > strLen / 2) {
        length = strLen / 2;
      }
      let i;
      for (i = 0; i < length; ++i) {
        const parsed = parseInt(string.substr(i * 2, 2), 16);
        if (numberIsNaN(parsed)) return i;
        buf[offset + i] = parsed;
      }
      return i;
    }
    function utf8Write(buf, string, offset, length) {
      return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
    }
    function asciiWrite(buf, string, offset, length) {
      return blitBuffer(asciiToBytes(string), buf, offset, length);
    }
    function base64Write(buf, string, offset, length) {
      return blitBuffer(base64ToBytes(string), buf, offset, length);
    }
    function ucs2Write(buf, string, offset, length) {
      return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
    }
    Buffer.prototype.write = function write(string, offset, length, encoding) {
      if (offset === void 0) {
        encoding = "utf8";
        length = this.length;
        offset = 0;
      } else if (length === void 0 && typeof offset === "string") {
        encoding = offset;
        length = this.length;
        offset = 0;
      } else if (isFinite(offset)) {
        offset = offset >>> 0;
        if (isFinite(length)) {
          length = length >>> 0;
          if (encoding === void 0) encoding = "utf8";
        } else {
          encoding = length;
          length = void 0;
        }
      } else {
        throw new Error(
          "Buffer.write(string, encoding, offset[, length]) is no longer supported"
        );
      }
      const remaining = this.length - offset;
      if (length === void 0 || length > remaining) length = remaining;
      if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
        throw new RangeError("Attempt to write outside buffer bounds");
      }
      if (!encoding) encoding = "utf8";
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "hex":
            return hexWrite(this, string, offset, length);
          case "utf8":
          case "utf-8":
            return utf8Write(this, string, offset, length);
          case "ascii":
          case "latin1":
          case "binary":
            return asciiWrite(this, string, offset, length);
          case "base64":
            return base64Write(this, string, offset, length);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return ucs2Write(this, string, offset, length);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    };
    Buffer.prototype.toJSON = function toJSON() {
      return {
        type: "Buffer",
        data: Array.prototype.slice.call(this._arr || this, 0)
      };
    };
    function base64Slice(buf, start, end) {
      if (start === 0 && end === buf.length) {
        return base64.fromByteArray(buf);
      } else {
        return base64.fromByteArray(buf.slice(start, end));
      }
    }
    function utf8Slice(buf, start, end) {
      end = Math.min(buf.length, end);
      const res = [];
      let i = start;
      while (i < end) {
        const firstByte = buf[i];
        let codePoint = null;
        let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
        if (i + bytesPerSequence <= end) {
          let secondByte, thirdByte, fourthByte, tempCodePoint;
          switch (bytesPerSequence) {
            case 1:
              if (firstByte < 128) {
                codePoint = firstByte;
              }
              break;
            case 2:
              secondByte = buf[i + 1];
              if ((secondByte & 192) === 128) {
                tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                if (tempCodePoint > 127) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 3:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 4:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              fourthByte = buf[i + 3];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                  codePoint = tempCodePoint;
                }
              }
          }
        }
        if (codePoint === null) {
          codePoint = 65533;
          bytesPerSequence = 1;
        } else if (codePoint > 65535) {
          codePoint -= 65536;
          res.push(codePoint >>> 10 & 1023 | 55296);
          codePoint = 56320 | codePoint & 1023;
        }
        res.push(codePoint);
        i += bytesPerSequence;
      }
      return decodeCodePointsArray(res);
    }
    var MAX_ARGUMENTS_LENGTH = 4096;
    function decodeCodePointsArray(codePoints) {
      const len = codePoints.length;
      if (len <= MAX_ARGUMENTS_LENGTH) {
        return String.fromCharCode.apply(String, codePoints);
      }
      let res = "";
      let i = 0;
      while (i < len) {
        res += String.fromCharCode.apply(
          String,
          codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
        );
      }
      return res;
    }
    function asciiSlice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i] & 127);
      }
      return ret;
    }
    function latin1Slice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i]);
      }
      return ret;
    }
    function hexSlice(buf, start, end) {
      const len = buf.length;
      if (!start || start < 0) start = 0;
      if (!end || end < 0 || end > len) end = len;
      let out = "";
      for (let i = start; i < end; ++i) {
        out += hexSliceLookupTable[buf[i]];
      }
      return out;
    }
    function utf16leSlice(buf, start, end) {
      const bytes = buf.slice(start, end);
      let res = "";
      for (let i = 0; i < bytes.length - 1; i += 2) {
        res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
      }
      return res;
    }
    Buffer.prototype.slice = function slice(start, end) {
      const len = this.length;
      start = ~~start;
      end = end === void 0 ? len : ~~end;
      if (start < 0) {
        start += len;
        if (start < 0) start = 0;
      } else if (start > len) {
        start = len;
      }
      if (end < 0) {
        end += len;
        if (end < 0) end = 0;
      } else if (end > len) {
        end = len;
      }
      if (end < start) end = start;
      const newBuf = this.subarray(start, end);
      Object.setPrototypeOf(newBuf, Buffer.prototype);
      return newBuf;
    };
    function checkOffset(offset, ext, length) {
      if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
      if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
    }
    Buffer.prototype.readUintLE = Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      return val;
    };
    Buffer.prototype.readUintBE = Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        checkOffset(offset, byteLength2, this.length);
      }
      let val = this[offset + --byteLength2];
      let mul = 1;
      while (byteLength2 > 0 && (mul *= 256)) {
        val += this[offset + --byteLength2] * mul;
      }
      return val;
    };
    Buffer.prototype.readUint8 = Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      return this[offset];
    };
    Buffer.prototype.readUint16LE = Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] | this[offset + 1] << 8;
    };
    Buffer.prototype.readUint16BE = Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] << 8 | this[offset + 1];
    };
    Buffer.prototype.readUint32LE = Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
    };
    Buffer.prototype.readUint32BE = Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
    };
    Buffer.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
      const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
      return BigInt(lo) + (BigInt(hi) << BigInt(32));
    });
    Buffer.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
      return (BigInt(hi) << BigInt(32)) + BigInt(lo);
    });
    Buffer.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let i = byteLength2;
      let mul = 1;
      let val = this[offset + --i];
      while (i > 0 && (mul *= 256)) {
        val += this[offset + --i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      if (!(this[offset] & 128)) return this[offset];
      return (255 - this[offset] + 1) * -1;
    };
    Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset] | this[offset + 1] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset + 1] | this[offset] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
    };
    Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
    };
    Buffer.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
      return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
    });
    Buffer.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = (first << 24) + // Overflow
      this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
    });
    Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, true, 23, 4);
    };
    Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, false, 23, 4);
    };
    Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, true, 52, 8);
    };
    Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, false, 52, 8);
    };
    function checkInt(buf, value, offset, ext, max, min) {
      if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
      if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
    }
    Buffer.prototype.writeUintLE = Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let mul = 1;
      let i = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer.prototype.writeUintBE = Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer.prototype.writeUint8 = Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer.prototype.writeUint16LE = Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer.prototype.writeUint16BE = Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer.prototype.writeUint32LE = Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset + 3] = value >>> 24;
      this[offset + 2] = value >>> 16;
      this[offset + 1] = value >>> 8;
      this[offset] = value & 255;
      return offset + 4;
    };
    Buffer.prototype.writeUint32BE = Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    function wrtBigUInt64LE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      return offset;
    }
    function wrtBigUInt64BE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset + 7] = lo;
      lo = lo >> 8;
      buf[offset + 6] = lo;
      lo = lo >> 8;
      buf[offset + 5] = lo;
      lo = lo >> 8;
      buf[offset + 4] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset + 3] = hi;
      hi = hi >> 8;
      buf[offset + 2] = hi;
      hi = hi >> 8;
      buf[offset + 1] = hi;
      hi = hi >> 8;
      buf[offset] = hi;
      return offset + 8;
    }
    Buffer.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = 0;
      let mul = 1;
      let sub = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      let sub = 0;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
      if (value < 0) value = 255 + value + 1;
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      this[offset + 2] = value >>> 16;
      this[offset + 3] = value >>> 24;
      return offset + 4;
    };
    Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      if (value < 0) value = 4294967295 + value + 1;
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    Buffer.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    Buffer.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    function checkIEEE754(buf, value, offset, ext, max, min) {
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
      if (offset < 0) throw new RangeError("Index out of range");
    }
    function writeFloat(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
      }
      ieee754.write(buf, value, offset, littleEndian, 23, 4);
      return offset + 4;
    }
    Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
      return writeFloat(this, value, offset, true, noAssert);
    };
    Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
      return writeFloat(this, value, offset, false, noAssert);
    };
    function writeDouble(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
      }
      ieee754.write(buf, value, offset, littleEndian, 52, 8);
      return offset + 8;
    }
    Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
      return writeDouble(this, value, offset, true, noAssert);
    };
    Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
      return writeDouble(this, value, offset, false, noAssert);
    };
    Buffer.prototype.copy = function copy(target, targetStart, start, end) {
      if (!Buffer.isBuffer(target)) throw new TypeError("argument should be a Buffer");
      if (!start) start = 0;
      if (!end && end !== 0) end = this.length;
      if (targetStart >= target.length) targetStart = target.length;
      if (!targetStart) targetStart = 0;
      if (end > 0 && end < start) end = start;
      if (end === start) return 0;
      if (target.length === 0 || this.length === 0) return 0;
      if (targetStart < 0) {
        throw new RangeError("targetStart out of bounds");
      }
      if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
      if (end < 0) throw new RangeError("sourceEnd out of bounds");
      if (end > this.length) end = this.length;
      if (target.length - targetStart < end - start) {
        end = target.length - targetStart + start;
      }
      const len = end - start;
      if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
        this.copyWithin(targetStart, start, end);
      } else {
        Uint8Array.prototype.set.call(
          target,
          this.subarray(start, end),
          targetStart
        );
      }
      return len;
    };
    Buffer.prototype.fill = function fill(val, start, end, encoding) {
      if (typeof val === "string") {
        if (typeof start === "string") {
          encoding = start;
          start = 0;
          end = this.length;
        } else if (typeof end === "string") {
          encoding = end;
          end = this.length;
        }
        if (encoding !== void 0 && typeof encoding !== "string") {
          throw new TypeError("encoding must be a string");
        }
        if (typeof encoding === "string" && !Buffer.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        if (val.length === 1) {
          const code = val.charCodeAt(0);
          if (encoding === "utf8" && code < 128 || encoding === "latin1") {
            val = code;
          }
        }
      } else if (typeof val === "number") {
        val = val & 255;
      } else if (typeof val === "boolean") {
        val = Number(val);
      }
      if (start < 0 || this.length < start || this.length < end) {
        throw new RangeError("Out of range index");
      }
      if (end <= start) {
        return this;
      }
      start = start >>> 0;
      end = end === void 0 ? this.length : end >>> 0;
      if (!val) val = 0;
      let i;
      if (typeof val === "number") {
        for (i = start; i < end; ++i) {
          this[i] = val;
        }
      } else {
        const bytes = Buffer.isBuffer(val) ? val : Buffer.from(val, encoding);
        const len = bytes.length;
        if (len === 0) {
          throw new TypeError('The value "' + val + '" is invalid for argument "value"');
        }
        for (i = 0; i < end - start; ++i) {
          this[i + start] = bytes[i % len];
        }
      }
      return this;
    };
    var errors = {};
    function E(sym, getMessage, Base) {
      errors[sym] = class NodeError extends Base {
        constructor() {
          super();
          Object.defineProperty(this, "message", {
            value: getMessage.apply(this, arguments),
            writable: true,
            configurable: true
          });
          this.name = `${this.name} [${sym}]`;
          this.stack;
          delete this.name;
        }
        get code() {
          return sym;
        }
        set code(value) {
          Object.defineProperty(this, "code", {
            configurable: true,
            enumerable: true,
            value,
            writable: true
          });
        }
        toString() {
          return `${this.name} [${sym}]: ${this.message}`;
        }
      };
    }
    E(
      "ERR_BUFFER_OUT_OF_BOUNDS",
      function(name) {
        if (name) {
          return `${name} is outside of buffer bounds`;
        }
        return "Attempt to access memory outside buffer bounds";
      },
      RangeError
    );
    E(
      "ERR_INVALID_ARG_TYPE",
      function(name, actual) {
        return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
      },
      TypeError
    );
    E(
      "ERR_OUT_OF_RANGE",
      function(str, range, input) {
        let msg = `The value of "${str}" is out of range.`;
        let received = input;
        if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
          received = addNumericalSeparator(String(input));
        } else if (typeof input === "bigint") {
          received = String(input);
          if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
            received = addNumericalSeparator(received);
          }
          received += "n";
        }
        msg += ` It must be ${range}. Received ${received}`;
        return msg;
      },
      RangeError
    );
    function addNumericalSeparator(val) {
      let res = "";
      let i = val.length;
      const start = val[0] === "-" ? 1 : 0;
      for (; i >= start + 4; i -= 3) {
        res = `_${val.slice(i - 3, i)}${res}`;
      }
      return `${val.slice(0, i)}${res}`;
    }
    function checkBounds(buf, offset, byteLength2) {
      validateNumber(offset, "offset");
      if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
        boundsError(offset, buf.length - (byteLength2 + 1));
      }
    }
    function checkIntBI(value, min, max, buf, offset, byteLength2) {
      if (value > max || value < min) {
        const n = typeof min === "bigint" ? "n" : "";
        let range;
        if (byteLength2 > 3) {
          if (min === 0 || min === BigInt(0)) {
            range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
          } else {
            range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
          }
        } else {
          range = `>= ${min}${n} and <= ${max}${n}`;
        }
        throw new errors.ERR_OUT_OF_RANGE("value", range, value);
      }
      checkBounds(buf, offset, byteLength2);
    }
    function validateNumber(value, name) {
      if (typeof value !== "number") {
        throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
      }
    }
    function boundsError(value, length, type) {
      if (Math.floor(value) !== value) {
        validateNumber(value, type);
        throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
      }
      if (length < 0) {
        throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
      }
      throw new errors.ERR_OUT_OF_RANGE(
        type || "offset",
        `>= ${type ? 1 : 0} and <= ${length}`,
        value
      );
    }
    var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
    function base64clean(str) {
      str = str.split("=")[0];
      str = str.trim().replace(INVALID_BASE64_RE, "");
      if (str.length < 2) return "";
      while (str.length % 4 !== 0) {
        str = str + "=";
      }
      return str;
    }
    function utf8ToBytes(string, units) {
      units = units || Infinity;
      let codePoint;
      const length = string.length;
      let leadSurrogate = null;
      const bytes = [];
      for (let i = 0; i < length; ++i) {
        codePoint = string.charCodeAt(i);
        if (codePoint > 55295 && codePoint < 57344) {
          if (!leadSurrogate) {
            if (codePoint > 56319) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            } else if (i + 1 === length) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            }
            leadSurrogate = codePoint;
            continue;
          }
          if (codePoint < 56320) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
            leadSurrogate = codePoint;
            continue;
          }
          codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
        } else if (leadSurrogate) {
          if ((units -= 3) > -1) bytes.push(239, 191, 189);
        }
        leadSurrogate = null;
        if (codePoint < 128) {
          if ((units -= 1) < 0) break;
          bytes.push(codePoint);
        } else if (codePoint < 2048) {
          if ((units -= 2) < 0) break;
          bytes.push(
            codePoint >> 6 | 192,
            codePoint & 63 | 128
          );
        } else if (codePoint < 65536) {
          if ((units -= 3) < 0) break;
          bytes.push(
            codePoint >> 12 | 224,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else if (codePoint < 1114112) {
          if ((units -= 4) < 0) break;
          bytes.push(
            codePoint >> 18 | 240,
            codePoint >> 12 & 63 | 128,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else {
          throw new Error("Invalid code point");
        }
      }
      return bytes;
    }
    function asciiToBytes(str) {
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        byteArray.push(str.charCodeAt(i) & 255);
      }
      return byteArray;
    }
    function utf16leToBytes(str, units) {
      let c, hi, lo;
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        if ((units -= 2) < 0) break;
        c = str.charCodeAt(i);
        hi = c >> 8;
        lo = c % 256;
        byteArray.push(lo);
        byteArray.push(hi);
      }
      return byteArray;
    }
    function base64ToBytes(str) {
      return base64.toByteArray(base64clean(str));
    }
    function blitBuffer(src, dst, offset, length) {
      let i;
      for (i = 0; i < length; ++i) {
        if (i + offset >= dst.length || i >= src.length) break;
        dst[i + offset] = src[i];
      }
      return i;
    }
    function isInstance(obj, type) {
      return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
    }
    function numberIsNaN(obj) {
      return obj !== obj;
    }
    var hexSliceLookupTable = function() {
      const alphabet = "0123456789abcdef";
      const table = new Array(256);
      for (let i = 0; i < 16; ++i) {
        const i16 = i * 16;
        for (let j = 0; j < 16; ++j) {
          table[i16 + j] = alphabet[i] + alphabet[j];
        }
      }
      return table;
    }();
    function defineBigIntMethod(fn) {
      return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
    }
    function BufferBigIntNotDefined() {
      throw new Error("BigInt not supported");
    }
  }
});

// node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/index.js
var require_src = __commonJS({
  "node_modules/.pnpm/xumm-sdk@1.11.2/node_modules/xumm-sdk/dist/src/index.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.XummSdkJwt = exports.XummSdk = void 0;
    var debug_1 = require_browser();
    var Meta_1 = require_Meta();
    var Storage_1 = require_Storage();
    var Payload_1 = require_Payload();
    var xApp_1 = require_xApp();
    var Push_1 = require_Push();
    var JwtUserdata_1 = require_JwtUserdata();
    var buffer_1 = require_buffer();
    var log = debug_1.debug("xumm-sdk");
    var XummSdk = class {
      constructor(apiKey, apiSecret) {
        log("Constructed");
        this.Meta = new Meta_1.Meta(apiKey || this.getEnv("XUMM_APIKEY"), apiSecret || this.getEnv("XUMM_APISECRET"));
        this.storage = new Storage_1.Storage(this.Meta);
        this.payload = new Payload_1.Payload(this.Meta);
        this.jwtUserdata = new JwtUserdata_1.JwtUserdata(this.Meta);
        this.Push = new Push_1.Push(this.Meta);
        this.xApp = new xApp_1.xApp(this.Meta);
        this.Meta._inject(this);
        return this;
      }
      getEnv(arg) {
        let value = "";
        try {
          value = (process === null || process === void 0 ? void 0 : process.env[arg]) || "";
        } catch (_e) {
        }
        return value;
      }
      /**
       * Proxy methods to Meta class below
       */
      ping() {
        return this.Meta.ping();
      }
      getCuratedAssets() {
        return this.Meta.getCuratedAssets();
      }
      getRails() {
        return this.Meta.getRails();
      }
      getHookHashes() {
        return this.Meta.getHookHashes();
      }
      getHookHash(hookHash) {
        return this.Meta.getHookHash(hookHash);
      }
      getRates(currencyCode) {
        return this.Meta.getRates(currencyCode);
      }
      getKycStatus(userTokenOrAccount) {
        return this.Meta.getKycStatus(userTokenOrAccount);
      }
      getTransaction(txHash) {
        return this.Meta.getTransaction(txHash);
      }
      getNftokenDetail(tokenId) {
        return this.Meta.getNftokenDetail(tokenId);
      }
      verifyUserTokens(userTokens) {
        return this.Meta.verifyUserTokens(userTokens);
      }
      verifyUserToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
          const tokenResults = yield this.Meta.verifyUserTokens([token]);
          return Array.isArray(tokenResults) && tokenResults.length === 1 ? tokenResults[0] : null;
        });
      }
      setEndpoint(endpoint) {
        return this.Meta.setEndpoint(endpoint);
      }
      caught(error) {
        throw error;
      }
    };
    exports.XummSdk = XummSdk;
    var XummSdkJwt = class extends XummSdk {
      constructor(apiKeyOrJwt, ott, options) {
        var _a, _b, _c, _d, _f, _g, _h, _j;
        let _ott = String(ott || "").trim().toLowerCase();
        const isRawJwt = apiKeyOrJwt.length !== 36;
        if (!isRawJwt) {
          if (typeof ott === "undefined" && typeof window !== "undefined" && typeof window.URLSearchParams !== "undefined") {
            const urlSearchParams = new window.URLSearchParams(((_a = window === null || window === void 0 ? void 0 : window.location) === null || _a === void 0 ? void 0 : _a.search) || "");
            for (const pair of urlSearchParams.entries()) {
              if (pair[0] === "xAppToken") {
                _ott = pair[1].toLowerCase().trim();
              }
            }
            if (_ott === "" && !(options === null || options === void 0 ? void 0 : options.store) && !(options === null || options === void 0 ? void 0 : options.noAutoRetrieve)) {
              if (typeof ((_b = window === null || window === void 0 ? void 0 : window.localStorage) === null || _b === void 0 ? void 0 : _b["XummSdkJwt"]) === "string") {
                try {
                  const localStorageJwtData = (_d = (_c = window === null || window === void 0 ? void 0 : window.localStorage) === null || _c === void 0 ? void 0 : _c["XummSdkJwt"]) === null || _d === void 0 ? void 0 : _d.split(":");
                  const localStorageJwt = JSON.parse((_f = localStorageJwtData === null || localStorageJwtData === void 0 ? void 0 : localStorageJwtData.slice(1)) === null || _f === void 0 ? void 0 : _f.join(":"));
                  if (localStorageJwt === null || localStorageJwt === void 0 ? void 0 : localStorageJwt.jwt) {
                    const decodedJwt = buffer_1.Buffer.from((_g = localStorageJwt.jwt.split(".")) === null || _g === void 0 ? void 0 : _g[1], "base64").toString("utf8");
                    const jwtContents = JSON.parse(decodedJwt);
                    if (jwtContents === null || jwtContents === void 0 ? void 0 : jwtContents.exp) {
                      const validForSec = (jwtContents === null || jwtContents === void 0 ? void 0 : jwtContents.exp) - Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3);
                      console.log("Restoring OTT " + (localStorageJwtData === null || localStorageJwtData === void 0 ? void 0 : localStorageJwtData[0]));
                      if (validForSec > 60 * 60) {
                        _ott = localStorageJwtData === null || localStorageJwtData === void 0 ? void 0 : localStorageJwtData[0];
                      } else {
                        console.log("Skip restore: not valid for one more hour");
                      }
                    }
                  }
                } catch (e) {
                  console.log("JWT Restore Error", e);
                }
              }
            }
          }
        }
        super(apiKeyOrJwt, !isRawJwt && _ott !== "" ? "xApp:OneTimeToken:" + _ott : "RAWJWT:" + apiKeyOrJwt);
        this.resolve = (ottData) => {
          log("OTT data resolved", ottData);
        };
        this.reject = (error) => {
          log("OTT data rejected", error.message);
        };
        this.ottResolved = isRawJwt ? Promise.resolve() : new Promise((resolve, reject) => {
          this.resolve = resolve;
          this.reject = reject;
        });
        if (options === null || options === void 0 ? void 0 : options.fatalHandler) {
          this.fatalHandler = options.fatalHandler;
        }
        this.store = {
          get(uuid) {
            var _a2;
            log("[JwtStore] » Builtin JWT store GET");
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
              if (typeof window.localStorage["XummSdkJwt"] === "string") {
                const lsOttData = window.localStorage["XummSdkJwt"].split(":");
                if (lsOttData[0] === uuid) {
                  log("Restoring OTT from localStorage:", uuid);
                  try {
                    return JSON.parse(lsOttData.slice(1).join(":"));
                  } catch (e) {
                    log("Error restoring OTT Data (JWT) from localStorage", (_a2 = e) === null || _a2 === void 0 ? void 0 : _a2.message);
                  }
                }
              }
            }
          },
          set(uuid, ottData) {
            log("[JwtStore] » Builtin JWT store SET", uuid);
            if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
              window.localStorage["XummSdkJwt"] = uuid + ":" + JSON.stringify(ottData);
            }
          }
        };
        if ((_h = options === null || options === void 0 ? void 0 : options.store) === null || _h === void 0 ? void 0 : _h.get) {
          this.store.get = options.store.get;
        }
        if ((_j = options === null || options === void 0 ? void 0 : options.store) === null || _j === void 0 ? void 0 : _j.set) {
          this.store.set = options.store.set;
        }
        if (isRawJwt) {
          this.reject(new Error("Not in OTT flow: in raw JWT (OAuth2-like) flow"));
          log("Using JWT (Raw, OAuth2) flow");
        } else {
          log("Using JWT (xApp) flow");
        }
      }
      _jwtStore(invoker, persistJwt) {
        if (invoker && (invoker === null || invoker === void 0 ? void 0 : invoker.constructor) === Meta_1.Meta) {
          return {
            get: (uuid) => {
              var _a;
              log("[JwtStore] Proxy GET");
              return (_a = this.store) === null || _a === void 0 ? void 0 : _a.get(uuid);
            },
            set: (uuid, ottData) => {
              var _a;
              log("[JwtStore] Proxy SET");
              this.resolve(ottData.ott);
              persistJwt(ottData.jwt);
              this.jwt = ottData.jwt;
              return (_a = this.store) === null || _a === void 0 ? void 0 : _a.set(uuid, ottData);
            }
          };
        }
        throw new Error("Invalid _jwtStore invoker");
      }
      getOttData() {
        return __awaiter(this, void 0, void 0, function* () {
          const resolved = yield this.ottResolved;
          if (resolved) {
            return resolved;
          }
          throw new Error("Called getOttData on a non OTT-JWT flow");
        });
      }
      getJwt() {
        return __awaiter(this, void 0, void 0, function* () {
          yield this.ottResolved;
          return this.jwt;
        });
      }
      caught(error) {
        this.reject(error);
      }
    };
    exports.XummSdkJwt = XummSdkJwt;
  }
});

// browser-external:crypto
var require_crypto = __commonJS({
  "browser-external:crypto"(exports, module) {
    module.exports = Object.create(new Proxy({}, {
      get(_, key) {
        if (key !== "__esModule" && key !== "__proto__" && key !== "constructor" && key !== "splice") {
          console.warn(`Module "crypto" has been externalized for browser compatibility. Cannot access "crypto.${key}" in client code. See https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility for more details.`);
        }
      }
    }));
  }
});

// node_modules/.pnpm/crypto-js@4.2.0/node_modules/crypto-js/core.js
var require_core = __commonJS({
  "node_modules/.pnpm/crypto-js@4.2.0/node_modules/crypto-js/core.js"(exports, module) {
    (function(root, factory) {
      if (typeof exports === "object") {
        module.exports = exports = factory();
      } else if (typeof define === "function" && define.amd) {
        define([], factory);
      } else {
        root.CryptoJS = factory();
      }
    })(exports, function() {
      var CryptoJS = CryptoJS || function(Math2, undefined2) {
        var crypto;
        if (typeof window !== "undefined" && window.crypto) {
          crypto = window.crypto;
        }
        if (typeof self !== "undefined" && self.crypto) {
          crypto = self.crypto;
        }
        if (typeof globalThis !== "undefined" && globalThis.crypto) {
          crypto = globalThis.crypto;
        }
        if (!crypto && typeof window !== "undefined" && window.msCrypto) {
          crypto = window.msCrypto;
        }
        if (!crypto && typeof global !== "undefined" && global.crypto) {
          crypto = global.crypto;
        }
        if (!crypto && typeof __require === "function") {
          try {
            crypto = require_crypto();
          } catch (err) {
          }
        }
        var cryptoSecureRandomInt = function() {
          if (crypto) {
            if (typeof crypto.getRandomValues === "function") {
              try {
                return crypto.getRandomValues(new Uint32Array(1))[0];
              } catch (err) {
              }
            }
            if (typeof crypto.randomBytes === "function") {
              try {
                return crypto.randomBytes(4).readInt32LE();
              } catch (err) {
              }
            }
          }
          throw new Error("Native crypto module could not be used to get secure random number.");
        };
        var create = Object.create || /* @__PURE__ */ function() {
          function F() {
          }
          return function(obj) {
            var subtype;
            F.prototype = obj;
            subtype = new F();
            F.prototype = null;
            return subtype;
          };
        }();
        var C = {};
        var C_lib = C.lib = {};
        var Base = C_lib.Base = /* @__PURE__ */ function() {
          return {
            /**
             * Creates a new object that inherits from this object.
             *
             * @param {Object} overrides Properties to copy into the new object.
             *
             * @return {Object} The new object.
             *
             * @static
             *
             * @example
             *
             *     var MyType = CryptoJS.lib.Base.extend({
             *         field: 'value',
             *
             *         method: function () {
             *         }
             *     });
             */
            extend: function(overrides) {
              var subtype = create(this);
              if (overrides) {
                subtype.mixIn(overrides);
              }
              if (!subtype.hasOwnProperty("init") || this.init === subtype.init) {
                subtype.init = function() {
                  subtype.$super.init.apply(this, arguments);
                };
              }
              subtype.init.prototype = subtype;
              subtype.$super = this;
              return subtype;
            },
            /**
             * Extends this object and runs the init method.
             * Arguments to create() will be passed to init().
             *
             * @return {Object} The new object.
             *
             * @static
             *
             * @example
             *
             *     var instance = MyType.create();
             */
            create: function() {
              var instance = this.extend();
              instance.init.apply(instance, arguments);
              return instance;
            },
            /**
             * Initializes a newly created object.
             * Override this method to add some logic when your objects are created.
             *
             * @example
             *
             *     var MyType = CryptoJS.lib.Base.extend({
             *         init: function () {
             *             // ...
             *         }
             *     });
             */
            init: function() {
            },
            /**
             * Copies properties into this object.
             *
             * @param {Object} properties The properties to mix in.
             *
             * @example
             *
             *     MyType.mixIn({
             *         field: 'value'
             *     });
             */
            mixIn: function(properties) {
              for (var propertyName in properties) {
                if (properties.hasOwnProperty(propertyName)) {
                  this[propertyName] = properties[propertyName];
                }
              }
              if (properties.hasOwnProperty("toString")) {
                this.toString = properties.toString;
              }
            },
            /**
             * Creates a copy of this object.
             *
             * @return {Object} The clone.
             *
             * @example
             *
             *     var clone = instance.clone();
             */
            clone: function() {
              return this.init.prototype.extend(this);
            }
          };
        }();
        var WordArray = C_lib.WordArray = Base.extend({
          /**
           * Initializes a newly created word array.
           *
           * @param {Array} words (Optional) An array of 32-bit words.
           * @param {number} sigBytes (Optional) The number of significant bytes in the words.
           *
           * @example
           *
           *     var wordArray = CryptoJS.lib.WordArray.create();
           *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
           *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
           */
          init: function(words, sigBytes) {
            words = this.words = words || [];
            if (sigBytes != undefined2) {
              this.sigBytes = sigBytes;
            } else {
              this.sigBytes = words.length * 4;
            }
          },
          /**
           * Converts this word array to a string.
           *
           * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
           *
           * @return {string} The stringified word array.
           *
           * @example
           *
           *     var string = wordArray + '';
           *     var string = wordArray.toString();
           *     var string = wordArray.toString(CryptoJS.enc.Utf8);
           */
          toString: function(encoder) {
            return (encoder || Hex).stringify(this);
          },
          /**
           * Concatenates a word array to this word array.
           *
           * @param {WordArray} wordArray The word array to append.
           *
           * @return {WordArray} This word array.
           *
           * @example
           *
           *     wordArray1.concat(wordArray2);
           */
          concat: function(wordArray) {
            var thisWords = this.words;
            var thatWords = wordArray.words;
            var thisSigBytes = this.sigBytes;
            var thatSigBytes = wordArray.sigBytes;
            this.clamp();
            if (thisSigBytes % 4) {
              for (var i = 0; i < thatSigBytes; i++) {
                var thatByte = thatWords[i >>> 2] >>> 24 - i % 4 * 8 & 255;
                thisWords[thisSigBytes + i >>> 2] |= thatByte << 24 - (thisSigBytes + i) % 4 * 8;
              }
            } else {
              for (var j = 0; j < thatSigBytes; j += 4) {
                thisWords[thisSigBytes + j >>> 2] = thatWords[j >>> 2];
              }
            }
            this.sigBytes += thatSigBytes;
            return this;
          },
          /**
           * Removes insignificant bits.
           *
           * @example
           *
           *     wordArray.clamp();
           */
          clamp: function() {
            var words = this.words;
            var sigBytes = this.sigBytes;
            words[sigBytes >>> 2] &= 4294967295 << 32 - sigBytes % 4 * 8;
            words.length = Math2.ceil(sigBytes / 4);
          },
          /**
           * Creates a copy of this word array.
           *
           * @return {WordArray} The clone.
           *
           * @example
           *
           *     var clone = wordArray.clone();
           */
          clone: function() {
            var clone = Base.clone.call(this);
            clone.words = this.words.slice(0);
            return clone;
          },
          /**
           * Creates a word array filled with random bytes.
           *
           * @param {number} nBytes The number of random bytes to generate.
           *
           * @return {WordArray} The random word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.lib.WordArray.random(16);
           */
          random: function(nBytes) {
            var words = [];
            for (var i = 0; i < nBytes; i += 4) {
              words.push(cryptoSecureRandomInt());
            }
            return new WordArray.init(words, nBytes);
          }
        });
        var C_enc = C.enc = {};
        var Hex = C_enc.Hex = {
          /**
           * Converts a word array to a hex string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The hex string.
           *
           * @static
           *
           * @example
           *
           *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
           */
          stringify: function(wordArray) {
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var hexChars = [];
            for (var i = 0; i < sigBytes; i++) {
              var bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
              hexChars.push((bite >>> 4).toString(16));
              hexChars.push((bite & 15).toString(16));
            }
            return hexChars.join("");
          },
          /**
           * Converts a hex string to a word array.
           *
           * @param {string} hexStr The hex string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
           */
          parse: function(hexStr) {
            var hexStrLength = hexStr.length;
            var words = [];
            for (var i = 0; i < hexStrLength; i += 2) {
              words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << 24 - i % 8 * 4;
            }
            return new WordArray.init(words, hexStrLength / 2);
          }
        };
        var Latin1 = C_enc.Latin1 = {
          /**
           * Converts a word array to a Latin1 string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The Latin1 string.
           *
           * @static
           *
           * @example
           *
           *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
           */
          stringify: function(wordArray) {
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var latin1Chars = [];
            for (var i = 0; i < sigBytes; i++) {
              var bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
              latin1Chars.push(String.fromCharCode(bite));
            }
            return latin1Chars.join("");
          },
          /**
           * Converts a Latin1 string to a word array.
           *
           * @param {string} latin1Str The Latin1 string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
           */
          parse: function(latin1Str) {
            var latin1StrLength = latin1Str.length;
            var words = [];
            for (var i = 0; i < latin1StrLength; i++) {
              words[i >>> 2] |= (latin1Str.charCodeAt(i) & 255) << 24 - i % 4 * 8;
            }
            return new WordArray.init(words, latin1StrLength);
          }
        };
        var Utf8 = C_enc.Utf8 = {
          /**
           * Converts a word array to a UTF-8 string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The UTF-8 string.
           *
           * @static
           *
           * @example
           *
           *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
           */
          stringify: function(wordArray) {
            try {
              return decodeURIComponent(escape(Latin1.stringify(wordArray)));
            } catch (e) {
              throw new Error("Malformed UTF-8 data");
            }
          },
          /**
           * Converts a UTF-8 string to a word array.
           *
           * @param {string} utf8Str The UTF-8 string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
           */
          parse: function(utf8Str) {
            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
          }
        };
        var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
          /**
           * Resets this block algorithm's data buffer to its initial state.
           *
           * @example
           *
           *     bufferedBlockAlgorithm.reset();
           */
          reset: function() {
            this._data = new WordArray.init();
            this._nDataBytes = 0;
          },
          /**
           * Adds new data to this block algorithm's buffer.
           *
           * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
           *
           * @example
           *
           *     bufferedBlockAlgorithm._append('data');
           *     bufferedBlockAlgorithm._append(wordArray);
           */
          _append: function(data) {
            if (typeof data == "string") {
              data = Utf8.parse(data);
            }
            this._data.concat(data);
            this._nDataBytes += data.sigBytes;
          },
          /**
           * Processes available data blocks.
           *
           * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
           *
           * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
           *
           * @return {WordArray} The processed data.
           *
           * @example
           *
           *     var processedData = bufferedBlockAlgorithm._process();
           *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
           */
          _process: function(doFlush) {
            var processedWords;
            var data = this._data;
            var dataWords = data.words;
            var dataSigBytes = data.sigBytes;
            var blockSize = this.blockSize;
            var blockSizeBytes = blockSize * 4;
            var nBlocksReady = dataSigBytes / blockSizeBytes;
            if (doFlush) {
              nBlocksReady = Math2.ceil(nBlocksReady);
            } else {
              nBlocksReady = Math2.max((nBlocksReady | 0) - this._minBufferSize, 0);
            }
            var nWordsReady = nBlocksReady * blockSize;
            var nBytesReady = Math2.min(nWordsReady * 4, dataSigBytes);
            if (nWordsReady) {
              for (var offset = 0; offset < nWordsReady; offset += blockSize) {
                this._doProcessBlock(dataWords, offset);
              }
              processedWords = dataWords.splice(0, nWordsReady);
              data.sigBytes -= nBytesReady;
            }
            return new WordArray.init(processedWords, nBytesReady);
          },
          /**
           * Creates a copy of this object.
           *
           * @return {Object} The clone.
           *
           * @example
           *
           *     var clone = bufferedBlockAlgorithm.clone();
           */
          clone: function() {
            var clone = Base.clone.call(this);
            clone._data = this._data.clone();
            return clone;
          },
          _minBufferSize: 0
        });
        var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
          /**
           * Configuration options.
           */
          cfg: Base.extend(),
          /**
           * Initializes a newly created hasher.
           *
           * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
           *
           * @example
           *
           *     var hasher = CryptoJS.algo.SHA256.create();
           */
          init: function(cfg) {
            this.cfg = this.cfg.extend(cfg);
            this.reset();
          },
          /**
           * Resets this hasher to its initial state.
           *
           * @example
           *
           *     hasher.reset();
           */
          reset: function() {
            BufferedBlockAlgorithm.reset.call(this);
            this._doReset();
          },
          /**
           * Updates this hasher with a message.
           *
           * @param {WordArray|string} messageUpdate The message to append.
           *
           * @return {Hasher} This hasher.
           *
           * @example
           *
           *     hasher.update('message');
           *     hasher.update(wordArray);
           */
          update: function(messageUpdate) {
            this._append(messageUpdate);
            this._process();
            return this;
          },
          /**
           * Finalizes the hash computation.
           * Note that the finalize operation is effectively a destructive, read-once operation.
           *
           * @param {WordArray|string} messageUpdate (Optional) A final message update.
           *
           * @return {WordArray} The hash.
           *
           * @example
           *
           *     var hash = hasher.finalize();
           *     var hash = hasher.finalize('message');
           *     var hash = hasher.finalize(wordArray);
           */
          finalize: function(messageUpdate) {
            if (messageUpdate) {
              this._append(messageUpdate);
            }
            var hash = this._doFinalize();
            return hash;
          },
          blockSize: 512 / 32,
          /**
           * Creates a shortcut function to a hasher's object interface.
           *
           * @param {Hasher} hasher The hasher to create a helper for.
           *
           * @return {Function} The shortcut function.
           *
           * @static
           *
           * @example
           *
           *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
           */
          _createHelper: function(hasher) {
            return function(message, cfg) {
              return new hasher.init(cfg).finalize(message);
            };
          },
          /**
           * Creates a shortcut function to the HMAC's object interface.
           *
           * @param {Hasher} hasher The hasher to use in this HMAC helper.
           *
           * @return {Function} The shortcut function.
           *
           * @static
           *
           * @example
           *
           *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
           */
          _createHmacHelper: function(hasher) {
            return function(message, key) {
              return new C_algo.HMAC.init(hasher, key).finalize(message);
            };
          }
        });
        var C_algo = C.algo = {};
        return C;
      }(Math);
      return CryptoJS;
    });
  }
});

// node_modules/.pnpm/crypto-js@4.2.0/node_modules/crypto-js/sha256.js
var require_sha256 = __commonJS({
  "node_modules/.pnpm/crypto-js@4.2.0/node_modules/crypto-js/sha256.js"(exports, module) {
    (function(root, factory) {
      if (typeof exports === "object") {
        module.exports = exports = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports, function(CryptoJS) {
      (function(Math2) {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var Hasher = C_lib.Hasher;
        var C_algo = C.algo;
        var H = [];
        var K = [];
        (function() {
          function isPrime(n2) {
            var sqrtN = Math2.sqrt(n2);
            for (var factor = 2; factor <= sqrtN; factor++) {
              if (!(n2 % factor)) {
                return false;
              }
            }
            return true;
          }
          function getFractionalBits(n2) {
            return (n2 - (n2 | 0)) * 4294967296 | 0;
          }
          var n = 2;
          var nPrime = 0;
          while (nPrime < 64) {
            if (isPrime(n)) {
              if (nPrime < 8) {
                H[nPrime] = getFractionalBits(Math2.pow(n, 1 / 2));
              }
              K[nPrime] = getFractionalBits(Math2.pow(n, 1 / 3));
              nPrime++;
            }
            n++;
          }
        })();
        var W = [];
        var SHA256 = C_algo.SHA256 = Hasher.extend({
          _doReset: function() {
            this._hash = new WordArray.init(H.slice(0));
          },
          _doProcessBlock: function(M, offset) {
            var H2 = this._hash.words;
            var a = H2[0];
            var b = H2[1];
            var c = H2[2];
            var d = H2[3];
            var e = H2[4];
            var f = H2[5];
            var g = H2[6];
            var h = H2[7];
            for (var i = 0; i < 64; i++) {
              if (i < 16) {
                W[i] = M[offset + i] | 0;
              } else {
                var gamma0x = W[i - 15];
                var gamma0 = (gamma0x << 25 | gamma0x >>> 7) ^ (gamma0x << 14 | gamma0x >>> 18) ^ gamma0x >>> 3;
                var gamma1x = W[i - 2];
                var gamma1 = (gamma1x << 15 | gamma1x >>> 17) ^ (gamma1x << 13 | gamma1x >>> 19) ^ gamma1x >>> 10;
                W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16];
              }
              var ch = e & f ^ ~e & g;
              var maj = a & b ^ a & c ^ b & c;
              var sigma0 = (a << 30 | a >>> 2) ^ (a << 19 | a >>> 13) ^ (a << 10 | a >>> 22);
              var sigma1 = (e << 26 | e >>> 6) ^ (e << 21 | e >>> 11) ^ (e << 7 | e >>> 25);
              var t1 = h + sigma1 + ch + K[i] + W[i];
              var t2 = sigma0 + maj;
              h = g;
              g = f;
              f = e;
              e = d + t1 | 0;
              d = c;
              c = b;
              b = a;
              a = t1 + t2 | 0;
            }
            H2[0] = H2[0] + a | 0;
            H2[1] = H2[1] + b | 0;
            H2[2] = H2[2] + c | 0;
            H2[3] = H2[3] + d | 0;
            H2[4] = H2[4] + e | 0;
            H2[5] = H2[5] + f | 0;
            H2[6] = H2[6] + g | 0;
            H2[7] = H2[7] + h | 0;
          },
          _doFinalize: function() {
            var data = this._data;
            var dataWords = data.words;
            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;
            dataWords[nBitsLeft >>> 5] |= 128 << 24 - nBitsLeft % 32;
            dataWords[(nBitsLeft + 64 >>> 9 << 4) + 14] = Math2.floor(nBitsTotal / 4294967296);
            dataWords[(nBitsLeft + 64 >>> 9 << 4) + 15] = nBitsTotal;
            data.sigBytes = dataWords.length * 4;
            this._process();
            return this._hash;
          },
          clone: function() {
            var clone = Hasher.clone.call(this);
            clone._hash = this._hash.clone();
            return clone;
          }
        });
        C.SHA256 = Hasher._createHelper(SHA256);
        C.HmacSHA256 = Hasher._createHmacHelper(SHA256);
      })(Math);
      return CryptoJS.SHA256;
    });
  }
});

// node_modules/.pnpm/crypto-js@4.2.0/node_modules/crypto-js/enc-base64.js
var require_enc_base64 = __commonJS({
  "node_modules/.pnpm/crypto-js@4.2.0/node_modules/crypto-js/enc-base64.js"(exports, module) {
    (function(root, factory) {
      if (typeof exports === "object") {
        module.exports = exports = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var C_enc = C.enc;
        var Base64 = C_enc.Base64 = {
          /**
           * Converts a word array to a Base64 string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The Base64 string.
           *
           * @static
           *
           * @example
           *
           *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
           */
          stringify: function(wordArray) {
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var map = this._map;
            wordArray.clamp();
            var base64Chars = [];
            for (var i = 0; i < sigBytes; i += 3) {
              var byte1 = words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
              var byte2 = words[i + 1 >>> 2] >>> 24 - (i + 1) % 4 * 8 & 255;
              var byte3 = words[i + 2 >>> 2] >>> 24 - (i + 2) % 4 * 8 & 255;
              var triplet = byte1 << 16 | byte2 << 8 | byte3;
              for (var j = 0; j < 4 && i + j * 0.75 < sigBytes; j++) {
                base64Chars.push(map.charAt(triplet >>> 6 * (3 - j) & 63));
              }
            }
            var paddingChar = map.charAt(64);
            if (paddingChar) {
              while (base64Chars.length % 4) {
                base64Chars.push(paddingChar);
              }
            }
            return base64Chars.join("");
          },
          /**
           * Converts a Base64 string to a word array.
           *
           * @param {string} base64Str The Base64 string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
           */
          parse: function(base64Str) {
            var base64StrLength = base64Str.length;
            var map = this._map;
            var reverseMap = this._reverseMap;
            if (!reverseMap) {
              reverseMap = this._reverseMap = [];
              for (var j = 0; j < map.length; j++) {
                reverseMap[map.charCodeAt(j)] = j;
              }
            }
            var paddingChar = map.charAt(64);
            if (paddingChar) {
              var paddingIndex = base64Str.indexOf(paddingChar);
              if (paddingIndex !== -1) {
                base64StrLength = paddingIndex;
              }
            }
            return parseLoop(base64Str, base64StrLength, reverseMap);
          },
          _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
        };
        function parseLoop(base64Str, base64StrLength, reverseMap) {
          var words = [];
          var nBytes = 0;
          for (var i = 0; i < base64StrLength; i++) {
            if (i % 4) {
              var bits1 = reverseMap[base64Str.charCodeAt(i - 1)] << i % 4 * 2;
              var bits2 = reverseMap[base64Str.charCodeAt(i)] >>> 6 - i % 4 * 2;
              var bitsCombined = bits1 | bits2;
              words[nBytes >>> 2] |= bitsCombined << 24 - nBytes % 4 * 8;
              nBytes++;
            }
          }
          return WordArray.create(words, nBytes);
        }
      })();
      return CryptoJS.enc.Base64;
    });
  }
});

// node_modules/.pnpm/crypto-js@4.2.0/node_modules/crypto-js/lib-typedarrays.js
var require_lib_typedarrays = __commonJS({
  "node_modules/.pnpm/crypto-js@4.2.0/node_modules/crypto-js/lib-typedarrays.js"(exports, module) {
    (function(root, factory) {
      if (typeof exports === "object") {
        module.exports = exports = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports, function(CryptoJS) {
      (function() {
        if (typeof ArrayBuffer != "function") {
          return;
        }
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var superInit = WordArray.init;
        var subInit = WordArray.init = function(typedArray) {
          if (typedArray instanceof ArrayBuffer) {
            typedArray = new Uint8Array(typedArray);
          }
          if (typedArray instanceof Int8Array || typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray || typedArray instanceof Int16Array || typedArray instanceof Uint16Array || typedArray instanceof Int32Array || typedArray instanceof Uint32Array || typedArray instanceof Float32Array || typedArray instanceof Float64Array) {
            typedArray = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
          }
          if (typedArray instanceof Uint8Array) {
            var typedArrayByteLength = typedArray.byteLength;
            var words = [];
            for (var i = 0; i < typedArrayByteLength; i++) {
              words[i >>> 2] |= typedArray[i] << 24 - i % 4 * 8;
            }
            superInit.call(this, words, typedArrayByteLength);
          } else {
            superInit.apply(this, arguments);
          }
        };
        subInit.prototype = WordArray;
      })();
      return CryptoJS.lib.WordArray;
    });
  }
});

// node_modules/.pnpm/xumm-js-pkce@1.0.2/node_modules/xumm-js-pkce/dist/PKCE.js
var require_PKCE = __commonJS({
  "node_modules/.pnpm/xumm-js-pkce@1.0.2/node_modules/xumm-js-pkce/dist/PKCE.js"(exports) {
    "use strict";
    var __assign = exports && exports.__assign || function() {
      __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var sha256_1 = __importDefault(require_sha256());
    var enc_base64_1 = __importDefault(require_enc_base64());
    var lib_typedarrays_1 = __importDefault(require_lib_typedarrays());
    var PKCE = (
      /** @class */
      function() {
        function PKCE2(config) {
          this.state = "";
          this.codeVerifier = "";
          this.config = config;
        }
        PKCE2.prototype.authorizeUrl = function(additionalParams) {
          var _a, _b;
          if (additionalParams === void 0) {
            additionalParams = {};
          }
          var queryString = new URLSearchParams(Object.assign(__assign({ response_type: ((_a = this.config) === null || _a === void 0 ? void 0 : _a.implicit) ? "token" : "code", client_id: this.config.client_id, state: this.getState(additionalParams.state || null), scope: this.config.requested_scopes, redirect_uri: this.config.redirect_uri }, ((_b = this.config) === null || _b === void 0 ? void 0 : _b.implicit) ? {} : {
            code_challenge: this.pkceChallengeFromVerifier(),
            code_challenge_method: "S256"
          }), additionalParams)).toString();
          return "".concat(this.config.authorization_endpoint, "?").concat(queryString);
        };
        PKCE2.prototype.exchangeForAccessToken = function(url, additionalParams) {
          var _this = this;
          if (additionalParams === void 0) {
            additionalParams = {};
          }
          return this.parseAuthResponseUrl(url).then(function(q) {
            var _a, _b;
            if ((_a = _this.config) === null || _a === void 0 ? void 0 : _a.implicit) {
              var tokenResponse_1 = {
                access_token: "",
                expires_in: 0,
                refresh_expires_in: 0,
                refresh_token: "",
                scope: "",
                token_type: ""
              };
              var urlParams = new URL(url).searchParams;
              urlParams.forEach(function(val, key) {
                if (Object.keys(tokenResponse_1).indexOf(key) > -1) {
                  tokenResponse_1[key] = typeof tokenResponse_1[key] === "number" ? Number(val) : String(val);
                }
              });
              return Promise.resolve(Object.assign(tokenResponse_1, additionalParams));
            }
            return fetch(_this.config.token_endpoint, {
              method: "POST",
              body: new URLSearchParams(Object.assign(__assign({ grant_type: "authorization_code", code: q.code, client_id: _this.config.client_id, redirect_uri: _this.config.redirect_uri }, ((_b = _this.config) === null || _b === void 0 ? void 0 : _b.implicit) ? {} : {
                code_verifier: _this.getCodeVerifier()
              }), additionalParams)),
              headers: {
                Accept: "application/json",
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
              }
            }).then(function(response) {
              return response.json();
            });
          });
        };
        PKCE2.prototype.getCodeVerifier = function() {
          if (this.codeVerifier === "") {
            this.codeVerifier = this.randomStringFromStorage("pkce_code_verifier");
          }
          return this.codeVerifier;
        };
        PKCE2.prototype.getState = function(explicit) {
          if (explicit === void 0) {
            explicit = null;
          }
          var stateKey = "pkce_state";
          if (explicit !== null) {
            this.getStore().setItem(stateKey, explicit);
          }
          if (this.state === "") {
            this.state = this.randomStringFromStorage(stateKey);
          }
          return this.state;
        };
        PKCE2.prototype.parseAuthResponseUrl = function(url) {
          var params = new URL(url).searchParams;
          return this.validateAuthResponse({
            error: params.get("error"),
            query: params.get("query"),
            state: params.get("state"),
            code: params.get("code")
          });
        };
        PKCE2.prototype.pkceChallengeFromVerifier = function() {
          var hashed = (0, sha256_1.default)(this.getCodeVerifier());
          return enc_base64_1.default.stringify(hashed).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        };
        PKCE2.prototype.randomStringFromStorage = function(key) {
          var fromStorage = this.getStore().getItem(key);
          if (fromStorage === null) {
            this.getStore().setItem(key, lib_typedarrays_1.default.random(64));
          }
          return this.getStore().getItem(key) || "";
        };
        PKCE2.prototype.validateAuthResponse = function(queryParams) {
          var _this = this;
          return new Promise(function(resolve, reject) {
            var _a;
            if (queryParams.error) {
              return reject({ error: queryParams.error });
            }
            if (queryParams.state !== _this.getState() && !((_a = _this.config) === null || _a === void 0 ? void 0 : _a.implicit)) {
              return reject({ error: "Invalid State" });
            }
            return resolve(queryParams);
          });
        };
        PKCE2.prototype.getStore = function() {
          var _a;
          return ((_a = this.config) === null || _a === void 0 ? void 0 : _a.storage) || sessionStorage;
        };
        return PKCE2;
      }()
    );
    exports.default = PKCE;
  }
});

// node_modules/.pnpm/xumm-oauth2-pkce@2.8.7/node_modules/xumm-oauth2-pkce/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/xumm-oauth2-pkce@2.8.7/node_modules/xumm-oauth2-pkce/dist/index.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.XummPkce = exports.XummPkceThread = void 0;
    var events_1 = require_events();
    var xumm_sdk_1 = require_src();
    var xumm_js_pkce_1 = __importDefault(require_PKCE());
    var log = function(...args) {
      if (typeof localStorage !== "undefined") {
        if (localStorage === null || localStorage === void 0 ? void 0 : localStorage.debug) {
          console.log(...args);
        }
      }
    };
    if (typeof window !== "undefined") {
      log("Xumm OAuth2 PKCE Authorization Code Flow lib.");
    }
    var EventReadyPromise = (event) => {
      let _resolve = (value) => {
      };
      const promise = new Promise((resolve) => {
        _resolve = resolve;
      });
      return {
        promise,
        resolve: (value) => {
          return _resolve(value);
        }
      };
    };
    var XummPkceThread = class extends events_1.EventEmitter {
      constructor(xummApiKey, optionsOrRedirectUrl) {
        var _a, _b;
        super();
        this.popup = null;
        this.resolved = false;
        this.mobileRedirectFlow = false;
        this.eventPromises = {
          retrieved: EventReadyPromise("retrieved"),
          error: EventReadyPromise("error"),
          success: EventReadyPromise("success"),
          loggedout: EventReadyPromise("loggedout")
        };
        this.options = {
          redirectUrl: document.location.href,
          rememberJwt: true,
          storage: localStorage,
          implicit: false
        };
        if (typeof optionsOrRedirectUrl === "string") {
          this.options.redirectUrl = optionsOrRedirectUrl;
        } else if (typeof optionsOrRedirectUrl === "object" && optionsOrRedirectUrl) {
          if (typeof optionsOrRedirectUrl.redirectUrl === "string") {
            this.options.redirectUrl = optionsOrRedirectUrl.redirectUrl;
          }
          if (typeof optionsOrRedirectUrl.rememberJwt === "boolean") {
            this.options.rememberJwt = optionsOrRedirectUrl.rememberJwt;
          }
          if (typeof optionsOrRedirectUrl.storage === "object") {
            this.options.storage = optionsOrRedirectUrl.storage;
          }
          if (typeof optionsOrRedirectUrl.implicit === "boolean") {
            this.options.implicit = optionsOrRedirectUrl.implicit;
          }
        }
        const pkceOptions = {
          client_id: xummApiKey,
          redirect_uri: this.options.redirectUrl,
          authorization_endpoint: "https://oauth2.xumm.app/auth",
          token_endpoint: "https://oauth2.xumm.app/token",
          requested_scopes: "XummPkce",
          storage: this.options.storage,
          implicit: this.options.implicit
        };
        this.pkce = new xumm_js_pkce_1.default(pkceOptions);
        if (this.options.rememberJwt) {
          log("Remember JWT");
          try {
            const existingJwt = JSON.parse(((_a = this.options.storage) === null || _a === void 0 ? void 0 : _a.getItem("XummPkceJwt")) || "{}");
            if ((existingJwt === null || existingJwt === void 0 ? void 0 : existingJwt.jwt) && typeof existingJwt.jwt === "string") {
              const sdk = new xumm_sdk_1.XummSdkJwt(existingJwt.jwt);
              this.ping = sdk.ping();
              this.ping.then((pong) => __awaiter(this, void 0, void 0, function* () {
                var _c;
                if ((_c = pong === null || pong === void 0 ? void 0 : pong.jwtData) === null || _c === void 0 ? void 0 : _c.sub) {
                  this.autoResolvedFlow = Object.assign(existingJwt, { sdk });
                  yield this.authorize();
                  this.emit("retrieved");
                } else {
                  this.logout();
                }
              })).catch((e) => {
                this.logout();
              });
            } else {
              this.logout();
            }
          } catch (e) {
          }
        }
        window.addEventListener("message", (event) => {
          var _a2;
          log("Received Event from ", event.origin);
          if (String((event === null || event === void 0 ? void 0 : event.data) || "").slice(0, 1) === "{" && String((event === null || event === void 0 ? void 0 : event.data) || "").slice(-1) === "}") {
            log("Got PostMessage with JSON");
            if (event.origin === "https://xumm.app" || event.origin === "https://oauth2.xumm.app") {
              log("Got PostMessage from https://xumm.app / https://oauth2.xumm.app");
              try {
                const postMessage = JSON.parse(event.data);
                if ((postMessage === null || postMessage === void 0 ? void 0 : postMessage.source) === "xumm_sign_request" && (postMessage === null || postMessage === void 0 ? void 0 : postMessage.payload)) {
                  log("Payload opened:", postMessage.payload);
                } else if ((postMessage === null || postMessage === void 0 ? void 0 : postMessage.source) === "xumm_sign_request_resolved" && (postMessage === null || postMessage === void 0 ? void 0 : postMessage.options)) {
                  log("Payload resolved, mostmessage containing options containing redirect URL: ", postMessage);
                  this.resolved = true;
                  this.pkce.exchangeForAccessToken(postMessage.options.full_redirect_uri).then((resp) => {
                    this.jwt = resp.access_token;
                    if (resp === null || resp === void 0 ? void 0 : resp.error_description) {
                      throw new Error(resp === null || resp === void 0 ? void 0 : resp.error_description);
                    }
                    fetch("https://oauth2.xumm.app/userinfo", {
                      headers: {
                        Authorization: "Bearer " + resp.access_token
                      }
                    }).then((r) => r.json()).then((me) => {
                      var _a3;
                      if (this.resolvePromise) {
                        if (this.options.rememberJwt) {
                          log("Remembering JWT");
                          try {
                            (_a3 = this.options.storage) === null || _a3 === void 0 ? void 0 : _a3.setItem("XummPkceJwt", JSON.stringify({ jwt: resp.access_token, me }));
                          } catch (e) {
                            log("Could not persist JWT to local storage", e);
                          }
                        }
                        this.resolvePromise({
                          jwt: resp.access_token,
                          sdk: new xumm_sdk_1.XummSdkJwt(resp.access_token),
                          me
                        });
                      }
                    });
                  }).catch((e) => {
                    if (this.rejectPromise) {
                      this.rejectPromise((e === null || e === void 0 ? void 0 : e.error) ? new Error(e.error) : e);
                    }
                    log((e === null || e === void 0 ? void 0 : e.error) || e);
                  });
                } else if ((postMessage === null || postMessage === void 0 ? void 0 : postMessage.source) === "xumm_sign_request_rejected") {
                  log("Payload rejected", postMessage === null || postMessage === void 0 ? void 0 : postMessage.options);
                  if (this.rejectPromise) {
                    this.rejectPromise(new Error(((_a2 = postMessage === null || postMessage === void 0 ? void 0 : postMessage.options) === null || _a2 === void 0 ? void 0 : _a2.error_description) || "Payload rejected"));
                  }
                } else if ((postMessage === null || postMessage === void 0 ? void 0 : postMessage.source) === "xumm_sign_request_popup_closed") {
                  log("Popup closed, wait 750ms");
                  setTimeout(() => {
                    if (!this.resolved && this.rejectPromise) {
                      this.rejectPromise(new Error("Sign In window closed"));
                    }
                  }, 750);
                } else {
                  log("Unexpected message, skipping", postMessage === null || postMessage === void 0 ? void 0 : postMessage.source);
                }
              } catch (e) {
                log("Error parsing message", (e === null || e === void 0 ? void 0 : e.message) || e);
              }
            }
          }
        }, false);
        const params = new URLSearchParams(((_b = document === null || document === void 0 ? void 0 : document.location) === null || _b === void 0 ? void 0 : _b.search) || "");
        if (params.get("authorization_code") || params.get("access_token") || params.get("error_description")) {
          this.mobileRedirectFlow = true;
          this.urlParams = params;
          let documentReadyExecuted = false;
          const onDocumentReady = (event) => __awaiter(this, void 0, void 0, function* () {
            log("onDocumentReady", document.readyState);
            if (!documentReadyExecuted && document.readyState === "complete") {
              documentReadyExecuted = true;
              log("(readystatechange: [ " + document.readyState + " ])");
              this.handleMobileGrant();
              yield this.authorize();
              this.emit("retrieved");
            }
          });
          onDocumentReady();
          document.addEventListener("readystatechange", onDocumentReady);
        }
      }
      emit(event, ...args) {
        this.eventPromises[event].promise.then(() => {
          return super.emit(event, ...args);
        });
        return true;
      }
      on(event, listener) {
        this.eventPromises[event].resolve();
        return super.on(event, listener);
      }
      off(event, listener) {
        this.eventPromises[event] = EventReadyPromise(event);
        return super.off(event, listener);
      }
      // Todo: document, e.g. custom flow, plugin
      authorizeUrl() {
        return this.pkce.authorizeUrl();
      }
      handleMobileGrant() {
        if (this.urlParams && this.mobileRedirectFlow) {
          const messageEventData = {
            data: JSON.stringify(this.urlParams.get("authorization_code") || this.urlParams.get("access_token") ? {
              source: "xumm_sign_request_resolved",
              options: {
                full_redirect_uri: document.location.href
              }
            } : {
              source: "xumm_sign_request_rejected",
              options: {
                error: this.urlParams.get("error"),
                error_code: this.urlParams.get("error_code"),
                error_description: this.urlParams.get("error_description")
              }
            }),
            origin: "https://oauth2.xumm.app"
          };
          const event = new MessageEvent("message", messageEventData);
          window.dispatchEvent(event);
          return true;
        }
        return false;
      }
      authorize() {
        return __awaiter(this, void 0, void 0, function* () {
          if (this.resolvedSuccessfully) {
            return this.promise;
          }
          this.resolved = false;
          try {
            yield this.ping;
          } catch (e) {
          }
          if (!this.mobileRedirectFlow && !this.autoResolvedFlow) {
            const url = this.authorizeUrl();
            const popup = window.open(url, "XummPkceLogin", "directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no,width=600,height=790");
            this.popup = popup;
            log("Popup opened...", url);
          }
          this.resolved = false;
          const clearUrlParams = () => {
            var _a;
            const newUrlParams = new URLSearchParams(((_a = document === null || document === void 0 ? void 0 : document.location) === null || _a === void 0 ? void 0 : _a.search) || "");
            newUrlParams.delete("authorization_code");
            newUrlParams.delete("code");
            newUrlParams.delete("scope");
            newUrlParams.delete("state");
            newUrlParams.delete("access_token");
            newUrlParams.delete("refresh_token");
            newUrlParams.delete("token_type");
            newUrlParams.delete("expires_in");
            const newSearchParamsString = newUrlParams.toString();
            const url = document.location.href.split("?")[0] + (newSearchParamsString !== "" ? "?" : "") + newSearchParamsString;
            window.history.replaceState({ path: url }, "", url);
          };
          clearUrlParams();
          if (this.autoResolvedFlow) {
            if (!this.resolved) {
              this.resolved = true;
              this.promise = Promise.resolve(this.autoResolvedFlow);
              this.rejectPromise = this.resolvePromise = () => {
              };
              log("Auto resolved");
              this.emit("success");
            }
          } else {
            this.promise = new Promise((resolve, reject) => {
              this.resolvePromise = (_) => {
                const resolved = resolve(_);
                this.resolved = true;
                this.resolvedSuccessfully = true;
                log("Xumm Sign in RESOLVED");
                this.emit("success");
                return resolved;
              };
              this.rejectPromise = (_) => {
                const rejected = reject(_);
                this.resolved = true;
                this.emit("error", typeof _ === "string" ? new Error(_) : _);
                log("Xumm Sign in REJECTED");
                return rejected;
              };
            });
          }
          return this.promise;
        });
      }
      state() {
        return __awaiter(this, void 0, void 0, function* () {
          return this.promise;
        });
      }
      logout() {
        var _a;
        setTimeout(() => this.emit("loggedout"), 0);
        try {
          this.resolved = false;
          this.resolvedSuccessfully = void 0;
          this.autoResolvedFlow = void 0;
          (_a = this.options.storage) === null || _a === void 0 ? void 0 : _a.removeItem("XummPkceJwt");
          this.mobileRedirectFlow = false;
        } catch (e) {
        }
        return;
      }
      getPopup() {
        return this === null || this === void 0 ? void 0 : this.popup;
      }
    };
    exports.XummPkceThread = XummPkceThread;
    var thread = (_XummPkce) => {
      let attached = false;
      if (_XummPkce) {
        if (typeof window === "object") {
          if (typeof window._XummPkce === "undefined") {
            window._XummPkce = _XummPkce;
            attached = true;
          }
        }
      }
      const instance = window === null || window === void 0 ? void 0 : window._XummPkce;
      if (instance && attached) {
        log("XummPkce attached to window");
      }
      return instance;
    };
    var XummPkce = class {
      constructor(xummApiKey, optionsOrRedirectUrl) {
        if (typeof window === "undefined" || typeof document === "undefined") {
          return;
        }
        if (!thread()) {
          thread(new XummPkceThread(xummApiKey, optionsOrRedirectUrl));
        }
      }
      on(event, listener) {
        const t = thread();
        if (!t) {
          return;
        }
        t.on(event, listener);
        return this;
      }
      off(event, listener) {
        const t = thread();
        if (!t) {
          return;
        }
        t.off(event, listener);
        return this;
      }
      authorize() {
        const t = thread();
        if (!t) {
          return;
        }
        return t.authorize();
      }
      state() {
        const t = thread();
        if (!t) {
          return;
        }
        return t.state();
      }
      logout() {
        const t = thread();
        if (!t) {
          return;
        }
        return t.logout();
      }
    };
    exports.XummPkce = XummPkce;
  }
});

// node_modules/.pnpm/xumm-xapp-sdk@1.7.2/node_modules/xumm-xapp-sdk/dist/types.js
var require_types = __commonJS({
  "node_modules/.pnpm/xumm-xapp-sdk@1.7.2/node_modules/xumm-xapp-sdk/dist/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.xAppEvents = void 0;
    var xAppEvents;
    (function(xAppEvents2) {
      xAppEvents2["ready"] = "ready";
      xAppEvents2["scanQr"] = "scanQr";
      xAppEvents2["payloadResolved"] = "payloadResolved";
      xAppEvents2["selectDestination"] = "selectDestination";
      xAppEvents2["networkSwitch"] = "networkSwitch";
    })(xAppEvents = exports.xAppEvents || (exports.xAppEvents = {}));
  }
});

// node_modules/.pnpm/xumm-xapp-sdk@1.7.2/node_modules/xumm-xapp-sdk/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/.pnpm/xumm-xapp-sdk@1.7.2/node_modules/xumm-xapp-sdk/dist/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var _a;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.xApp = void 0;
    var events_1 = require_events();
    var types_1 = require_types();
    __exportStar(require_types(), exports);
    var docMinAliveSec = 0.25;
    var attemptMs = 250;
    var attemptDuration = 2e3;
    var appStart = Number(/* @__PURE__ */ new Date());
    var documentIsReady;
    var documentReadyPromise = new Promise((resolve) => {
      documentIsReady = (value) => {
        console.log("Doc Ready...");
        const timeSinceDocLoad = (Number(/* @__PURE__ */ new Date()) - appStart) / 1e3;
        if (timeSinceDocLoad < docMinAliveSec) {
          console.log("Doc not alive >= " + docMinAliveSec + " sec, stalling for " + (docMinAliveSec - timeSinceDocLoad));
          setTimeout(function() {
            resolve(value);
          }, (docMinAliveSec - timeSinceDocLoad) * 1e3);
        } else {
          console.log("Doc alive " + docMinAliveSec + "+ sec, go ahead");
          resolve(value);
        }
      };
    });
    documentReadyPromise.then(() => {
      console.log("documentReadyPromise resolved");
    }).catch((e) => {
      console.log(e);
    });
    if (typeof document !== "undefined") {
      document.addEventListener("readystatechange", (event) => {
        console.log("(readystatechange: [ " + document.readyState + " ])");
        if (document.readyState === "complete") {
          documentIsReady();
        }
      });
    }
    if (typeof window !== "undefined") {
      console.log("Loading xApp SDK");
    }
    var _window = typeof window !== "undefined" ? window : {};
    var isSandbox = false;
    if (_window === null || _window === void 0 ? void 0 : _window.parent) {
      (_a = _window.parent) === null || _a === void 0 ? void 0 : _a.postMessage("XAPP_PROXY_INIT", "*");
    }
    var xAppActionAttempt = (command, options, attempt = 0) => __awaiter(void 0, void 0, void 0, function* () {
      var _b, _c;
      yield documentReadyPromise;
      if (typeof (_window === null || _window === void 0 ? void 0 : _window.ReactNativeWebView) !== "undefined" || isSandbox) {
        const timeSinceDocLoad = (Number(/* @__PURE__ */ new Date()) - appStart) / 1e3;
        if (["close"].indexOf(command) > -1) {
          const minAliveTimeSec = 4;
          if (timeSinceDocLoad < minAliveTimeSec) {
            console.log("xApp close, doc alive < minAliveTimeSec, stall: " + (minAliveTimeSec - timeSinceDocLoad));
            yield new Promise((resolve) => {
              setTimeout(() => {
                resolve(true);
              }, (minAliveTimeSec - timeSinceDocLoad) * 1e3);
            });
          }
        }
        const msgToPost = JSON.stringify(Object.assign({ command }, options || {}));
        if (isSandbox) {
          (_b = _window.parent) === null || _b === void 0 ? void 0 : _b.postMessage(msgToPost, "*");
        } else {
          (_c = _window.ReactNativeWebView) === null || _c === void 0 ? void 0 : _c.postMessage(msgToPost);
        }
        console.log("xAppActionAttempt Success", command, options);
        return true;
      } else {
        if (attempt * attemptMs < attemptDuration) {
          console.log("xAppActionAttempt Attempt " + attempt + " » Retry", command, options);
          yield new Promise((resolve) => {
            setTimeout(resolve, attemptMs);
          });
          return xAppActionAttempt(command, options, attempt + 1);
        } else {
          console.log("xAppActionAttempt Failed after attempt " + attempt, command, options);
          return new Error("xApp." + command.replace(/^xApp/, "") + ": could not contact Xumm App Host");
        }
      }
    });
    var xAppThread = class extends events_1.EventEmitter {
      constructor() {
        super();
        if (document.readyState === "complete") {
          documentIsReady();
        }
        const eventHandler = (event) => {
          const rEvent = event;
          if (typeof (rEvent === null || rEvent === void 0 ? void 0 : rEvent.data) === "string" && rEvent.data === "XAPP_PROXY_INIT_ACK") {
            console.log("xApp Proxy ACK received, switching to PROXY (SANDBOX) mode");
            isSandbox = true;
            return;
          }
          try {
            const _event = JSON.parse((rEvent === null || rEvent === void 0 ? void 0 : rEvent.data) || "{}");
            console.log("_event (typeof, {_event}) ", typeof _event, { _event });
            if (typeof _event === "object" && _event !== null) {
              if (typeof _event.method === "string" && _event.method in types_1.xAppEvents) {
                console.log("xApp Event received", _event.method, _event);
                const method = _event.method;
                delete _event.method;
                switch (method) {
                  case String(types_1.xAppEvents.payloadResolved):
                    this.emit("payload", _event);
                    break;
                  case String(types_1.xAppEvents.scanQr):
                    this.emit("qr", _event);
                    break;
                  case String(types_1.xAppEvents.networkSwitch):
                    this.emit("networkswitch", _event);
                    break;
                  case String(types_1.xAppEvents.selectDestination):
                    this.emit("destination", _event);
                    break;
                }
              } else {
                console.log("xApp Event received, not in xAppEvents:", _event.method);
              }
            }
          } catch (e) {
            const emessage = (e === null || e === void 0 ? void 0 : e.message) || "";
            if (!emessage.match(/XAPP_PROXY_INIT/)) {
              console.log("xApp Event received, cannot parse as JSON", emessage);
            }
          }
        };
        if (typeof window.addEventListener === "function") {
          window.addEventListener("message", eventHandler);
        }
        if (typeof document.addEventListener === "function") {
          document.addEventListener("message", eventHandler);
        }
      }
      getEnvironment() {
        const t = thread();
        if (!t) {
          return { version: "", ott: "" };
        }
        return t.getEnvironment();
      }
      navigate(navigateOptions) {
        if (typeof (navigateOptions === null || navigateOptions === void 0 ? void 0 : navigateOptions.xApp) !== "string") {
          return Promise.reject(new Error("xApp.navigate: Invalid argument: `xApp`"));
        }
        return xAppActionAttempt("xAppNavigate", navigateOptions);
      }
      openSignRequest(openSignRequestOptions) {
        if (typeof (openSignRequestOptions === null || openSignRequestOptions === void 0 ? void 0 : openSignRequestOptions.uuid) !== "string") {
          return Promise.reject(new Error("xApp.openSignRequest: Invalid argument: `uuid`"));
        }
        if (!openSignRequestOptions.uuid.match(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)) {
          return Promise.reject(new Error("xApp.openSignRequest: Invalid payload UUID"));
        }
        return xAppActionAttempt("openSignRequest", openSignRequestOptions);
      }
      selectDestination(selectDestinationOptions) {
        return xAppActionAttempt("selectDestination", selectDestinationOptions);
      }
      openBrowser(openBrowserOptions) {
        if (typeof (openBrowserOptions === null || openBrowserOptions === void 0 ? void 0 : openBrowserOptions.url) !== "string") {
          return Promise.reject(new Error("xApp.openBrowser: Invalid argument: `url`"));
        }
        return xAppActionAttempt("openBrowser", openBrowserOptions);
      }
      share(shareOptions) {
        if (typeof (shareOptions === null || shareOptions === void 0 ? void 0 : shareOptions.text) !== "string") {
          return Promise.reject(new Error("xApp.share: Invalid argument: `text`"));
        }
        return xAppActionAttempt("share", shareOptions);
      }
      scanQr() {
        return xAppActionAttempt("scanQr");
      }
      tx(txOptions) {
        if (typeof (txOptions === null || txOptions === void 0 ? void 0 : txOptions.tx) !== "string") {
          return Promise.reject(new Error("xApp.tx: Invalid argument: `tx`"));
        }
        if (typeof (txOptions === null || txOptions === void 0 ? void 0 : txOptions.account) !== "string") {
          return Promise.reject(new Error("xApp.tx: Invalid argument: `account`"));
        }
        return xAppActionAttempt("txDetails", txOptions);
      }
      close(closeOptions) {
        return xAppActionAttempt("close", closeOptions);
      }
      ready() {
        return xAppActionAttempt("ready");
      }
      customCommand(customCommand, customCommandOptions) {
        return xAppActionAttempt(customCommand, customCommandOptions);
      }
    };
    var thread = (_xApp) => {
      let attached = false;
      if (_xApp) {
        if (typeof _window === "object") {
          if (typeof _window._xAppSdk === "undefined") {
            _window._xAppSdk = _xApp;
            attached = true;
          }
        }
      }
      const instance = _window === null || _window === void 0 ? void 0 : _window._xAppSdk;
      if (instance && attached) {
        console.log("xAppSdk attached to window");
      }
      return instance;
    };
    var xApp = class {
      constructor() {
        this.xummEnvironment = {
          version: "",
          ott: ""
        };
        if (typeof window === "undefined" || typeof document === "undefined") {
          return;
        }
        if (typeof navigator !== "undefined") {
          if (typeof (navigator === null || navigator === void 0 ? void 0 : navigator.userAgent) === "string") {
            const uaMatch = navigator.userAgent.trim().match(/xumm\/xapp:([0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}).*ott:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/);
            if (uaMatch) {
              this.xummEnvironment.version = uaMatch[1];
              this.xummEnvironment.ott = uaMatch[2];
            }
          }
        }
        if (this.xummEnvironment.version === "") {
          console.log("Warning: Xumm Version could not be retrieved from User Agent, possibly not loaded in xApp context?");
        }
        if (!thread()) {
          thread(new xAppThread());
        }
      }
      getEnvironment() {
        return this.xummEnvironment;
      }
      on(event, listener) {
        const t = thread();
        if (!t) {
          return;
        }
        t.on(event, listener);
        return this;
      }
      off(event, listener) {
        const t = thread();
        if (!t) {
          return;
        }
        t.off(event, listener);
        return this;
      }
      navigate(navigateOptions) {
        const t = thread();
        if (!t) {
          return;
        }
        return t.navigate(navigateOptions);
      }
      openSignRequest(openSignRequestOptions) {
        const t = thread();
        if (t) {
          if (openSignRequestOptions === null || openSignRequestOptions === void 0 ? void 0 : openSignRequestOptions.uuid) {
            return t.openSignRequest(openSignRequestOptions);
          }
        }
        return;
      }
      selectDestination(selectDestinationOptions) {
        const t = thread();
        if (!t) {
          return;
        }
        return t.selectDestination(selectDestinationOptions);
      }
      openBrowser(openBrowserOptions) {
        const t = thread();
        if (!t) {
          return;
        }
        return t.openBrowser(openBrowserOptions);
      }
      share(shareOptions) {
        const t = thread();
        if (!t) {
          return;
        }
        return t.share(shareOptions);
      }
      scanQr() {
        const t = thread();
        if (!t) {
          return;
        }
        return t.scanQr();
      }
      tx(txOptions) {
        const t = thread();
        if (!t) {
          return;
        }
        return t.tx(txOptions);
      }
      close(closeOptions) {
        const t = thread();
        if (!t) {
          return;
        }
        return t.close(closeOptions);
      }
      ready() {
        const t = thread();
        if (!t) {
          return;
        }
        return t.ready();
      }
      customCommand(customCommand, customCommandOptions) {
        const t = thread();
        if (!t) {
          return;
        }
        return t.customCommand(customCommand, customCommandOptions);
      }
    };
    exports.xApp = xApp;
  }
});

// node_modules/.pnpm/xumm@1.8.0/node_modules/xumm/dist/index.js
var require_dist3 = __commonJS({
  "node_modules/.pnpm/xumm@1.8.0/node_modules/xumm/dist/index.js"(exports) {
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Xumm = void 0;
    var xumm_oauth2_pkce_1 = require_dist();
    var buffer_1 = require_buffer();
    var events_1 = require_events();
    var fromBinary = (encoded) => {
      return buffer_1.Buffer.from(encoded, "base64").toString("utf8");
    };
    var Runtimes;
    (function(Runtimes2) {
      Runtimes2["cli"] = "cli";
      Runtimes2["browser"] = "browser";
      Runtimes2["xapp"] = "xapp";
    })(Runtimes || (Runtimes = {}));
    var _runtime = {
      cli: false,
      browser: false,
      xapp: false
    };
    var uuidv4re = new RegExp("^[0-9(a-f|A-F)]{8}-[0-9(a-f|A-F)]{4}-4[0-9(a-f|A-F)]{3}-[89ab][0-9(a-f|A-F)]{3}-[0-9(a-f|A-F)]{12}$");
    var _classes = {};
    var _env = typeof process === "object" && process ? (process === null || process === void 0 ? void 0 : process.env) || {} : {};
    Object.assign(_runtime, {
      cli: Object.keys(_env).indexOf("NODE") > -1 || Object.keys(_env).indexOf("SHELL") > -1 || Object.keys(_env).indexOf("TERM") > -1 || Object.keys(_env).indexOf("PATH") > -1
    });
    Object.assign(_runtime, {
      browser: typeof process === "object" && process && (process === null || process === void 0 ? void 0 : process.browser) || typeof document === "object" && document && (document === null || document === void 0 ? void 0 : document.location)
    });
    Object.assign(_runtime, {
      xapp: _runtime.browser && (!!navigator.userAgent.match(/xumm\/xapp/i) || !!navigator.userAgent.match(/xAppBuilder/i))
    });
    var runtime = Object.keys(_runtime).filter((r) => _runtime[r]);
    var readyPromises = [];
    var Asyncify = (ReturnValue) => __awaiter(void 0, void 0, void 0, function* () {
      yield Promise.all(readyPromises);
      return yield ReturnValue();
    });
    var Proxify = (ObjectToProxy) => {
      return new Proxy(ObjectToProxy, {
        get(obj, prop) {
          if (["on", "off"].indexOf(String(prop)) < 0 && // Events
          (typeof obj[prop] === "function" || obj.constructor.name === "Promise")) {
            return function() {
              if (obj.constructor.name === "Promise") {
                return obj.then((res) => Asyncify(() => {
                  return res[prop](...arguments);
                }));
              }
              return Asyncify(() => {
                return obj[prop](...arguments);
              });
            };
          }
          return obj[prop];
        }
      });
    };
    var _initialized = {
      XummSdk: false,
      XummSdkJwt: false,
      XummPkce: false,
      xApp: false
    };
    var _ott;
    var _jwt = "";
    var _jwtData = {};
    var _me = {};
    var instance = 0;
    var UnifiedUserData = class {
      constructor() {
        this.account = Asyncify(() => {
          var _a, _b, _c;
          return (_b = (_a = _jwtData === null || _jwtData === void 0 ? void 0 : _jwtData.sub) !== null && _a !== void 0 ? _a : _me === null || _me === void 0 ? void 0 : _me.sub) !== null && _b !== void 0 ? _b : (_c = _ott === null || _ott === void 0 ? void 0 : _ott.account_info) === null || _c === void 0 ? void 0 : _c.account;
        });
        this.picture = Asyncify(() => {
          var _a, _b, _c, _d, _e, _f, _g;
          return (_a = _me === null || _me === void 0 ? void 0 : _me.picture) !== null && _a !== void 0 ? _a : ((_c = (_b = _jwtData === null || _jwtData === void 0 ? void 0 : _jwtData.sub) !== null && _b !== void 0 ? _b : _me === null || _me === void 0 ? void 0 : _me.sub) !== null && _c !== void 0 ? _c : (_d = _ott === null || _ott === void 0 ? void 0 : _ott.account_info) === null || _d === void 0 ? void 0 : _d.account) ? `https://xumm.app/avatar/${(_f = (_e = _jwtData === null || _jwtData === void 0 ? void 0 : _jwtData.sub) !== null && _e !== void 0 ? _e : _me === null || _me === void 0 ? void 0 : _me.sub) !== null && _f !== void 0 ? _f : (_g = _ott === null || _ott === void 0 ? void 0 : _ott.account_info) === null || _g === void 0 ? void 0 : _g.account}.png` : void 0;
        });
        this.name = Asyncify(() => {
          var _a, _b;
          return (_a = _me === null || _me === void 0 ? void 0 : _me.name) !== null && _a !== void 0 ? _a : (_b = _ott === null || _ott === void 0 ? void 0 : _ott.account_info) === null || _b === void 0 ? void 0 : _b.name;
        });
        this.domain = Asyncify(() => {
          var _a, _b;
          return (_a = _me === null || _me === void 0 ? void 0 : _me.domain) !== null && _a !== void 0 ? _a : (_b = _ott === null || _ott === void 0 ? void 0 : _ott.account_info) === null || _b === void 0 ? void 0 : _b.domain;
        });
        this.source = Asyncify(() => {
          var _a, _b;
          return (_a = _me === null || _me === void 0 ? void 0 : _me.source) !== null && _a !== void 0 ? _a : (_b = _ott === null || _ott === void 0 ? void 0 : _ott.account_info) === null || _b === void 0 ? void 0 : _b.source;
        });
        this.networkType = Asyncify(() => {
          var _a, _b;
          return (_b = (_a = _me === null || _me === void 0 ? void 0 : _me.networkType) !== null && _a !== void 0 ? _a : _jwtData.network_type) !== null && _b !== void 0 ? _b : _ott === null || _ott === void 0 ? void 0 : _ott.nodetype;
        });
        this.networkEndpoint = Asyncify(() => {
          var _a, _b;
          return (_b = (_a = _me === null || _me === void 0 ? void 0 : _me.networkEndpoint) !== null && _a !== void 0 ? _a : _jwtData.network_endpoint) !== null && _b !== void 0 ? _b : _ott === null || _ott === void 0 ? void 0 : _ott.nodewss;
        });
        this.networkId = Asyncify(() => {
          var _a, _b;
          return (_b = (_a = _me === null || _me === void 0 ? void 0 : _me.networkId) !== null && _a !== void 0 ? _a : _jwtData.network_id) !== null && _b !== void 0 ? _b : _ott === null || _ott === void 0 ? void 0 : _ott.networkid;
        });
        this.blocked = Asyncify(() => {
          var _a, _b;
          return (_a = _me === null || _me === void 0 ? void 0 : _me.blocked) !== null && _a !== void 0 ? _a : (_b = _ott === null || _ott === void 0 ? void 0 : _ott.account_info) === null || _b === void 0 ? void 0 : _b.blocked;
        });
        this.kycApproved = Asyncify(() => {
          var _a, _b;
          return (_a = _me === null || _me === void 0 ? void 0 : _me.kycApproved) !== null && _a !== void 0 ? _a : (_b = _ott === null || _ott === void 0 ? void 0 : _ott.account_info) === null || _b === void 0 ? void 0 : _b.kycApproved;
        });
        this.proSubscription = Asyncify(() => {
          var _a, _b;
          return (_a = _me === null || _me === void 0 ? void 0 : _me.proSubscription) !== null && _a !== void 0 ? _a : (_b = _ott === null || _ott === void 0 ? void 0 : _ott.account_info) === null || _b === void 0 ? void 0 : _b.proSubscription;
        });
        this.profile = Asyncify(() => {
          var _a, _b, _c;
          return (_a = _me === null || _me === void 0 ? void 0 : _me.profile) !== null && _a !== void 0 ? _a : ((_c = (_b = _ott === null || _ott === void 0 ? void 0 : _ott.account_info) === null || _b === void 0 ? void 0 : _b.profile) === null || _c === void 0 ? void 0 : _c.slug) ? _ott.account_info.profile : void 0;
        });
        this.token = Asyncify(() => {
          var _a;
          return (_a = _jwtData === null || _jwtData === void 0 ? void 0 : _jwtData.usertoken_uuidv4) !== null && _a !== void 0 ? _a : null;
        });
      }
    };
    var Xumm = class extends events_1.EventEmitter {
      constructor(apiKeyOrJwt, apiSecretOrOtt) {
        var _a, _b, _c, _d;
        super();
        this.instance = "0";
        this.jwtCredential = false;
        this.runtime = _runtime;
        this.apiKeyOrJwt = "";
        this.apiKeyOrJwt = apiKeyOrJwt;
        this.apiSecretOrOtt = apiSecretOrOtt;
        instance++;
        this.instance = String(instance);
        if (typeof (console === null || console === void 0 ? void 0 : console.log) !== "undefined") {
          if (!_runtime.cli)
            console.log("Constructed Xumm", { runtime });
        }
        let jwtExpired = false;
        if (typeof this.apiKeyOrJwt === "string" && this.apiKeyOrJwt.split(".").length === 3) {
          let _testJwtData;
          try {
            _testJwtData = JSON.parse(fromBinary((_a = this.apiKeyOrJwt.split(".")) === null || _a === void 0 ? void 0 : _a[1]));
          } catch (e) {
          }
          if (Date.now() >= _testJwtData.exp * 1e3) {
            jwtExpired = true;
            const appId = (_d = (_c = (_b = _testJwtData === null || _testJwtData === void 0 ? void 0 : _testJwtData.app_uuidv4) !== null && _b !== void 0 ? _b : _testJwtData === null || _testJwtData === void 0 ? void 0 : _testJwtData.client_id) !== null && _c !== void 0 ? _c : _testJwtData === null || _testJwtData === void 0 ? void 0 : _testJwtData.aud) !== null && _d !== void 0 ? _d : "";
            this.apiKeyOrJwt = appId;
            if (!_runtime.cli)
              console.log("JWT expired, falling back to API KEY: " + appId);
            if (_runtime.cli || _runtime.xapp) {
              const error = new Error("JWT Expired, cannot fall back to API credential: in CLI/xApp environment");
              this.emit("error", error);
              throw error;
            }
          }
          if (!jwtExpired) {
            this.jwtCredential = true;
            _jwt = this.apiKeyOrJwt;
          }
        }
        this.initialize();
        this.user = new UnifiedUserData();
        this.environment = {
          jwt: Asyncify(() => _jwtData),
          ott: Asyncify(() => _ott),
          openid: Asyncify(() => _me),
          bearer: Asyncify(() => _jwt),
          ready: new Promise((resolve) => this.on("ready", () => resolve(void 0))),
          success: new Promise((resolve) => this.on("success", () => resolve(void 0))),
          retrieved: new Promise((resolve) => this.on("retrieved", () => resolve(void 0))),
          retrieving: new Promise((resolve) => this.on("retrieving", () => resolve(void 0)))
        };
        this.state = {
          account: "",
          signedIn: false
        };
        this.helpers = Proxify(Asyncify(() => _classes.XummSdk || _classes.XummSdkJwt));
        this.push = Proxify(Asyncify(() => (_classes.XummSdk || _classes.XummSdkJwt).Push));
        this.payload = Proxify(Asyncify(() => (_classes.XummSdk || _classes.XummSdkJwt).payload));
        this.userstore = Proxify(Asyncify(() => (_classes.XummSdk || _classes.XummSdkJwt).jwtUserdata));
        this.backendstore = Proxify(Asyncify(() => (_classes.XummSdk || _classes.XummSdkJwt).storage));
        const xapp = _classes === null || _classes === void 0 ? void 0 : _classes.xApp;
        if (xapp)
          this.xapp = xapp;
        setTimeout(
          () => Promise.all([
            ...readyPromises.filter((p) => (p === null || p === void 0 ? void 0 : p.promiseType) !== "pkceRetrieverResolver"),
            /**
             * If PKCE flow: wait for `ready` till account is known
             */
            _runtime.xapp ? Promise.resolve() : new Promise((resolve) => {
              var _a2;
              if (_classes === null || _classes === void 0 ? void 0 : _classes.XummPkce) {
                this.user.account.then(() => resolve());
                (_a2 = _classes.XummPkce) === null || _a2 === void 0 ? void 0 : _a2.on("loggedout", () => resolve());
              } else {
                resolve();
              }
            })
          ]).then(() => this.emit("ready")),
          // Constructor ready
          0
        );
      }
      initialize() {
        _ott = void 0;
        if (typeof this.apiKeyOrJwt === "string" && this.apiKeyOrJwt.split(".").length === 3 && _jwt === this.apiKeyOrJwt) {
        } else {
          _jwt = "";
          _jwtData = {};
        }
        _me = {};
        _initialized.XummSdkJwt = false;
        const handleXappEvents = () => __awaiter(this, void 0, void 0, function* () {
          if (_classes === null || _classes === void 0 ? void 0 : _classes.xApp) {
            _initialized.xApp = true;
            _classes.xApp.on("qr", (data) => {
              this.emit("qr", data, this.instance);
            });
            _classes.xApp.on("payload", (data) => {
              this.emit("payload", data, this.instance);
            });
            _classes.xApp.on("networkswitch", (data) => {
              this.emit("networkswitch", data, this.instance);
            });
            _classes.xApp.on("destination", (data) => {
              this.emit("destination", data, this.instance);
            });
          }
        });
        this.handlePkceEvents();
        const handleOttJwt = () => __awaiter(this, void 0, void 0, function* () {
          var _a;
          if ((_classes === null || _classes === void 0 ? void 0 : _classes.XummSdkJwt) && !_initialized.XummSdkJwt) {
            _initialized.XummSdkJwt = true;
            const doNotFetchJwtOtt = this.jwtCredential || _jwt !== "";
            if (!doNotFetchJwtOtt) {
              readyPromises.push(_classes.XummSdkJwt.getOttData());
              readyPromises.push(_classes.XummSdkJwt.getJwt());
            }
            const ott = !doNotFetchJwtOtt ? yield _classes.XummSdkJwt.getOttData() : null;
            const jwt = !doNotFetchJwtOtt ? yield _classes.XummSdkJwt.getJwt() : _jwt;
            if (ott) {
              _ott = ott;
              if (_ott === null || _ott === void 0 ? void 0 : _ott.account) {
                this.state.account = _ott.account;
                this.state.signedIn = true;
              }
              this.emit("retrieved");
              this.emit("success");
            }
            if (jwt) {
              _jwt = jwt;
              try {
                _jwtData = JSON.parse(fromBinary((_a = _jwt.split(".")) === null || _a === void 0 ? void 0 : _a[1]));
                if (doNotFetchJwtOtt && this.jwtCredential) {
                  setTimeout(() => this.emit("retrieved"), 0);
                  setTimeout(() => this.emit("success"), 0);
                }
              } catch (e) {
                if (typeof (console === null || console === void 0 ? void 0 : console.log) !== "undefined") {
                  if (!_runtime.cli)
                    console.log("Error decoding JWT", (e === null || e === void 0 ? void 0 : e.message) || "");
                }
              }
            }
            if (typeof (console === null || console === void 0 ? void 0 : console.log) !== "undefined") {
            }
          }
        });
        const initOttJwtRuntime = () => {
          var _a, _b, _c;
          if (!(_classes === null || _classes === void 0 ? void 0 : _classes.XummSdkJwt)) {
            Object.assign(_classes, {
              XummSdkJwt: new (require_src()).XummSdkJwt(
                this.apiKeyOrJwt,
                // Get OTT from UA if present, otherwise fall back to default behaviour
                typeof ((_a = _classes === null || _classes === void 0 ? void 0 : _classes.xApp) === null || _a === void 0 ? void 0 : _a.getEnvironment) !== "undefined" ? ((_c = (_b = _classes === null || _classes === void 0 ? void 0 : _classes.xApp) === null || _b === void 0 ? void 0 : _b.getEnvironment()) === null || _c === void 0 ? void 0 : _c.ott) || void 0 : void 0
              )
            });
            readyPromises.push(handleOttJwt());
          }
        };
        if (_runtime.xapp) {
          if (typeof this.apiKeyOrJwt !== "string" || !(uuidv4re.test(this.apiKeyOrJwt) || this.jwtCredential)) {
            throw new Error("Running in xApp, constructor requires first param. to be Xumm API Key or JWT");
          }
          if (!(_classes === null || _classes === void 0 ? void 0 : _classes.xApp)) {
            Object.assign(_classes, {
              xApp: new (require_dist2()).xApp()
            });
          }
          readyPromises.push(handleXappEvents());
          initOttJwtRuntime();
        } else if (_runtime.browser) {
          if (typeof this.apiKeyOrJwt !== "string" || !(uuidv4re.test(this.apiKeyOrJwt) || this.jwtCredential)) {
            throw new Error("Running in browser, constructor requires first param. to be Xumm API Key or JWT");
          }
          if (!(_classes === null || _classes === void 0 ? void 0 : _classes.XummPkce) && !_runtime.xapp) {
            Object.assign(_classes, {
              XummPkce: new xumm_oauth2_pkce_1.XummPkce(this.apiKeyOrJwt, {
                implicit: true
              })
            });
            if (_classes.XummPkce) {
              if (this.jwtCredential) {
                initOttJwtRuntime();
              } else {
                setTimeout(() => this.emit("retrieving"), 0);
                const handlePkceState = (resolve) => {
                  var _a, _b;
                  (_b = (_a = _classes.XummPkce) === null || _a === void 0 ? void 0 : _a.state()) === null || _b === void 0 ? void 0 : _b.then((state) => {
                    var _a2;
                    if ((state === null || state === void 0 ? void 0 : state.sdk) && !(_classes === null || _classes === void 0 ? void 0 : _classes.XummSdkJwt)) {
                      Object.assign(_classes, { XummSdkJwt: state.sdk });
                      Object.assign(_me, Object.assign({}, (state === null || state === void 0 ? void 0 : state.me) || {}));
                      if ((_a2 = state === null || state === void 0 ? void 0 : state.me) === null || _a2 === void 0 ? void 0 : _a2.account) {
                        this.state.account = state.me.account;
                        this.state.signedIn = true;
                      }
                    }
                    if ((state === null || state === void 0 ? void 0 : state.jwt) && _jwt === "") {
                      _jwt = state.jwt;
                      handleOttJwt();
                    }
                    resolve(state);
                  });
                };
                readyPromises.push(this.handlePkceEvents());
                const pkceRetrieverResolver = new Promise((resolve) => {
                  var _a, _b;
                  (_a = _classes.XummPkce) === null || _a === void 0 ? void 0 : _a.on("retrieved", () => {
                    handlePkceState(resolve);
                  });
                  (_b = _classes.XummPkce) === null || _b === void 0 ? void 0 : _b.on("success", () => {
                    handlePkceState(resolve);
                  });
                });
                readyPromises.push(Object.assign(pkceRetrieverResolver, {
                  promiseType: "pkceRetrieverResolver"
                }));
              }
            }
          }
        } else if (_runtime.cli) {
          if (typeof this.apiKeyOrJwt !== "string") {
            throw new Error("Running CLI, constructor needs first param. to be Xumm API Key / raw JWT");
          } else {
            if (uuidv4re.test(this.apiKeyOrJwt)) {
              if (typeof this.apiSecretOrOtt !== "string" || !uuidv4re.test(this.apiSecretOrOtt)) {
                throw new Error("Running CLI, constructor first param. is API Key, but second param. isn't a valid API Secret");
              }
            }
            if (!uuidv4re.test(this.apiKeyOrJwt) && this.apiKeyOrJwt.split(".").length !== 3) {
              throw new Error("Running CLI, constructor first param. not a valid JWT, nor a valid API Key");
            }
            if (this.jwtCredential) {
              initOttJwtRuntime();
            } else {
              if (!(_classes === null || _classes === void 0 ? void 0 : _classes.XummSdk)) {
                Object.assign(_classes, {
                  XummSdk: new (require_src()).XummSdk(this.apiKeyOrJwt, this.apiSecretOrOtt)
                });
              }
            }
          }
        }
      }
      /**
       * PKCE
       */
      authorize() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
          try {
            return yield (_a = _classes === null || _classes === void 0 ? void 0 : _classes.XummPkce) === null || _a === void 0 ? void 0 : _a.authorize();
          } catch (e) {
            return e;
          }
        });
      }
      /**
       * TODO: CHECK IF EVENTS ARE NOT REGISTERED AND FIRING TWICE
       */
      handlePkceEvents() {
        return __awaiter(this, void 0, void 0, function* () {
          if ((_classes === null || _classes === void 0 ? void 0 : _classes.XummPkce) && !_initialized.XummPkce) {
            _initialized.XummPkce = true;
            const retrievedHandler = () => this.emit("retrieved");
            const successHandler = () => this.emit("success");
            const errorHandler = (data) => this.emit("error", data);
            _classes.XummPkce.on("retrieved", retrievedHandler);
            _classes.XummPkce.on("success", successHandler);
            _classes.XummPkce.on("error", errorHandler);
          }
          return;
        });
      }
      logout() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
          if (_runtime.xapp) {
            return;
          }
          let downgradeJwtLogin = false;
          this.state.account = "";
          this.state.signedIn = false;
          if (typeof this.apiKeyOrJwt === "string" && this.apiKeyOrJwt.split(".").length === 3 && (_jwtData === null || _jwtData === void 0 ? void 0 : _jwtData.app_uuidv4) && this.jwtCredential) {
            this.apiKeyOrJwt = _jwtData.app_uuidv4;
            this.jwtCredential = false;
            downgradeJwtLogin = true;
            window._XummPkce = void 0;
          }
          if (_runtime.browser && ((_me === null || _me === void 0 ? void 0 : _me.sub) || downgradeJwtLogin)) {
            (_a = _classes === null || _classes === void 0 ? void 0 : _classes.XummPkce) === null || _a === void 0 ? void 0 : _a.logout();
            Object.assign(_classes, {
              XummSdk: void 0,
              XummSdkJwt: void 0,
              XummPkce: void 0
            });
            readyPromises.length = 0;
            this.jwtCredential = false;
            this.initialize();
            this.user = new UnifiedUserData();
            this.environment = {
              jwt: Asyncify(() => _jwtData),
              ott: Asyncify(() => _ott),
              openid: Asyncify(() => _me),
              bearer: Asyncify(() => _jwt),
              ready: new Promise((resolve) => this.on("ready", () => resolve(void 0))),
              success: new Promise((resolve) => this.on("success", () => resolve(void 0))),
              retrieved: new Promise((resolve) => this.on("retrieved", () => resolve(void 0))),
              retrieving: new Promise((resolve) => this.on("retrieving", () => resolve(void 0)))
            };
            this.emit("logout");
          }
        });
      }
      /**
       * SDK
       */
      ping() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
          yield Promise.all(readyPromises);
          return (_a = (_classes === null || _classes === void 0 ? void 0 : _classes.XummSdkJwt) || (_classes === null || _classes === void 0 ? void 0 : _classes.XummSdk)) === null || _a === void 0 ? void 0 : _a.ping();
        });
      }
    };
    exports.Xumm = Xumm;
  }
});
export default require_dist3();
/*! Bundled license information:

ieee754/index.js:
  (*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> *)

buffer/index.js:
  (*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)
*/
//# sourceMappingURL=xumm.js.map

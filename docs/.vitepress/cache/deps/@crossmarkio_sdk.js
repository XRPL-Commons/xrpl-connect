import {
  __commonJS,
  __privateAdd,
  __privateGet,
  __publicField
} from "./chunk-V46ELZXU.js";

// node_modules/.pnpm/@crossmarkio+sdk@0.4.0_bufferutil@4.0.9_utf-8-validate@5.0.10/node_modules/@crossmarkio/sdk/pack/umd/index.js
var require_umd = __commonJS({
  "node_modules/.pnpm/@crossmarkio+sdk@0.4.0_bufferutil@4.0.9_utf-8-validate@5.0.10/node_modules/@crossmarkio/sdk/pack/umd/index.js"(exports, module) {
    !function(e, t) {
      if ("object" == typeof exports && "object" == typeof module) module.exports = t();
      else if ("function" == typeof define && define.amd) define([], t);
      else {
        var s, r = t();
        for (s in r) ("object" == typeof exports ? exports : e)[s] = r[s];
      }
    }(exports, () => (() => {
      "use strict";
      var r = { 7531: (e) => {
        var t = "object" == typeof Reflect ? Reflect : null, c = t && "function" == typeof t.apply ? t.apply : function(e2, t2, s2) {
          return Function.prototype.apply.call(e2, t2, s2);
        };
        var s = t && "function" == typeof t.ownKeys ? t.ownKeys : Object.getOwnPropertySymbols ? function(e2) {
          return Object.getOwnPropertyNames(e2).concat(Object.getOwnPropertySymbols(e2));
        } : function(e2) {
          return Object.getOwnPropertyNames(e2);
        }, r2 = Number.isNaN || function(e2) {
          return e2 != e2;
        };
        function o2() {
          o2.init.call(this);
        }
        e.exports = o2, e.exports.once = function(a2, c2) {
          return new Promise(function(e2, t2) {
            function s2(e3) {
              a2.removeListener(c2, r3), t2(e3);
            }
            function r3() {
              "function" == typeof a2.removeListener && a2.removeListener("error", s2), e2([].slice.call(arguments));
            }
            var o3, i2, n2;
            f(a2, c2, r3, { once: true }), "error" !== c2 && (i2 = s2, n2 = { once: true }, "function" == typeof (o3 = a2).on) && f(o3, "error", i2, n2);
          });
        }, (o2.EventEmitter = o2).prototype._events = void 0, o2.prototype._eventsCount = 0, o2.prototype._maxListeners = void 0;
        var i = 10;
        function l(e2) {
          if ("function" != typeof e2) throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof e2);
        }
        function n(e2) {
          return void 0 === e2._maxListeners ? o2.defaultMaxListeners : e2._maxListeners;
        }
        function a(e2, t2, s2, r3) {
          var o3, i2;
          return l(s2), void 0 === (o3 = e2._events) ? (o3 = e2._events = /* @__PURE__ */ Object.create(null), e2._eventsCount = 0) : (void 0 !== o3.newListener && (e2.emit("newListener", t2, s2.listener || s2), o3 = e2._events), i2 = o3[t2]), void 0 === i2 ? (i2 = o3[t2] = s2, ++e2._eventsCount) : ("function" == typeof i2 ? i2 = o3[t2] = r3 ? [s2, i2] : [i2, s2] : r3 ? i2.unshift(s2) : i2.push(s2), 0 < (o3 = n(e2)) && i2.length > o3 && !i2.warned && (i2.warned = true, (r3 = new Error("Possible EventEmitter memory leak detected. " + i2.length + " " + String(t2) + " listeners added. Use emitter.setMaxListeners() to increase limit")).name = "MaxListenersExceededWarning", r3.emitter = e2, r3.type = t2, r3.count = i2.length, s2 = r3, console) && console.warn && console.warn(s2)), e2;
        }
        function p(e2, t2, s2) {
          e2 = { fired: false, wrapFn: void 0, target: e2, type: t2, listener: s2 }, t2 = (function() {
            if (!this.fired) return this.target.removeListener(this.type, this.wrapFn), this.fired = true, 0 === arguments.length ? this.listener.call(this.target) : this.listener.apply(this.target, arguments);
          }).bind(e2);
          return t2.listener = s2, e2.wrapFn = t2;
        }
        function d(e2, t2, s2) {
          e2 = e2._events;
          if (void 0 === e2) return [];
          e2 = e2[t2];
          if (void 0 === e2) return [];
          if ("function" == typeof e2) return s2 ? [e2.listener || e2] : [e2];
          if (s2) {
            for (var r3 = e2, o3 = new Array(r3.length), i2 = 0; i2 < o3.length; ++i2) o3[i2] = r3[i2].listener || r3[i2];
            return o3;
          }
          return h(e2, e2.length);
        }
        function u(e2) {
          var t2 = this._events;
          if (void 0 !== t2) {
            t2 = t2[e2];
            if ("function" == typeof t2) return 1;
            if (void 0 !== t2) return t2.length;
          }
          return 0;
        }
        function h(e2, t2) {
          for (var s2 = new Array(t2), r3 = 0; r3 < t2; ++r3) s2[r3] = e2[r3];
          return s2;
        }
        function f(s2, r3, o3, i2) {
          if ("function" == typeof s2.on) i2.once ? s2.once(r3, o3) : s2.on(r3, o3);
          else {
            if ("function" != typeof s2.addEventListener) throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof s2);
            s2.addEventListener(r3, function e2(t2) {
              i2.once && s2.removeEventListener(r3, e2), o3(t2);
            });
          }
        }
        Object.defineProperty(o2, "defaultMaxListeners", { enumerable: true, get: function() {
          return i;
        }, set: function(e2) {
          if ("number" != typeof e2 || e2 < 0 || r2(e2)) throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + e2 + ".");
          i = e2;
        } }), o2.init = function() {
          void 0 !== this._events && this._events !== Object.getPrototypeOf(this)._events || (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0), this._maxListeners = this._maxListeners || void 0;
        }, o2.prototype.setMaxListeners = function(e2) {
          if ("number" != typeof e2 || e2 < 0 || r2(e2)) throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + e2 + ".");
          return this._maxListeners = e2, this;
        }, o2.prototype.getMaxListeners = function() {
          return n(this);
        }, o2.prototype.emit = function(e2) {
          for (var t2 = [], s2 = 1; s2 < arguments.length; s2++) t2.push(arguments[s2]);
          var r3 = "error" === e2, o3 = this._events;
          if (void 0 !== o3) r3 = r3 && void 0 === o3.error;
          else if (!r3) return false;
          if (r3) {
            if ((i2 = 0 < t2.length ? t2[0] : i2) instanceof Error) throw i2;
            r3 = new Error("Unhandled error." + (i2 ? " (" + i2.message + ")" : ""));
            throw r3.context = i2, r3;
          }
          var i2 = o3[e2];
          if (void 0 === i2) return false;
          if ("function" == typeof i2) c(i2, this, t2);
          else for (var n2 = i2.length, a2 = h(i2, n2), s2 = 0; s2 < n2; ++s2) c(a2[s2], this, t2);
          return true;
        }, o2.prototype.on = o2.prototype.addListener = function(e2, t2) {
          return a(this, e2, t2, false);
        }, o2.prototype.prependListener = function(e2, t2) {
          return a(this, e2, t2, true);
        }, o2.prototype.once = function(e2, t2) {
          return l(t2), this.on(e2, p(this, e2, t2)), this;
        }, o2.prototype.prependOnceListener = function(e2, t2) {
          return l(t2), this.prependListener(e2, p(this, e2, t2)), this;
        }, o2.prototype.off = o2.prototype.removeListener = function(e2, t2) {
          var s2, r3, o3, i2, n2;
          if (l(t2), void 0 !== (r3 = this._events) && void 0 !== (s2 = r3[e2])) {
            if (s2 === t2 || s2.listener === t2) 0 == --this._eventsCount ? this._events = /* @__PURE__ */ Object.create(null) : (delete r3[e2], r3.removeListener && this.emit("removeListener", e2, s2.listener || t2));
            else if ("function" != typeof s2) {
              for (o3 = -1, i2 = s2.length - 1; 0 <= i2; i2--) if (s2[i2] === t2 || s2[i2].listener === t2) {
                n2 = s2[i2].listener, o3 = i2;
                break;
              }
              if (o3 < 0) return this;
              if (0 === o3) s2.shift();
              else {
                for (var a2 = s2, c2 = o3; c2 + 1 < a2.length; c2++) a2[c2] = a2[c2 + 1];
                a2.pop();
              }
              1 === s2.length && (r3[e2] = s2[0]), void 0 !== r3.removeListener && this.emit("removeListener", e2, n2 || t2);
            }
          }
          return this;
        }, o2.prototype.removeAllListeners = function(e2) {
          var t2, s2 = this._events;
          if (void 0 !== s2) {
            if (void 0 === s2.removeListener) 0 === arguments.length ? (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0) : void 0 !== s2[e2] && (0 == --this._eventsCount ? this._events = /* @__PURE__ */ Object.create(null) : delete s2[e2]);
            else if (0 === arguments.length) {
              for (var r3, o3 = Object.keys(s2), i2 = 0; i2 < o3.length; ++i2) "removeListener" !== (r3 = o3[i2]) && this.removeAllListeners(r3);
              this.removeAllListeners("removeListener"), this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0;
            } else if ("function" == typeof (t2 = s2[e2])) this.removeListener(e2, t2);
            else if (void 0 !== t2) for (i2 = t2.length - 1; 0 <= i2; i2--) this.removeListener(e2, t2[i2]);
          }
          return this;
        }, o2.prototype.listeners = function(e2) {
          return d(this, e2, true);
        }, o2.prototype.rawListeners = function(e2) {
          return d(this, e2, false);
        }, o2.listenerCount = function(e2, t2) {
          return "function" == typeof e2.listenerCount ? e2.listenerCount(t2) : u.call(e2, t2);
        }, o2.prototype.listenerCount = u, o2.prototype.eventNames = function() {
          return 0 < this._eventsCount ? s(this._events) : [];
        };
      }, 9616: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        };
        Object.defineProperty(t, "__esModule", { value: true }), t.Sdk = void 0;
        const n = i(s(5149)), a = i(s(9386));
        var c = i(s(9815));
        class l extends n.CustomEmitter {
          constructor(e2) {
            super();
            __publicField(this, "mount");
            __publicField(this, "api");
            __publicField(this, "session");
            __publicField(this, "env");
            __publicField(this, "async");
            __publicField(this, "sync");
            __publicField(this, "methods");
            __publicField(this, "app", c.Projects.titles.crossmark);
            (e2 == null ? void 0 : e2.project) && (this.app = e2 == null ? void 0 : e2.project), this.env = new n.Env(), this.api = new n.Api(this), this.session = new n.Session(this), this.mount = new n.Mount(this), this.async = new a.Async(this), this.sync = new a.Sync(this), this.methods = Object.assign({}, this.async, this.sync), new n.CustomEvents(this);
          }
        }
        t.Sdk = l;
      }, 614: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        };
        Object.defineProperty(t, "__esModule", { value: true }), t.Async = void 0;
        const n = i(s(9815));
        t.Async = class {
          constructor(e2) {
            __publicField(this, "sdk");
            __publicField(this, "api");
            __publicField(this, "session");
            __publicField(this, "mount");
            __publicField(this, "signInAndWait", (e2) => this.api.awaitRequest({ command: n.COMMANDS.SIGN, data: { tx: { TransactionType: "SignIn" }, hex: e2 } }));
            __publicField(this, "signAndWait", (e2, t2) => this.api.awaitRequest({ command: n.COMMANDS.SIGN, data: { tx: e2, opts: t2 } }));
            __publicField(this, "submitAndWait", (e2, t2, s2) => this.api.awaitRequest({ command: n.COMMANDS.SUBMIT, data: { address: e2, txblob: t2, opts: s2 } }));
            __publicField(this, "signAndSubmitAndWait", (e2, t2) => this.api.awaitRequest({ command: n.COMMANDS.SIGNANDSUBMIT, data: { tx: e2, opts: t2 } }));
            __publicField(this, "bulkSignAndWait", (e2, t2) => this.api.awaitRequest({ command: n.COMMANDS.BULKSIGN, data: { txns: e2, opts: t2 } }));
            __publicField(this, "bulkSubmitAndWait", (e2, t2, s2) => this.api.awaitRequest({ command: n.COMMANDS.BULKSUBMIT, data: { address: e2, txblobs: t2, opts: s2 } }));
            __publicField(this, "bulkSignAndSubmitAndWait", (e2, t2) => this.api.awaitRequest({ command: n.COMMANDS.BULK, data: { txns: e2, opts: t2 } }));
            __publicField(this, "encryptAndWait", { aes: (e2, t2, s2) => this.api.awaitRequest({ command: n.COMMANDS.ENCRYPT, data: { address: e2, data: t2, opts: s2 } }) });
            __publicField(this, "decryptAndAwait", { aes: (e2, t2, s2) => this.api.awaitRequest({ command: n.COMMANDS.DECRYPT, data: { address: e2, hex: t2, opts: s2 } }) });
            __publicField(this, "isLockedAndWait", () => this.api.awaitRequest({ command: n.COMMANDS.IS_LOCKED }));
            __publicField(this, "versionAndWait", () => this.api.awaitRequest({ command: n.COMMANDS.VERSION }));
            __publicField(this, "verifyAndWait", (e2) => this.api.awaitRequest({ command: n.COMMANDS.VERIFY, data: { hex: e2 } }));
            __publicField(this, "connect", (e2) => this.mount.loop(e2));
            __publicField(this, "detect", (e2) => this.mount.loop(e2));
            this.sdk = e2, this.api = e2.api, this.session = e2.session, this.mount = e2.mount;
          }
        };
      }, 9386: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Sync = t.Async = void 0;
        var r2 = s(614), o2 = (Object.defineProperty(t, "Async", { enumerable: true, get: function() {
          return r2.Async;
        } }), s(8258));
        Object.defineProperty(t, "Sync", { enumerable: true, get: function() {
          return o2.Sync;
        } });
      }, 8258: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        };
        Object.defineProperty(t, "__esModule", { value: true }), t.Sync = void 0;
        const n = i(s(9815));
        t.Sync = class {
          constructor(e2) {
            __publicField(this, "sdk");
            __publicField(this, "api");
            __publicField(this, "session");
            __publicField(this, "mount");
            __publicField(this, "signIn", (e2) => this.api.request({ command: n.COMMANDS.SIGN, data: { tx: { TransactionType: "SignIn" }, hex: e2 } }));
            __publicField(this, "sign", (e2, t2) => this.api.request({ command: n.COMMANDS.SIGN, data: { tx: e2, opts: t2 } }));
            __publicField(this, "submit", (e2, t2, s2) => this.api.request({ command: n.COMMANDS.SUBMIT, data: { address: e2, txblob: t2, opts: s2 } }));
            __publicField(this, "signAndSubmit", (e2, t2) => this.api.request({ command: n.COMMANDS.SIGNANDSUBMIT, data: { tx: e2, opts: t2 } }));
            __publicField(this, "bulkSign", (e2, t2) => this.api.request({ command: n.COMMANDS.BULKSIGN, data: { txns: e2, opts: t2 } }));
            __publicField(this, "bulkSubmit", (e2, t2, s2) => this.api.request({ command: n.COMMANDS.BULKSUBMIT, data: { address: e2, txblobs: t2, opts: s2 } }));
            __publicField(this, "encrypt", { aes: (e2, t2, s2) => this.api.request({ command: n.COMMANDS.ENCRYPT, data: { address: e2, data: t2, opts: s2 } }) });
            __publicField(this, "decrypt", { aes: (e2, t2, s2) => this.api.request({ command: n.COMMANDS.DECRYPT, data: { address: e2, hex: t2, opts: s2 } }) });
            __publicField(this, "bulkSignAndSubmit", (e2, t2) => this.api.request({ command: n.COMMANDS.BULK, data: { txns: e2, opts: t2 } }));
            __publicField(this, "getResponse", (e2) => this.session.responses.get(e2));
            __publicField(this, "isConnected", () => this.mount.isDetected);
            __publicField(this, "isInstalled", () => this.mount.isDetected);
            __publicField(this, "isLocked", () => this.api.request({ command: n.COMMANDS.IS_LOCKED }));
            __publicField(this, "isOpen", () => this.session.isOpen);
            __publicField(this, "version", () => this.api.request({ command: n.COMMANDS.VERSION }));
            __publicField(this, "verify", (e2) => this.api.request({ command: n.COMMANDS.VERIFY, data: { hex: e2 } }));
            __publicField(this, "getAddress", () => this.session.address);
            __publicField(this, "getNetwork", () => this.session.network);
            __publicField(this, "getUser", () => this.session.user);
            this.sdk = e2, this.api = e2.api, this.session = e2.session, this.mount = e2.mount;
          }
        };
      }, 6515: function(e, t, s) {
        var _handleMsg, _handleEvent, _fire;
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, n = this && this.__importDefault || function(e2) {
          return e2 && e2.__esModule ? e2 : { default: e2 };
        }, n = (Object.defineProperty(t, "__esModule", { value: true }), t.Api = void 0, n(s(7531)));
        const a = i(s(9815)), c = s(266);
        class l extends n.default {
          constructor(e2) {
            super();
            __publicField(this, "sdk");
            __publicField(this, "active", /* @__PURE__ */ new Map());
            __publicField(this, "uuid");
            __publicField(this, "connected");
            __publicField(this, "target");
            __publicField(this, "timestamp");
            __privateAdd(this, _handleMsg, (e2) => {
              var _a, _b, _c, _d;
              try {
                if (window && ((!window || e2.source === window && e2.source && e2.origin === window.location.origin) && e2.data)) {
                  var t2 = ((_a = e2.data) == null ? void 0 : _a.type) || void 0, s2 = ((_b = e2.data) == null ? void 0 : _b.response) || void 0, r3 = ((_c = e2.data) == null ? void 0 : _c.app) || void 0;
                  if (("request" !== t2 || r3 === this.sdk.app) && t2 !== a.TYPES.UPDATE) return t2 === a.TYPES.EVENT && "type" in e2.data ? __privateGet(this, _handleEvent).call(this, e2.data) : (s2 && s2.type === a.TYPES.RESPONSE && this.emit(a.EVENTS.RESPONSE, e2.data), s2 && s2.type === a.EVENTS.RESPONSE && this.active.get(s2.id) ? (_d = this.active.get(s2.id)) == null ? void 0 : _d.resolve(e2.data) : void 0);
                }
              } catch (e3) {
              }
            });
            __privateAdd(this, _handleEvent, (e2) => {
              e2.event === a.EVENTS.PING && this.emit(a.EVENTS.PING), e2.event === a.EVENTS.CLOSE && this.emit(a.EVENTS.CLOSE), e2.event === a.EVENTS.OPEN && this.emit(a.EVENTS.OPEN), e2.event === a.EVENTS.SIGNOUT && this.emit(a.EVENTS.SIGNOUT), e2.event === a.EVENTS.USER_CHANGE && this.emit(a.EVENTS.USER_CHANGE, e2.data), e2.event === a.EVENTS.NETWORK_CHANGE && this.emit(a.EVENTS.NETWORK_CHANGE, e2.data);
            });
            __privateAdd(this, _fire, async (s2) => {
              var e2 = await new Promise((e3, t2) => {
                this.active.set(s2.id, { resolve: e3, reject: t2 }), window && window.postMessage(s2);
              });
              return this.active.delete(s2.id), e2;
            });
            __publicField(this, "awaitRequest", async (e2) => {
              try {
                return await __privateGet(this, _fire).call(this, { app: this.sdk.app, type: a.TYPES.REQUEST, id: (0, c.uuid)(), ...e2 });
              } catch (e3) {
                throw e3;
              }
            });
            __publicField(this, "request", (e2) => {
              try {
                var t2 = (0, c.uuid)();
                return __privateGet(this, _fire).call(this, { app: this.sdk.app, type: a.TYPES.REQUEST, id: t2, ...e2 }), t2;
              } catch (e3) {
                throw e3;
              }
            });
            this.sdk = e2, this.uuid = (0, c.uuid)(), this.connected = false, this.timestamp = Date.now(), "undefined" != typeof window && (this.target = window.origin, window.addEventListener("message", __privateGet(this, _handleMsg)));
          }
        }
        _handleMsg = new WeakMap();
        _handleEvent = new WeakMap();
        _fire = new WeakMap();
        t.Api = l;
      }, 2585: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Env = void 0;
        class s {
          constructor() {
            __publicField(this, "isAndroid", false);
            __publicField(this, "isIos", false);
            __publicField(this, "isOpera", false);
            __publicField(this, "isWindows", false);
            __publicField(this, "isSSR", false);
            __publicField(this, "isXApp", false);
            __publicField(this, "isMobile", false);
            __publicField(this, "isDesktop", false);
            "undefined" != typeof window && (this.isAndroid = Boolean(window == null ? void 0 : window.navigator.userAgent.match(/Android/i)), this.isIos = Boolean(window == null ? void 0 : window.navigator.userAgent.match(/iPhone|iPad|iPod/i)), this.isOpera = Boolean(window == null ? void 0 : window.navigator.userAgent.match(/Opera Mini/i)), this.isWindows = Boolean(window == null ? void 0 : window.navigator.userAgent.match(/IEMobile/i)), this.isSSR = Boolean(window == null ? void 0 : window.navigator.userAgent.match(/SSR/i)), this.isXApp = Boolean(window == null ? void 0 : window.navigator.userAgent.match(/xumm/i)), this.isMobile = Boolean(this.isAndroid || this.isIos || this.isOpera || this.isWindows), this.isDesktop = Boolean(!this.isMobile && !this.isSSR));
          }
        }
        t.Env = s, t.default = new s();
      }, 6962: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, n = this && this.__importDefault || function(e2) {
          return e2 && e2.__esModule ? e2 : { default: e2 };
        }, n = (Object.defineProperty(t, "__esModule", { value: true }), t.CustomEvents = t.CustomEmitter = void 0, n(s(7531)));
        const a = i(s(9815));
        class c extends n.default {
        }
        t.CustomEmitter = c;
        t.CustomEvents = class extends c {
          constructor(e2) {
            super();
            __publicField(this, "sdk");
            __publicField(this, "api");
            this.sdk = e2, this.api = this.sdk.api, this.api.on(a.EVENTS.PING, () => this.sdk.emit(a.EVENTS.PING)), this.api.on(a.EVENTS.RESPONSE, (e3) => {
              this.sdk.emit(a.EVENTS.RESPONSE, e3), this.sdk.emit(a.EVENTS.ALL, { type: a.EVENTS.RESPONSE, resp: e3 });
            }), this.api.on(a.EVENTS.USER_CHANGE, (e3) => {
              this.sdk.emit(a.EVENTS.USER_CHANGE, e3), this.sdk.emit(a.EVENTS.ALL, { type: a.EVENTS.USER_CHANGE, user: e3 });
            }), this.api.on(a.EVENTS.NETWORK_CHANGE, (e3) => {
              this.sdk.emit(a.EVENTS.NETWORK_CHANGE, e3), this.sdk.emit(a.EVENTS.ALL, { type: a.EVENTS.NETWORK_CHANGE, network: e3 });
            }), this.api.on(a.EVENTS.OPEN, () => {
              this.sdk.emit(a.EVENTS.OPEN), this.sdk.emit(a.EVENTS.ALL, { type: a.EVENTS.OPEN });
            }), this.api.on(a.EVENTS.CLOSE, () => {
              this.sdk.emit(a.EVENTS.CLOSE), this.sdk.emit(a.EVENTS.ALL, { type: a.EVENTS.CLOSE });
            }), this.api.on(a.EVENTS.SIGNOUT, () => {
              this.sdk.emit(a.EVENTS.SIGNOUT), this.sdk.emit(a.EVENTS.ALL, { type: a.EVENTS.SIGNOUT });
            });
          }
        };
      }, 5149: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Session = t.Scheme = t.Mount = t.CustomEvents = t.CustomEmitter = t.Env = t.Api = void 0;
        var r2 = s(6515), o2 = (Object.defineProperty(t, "Api", { enumerable: true, get: function() {
          return r2.Api;
        } }), s(2585)), i = (Object.defineProperty(t, "Env", { enumerable: true, get: function() {
          return o2.Env;
        } }), s(6962)), n = (Object.defineProperty(t, "CustomEmitter", { enumerable: true, get: function() {
          return i.CustomEmitter;
        } }), Object.defineProperty(t, "CustomEvents", { enumerable: true, get: function() {
          return i.CustomEvents;
        } }), s(288)), a = (Object.defineProperty(t, "Mount", { enumerable: true, get: function() {
          return n.Mount;
        } }), s(2821)), c = (Object.defineProperty(t, "Scheme", { enumerable: true, get: function() {
          return a.Scheme;
        } }), s(2413));
        Object.defineProperty(t, "Session", { enumerable: true, get: function() {
          return c.Session;
        } });
      }, 288: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, n = this && this.__importDefault || function(e2) {
          return e2 && e2.__esModule ? e2 : { default: e2 };
        }, n = (Object.defineProperty(t, "__esModule", { value: true }), t.Mount = void 0, n(s(7531)));
        const a = s(266), c = i(s(9815));
        class l extends n.default {
          constructor(e2) {
            super();
            __publicField(this, "isDetected");
            __publicField(this, "sdk");
            __publicField(this, "loop", async (r3) => new Promise(async (e2, t2) => {
              this.isDetected && e2(true);
              var s2 = Date.now();
              if (this.sdk.app === c.Projects.titles.embark) for (; ; ) {
                if ("undefined" != typeof window && window.xrpl && window.xrpl.isEmbark) {
                  this.isDetected = window.xrpl.isEmbark, window.embark = Object.assign({}, window == null ? void 0 : window.embark, this.sdk), this.emit("detected"), this.sdk.emit("detected"), e2(true);
                  break;
                }
                if (await (0, a.sleep)(500), Date.now() > s2 + (r3 ?? 1e4)) {
                  e2(false);
                  break;
                }
              }
              else for (; ; ) {
                if ("undefined" != typeof window && window.xrpl && window.xrpl.isCrossmark) {
                  this.isDetected = window.xrpl.isCrossmark, window.crossmark = Object.assign({}, window == null ? void 0 : window.crossmark, this.sdk), this.emit("detected"), this.sdk.emit("detected"), e2(true);
                  break;
                }
                if (await (0, a.sleep)(500), Date.now() > s2 + (r3 ?? 1e4)) {
                  e2(false);
                  break;
                }
              }
            }));
            this.sdk = e2, this.loop(1e4);
          }
        }
        t.Mount = l;
      }, 2821: function(e, t, s) {
        var r2 = this && this.__importDefault || function(e2) {
          return e2 && e2.__esModule ? e2 : { default: e2 };
        };
        Object.defineProperty(t, "__esModule", { value: true }), t.Scheme = void 0;
        const o2 = r2(s(2585));
        t.Scheme = { get: (e2, t2) => {
          if (t2.startsWith("_")) throw new Error("Access denied");
          if (o2.default.isMobile) throw new Error("Crossmark only available from desktop");
          t2 = e2[t2];
          return "function" == typeof t2 ? t2.bind(e2) : t2;
        }, set: (e2, t2, s2) => {
          if (t2.startsWith("_")) throw new Error("Access denied");
          return e2[t2] = s2, true;
        }, deleteProperty: (e2, t2) => {
          if (t2.startsWith("_")) throw new Error("Access denied");
          return delete e2[t2], true;
        }, ownKeys: (e2) => Object.keys(e2).filter((e3) => !e3.startsWith("_")) };
      }, 2413: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        };
        Object.defineProperty(t, "__esModule", { value: true }), t.Session = void 0;
        const n = i(s(9815));
        class a {
          constructor(e2) {
            __publicField(this, "sdk");
            __publicField(this, "user");
            __publicField(this, "network");
            __publicField(this, "address");
            __publicField(this, "isOpen", false);
            __publicField(this, "lastPing");
            __publicField(this, "state", "unactive");
            __publicField(this, "responses", /* @__PURE__ */ new Map());
            __publicField(this, "handleDetect", async () => {
              this.network = (await this.sdk.api.awaitRequest({ command: n.COMMANDS.NETWORK })).response.data.network, this.user = (await this.sdk.api.awaitRequest({ command: n.COMMANDS.USER })).response.data.user, this.address = (await this.sdk.api.awaitRequest({ command: n.COMMANDS.ADDRESS })).response.data.address, this.network && this.user && this.address && (this.state = "active");
            });
            __publicField(this, "handlePing", () => this.lastPing = Date.now());
            __publicField(this, "handleClose", () => this.isOpen = false);
            __publicField(this, "handleOpen", () => this.isOpen = true);
            __publicField(this, "handleSignOut", () => {
              this.state = "unactive", this.address = void 0, this.network = void 0, this.user = void 0;
            });
            __publicField(this, "handleNetworkChange", (e2) => {
              this.network = e2.network;
            });
            __publicField(this, "handleUserChange", (e2) => {
              this.user = e2.user, this.address = void 0;
            });
            __publicField(this, "handleResponse", (e2) => {
              "address" in e2.response.data && (this.state = "active", this.address = e2.response.data.address), "network" in e2.response.data && (this.network = e2.response.data.network), "user" in e2.response.data && (this.user = e2.response.data.user), this.responses.set(e2.request.id, e2);
            });
            this.sdk = e2, this.sdk.on(n.EVENTS.PING, this.handlePing), this.sdk.on(n.EVENTS.RESPONSE, this.handleResponse), this.sdk.on(n.EVENTS.USER_CHANGE, this.handleUserChange), this.sdk.on(n.EVENTS.NETWORK_CHANGE, this.handleNetworkChange), this.sdk.on(n.EVENTS.OPEN, this.handleOpen), this.sdk.on(n.EVENTS.CLOSE, this.handleClose), this.sdk.on(n.EVENTS.SIGNOUT, this.handleSignOut), this.sdk.on("detected", this.handleDetect);
          }
        }
        (t.Session = a).prototype.user = void 0, a.prototype.network = void 0, a.prototype.address = void 0;
      }, 4240: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        };
        Object.defineProperty(t, "__esModule", { value: true }), t.typings = t.modules = t.vanilla = void 0;
        const n = s(9616);
        Object.defineProperty(t, "vanilla", { enumerable: true, get: function() {
          return n.Sdk;
        } });
        var a = i(s(40)), i = (t.modules = a, i(s(9815)));
        t.typings = i, t.default = a.xmark;
      }, 2898: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, n = (Object.defineProperty(t, "__esModule", { value: true }), s(9616)), a = i(s(5149)), i = i(s(9815));
        t.default = new Proxy(new n.Sdk({ project: i.Projects.titles.crossmark }), a.Scheme);
      }, 477: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, n = (Object.defineProperty(t, "__esModule", { value: true }), s(9616)), a = i(s(5149)), i = i(s(9815));
        t.default = new Proxy(new n.Sdk({ project: i.Projects.titles.embark }), a.Scheme);
      }, 40: function(e, t, s) {
        var r2 = this && this.__importDefault || function(e2) {
          return e2 && e2.__esModule ? e2 : { default: e2 };
        }, o2 = (Object.defineProperty(t, "__esModule", { value: true }), t.embark = t.xmark = void 0, s(2898)), i = (Object.defineProperty(t, "xmark", { enumerable: true, get: function() {
          return r2(o2).default;
        } }), s(477));
        Object.defineProperty(t, "embark", { enumerable: true, get: function() {
          return r2(i).default;
        } });
      }, 5007: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.uuid = void 0;
        t.uuid = () => {
          let e2 = "", t2;
          for (t2 = 0; t2 < 32; t2 += 1) switch (t2) {
            case 8:
            case 20:
              e2 = (e2 += "-") + (16 * Math.random() | 0).toString(16);
              break;
            case 12:
              e2 = e2 + "-4";
              break;
            case 16:
              e2 = (e2 += "-") + (4 * Math.random() | 8).toString(16);
              break;
            default:
              e2 += (16 * Math.random() | 0).toString(16);
          }
          return e2;
        };
      }, 266: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.uuid = t.sleep = void 0;
        var r2 = s(2200), o2 = (Object.defineProperty(t, "sleep", { enumerable: true, get: function() {
          return r2.sleep;
        } }), s(5007));
        Object.defineProperty(t, "uuid", { enumerable: true, get: function() {
          return o2.uuid;
        } });
      }, 2200: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.sleep = void 0;
        t.sleep = async (t2) => {
          await new Promise((e2) => {
            setTimeout(e2, t2);
          });
        };
      }, 2025: (e, t) => {
        var _a;
        Object.defineProperty(t, "__esModule", { value: true }), t.Config = void 0;
        t.Config = (_a = class {
        }, __publicField(_a, "config"), _a);
      }, 7268: (e, t) => {
        var _a;
        Object.defineProperty(t, "__esModule", { value: true }), t.Events = void 0;
        t.Events = (_a = class {
        }, __publicField(_a, "GenericEvent"), __publicField(_a, "BaseEvent"), __publicField(_a, "EventMessage"), __publicField(_a, "NetworkEvent"), __publicField(_a, "UserEvent"), __publicField(_a, "StateEvent"), __publicField(_a, "SignoutEvent"), _a);
      }, 9291: (e, t) => {
        var _a;
        Object.defineProperty(t, "__esModule", { value: true }), t.Models = void 0;
        t.Models = (_a = class {
        }, __publicField(_a, "Request"), __publicField(_a, "Response"), __publicField(_a, "FullResponse"), __publicField(_a, "IsConnectedRequest"), __publicField(_a, "IsLockedRequest"), __publicField(_a, "SignInRequest"), __publicField(_a, "IsOpenRequest"), __publicField(_a, "SignRequest"), __publicField(_a, "VersionRequest"), __publicField(_a, "NetworkRequest"), __publicField(_a, "UserRequest"), __publicField(_a, "AddressRequest"), __publicField(_a, "VerifyRequest"), __publicField(_a, "SignAndSubmitRequest"), __publicField(_a, "SubmitRequest"), __publicField(_a, "EncryptRequest"), __publicField(_a, "DecryptRequest"), __publicField(_a, "IsConnectedResponse"), __publicField(_a, "IsLockedResponse"), __publicField(_a, "SignInResponse"), __publicField(_a, "IsOpenResponse"), __publicField(_a, "SignResponse"), __publicField(_a, "VersionResponse"), __publicField(_a, "AddressResponse"), __publicField(_a, "NetworkResponse"), __publicField(_a, "UserResponse"), __publicField(_a, "VerifyResponse"), __publicField(_a, "SignAndSubmitResponse"), __publicField(_a, "SubmitResponse"), __publicField(_a, "IsConnectedFullResponse"), __publicField(_a, "IsLockedFullResponse"), __publicField(_a, "SignInFullResponse"), __publicField(_a, "IsOpenFullResponse"), __publicField(_a, "SignFullResponse"), __publicField(_a, "VersionFullResponse"), __publicField(_a, "AddressFullResponse"), __publicField(_a, "NetworkFullResponse"), __publicField(_a, "UserFullResponse"), __publicField(_a, "VerifyFullResponse"), __publicField(_a, "SignAndSubmitFullResponse"), __publicField(_a, "SubmitFullResponse"), __publicField(_a, "BulkSubmitRequest"), __publicField(_a, "BulkSignRequest"), __publicField(_a, "BulkSignAndSubmitRequest"), __publicField(_a, "BulkSubmitFullResponse"), __publicField(_a, "BulkSignFullResponse"), __publicField(_a, "BulkSignAndSubmitFullResponse"), __publicField(_a, "BulkSubmitResponse"), __publicField(_a, "BulkSignResponse"), __publicField(_a, "BulkSignAndSubmitResponse"), __publicField(_a, "EncryptResponse"), __publicField(_a, "EncryptFullResponse"), __publicField(_a, "DecryptResponse"), __publicField(_a, "DecryptFullResponse"), __publicField(_a, "SenderFullResponse"), __publicField(_a, "SenderRequest"), __publicField(_a, "SenderResponse"), __publicField(_a, "ManagerFullResponse"), __publicField(_a, "ManagerRequest"), __publicField(_a, "ManagerResponse"), __publicField(_a, "AllTransactionRequest"), __publicField(_a, "AllTransactionResponse"), __publicField(_a, "AllTransactionMetadata"), __publicField(_a, "AllTxResponse"), __publicField(_a, "AllSubmitResponse"), __publicField(_a, "AllTransactionStream"), __publicField(_a, "AllTransaction"), __publicField(_a, "AllFullTransaction"), __publicField(_a, "IndexedTransactionRequest"), __publicField(_a, "SignTransaction"), __publicField(_a, "SignOpts"), __publicField(_a, "CryptOpts"), __publicField(_a, "ExtendedSignOpts"), __publicField(_a, "Status"), _a);
      }, 4151: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.CatchAllEvent = t.TYPES = t.EVENTS = t.COMMANDS = t.Extension = void 0;
        class s {
        }
        __publicField(s, "CatchAllEvent");
        __publicField(s, "BasicUser");
        __publicField(s, "BasicNetwork");
        __publicField(s, "CleanExtMessage");
        __publicField(s, "CommResponse");
        __publicField(s, "CleanResponse");
        __publicField(s, "PostMessage");
        __publicField(s, "PortMessage");
        __publicField(s, "Payload");
        __publicField(s, "AppStatus");
        __publicField(s, "AllExtMessage");
        __publicField(s, "ExtMessage");
        __publicField(s, "RequestMessage");
        __publicField(s, "ResponseMessage");
        __publicField(s, "Targets");
        __publicField(s, "Events");
        __publicField(s, "Commands");
        __publicField(s, "Types");
        var r2, o2;
        t.Extension = s, r2 = s || (t.Extension = s = {}), (o2 = r2.TYPES || (r2.TYPES = {})).INIT = "init", o2.REFRESH = "refresh", o2.DISCONNECT = "disconnect", o2.PING = "ping", o2.REQUEST = "request", o2.RESPONSE = "response", o2.UPDATE = "update", o2.EVENT = "event", (o2 = r2.COMMANDS || (r2.COMMANDS = {})).VERSION = "version", o2.IS_CONNECTED = "isConnected", o2.IS_LOCKED = "isLocked", o2.OPEN = "open", o2.SIGN = "sign", o2.SIGNANDSUBMIT = "sign-and-submit", o2.BULKSUBMIT = "bulk-submit", o2.BULKSIGN = "bulk-sign", o2.BULK = "bulk", o2.SUBMIT = "submit", o2.MANAGER = "manager", o2.ADDRESS = "address", o2.NETWORK = "network", o2.USER = "user", o2.VERIFY = "verify", o2.SENDER = "sender", o2.CHANGENODE = "change-node", o2.CHANGEUSER = "change-user", o2.DECRYPT = "decrypt", o2.ENCRYPT = "encrypt", (o2 = r2.EVENTS || (r2.EVENTS = {})).ACCOUNTS_CHANGED = "accountsChanged", o2.CHAIN_CHANGED = "chainChanged", o2.CONNECT = "connect", o2.DISCONNECT = "disconnect", o2.MESSAGE = "message", o2.POPUP_MODE = "popup-mode", o2.STATE_UPDATE = "state-update", o2.NETWORK_CHANGE = "network-change", o2.USER_CHANGE = "user-change", o2.OPEN = "open", o2.CLOSE = "close", o2.PING = "ping", o2.SIGNIN = "signin", o2.SIGNOUT = "signout", o2.RESPONSE = "response", o2.ALL = "all", (o2 = r2.TARGETS || (r2.TARGETS = {})).CONTENT = "content", o2.BG = "bg", o2.POP = "pop", t.COMMANDS = s.COMMANDS, t.EVENTS = s.EVENTS, t.TYPES = s.TYPES, t.CatchAllEvent = s.CatchAllEvent;
      }, 9312: (e, t) => {
        var _a;
        Object.defineProperty(t, "__esModule", { value: true }), t.Types = void 0;
        t.Types = (_a = class {
        }, __publicField(_a, "AgreementsSchema"), __publicField(_a, "GeneralSchema"), __publicField(_a, "NetworkSchema"), __publicField(_a, "CardSchema"), __publicField(_a, "ContactSchema"), __publicField(_a, "ProfileSchema"), __publicField(_a, "SecuritySchema"), __publicField(_a, "StateSchema"), __publicField(_a, "UserSchema"), __publicField(_a, "AppSchema"), __publicField(_a, "PreferenceSchema"), __publicField(_a, "VaultSchema"), __publicField(_a, "MountedUserSchema"), __publicField(_a, "Blank"), _a);
      }, 7579: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, i = (Object.defineProperty(t, "__esModule", { value: true }), t.Types = void 0, i(s(9312)));
        class n {
        }
        __publicField(n, "Api", i);
        t.Types = n, s = n || (t.Types = n = {}), (i = s.TWCardColor || (s.TWCardColor = {})).color1 = "tw-bg-cardGradient1", i.color2 = "tw-bg-cardGradient2", i.color3 = "tw-bg-cardGradient3", i.color4 = "tw-bg-cardGradient4", i.color5 = "tw-bg-cardGradient5", i.color6 = "tw-bg-cardGradient6", i.color7 = "tw-bg-cardGradient7", i.color8 = "tw-bg-cardGradient8", i.color9 = "tw-bg-cardGradient9", i.color10 = "tw-bg-cardGradient10", (i = s.CardColor || (s.CardColor = {})).color1 = "color1", i.color2 = "color2", i.color3 = "color3", i.color4 = "color4", i.color5 = "color5", i.color6 = "color6", i.color7 = "color7", i.color8 = "color8", i.color9 = "color9", i.color10 = "color10", (i = s.NetworkTypes || (s.NetworkTypes = {})).main = "main", i.live = "live", i.test = "test", i.dev = "dev", i.hooks = "hooks", i.experimental = "experimental", i.sidechain = "sidechain", i.xls30 = "xls-30d", i.xls38 = "xls-38d", i.xahautest = "xahau-test", (i = s.Protocol || (s.Protocol = {})).xrpl = "XRPL", i.evm = "EVM", i.btc = "BTC", i.bsc = "BSC", i.ada = "ADA", i.sol = "SOL", i.usd = "USD", (i = s.XRPLExplorers || (s.XRPLExplorers = {})).bithomp = "bithomp", i.xrplorg = "xrpl.org", i.xrplf = "xrplf", i.xrpscan = "xrpscan", (s.EVMExplorers || (s.EVMExplorers = {})).evmSideChain = "evm-sidechain", s.networkColorMap = { [s.NetworkTypes.main]: "tw-bg-[#38DBFF]", [s.NetworkTypes.live]: "tw-bg-[#38FFDB]", [s.NetworkTypes.test]: "tw-bg-[#DE7EFF]", [s.NetworkTypes.dev]: "tw-bg-[#FFB648]", [s.NetworkTypes.experimental]: "tw-bg-[#FF7B9B]", [s.NetworkTypes.sidechain]: "tw-bg-[#7CFF99]", [s.NetworkTypes.xls30]: "tw-bg-[#FF9C7C]", [s.NetworkTypes.xls38]: "tw-bg-[#C34D27]", [s.NetworkTypes.hooks]: "tw-bg-[#CF4C27]", [s.NetworkTypes.xahautest]: "tw-bg-[#CF4C27]" }, s.BithompHost = { [s.NetworkTypes.main]: "https://bithomp.com/explorer", [s.NetworkTypes.test]: "https://test.bithomp.com/explorer", [s.NetworkTypes.dev]: "https://dev.bithomp.com/explorer", [s.NetworkTypes.xls30]: "https://amm.bithomp.com/explorer", [s.NetworkTypes.hooks]: "https://beta.bithomp.com/explorer", [s.NetworkTypes.live]: "https://bithomp.com/explorer", [s.NetworkTypes.experimental]: "", [s.NetworkTypes.sidechain]: "", [s.NetworkTypes.xls38]: "", [s.NetworkTypes.xahautest]: "https://test.xahauexplorer.com/explorer" }, s.XrplfHost = { [s.NetworkTypes.main]: "https://explorer.xrplf.org", [s.NetworkTypes.test]: "https://explorer-testnet.xrplf.org", [s.NetworkTypes.hooks]: "https://hooks-testnet-v3-explorer.xrpl-labs.com", [s.NetworkTypes.dev]: "", [s.NetworkTypes.xls30]: "", [s.NetworkTypes.live]: "", [s.NetworkTypes.experimental]: "", [s.NetworkTypes.sidechain]: "", [s.NetworkTypes.xls38]: "", [s.NetworkTypes.xahautest]: "https://explorer.xahau-test.net" }, s.XrplOrgHost = { [s.NetworkTypes.main]: "https://livenet.xrpl.org", [s.NetworkTypes.test]: "https://testnet.xrpl.org", [s.NetworkTypes.dev]: "https://devnet.xrpl.org", [s.NetworkTypes.xls30]: "", [s.NetworkTypes.hooks]: "", [s.NetworkTypes.live]: "", [s.NetworkTypes.experimental]: "", [s.NetworkTypes.sidechain]: "", [s.NetworkTypes.xls38]: "", [s.NetworkTypes.xahautest]: "" }, s.XRPScanHost = { [s.NetworkTypes.main]: "https://xrpscan.com", [s.NetworkTypes.test]: "", [s.NetworkTypes.dev]: "", [s.NetworkTypes.xls30]: "", [s.NetworkTypes.hooks]: "", [s.NetworkTypes.live]: "", [s.NetworkTypes.experimental]: "", [s.NetworkTypes.sidechain]: "", [s.NetworkTypes.xls38]: "", [s.NetworkTypes.xahautest]: "" }, s.EvmSideChainHost = { [s.NetworkTypes.dev]: "https://evm-sidechain.xrpl.org", [s.NetworkTypes.main]: "", [s.NetworkTypes.test]: "", [s.NetworkTypes.xls30]: "", [s.NetworkTypes.hooks]: "", [s.NetworkTypes.live]: "", [s.NetworkTypes.experimental]: "", [s.NetworkTypes.sidechain]: "", [s.NetworkTypes.xls38]: "", [s.NetworkTypes.xahautest]: "" }, s.ExplorerAddressPath = { [s.XRPLExplorers.bithomp]: "", [s.XRPLExplorers.xrplorg]: "/address", [s.XRPLExplorers.xrplf]: "", [s.XRPLExplorers.xrpscan]: "/account", [s.EVMExplorers.evmSideChain]: "/address" }, s.ExplorerTxPath = { [s.XRPLExplorers.bithomp]: "", [s.XRPLExplorers.xrplorg]: "/transactions", [s.XRPLExplorers.xrplf]: "/tx", [s.XRPLExplorers.xrpscan]: "/tx", [s.EVMExplorers.evmSideChain]: "/tx" }, s.availableProtocols = [s.Protocol.xrpl, s.Protocol.evm];
      }, 2083: (e, t, s) => {
        var _a;
        Object.defineProperty(t, "__esModule", { value: true }), t.Types = void 0;
        s(7579).Types.Api.Types;
        t.Types = (_a = class {
        }, __publicField(_a, "AgreementsSchema"), __publicField(_a, "GeneralSchema"), __publicField(_a, "NodeSchema"), __publicField(_a, "CardSchema"), __publicField(_a, "ContactSchema"), __publicField(_a, "ProfileSchema"), __publicField(_a, "SecuritySchema"), __publicField(_a, "StateSchema"), __publicField(_a, "UserSchema"), __publicField(_a, "AppSchema"), __publicField(_a, "PreferenceSchema"), __publicField(_a, "VaultSchema"), __publicField(_a, "MountedUserSchema"), __publicField(_a, "SecurityTypes"), __publicField(_a, "SecurityLevel"), __publicField(_a, "Blank"), _a);
      }, 4855: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Card = void 0;
        class s {
        }
        __publicField(s, "MappedAddresses");
        __publicField(s, "ThemeArray");
        __publicField(s, "Color");
        var r2, o2;
        t.Card = s, t = s || (t.Card = s = {}), (r2 = t.TWCardColor || (t.TWCardColor = {})).color1 = "tw-bg-cardGradient1", r2.color2 = "tw-bg-cardGradient2", r2.color3 = "tw-bg-cardGradient3", r2.color4 = "tw-bg-cardGradient4", r2.color5 = "tw-bg-cardGradient5", r2.color6 = "tw-bg-cardGradient6", r2.color7 = "tw-bg-cardGradient7", r2.color8 = "tw-bg-cardGradient8", r2.color9 = "tw-bg-cardGradient9", r2.color10 = "tw-bg-cardGradient10", (o2 = r2 = t.cardColorTheme || (t.cardColorTheme = {})).dark = "Dark", o2.light = "Light", t.cardColorBg = { [r2.light]: "tw-bg-black", [r2.dark]: "tw-bg-white" }, t.cardColorStroke = { [r2.light]: "tw-stroke-black", [r2.dark]: "tw-stroke-white" }, t.cardColorText = { [r2.light]: "tw-text-black", [r2.dark]: "tw-text-white" }, t.cardColorFill = { [r2.light]: "tw-fill-black", [r2.dark]: "tw-fill-white" }, (o2 = t.CardColor || (t.CardColor = {})).color1 = "color1", o2.color2 = "color2", o2.color3 = "color3", o2.color4 = "color4", o2.color5 = "color5", o2.color6 = "color6", o2.color7 = "color7", o2.color8 = "color8", o2.color9 = "color9", o2.color10 = "color10";
      }, 4284: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.AES_CBC = void 0;
        var r2 = s(6914);
        t.AES_CBC = class {
          constructor() {
            __publicField(this, "algo");
            __publicField(this, "type", r2.AlgoTypes.aes_cbc);
            __publicField(this, "iv");
            __publicField(this, "derivation");
            __publicField(this, "encrypt");
            __publicField(this, "decrypt");
          }
        };
      }, 410: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.AES_GCM = void 0;
        var r2 = s(6914);
        t.AES_GCM = class {
          constructor() {
            __publicField(this, "algo");
            __publicField(this, "type", r2.AlgoTypes.aes_gcm);
            __publicField(this, "iv");
            __publicField(this, "tag");
            __publicField(this, "derivation");
            __publicField(this, "encrypt");
            __publicField(this, "decrypt");
          }
        };
      }, 6914: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.AlgoTypes = void 0, t.AlgoTypes = { standard: "sha512", pbkdf2: "pbkdf2-sha512", aes_cbc: "aes-512-cbc", aes_gcm: "aes-512-gcm" };
      }, 2625: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Standard = t.PBKDF2 = t.AES_CBC = t.AES_GCM = void 0;
        var r2 = s(410), o2 = (Object.defineProperty(t, "AES_GCM", { enumerable: true, get: function() {
          return r2.AES_GCM;
        } }), s(4284)), i = (Object.defineProperty(t, "AES_CBC", { enumerable: true, get: function() {
          return o2.AES_CBC;
        } }), s(1055)), n = (Object.defineProperty(t, "PBKDF2", { enumerable: true, get: function() {
          return i.PBKDF2;
        } }), s(8633));
        Object.defineProperty(t, "Standard", { enumerable: true, get: function() {
          return n.Standard;
        } });
      }, 1055: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.PBKDF2 = void 0;
        var r2 = s(6914);
        t.PBKDF2 = class {
          constructor() {
            __publicField(this, "type", r2.AlgoTypes.pbkdf2);
            __publicField(this, "iterations");
            __publicField(this, "keylet");
            __publicField(this, "iv");
            __publicField(this, "encrypt");
          }
        };
      }, 8633: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Standard = void 0;
        var r2 = s(6914);
        t.Standard = class {
          constructor() {
            __publicField(this, "type", r2.AlgoTypes.standard);
            __publicField(this, "encrypt");
          }
        };
      }, 4575: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, n = (Object.defineProperty(t, "__esModule", { value: true }), t.Types = void 0, s(1437)), a = i(s(2083)), c = i(s(4855)), i = i(s(2789)), s = s(2164);
        class l {
        }
        __publicField(l, "AllNetworks", n.AllNetworks);
        __publicField(l, "AllNodeTypes", n.AllNetworks.AllNodeTypes);
        __publicField(l, "AllNodeExplorers", n.AllNetworks.AllNodeExplorers);
        __publicField(l, "AllProtocols", s.Protocols);
        __publicField(l, "Api", a);
        __publicField(l, "Card", c.Card);
        __publicField(l, "Security", i.Security);
        __publicField(l, "BasicNetwork");
        __publicField(l, "BasicUser");
        __publicField(l, "NodeTypes");
        __publicField(l, "NodeExplorers");
        __publicField(l, "Protocols");
        __publicField(l, "Networks");
        __publicField(l, "Icons");
        __publicField(l, "EncryptionTypes");
        __publicField(l, "EncryptTypes");
        __publicField(l, "CardEncryptionTypes");
        __publicField(l, "PasscodeEncryptionTypes");
        __publicField(l, "availableProtocols", [s.Protocols.xrpl, s.Protocols.evm]);
        __publicField(l, "NetworkIdentifiers", { [n.AllNetworks.NetworkLabels.xrpl]: n.AllNetworks.XrplLedger, [n.AllNetworks.NetworkLabels.xevm]: n.AllNetworks.Xevm, [n.AllNetworks.NetworkLabels.xahau]: n.AllNetworks.Xahau });
        t.Types = l;
      }, 8950: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.NetworkIcons = void 0, t.NetworkIcons = { xrpl: "/assets/chains/xrpl/info/logo.png", xevm: "/assets/chains/xevm/info/logo.jpg", xahau: "/assets/chains/xahau/info/logo.jpg" };
      }, 7782: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.NetworkLabels = void 0, t.NetworkLabels = { xrpl: "xrp ledger", xevm: "xevm sidechain", xahau: "xahau" };
      }, 1437: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.AllNetworks = void 0;
        var r2 = s(1396), o2 = s(1743), i = s(4942), n = s(8950), s = s(7782), a = r2.XahauNetwork.NetworkTypes, c = o2.XrplLedgerNetwork.NetworkTypes, l = i.XevmNetwork.NetworkTypes, p = r2.XahauNetwork.Explorers, d = o2.XrplLedgerNetwork.Explorers, u = i.XevmNetwork.Explorers;
        class h {
        }
        __publicField(h, "Xahau", r2.XahauNetwork);
        __publicField(h, "XrplLedger", o2.XrplLedgerNetwork);
        __publicField(h, "Xevm", i.XevmNetwork);
        __publicField(h, "AllNodeTypes", { xahau: a, xrpl: c, xevm: l });
        __publicField(h, "AllNodeExplorers", { xahauExpl: p, xrplExpl: d, xevmExpl: u });
        __publicField(h, "NetworkLabels", s.NetworkLabels);
        __publicField(h, "NetworkIcons", n.NetworkIcons);
        t.AllNetworks = h;
      }, 1396: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.XahauNetwork = void 0;
        var r2, o2 = s(2164), i = s(8950), s = s(7782);
        class n {
        }
        __publicField(n, "protocol", o2.Protocols.xrpl);
        __publicField(n, "Types");
        __publicField(n, "label", s.NetworkLabels.xahau);
        __publicField(n, "icon", i.NetworkIcons.xahau);
        __publicField(n, "asset", "XAH");
        __publicField(n, "active", true);
        __publicField(n, "defaultReserves", { base: "1", inc: "0.2" });
        t.XahauNetwork = n, r2 = n || (t.XahauNetwork = n = {}), (o2 = r2.NetworkTypes || (r2.NetworkTypes = {})).mainnet = "mainnet", o2.testnet = "testnet", o2.devnet = "devnet", (o2 = r2.Explorers || (r2.Explorers = {})).bithomp = "bithomp", o2.xrplf = "xrplf", o2.xrplorg = "xrpl.org", r2.colors = { [r2.NetworkTypes.mainnet]: "tw-bg-[#38DBFF]", [r2.NetworkTypes.devnet]: "tw-bg-[#38FFDB]", [r2.NetworkTypes.testnet]: "tw-bg-[#DE7EFF]" }, r2.BithompHost = { [r2.NetworkTypes.mainnet]: "https://xahauexplorer.com", [r2.NetworkTypes.testnet]: "https://test.xahauexplorer.com", [r2.NetworkTypes.devnet]: "" }, r2.XrplfHost = { [r2.NetworkTypes.mainnet]: "https://explorer.xahau.network", [r2.NetworkTypes.testnet]: "https://explorer.xahau-test.net", [r2.NetworkTypes.devnet]: "" }, r2.XrplOrgHost = { [r2.NetworkTypes.mainnet]: "https://xahau.xrpl.org", [r2.NetworkTypes.testnet]: "https://xahau-testnet.xrpl.org", [r2.NetworkTypes.devnet]: "" }, r2.Hosts = { [r2.Explorers.bithomp]: r2.BithompHost, [r2.Explorers.xrplf]: r2.XrplfHost, [r2.Explorers.xrplorg]: r2.XrplOrgHost }, r2.ExplorerAddressPath = { [r2.Explorers.bithomp]: "", [r2.Explorers.xrplf]: "/address", [r2.Explorers.xrplorg]: "/accounts" }, r2.ExplorerTxPath = { [r2.Explorers.bithomp]: "", [r2.Explorers.xrplf]: "/tx", [r2.Explorers.xrplorg]: "/transactions" }, r2.getExplorerHost = (e2, t2) => e2 === r2.Explorers.bithomp ? r2.BithompHost[t2] : e2 === r2.Explorers.xrplf ? r2.XrplfHost[t2] : e2 === r2.Explorers.xrplorg ? r2.XrplOrgHost[t2] : void 0, r2.getExplorerPath = (e2, t2) => "address" === t2 ? r2.ExplorerAddressPath[e2] : "tx" === t2 ? r2.ExplorerTxPath[e2] : void 0;
      }, 4942: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.XevmNetwork = void 0;
        var r2, o2 = s(2164), i = s(8950), s = s(7782);
        class n {
        }
        __publicField(n, "protocol", o2.Protocols.evm);
        __publicField(n, "Types");
        __publicField(n, "label", s.NetworkLabels.xevm);
        __publicField(n, "icon", i.NetworkIcons.xevm);
        __publicField(n, "asset", "EXRP");
        __publicField(n, "active", false);
        __publicField(n, "defaultReserves", { base: "0", inc: "0" });
        t.XevmNetwork = n, r2 = n || (t.XevmNetwork = n = {}), (o2 = r2.NetworkTypes || (r2.NetworkTypes = {})).mainnet = "mainnet", o2.testnet = "testnet", o2.devnet = "devnet", (r2.Explorers || (r2.Explorers = {})).peersyst = "peersyst", r2.colors = { [r2.NetworkTypes.mainnet]: "tw-bg-[#38DBFF]", [r2.NetworkTypes.testnet]: "tw-bg-[#DE7EFF]", [r2.NetworkTypes.devnet]: "tw-bg-[#FFB648]" }, r2.PeersysHost = { [r2.NetworkTypes.mainnet]: "", [r2.NetworkTypes.testnet]: "", [r2.NetworkTypes.devnet]: "https://evm-sidechain.xrpl.org" }, r2.Hosts = { [r2.Explorers.peersyst]: r2.PeersysHost }, r2.ExplorerAddressPath = { [r2.Explorers.peersyst]: "/address" }, r2.ExplorerTxPath = { [r2.Explorers.peersyst]: "/tx" }, r2.getExplorerHost = (e2, t2) => {
          if (e2 === r2.Explorers.peersyst) return r2.PeersysHost[t2];
        }, r2.getExplorerPath = (e2, t2) => "address" === t2 ? r2.ExplorerAddressPath[e2] : "tx" === t2 ? r2.ExplorerTxPath[e2] : void 0;
      }, 1743: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.XrplLedgerNetwork = void 0;
        var r2, o2 = s(2164), i = s(8950), s = s(7782);
        class n {
        }
        __publicField(n, "protocol", o2.Protocols.xrpl);
        __publicField(n, "Types");
        __publicField(n, "label", s.NetworkLabels.xrpl);
        __publicField(n, "icon", i.NetworkIcons.xrpl);
        __publicField(n, "asset", "XRP");
        __publicField(n, "active", true);
        __publicField(n, "defaultReserves", { base: "10", inc: "2" });
        t.XrplLedgerNetwork = n, r2 = n || (t.XrplLedgerNetwork = n = {}), (o2 = r2.NetworkTypes || (r2.NetworkTypes = {})).mainnet = "mainnet", o2.testnet = "testnet", o2.devnet = "devnet", o2.xls30d = "xls30d", o2.xls38d = "xls38d", (o2 = r2.Explorers || (r2.Explorers = {})).bithomp = "bithomp", o2.xrplorg = "xrpl.org", o2.xrplf = "xrplf", o2.xrpscan = "xrpscan", r2.colors = { [r2.NetworkTypes.mainnet]: "tw-bg-[#38DBFF]", [r2.NetworkTypes.testnet]: "tw-bg-[#DE7EFF]", [r2.NetworkTypes.devnet]: "tw-bg-[#FFB648]", [r2.NetworkTypes.xls30d]: "tw-bg-[#FF9C7C]", [r2.NetworkTypes.xls38d]: "tw-bg-[#C34D27]" }, r2.BithompHost = { [r2.NetworkTypes.mainnet]: "https://bithomp.com/explorer", [r2.NetworkTypes.testnet]: "https://test.bithomp.com/explorer", [r2.NetworkTypes.devnet]: "https://dev.bithomp.com/explorer", [r2.NetworkTypes.xls30d]: "https://amm.bithomp.com/explorer", [r2.NetworkTypes.xls38d]: "" }, r2.XrplfHost = { [r2.NetworkTypes.mainnet]: "https://explorer.xrplf.org", [r2.NetworkTypes.testnet]: "https://explorer-testnet.xrplf.org", [r2.NetworkTypes.devnet]: "", [r2.NetworkTypes.xls30d]: "", [r2.NetworkTypes.xls38d]: "" }, r2.XrplOrgHost = { [r2.NetworkTypes.mainnet]: "https://livenet.xrpl.org", [r2.NetworkTypes.testnet]: "https://testnet.xrpl.org", [r2.NetworkTypes.devnet]: "https://devnet.xrpl.org", [r2.NetworkTypes.xls30d]: "", [r2.NetworkTypes.xls38d]: "" }, r2.XRPScanHost = { [r2.NetworkTypes.mainnet]: "https://xrpscan.com", [r2.NetworkTypes.testnet]: "", [r2.NetworkTypes.devnet]: "", [r2.NetworkTypes.xls30d]: "", [r2.NetworkTypes.xls38d]: "" }, r2.Hosts = { [r2.Explorers.bithomp]: r2.BithompHost, [r2.Explorers.xrplf]: r2.XrplfHost, [r2.Explorers.xrplorg]: r2.XrplOrgHost, [r2.Explorers.xrpscan]: r2.XRPScanHost }, r2.ExplorerAddressPath = { [r2.Explorers.bithomp]: "", [r2.Explorers.xrplorg]: "/address", [r2.Explorers.xrplf]: "", [r2.Explorers.xrpscan]: "/account" }, r2.ExplorerTxPath = { [r2.Explorers.bithomp]: "", [r2.Explorers.xrplorg]: "/transactions", [r2.Explorers.xrplf]: "/tx", [r2.Explorers.xrpscan]: "/tx" }, r2.getExplorerHost = (e2, t2) => e2 === r2.Explorers.bithomp ? r2.BithompHost[t2] : e2 === r2.Explorers.xrplf ? r2.XrplfHost[t2] : e2 === r2.Explorers.xrplorg ? r2.XrplOrgHost[t2] : e2 === r2.Explorers.xrpscan ? r2.XRPScanHost[t2] : void 0, r2.getExplorerPath = (e2, t2) => "address" === t2 ? r2.ExplorerAddressPath[e2] : "tx" === t2 ? r2.ExplorerTxPath[e2] : void 0;
      }, 2164: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Protocols = void 0, t.Protocols = { xrpl: "XRPL", evm: "EVM", btc: "BTC", bsc: "BSC", ada: "ADA", sol: "SOL", usd: "USD" };
      }, 2789: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Security = void 0;
        const r2 = s(2625);
        class o2 {
        }
        __publicField(o2, "EncryptTypes");
        __publicField(o2, "AlgoTypes", s(6914).AlgoTypes);
        ((t.Security = o2) || (t.Security = o2 = {})).AllEncryptionTypes = { AES_CBC: r2.AES_CBC, AES_GCM: r2.AES_GCM, PBKDF2: r2.PBKDF2, Standard: r2.Standard };
      }, 7083: (e, t, s) => {
        var _a;
        Object.defineProperty(t, "__esModule", { value: true }), t.Types = void 0;
        s(4575).Types.Api.Types;
        t.Types = (_a = class {
        }, __publicField(_a, "AgreementsSchema"), __publicField(_a, "GeneralSchema"), __publicField(_a, "NodeSchema"), __publicField(_a, "CardSchema"), __publicField(_a, "ContactSchema"), __publicField(_a, "ProfileSchema"), __publicField(_a, "SecuritySchema"), __publicField(_a, "StateSchema"), __publicField(_a, "UserSchema"), __publicField(_a, "AppSchema"), __publicField(_a, "PreferenceSchema"), __publicField(_a, "VaultSchema"), __publicField(_a, "MountedUserSchema"), __publicField(_a, "SecurityTypes"), __publicField(_a, "SecurityLevel"), __publicField(_a, "Blank"), _a);
      }, 191: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Apps = void 0;
        class s {
        }
        __publicField(s, "AppTitle");
        __publicField(s, "AppTypes");
        t.Apps = s, (t = (t = s || (t.Apps = s = {})).titles || (t.titles = {})).crossmark = "crossmark", t.embark = "embark";
      }, 5659: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, n = (Object.defineProperty(t, "__esModule", { value: true }), t.Projects = t.BasicUser = t.BasicNetwork = t.Types = void 0, s(1437)), a = i(s(7083)), c = i(s(4855)), l = i(s(2789)), p = i(s(8084)), i = i(s(191)), s = s(2164);
        class d {
        }
        __publicField(d, "AllNetworks", n.AllNetworks);
        __publicField(d, "AllNodeTypes", n.AllNetworks.AllNodeTypes);
        __publicField(d, "AllNodeExplorers", n.AllNetworks.AllNodeExplorers);
        __publicField(d, "Themes", p);
        __publicField(d, "Apps", i);
        __publicField(d, "AllProtocols", s.Protocols);
        __publicField(d, "Api", a);
        __publicField(d, "Card", c.Card);
        __publicField(d, "Security", l.Security);
        __publicField(d, "BasicNetwork");
        __publicField(d, "BasicUser");
        __publicField(d, "NodeTypes");
        __publicField(d, "NodeExplorers");
        __publicField(d, "Protocols");
        __publicField(d, "Networks");
        __publicField(d, "Icons");
        __publicField(d, "EncryptionTypes");
        __publicField(d, "EncryptTypes");
        __publicField(d, "CardEncryptionTypes");
        __publicField(d, "PasscodeEncryptionTypes");
        __publicField(d, "availableProtocols", [s.Protocols.xrpl, s.Protocols.evm]);
        __publicField(d, "NetworkIdentifiers", { [n.AllNetworks.NetworkLabels.xrpl]: n.AllNetworks.XrplLedger, [n.AllNetworks.NetworkLabels.xevm]: n.AllNetworks.Xevm, [n.AllNetworks.NetworkLabels.xahau]: n.AllNetworks.Xahau });
        t.Types = d, t.BasicNetwork = d.BasicNetwork, t.BasicUser = d.BasicUser, t.Projects = i.Apps;
      }, 8084: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Themes = void 0;
        const r2 = s(191);
        class o2 {
        }
        __publicField(o2, "ThemeTypes");
        var i;
        t.Themes = o2, s = o2 || (t.Themes = o2 = {}), (i = t = s.availableThemes || (s.availableThemes = {})).theme1 = "theme1", i.theme2 = "theme2", i.theme3 = "theme3", i.theme4 = "theme4", i.theme5 = "theme5", i.theme6 = "theme6", s.DefaultThemes = { [r2.Apps.titles.crossmark]: t.theme1, [r2.Apps.titles.embark]: t.theme6 }, s.CrossmarkThemeKey = { [t.theme1]: "light", [t.theme2]: "dark", [t.theme3]: "moon", [t.theme4]: "sun", [t.theme5]: "blueberry", [t.theme6]: "treeberry" }, s.EmbarkThemeKey = { [t.theme1]: "", [t.theme2]: "", [t.theme3]: "", [t.theme4]: "", [t.theme5]: "", [t.theme6]: "treeberry" }, s.ThemeKey = { [r2.Apps.titles.crossmark]: s.CrossmarkThemeKey, [r2.Apps.titles.embark]: s.EmbarkThemeKey }, s.ToastColor = { [t.theme1]: "light", [t.theme2]: "dark", [t.theme3]: "light", [t.theme4]: "light", [t.theme5]: "dark", [t.theme6]: "dark" }, s.SpinnerColor = { [t.theme1]: "black", [t.theme2]: "white", [t.theme3]: "black", [t.theme4]: "black", [t.theme5]: "light", [t.theme6]: "light" };
      }, 2876: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, i = (Object.defineProperty(t, "__esModule", { value: true }), t.Types = void 0, i(s(4080))), s = s(5659).Types.Api.Types;
        class n {
        }
        __publicField(n, "AgreementsSchema");
        __publicField(n, "GeneralSchema");
        __publicField(n, "NodeSchema");
        __publicField(n, "ContactSchema");
        __publicField(n, "ProfileSchema");
        __publicField(n, "AppSchema");
        __publicField(n, "PreferenceSchema");
        __publicField(n, "VaultSchema");
        __publicField(n, "CardSchema");
        __publicField(n, "StateSchema");
        __publicField(n, "SecuritySchema");
        __publicField(n, "UserSchema");
        __publicField(n, "MountedUserSchema");
        __publicField(n, "SecurityTypes", i);
        __publicField(n, "SecurityLevel", s.SecurityLevel);
        __publicField(n, "Blank");
        t.Types = n;
      }, 43: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Apps = void 0;
        class s {
        }
        __publicField(s, "AppTitle");
        __publicField(s, "AppTypes");
        t.Apps = s, (t = (t = s || (t.Apps = s = {})).titles || (t.titles = {})).crossmark = "crossmark", t.embark = "embark";
      }, 9455: (e, t) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Index = void 0;
        t.Index = class {
          constructor() {
            __publicField(this, "algo");
            __publicField(this, "type");
            __publicField(this, "opts");
          }
        };
      }, 3710: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.HashTypes = t.AesTypes = t.Standard = t.Pbkdf2 = t.hash = t.aes = void 0;
        var r2 = s(9455);
        Object.defineProperty(t, "aes", { enumerable: true, get: function() {
          return r2.Index;
        } });
        const o2 = s(1261), i = (Object.defineProperty(t, "Standard", { enumerable: true, get: function() {
          return o2.Index;
        } }), s(4483));
        Object.defineProperty(t, "Pbkdf2", { enumerable: true, get: function() {
          return i.Index;
        } }), t.hash = { Pbkdf2: i.Index, Standard: o2.Index }, t.AesTypes = { cbc: "aes-cbc", gcm: "aes-gcm", ctr: "aes-ctr", cfb: "aes-cfb", ecb: "aes-ecb", ofb: "aes-ofb" }, t.HashTypes = { standard: "hmac256", pbkdf2: "pbkdf2" };
      }, 4483: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Index = void 0;
        var r2 = s(3710);
        t.Index = class {
          constructor() {
            __publicField(this, "type", r2.HashTypes.pbkdf2);
            __publicField(this, "opts");
            __publicField(this, "make");
          }
        };
      }, 1261: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Index = void 0;
        var r2 = s(3710);
        t.Index = class {
          constructor() {
            __publicField(this, "type", r2.HashTypes.standard);
            __publicField(this, "make");
          }
        };
      }, 5541: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, n = (Object.defineProperty(t, "__esModule", { value: true }), t.AllHashTypes = t.AllEncryptionTypes = t.Projects = t.BasicUser = t.BasicNetwork = t.Types = void 0, s(1437)), a = i(s(2876)), c = i(s(4855)), l = i(s(4080)), p = i(s(2897)), i = i(s(43)), s = s(2164);
        class d {
        }
        __publicField(d, "AllNetworks", n.AllNetworks);
        __publicField(d, "AllNodeTypes", n.AllNetworks.AllNodeTypes);
        __publicField(d, "AllNodeExplorers", n.AllNetworks.AllNodeExplorers);
        __publicField(d, "Themes", p);
        __publicField(d, "Apps", i);
        __publicField(d, "AllProtocols", s.Protocols);
        __publicField(d, "Api", a);
        __publicField(d, "Card", c.Card);
        __publicField(d, "Security", l);
        __publicField(d, "BasicNetwork");
        __publicField(d, "BasicUser");
        __publicField(d, "NodeTypes");
        __publicField(d, "NodeExplorers");
        __publicField(d, "Protocols");
        __publicField(d, "Networks");
        __publicField(d, "Icons");
        __publicField(d, "EncryptionTypes");
        __publicField(d, "EncryptTypes");
        __publicField(d, "HashTypes");
        __publicField(d, "CardEncryptionTypes");
        __publicField(d, "PasscodeHashTypes");
        __publicField(d, "availableProtocols", [s.Protocols.xrpl, s.Protocols.evm]);
        __publicField(d, "NetworkIdentifiers", { [n.AllNetworks.NetworkLabels.xrpl]: n.AllNetworks.XrplLedger, [n.AllNetworks.NetworkLabels.xevm]: n.AllNetworks.Xevm, [n.AllNetworks.NetworkLabels.xahau]: n.AllNetworks.Xahau });
        t.Types = d, t.BasicNetwork = d.BasicNetwork, t.BasicUser = d.BasicUser, t.Projects = i.Apps, t.AllEncryptionTypes = l.AllEncryptionTypes, t.AllHashTypes = l.AllHashTypes;
      }, 4080: function(e, t, s) {
        var r2 = this && this.__createBinding || (Object.create ? function(e2, t2, s2, r3) {
          void 0 === r3 && (r3 = s2);
          var o3 = Object.getOwnPropertyDescriptor(t2, s2);
          o3 && ("get" in o3 ? t2.__esModule : !o3.writable && !o3.configurable) || (o3 = { enumerable: true, get: function() {
            return t2[s2];
          } }), Object.defineProperty(e2, r3, o3);
        } : function(e2, t2, s2, r3) {
          e2[r3 = void 0 === r3 ? s2 : r3] = t2[s2];
        }), o2 = this && this.__setModuleDefault || (Object.create ? function(e2, t2) {
          Object.defineProperty(e2, "default", { enumerable: true, value: t2 });
        } : function(e2, t2) {
          e2.default = t2;
        }), i = this && this.__importStar || function(e2) {
          if (e2 && e2.__esModule) return e2;
          var t2 = {};
          if (null != e2) for (var s2 in e2) "default" !== s2 && Object.prototype.hasOwnProperty.call(e2, s2) && r2(t2, e2, s2);
          return o2(t2, e2), t2;
        }, i = (Object.defineProperty(t, "__esModule", { value: true }), t.AllHashTypes = t.AllEncryptionTypes = void 0, i(s(3710)));
        t.AllEncryptionTypes = { AES_CBC: i.AesTypes.cbc, AES_GCM: i.AesTypes.gcm, AES_CTR: i.AesTypes.ctr, AES_ECB: i.AesTypes.ecb, AES_OFB: i.AesTypes.ofb, AES_CFB: i.AesTypes.cfb }, t.AllHashTypes = { PBKDF2: i.HashTypes.pbkdf2, Standard: i.HashTypes.standard };
      }, 2897: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.Themes = void 0;
        const r2 = s(43);
        class o2 {
        }
        __publicField(o2, "ThemeTypes");
        var i;
        t.Themes = o2, s = o2 || (t.Themes = o2 = {}), (i = t = s.availableThemes || (s.availableThemes = {})).theme1 = "theme1", i.theme2 = "theme2", i.theme3 = "theme3", i.theme4 = "theme4", i.theme5 = "theme5", i.theme6 = "theme6", s.DefaultThemes = { [r2.Apps.titles.crossmark]: t.theme1, [r2.Apps.titles.embark]: t.theme6 }, s.CrossmarkThemeKey = { [t.theme1]: "light", [t.theme2]: "dark", [t.theme3]: "moon", [t.theme4]: "sun", [t.theme5]: "blueberry", [t.theme6]: "treeberry" }, s.EmbarkThemeKey = { [t.theme1]: "", [t.theme2]: "", [t.theme3]: "", [t.theme4]: "", [t.theme5]: "", [t.theme6]: "treeberry" }, s.ThemeKey = { [r2.Apps.titles.crossmark]: s.CrossmarkThemeKey, [r2.Apps.titles.embark]: s.EmbarkThemeKey }, s.ToastColor = { [t.theme1]: "light", [t.theme2]: "dark", [t.theme3]: "light", [t.theme4]: "light", [t.theme5]: "dark", [t.theme6]: "dark" }, s.SpinnerColor = { [t.theme1]: "black", [t.theme2]: "white", [t.theme3]: "black", [t.theme4]: "black", [t.theme5]: "light", [t.theme6]: "light" };
      }, 9815: (e, t, s) => {
        Object.defineProperty(t, "__esModule", { value: true }), t.HashTypes = t.EncryptionAlgos = t.Projects = t.BasicUser = t.BasicNetwork = t.CatchAllEvent = t.TYPES = t.COMMANDS = t.EVENTS = t.Events = t.Models = t.Config = void 0;
        var r2 = s(2025), o2 = (Object.defineProperty(t, "Config", { enumerable: true, get: function() {
          return r2.Config;
        } }), s(9291)), i = (Object.defineProperty(t, "Models", { enumerable: true, get: function() {
          return o2.Models;
        } }), s(7268)), n = (Object.defineProperty(t, "Events", { enumerable: true, get: function() {
          return i.Events;
        } }), s(4151)), a = (Object.defineProperty(t, "EVENTS", { enumerable: true, get: function() {
          return n.EVENTS;
        } }), Object.defineProperty(t, "COMMANDS", { enumerable: true, get: function() {
          return n.COMMANDS;
        } }), Object.defineProperty(t, "TYPES", { enumerable: true, get: function() {
          return n.TYPES;
        } }), Object.defineProperty(t, "CatchAllEvent", { enumerable: true, get: function() {
          return n.CatchAllEvent;
        } }), s(5541));
        Object.defineProperty(t, "BasicNetwork", { enumerable: true, get: function() {
          return a.BasicNetwork;
        } }), Object.defineProperty(t, "BasicUser", { enumerable: true, get: function() {
          return a.BasicUser;
        } }), Object.defineProperty(t, "Projects", { enumerable: true, get: function() {
          return a.Projects;
        } }), Object.defineProperty(t, "EncryptionAlgos", { enumerable: true, get: function() {
          return a.AllEncryptionTypes;
        } }), Object.defineProperty(t, "HashTypes", { enumerable: true, get: function() {
          return a.AllHashTypes;
        } });
      } }, o = {};
      return function e(t) {
        var s = o[t];
        return void 0 === s && (s = o[t] = { exports: {} }, r[t].call(s.exports, s, s.exports, e)), s.exports;
      }(4240);
    })());
  }
});
export default require_umd();
//# sourceMappingURL=@crossmarkio_sdk.js.map

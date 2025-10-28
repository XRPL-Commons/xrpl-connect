import {
  __commonJS
} from "./chunk-V46ELZXU.js";

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/errors/errors.constant.js
var require_errors_constant = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/errors/errors.constant.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.API_ERROR_BAD_REQUEST = void 0;
    exports.API_ERROR_BAD_REQUEST = "gem_BAD_REQUEST";
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/event/event.types.js
var require_event_types = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/event/event.types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/message/message.constant.js
var require_message_constant = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/message/message.constant.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MSG_INTERNAL_RECEIVE_SIGN_OUT = exports.MSG_INTERNAL_RECEIVE_PASSWORD = exports.MSG_INTERNAL_REQUEST_PASSWORD = void 0;
    exports.MSG_INTERNAL_REQUEST_PASSWORD = "INTERNAL_REQUEST_PASSWORD";
    exports.MSG_INTERNAL_RECEIVE_PASSWORD = "INTERNAL_RECEIVE_PASSWORD";
    exports.MSG_INTERNAL_RECEIVE_SIGN_OUT = "INTERNAL_RECEIVE_SIGN_OUT";
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/message/message.types.js
var require_message_types = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/message/message.types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/network/network.constant.js
var require_network_constant = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/network/network.constant.js"(exports) {
    "use strict";
    var __spreadArray = exports && exports.__spreadArray || function(to, from, pack) {
      if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
      return to.concat(ar || Array.prototype.slice.call(from));
    };
    var _a;
    var _b;
    var _c;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getNetworkByNetworkID = exports.getNetwork = exports.getDefaultNetwork = exports.NETWORK = exports.FAUCET_XAHAU_TESTNET = exports.XAHAU_TESTNET_NODES = exports.XAHAU_MAINNET_NODES = exports.DEVNET_NODES = exports.TESTNET_NODES = exports.MAINNET_NODES = exports.MAINNET_CLIO_NODES = exports.XahauNetwork = exports.XRPLNetwork = exports.Chain = void 0;
    var Chain;
    (function(Chain2) {
      Chain2["XRPL"] = "XRPL";
      Chain2["XAHAU"] = "XAHAU";
    })(Chain || (exports.Chain = Chain = {}));
    var XRPLNetwork;
    (function(XRPLNetwork2) {
      XRPLNetwork2["MAINNET"] = "Mainnet";
      XRPLNetwork2["TESTNET"] = "Testnet";
      XRPLNetwork2["DEVNET"] = "Devnet";
      XRPLNetwork2["CUSTOM"] = "Custom";
    })(XRPLNetwork || (exports.XRPLNetwork = XRPLNetwork = {}));
    var XahauNetwork;
    (function(XahauNetwork2) {
      XahauNetwork2["XAHAU_MAINNET"] = "Mainnet";
      XahauNetwork2["XAHAU_TESTNET"] = "Testnet";
      XahauNetwork2["CUSTOM"] = "Custom";
    })(XahauNetwork || (exports.XahauNetwork = XahauNetwork = {}));
    exports.MAINNET_CLIO_NODES = ["wss://s1.ripple.com", "wss://s2.ripple.com"];
    exports.MAINNET_NODES = __spreadArray(["wss://xrplcluster.com"], exports.MAINNET_CLIO_NODES, true);
    exports.TESTNET_NODES = ["wss://s.altnet.rippletest.net:51233", "wss://testnet.xrpl-labs.com"];
    exports.DEVNET_NODES = ["wss://s.devnet.rippletest.net:51233"];
    exports.XAHAU_MAINNET_NODES = ["wss://xahau.network"];
    exports.XAHAU_TESTNET_NODES = ["wss://xahau-test.net"];
    exports.FAUCET_XAHAU_TESTNET = "https://xahau-test.net/accounts";
    exports.NETWORK = (_a = {}, _a[Chain.XRPL] = (_b = {}, _b[XRPLNetwork.MAINNET] = {
      chain: Chain.XRPL,
      name: XRPLNetwork.MAINNET,
      server: exports.MAINNET_NODES[0],
      nodes: exports.MAINNET_NODES,
      description: "Main network using the production version of the XRP Ledger.",
      networkID: 0
    }, _b[XRPLNetwork.TESTNET] = {
      chain: Chain.XRPL,
      name: XRPLNetwork.TESTNET,
      server: exports.TESTNET_NODES[0],
      nodes: exports.TESTNET_NODES,
      description: "Acts as a testing network, without impacting production users and risking real money.",
      networkID: 1
    }, _b[XRPLNetwork.DEVNET] = {
      chain: Chain.XRPL,
      name: XRPLNetwork.DEVNET,
      server: exports.DEVNET_NODES[0],
      nodes: exports.DEVNET_NODES,
      description: "A preview of upcoming features, where unstable changes are tested out."
    }, _b[XRPLNetwork.CUSTOM] = {
      chain: Chain.XRPL,
      name: XRPLNetwork.CUSTOM,
      server: "",
      description: "Custom network configuration provided by the user."
    }, _b), _a[Chain.XAHAU] = (_c = {}, _c[XahauNetwork.XAHAU_MAINNET] = {
      chain: Chain.XAHAU,
      name: XahauNetwork.XAHAU_MAINNET,
      server: exports.XAHAU_MAINNET_NODES[0],
      nodes: exports.XAHAU_MAINNET_NODES,
      description: "Mainnet for the Xahau blockchain.",
      networkID: 21337
    }, _c[XahauNetwork.XAHAU_TESTNET] = {
      chain: Chain.XAHAU,
      name: XahauNetwork.XAHAU_TESTNET,
      server: exports.XAHAU_TESTNET_NODES[0],
      nodes: exports.XAHAU_TESTNET_NODES,
      description: "Testnet for the Xahau blockchain.",
      networkID: 21338
    }, _c[XahauNetwork.CUSTOM] = {
      chain: Chain.XAHAU,
      name: XahauNetwork.CUSTOM,
      server: "",
      description: "Custom network configuration provided by the user."
    }, _c), _a);
    var getDefaultNetwork = function(chain) {
      switch (chain) {
        case Chain.XAHAU:
          return XahauNetwork.XAHAU_MAINNET;
        default:
          return XRPLNetwork.MAINNET;
      }
    };
    exports.getDefaultNetwork = getDefaultNetwork;
    function getNetwork(chain, network) {
      if (chain === Chain.XRPL && Object.values(XRPLNetwork).includes(network)) {
        return exports.NETWORK[chain][network];
      }
      if (chain === Chain.XAHAU && Object.values(XahauNetwork).includes(network)) {
        return exports.NETWORK[chain][network];
      }
      throw new Error("Network ".concat(network, " is not valid for chain ").concat(chain));
    }
    exports.getNetwork = getNetwork;
    var getNetworkByNetworkID = function(networkID) {
      switch (networkID) {
        case 0:
          return exports.NETWORK[Chain.XRPL][XRPLNetwork.MAINNET];
        case 1:
          return exports.NETWORK[Chain.XRPL][XRPLNetwork.TESTNET];
        case 21337:
          return exports.NETWORK[Chain.XAHAU][XahauNetwork.XAHAU_MAINNET];
        case 21338:
          return exports.NETWORK[Chain.XAHAU][XahauNetwork.XAHAU_TESTNET];
        default:
          throw new Error("Network ID ".concat(networkID, " is not valid"));
      }
    };
    exports.getNetworkByNetworkID = getNetworkByNetworkID;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/global/global.constant.js
var require_global_constant = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/global/global.constant.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GEM_WALLET = void 0;
    exports.GEM_WALLET = "gem-wallet";
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/payload/payload.types.js
var require_payload_types = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/payload/payload.types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DEFAULT_SUBMIT_TX_BULK_ON_ERROR = void 0;
    exports.DEFAULT_SUBMIT_TX_BULK_ON_ERROR = "abort";
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/xrpl/basic.types.js
var require_basic_types = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/xrpl/basic.types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/xrpl/hooks.types.js
var require_hooks_types = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/xrpl/hooks.types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/xrpl/nft.types.js
var require_nft_types = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/xrpl/nft.types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/index.js
var require_constants = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/_constants/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_errors_constant(), exports);
    __exportStar(require_event_types(), exports);
    __exportStar(require_message_constant(), exports);
    __exportStar(require_message_types(), exports);
    __exportStar(require_network_constant(), exports);
    __exportStar(require_global_constant(), exports);
    __exportStar(require_payload_types(), exports);
    __exportStar(require_basic_types(), exports);
    __exportStar(require_hooks_types(), exports);
    __exportStar(require_nft_types(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/helpers/errors.js
var require_errors = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/helpers/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.deserializeError = void 0;
    var deserializeError = function(error) {
      var e = new Error(error.message);
      e.stack = error.stack;
      e.name = error.name;
      return e;
    };
    exports.deserializeError = deserializeError;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/helpers/extensionMessaging.js
var require_extensionMessaging = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/helpers/extensionMessaging.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sendMessageToContentScript = void 0;
    var sendMessageToContentScript = function(msg) {
      var messageId = Date.now() + Math.random();
      window.postMessage(__assign({ source: "GEM_WALLET_MSG_REQUEST", messageId }, msg), window.location.origin);
      return new Promise(function(resolve, reject) {
        if (!window.gemWallet && msg.type !== "REQUEST_IS_INSTALLED/V3") {
          reject(new Error("Please check if GemWallet is installed - GemWallet needs to be installed: https://gemwallet.app"));
        }
        var messageListener = function(event) {
          var _a, _b;
          if (event.source !== window)
            return;
          if (((_a = event === null || event === void 0 ? void 0 : event.data) === null || _a === void 0 ? void 0 : _a.source) !== "GEM_WALLET_MSG_RESPONSE")
            return;
          if (((_b = event === null || event === void 0 ? void 0 : event.data) === null || _b === void 0 ? void 0 : _b.messagedId) !== messageId)
            return;
          resolve(event.data);
          window.removeEventListener("message", messageListener);
        };
        window.addEventListener("message", messageListener, false);
      });
    };
    exports.sendMessageToContentScript = sendMessageToContentScript;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/acceptNFTOffer/acceptNFTOffer.js
var require_acceptNFTOffer = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/acceptNFTOffer/acceptNFTOffer.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.acceptNFTOffer = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var acceptNFTOffer = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_ACCEPT_NFT_OFFER/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.acceptNFTOffer = acceptNFTOffer;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/acceptNFTOffer/index.js
var require_acceptNFTOffer2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/acceptNFTOffer/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_acceptNFTOffer(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/burnNFT/burnNFT.js
var require_burnNFT = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/burnNFT/burnNFT.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.burnNFT = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var burnNFT = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_BURN_NFT/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.burnNFT = burnNFT;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/burnNFT/index.js
var require_burnNFT2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/burnNFT/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_burnNFT(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/cancelNFTOffer/cancelNFTOffer.js
var require_cancelNFTOffer = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/cancelNFTOffer/cancelNFTOffer.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.cancelNFTOffer = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var cancelNFTOffer = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_CANCEL_NFT_OFFER/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.cancelNFTOffer = cancelNFTOffer;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/cancelNFTOffer/index.js
var require_cancelNFTOffer2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/cancelNFTOffer/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_cancelNFTOffer(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/cancelOffer/cancelOffer.js
var require_cancelOffer = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/cancelOffer/cancelOffer.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.cancelOffer = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var cancelOffer = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_CANCEL_OFFER/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.cancelOffer = cancelOffer;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/cancelOffer/index.js
var require_cancelOffer2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/cancelOffer/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_cancelOffer(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/createNFTOffer/createNFTOffer.js
var require_createNFTOffer = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/createNFTOffer/createNFTOffer.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createNFTOffer = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var createNFTOffer = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_CREATE_NFT_OFFER/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.createNFTOffer = createNFTOffer;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/createNFTOffer/index.js
var require_createNFTOffer2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/createNFTOffer/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_createNFTOffer(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/createOffer/createOffer.js
var require_createOffer = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/createOffer/createOffer.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createOffer = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var createOffer = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_CREATE_OFFER/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.createOffer = createOffer;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/createOffer/index.js
var require_createOffer2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/createOffer/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_createOffer(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/on/on.js
var require_on = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/on/on.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.on = void 0;
    var constants_1 = require_constants();
    var on = function(eventType, callback) {
      window.addEventListener("message", function(event) {
        if (event.origin !== window.origin)
          return;
        if (event.source !== window && event.data.app === constants_1.GEM_WALLET)
          return;
        if (!event.data.source || event.data.source !== "GEM_WALLET_MSG_REQUEST")
          return;
        if (event.data.type && event.data.type === eventType) {
          callback(event.data.payload.result);
        }
      });
    };
    exports.on = on;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/on/index.js
var require_on2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/on/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_on(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/helpers/getFavicon.js
var require_getFavicon = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/helpers/getFavicon.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getFavicon = void 0;
    var getFavicon = function() {
      var _a;
      var favicon = (_a = document.querySelector("link[rel*='icon']")) === null || _a === void 0 ? void 0 : _a.getAttribute("href");
      if (favicon) {
        try {
          new URL(favicon);
        } catch (e) {
          favicon = window.location.origin + favicon;
        }
      }
      return favicon;
    };
    exports.getFavicon = getFavicon;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getAddress/getAddress.js
var require_getAddress = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getAddress/getAddress.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getAddress = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var getFavicon_1 = require_getFavicon();
    var getAddress = function() {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, favicon, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              favicon = (0, getFavicon_1.getFavicon)();
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_GET_ADDRESS/V3",
                payload: {
                  url: window.location.origin,
                  title: document.title,
                  favicon
                }
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.getAddress = getAddress;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getAddress/index.js
var require_getAddress2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getAddress/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_getAddress(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getNetwork/getNetwork.js
var require_getNetwork = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getNetwork/getNetwork.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getNetwork = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var getNetwork = function() {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_GET_NETWORK/V3"
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.getNetwork = getNetwork;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getNetwork/index.js
var require_getNetwork2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getNetwork/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_getNetwork(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getNFT/getNFT.js
var require_getNFT = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getNFT/getNFT.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getNFT = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var getFavicon_1 = require_getFavicon();
    var getNFT = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, favicon, message, _a, result, error, parsedError, e_1;
        var _b, _c;
        return __generator(this, function(_d) {
          switch (_d.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _d.label = 1;
            case 1:
              _d.trys.push([1, 3, , 4]);
              favicon = (0, getFavicon_1.getFavicon)();
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_GET_NFT/V3",
                payload: {
                  url: window.location.origin,
                  title: document.title,
                  favicon,
                  limit: (_b = payload === null || payload === void 0 ? void 0 : payload.limit) !== null && _b !== void 0 ? _b : void 0,
                  // Value from a previous paginated response. Resume retrieving data where that response left off.
                  marker: (_c = payload === null || payload === void 0 ? void 0 : payload.marker) !== null && _c !== void 0 ? _c : void 0
                }
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _d.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _d.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.getNFT = getNFT;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getNFT/index.js
var require_getNFT2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getNFT/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_getNFT(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getPublicKey/getPublicKey.js
var require_getPublicKey = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getPublicKey/getPublicKey.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getPublicKey = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var getFavicon_1 = require_getFavicon();
    var getPublicKey = function() {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, favicon, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              favicon = (0, getFavicon_1.getFavicon)();
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_GET_PUBLIC_KEY/V3",
                payload: {
                  url: window.location.origin,
                  title: document.title,
                  favicon
                }
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.getPublicKey = getPublicKey;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getPublicKey/index.js
var require_getPublicKey2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/getPublicKey/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_getPublicKey(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/isInstalled/isInstalled.js
var require_isInstalled = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/isInstalled/isInstalled.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isInstalled = void 0;
    var constants_1 = require_constants();
    var extensionMessaging_1 = require_extensionMessaging();
    var isInstalled = function() {
      if (window.gemWallet) {
        return Promise.resolve({ result: { isInstalled: true } });
      } else {
        var timeoutId_1;
        var abortConnection = new Promise(function(resolve) {
          timeoutId_1 = setTimeout(function() {
            resolve({ result: { isInstalled: false } });
          }, 1e3);
        });
        var connectionToExtension = new Promise(function(resolve) {
          return __awaiter(void 0, void 0, void 0, function() {
            var message, response, e_1;
            return __generator(this, function(_a) {
              switch (_a.label) {
                case 0:
                  _a.trys.push([0, 2, , 3]);
                  message = {
                    app: constants_1.GEM_WALLET,
                    type: "REQUEST_IS_INSTALLED/V3"
                  };
                  return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
                case 1:
                  response = _a.sent();
                  resolve({ result: { isInstalled: response.isInstalled || false } });
                  return [3, 3];
                case 2:
                  e_1 = _a.sent();
                  resolve({ result: { isInstalled: false } });
                  return [3, 3];
                case 3:
                  return [
                    2
                    /*return*/
                  ];
              }
            });
          });
        });
        return Promise.race([abortConnection, connectionToExtension]).then(function(res) {
          clearTimeout(timeoutId_1);
          if (res.result.isInstalled === true) {
            window.gemWallet = true;
          }
          return { result: { isInstalled: res.result.isInstalled } };
        }).catch(function() {
          return { result: { isInstalled: false } };
        });
      }
    };
    exports.isInstalled = isInstalled;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/isInstalled/index.js
var require_isInstalled2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/isInstalled/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_isInstalled(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/mintNFT/mintNFT.js
var require_mintNFT = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/mintNFT/mintNFT.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.mintNFT = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var mintNFT = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_MINT_NFT/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.mintNFT = mintNFT;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/mintNFT/index.js
var require_mintNFT2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/mintNFT/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_mintNFT(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/sendPayment/sendPayment.js
var require_sendPayment = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/sendPayment/sendPayment.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sendPayment = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var sendPayment = function(paymentPayload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_SEND_PAYMENT/V3",
                payload: paymentPayload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.sendPayment = sendPayment;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/sendPayment/index.js
var require_sendPayment2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/sendPayment/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_sendPayment(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setAccount/setAccount.js
var require_setAccount = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setAccount/setAccount.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.setAccount = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var setAccount = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_SET_ACCOUNT/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.setAccount = setAccount;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setAccount/index.js
var require_setAccount2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setAccount/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_setAccount(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setHook/setHook.js
var require_setHook = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setHook/setHook.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.setHook = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var setHook = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_SET_HOOK/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.setHook = setHook;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setHook/index.js
var require_setHook2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setHook/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_setHook(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setRegularKey/setRegularKey.js
var require_setRegularKey = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setRegularKey/setRegularKey.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.setRegularKey = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var setRegularKey = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_SET_REGULAR_KEY/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.setRegularKey = setRegularKey;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setRegularKey/index.js
var require_setRegularKey2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setRegularKey/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_setRegularKey(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setTrustline/setTrustline.js
var require_setTrustline = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setTrustline/setTrustline.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.setTrustline = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var setTrustline = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_SET_TRUSTLINE/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.setTrustline = setTrustline;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setTrustline/index.js
var require_setTrustline2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/setTrustline/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_setTrustline(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/signMessage/signMessage.js
var require_signMessage = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/signMessage/signMessage.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.signMessage = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var getFavicon_1 = require_getFavicon();
    var signMessage = function(message, isHex) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, favicon, messageToContentScript, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              favicon = (0, getFavicon_1.getFavicon)();
              messageToContentScript = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_SIGN_MESSAGE/V3",
                payload: {
                  url: window.location.origin,
                  title: document.title,
                  favicon,
                  message,
                  isHex
                }
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(messageToContentScript)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.signMessage = signMessage;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/signMessage/index.js
var require_signMessage2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/signMessage/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_signMessage(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/signTransaction/signTransaction.js
var require_signTransaction = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/signTransaction/signTransaction.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.signTransaction = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var signTransaction = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_SIGN_TRANSACTION/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.signTransaction = signTransaction;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/signTransaction/index.js
var require_signTransaction2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/signTransaction/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_signTransaction(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/submitTransaction/submitTransaction.js
var require_submitTransaction = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/submitTransaction/submitTransaction.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.submitTransaction = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var submitTransaction = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_SUBMIT_TRANSACTION/V3",
                payload
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.submitTransaction = submitTransaction;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/submitTransaction/index.js
var require_submitTransaction2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/submitTransaction/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_submitTransaction(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/submitBulkTransactions/submitBulkTransactions.js
var require_submitBulkTransactions = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/submitBulkTransactions/submitBulkTransactions.js"(exports) {
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
    var __generator = exports && exports.__generator || function(thisArg, body) {
      var _ = { label: 0, sent: function() {
        if (t[0] & 1) throw t[1];
        return t[1];
      }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
      }), g;
      function verb(n) {
        return function(v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.submitBulkTransactions = void 0;
    var constants_1 = require_constants();
    var errors_1 = require_errors();
    var extensionMessaging_1 = require_extensionMessaging();
    var MAX_TRANSACTIONS = 50;
    var submitBulkTransactions = function(payload) {
      return __awaiter(void 0, void 0, void 0, function() {
        var response, message, _a, result, error, parsedError, e_1;
        return __generator(this, function(_b) {
          switch (_b.label) {
            case 0:
              response = {
                type: "reject",
                result: void 0
              };
              if (!payload.transactions) {
                throw new Error(constants_1.API_ERROR_BAD_REQUEST);
              }
              if (payload.transactions.length === 0 || payload.transactions.length > MAX_TRANSACTIONS) {
                throw new Error("Invalid number of transactions (must be between 1 and ".concat(MAX_TRANSACTIONS, ")"));
              }
              _b.label = 1;
            case 1:
              _b.trys.push([1, 3, , 4]);
              message = {
                app: constants_1.GEM_WALLET,
                type: "REQUEST_SUBMIT_BULK_TRANSACTIONS/V3",
                payload: __assign(__assign({}, payload), {
                  // Add an index to each transaction so that we can process them in order
                  transactions: payload.transactions.reduce(function(acc, transaction, index) {
                    acc[index] = transaction;
                    return acc;
                  }, {})
                })
              };
              return [4, (0, extensionMessaging_1.sendMessageToContentScript)(message)];
            case 2:
              _a = _b.sent(), result = _a.result, error = _a.error;
              parsedError = error ? (0, errors_1.deserializeError)(error) : void 0;
              if (parsedError) {
                throw parsedError;
              }
              if (result) {
                response.type = "response";
                response.result = result;
              }
              return [3, 4];
            case 3:
              e_1 = _b.sent();
              throw e_1;
            case 4:
              return [2, response];
          }
        });
      });
    };
    exports.submitBulkTransactions = submitBulkTransactions;
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/submitBulkTransactions/index.js
var require_submitBulkTransactions2 = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/submitBulkTransactions/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_submitBulkTransactions(), exports);
  }
});

// node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/index.js
var require_api = __commonJS({
  "node_modules/.pnpm/@gemwallet+api@3.8.0/node_modules/@gemwallet/api/index.js"(exports) {
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
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_acceptNFTOffer2(), exports);
    __exportStar(require_burnNFT2(), exports);
    __exportStar(require_cancelNFTOffer2(), exports);
    __exportStar(require_cancelOffer2(), exports);
    __exportStar(require_createNFTOffer2(), exports);
    __exportStar(require_createOffer2(), exports);
    __exportStar(require_on2(), exports);
    __exportStar(require_getAddress2(), exports);
    __exportStar(require_getNetwork2(), exports);
    __exportStar(require_getNFT2(), exports);
    __exportStar(require_getPublicKey2(), exports);
    __exportStar(require_isInstalled2(), exports);
    __exportStar(require_mintNFT2(), exports);
    __exportStar(require_sendPayment2(), exports);
    __exportStar(require_setAccount2(), exports);
    __exportStar(require_setHook2(), exports);
    __exportStar(require_setRegularKey2(), exports);
    __exportStar(require_setTrustline2(), exports);
    __exportStar(require_signMessage2(), exports);
    __exportStar(require_signTransaction2(), exports);
    __exportStar(require_submitTransaction2(), exports);
    __exportStar(require_submitBulkTransactions2(), exports);
  }
});
export default require_api();
//# sourceMappingURL=@gemwallet_api.js.map

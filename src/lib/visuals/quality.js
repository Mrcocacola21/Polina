"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_VISUAL_QUALITY = exports.VISUAL_QUALITY = void 0;
exports.VISUAL_QUALITY = Object.freeze({
    HIGH: Object.freeze({ dprCap: 2, particleScale: 1 }),
    MEDIUM: Object.freeze({ dprCap: 1.5, particleScale: 0.7 }),
    LOW: Object.freeze({ dprCap: 1, particleScale: 0.4 }),
});
exports.DEFAULT_VISUAL_QUALITY = "MEDIUM";
